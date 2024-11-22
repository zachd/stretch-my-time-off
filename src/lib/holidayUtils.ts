import Holidays from 'date-holidays';

// Constants
const MS_IN_A_DAY = 86400000;
const MAX_GAP_LENGTH = 5;

// Helper function to check if a date is a weekend
const isWeekend = (date: Date): boolean => date.getDay() === 0 || date.getDay() === 6;

// Helper function to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date): boolean => 
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();

// Helper function to generate a unique key for a date
const dateKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

// Helper function to check if a date is a holiday
const isHoliday = (date: Date, holidays: { date: Date }[]): boolean => holidays.some(h => isSameDay(h.date, date));

// Helper function to check if a date is a day off
const isDayOff = (date: Date, allDaysOffSet: Set<string>): boolean => allDaysOffSet.has(dateKey(date));

// Helper function to calculate the number of days between two dates
const daysBetween = (startDate: Date, endDate: Date): number => Math.round((endDate.getTime() - startDate.getTime()) / MS_IN_A_DAY);

// Helper function to format a date
const formatDate = (date: Date): string => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Get holidays for a specific year and country
export function getHolidaysForYear(countryCode: string, year: number, stateCode?: string): { date: Date; name: string }[] {
    // The date-holidays lib has translations for many holidays, but defaults to using the language of the country.
    // We can pass in the browser's preferred languages (though the lib doesn't fall back, e.g. from `de-AT` to `de`)
    const languages = navigator.languages.map(lang => lang.split('-')[0]);
    // Start/end dates are returned in that country/state's time zone, so we need to provide our time zone to localise
    const opts = { languages, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    const hd = stateCode ? new Holidays(countryCode, stateCode, opts) : new Holidays(countryCode, opts);
    return hd.getHolidays(year)
        .filter(holiday => holiday.type === 'public')
        .flatMap(holiday =>
            // To handle single- and multi-day holidays, we generate a holiday entry for each day in the period
            Array.from({ length: daysBetween(holiday.start, holiday.end) }, (_, i) => ({
                date: new Date(holiday.start.getFullYear(), holiday.start.getMonth(), holiday.start.getDate() + i),
                name: holiday.name,
            }))
        );
}

// Optimize days off to create the longest possible chains
export function optimizeDaysOff(holidays: { date: Date }[], year: number, daysOff: number): Date[] {
    const currentYearHolidays = holidays.filter(h => h.date.getFullYear() === year);
    const weekends = getWeekends(year);
    const allDaysOffSet = new Set([
        ...currentYearHolidays.map(h => dateKey(h.date)),
        ...weekends.map(d => dateKey(d))
    ]);

    let rankedGaps = rankGapsByEfficiency(findGaps(allDaysOffSet, year), allDaysOffSet);

    return selectDaysOff(rankedGaps, daysOff, allDaysOffSet, year);
}

// Calculate consecutive days off
export function calculateConsecutiveDaysOff(holidays: { date: Date }[], optimizedDaysOff: Date[], year: number): { startDate: Date; endDate: Date; usedDaysOff: number; totalDays: number }[] {
    const allDaysOffSet = new Set([...holidays.map(h => dateKey(h.date)), ...optimizedDaysOff.map(d => dateKey(d))]);
    const consecutiveDaysOff: { startDate: Date; endDate: Date; usedDaysOff: number; totalDays: number }[] = [];
    let currentGroup: Date[] = [];
    
    for (let month = 0; month < 12; month++) {
        for (let day = 1; day <= 31; day++) {
            const date = new Date(year, month, day);
            if (date.getMonth() !== month) break;

            if (isWeekend(date) || isHoliday(date, holidays) || isDayOff(date, allDaysOffSet)) {
                currentGroup.push(date);
            } else {
                if (currentGroup.length > 2) {
                    addConsecutiveDaysOff(consecutiveDaysOff, currentGroup, optimizedDaysOff);
                }
                currentGroup = [];
            }
        }
    }

    if (currentGroup.length > 2) {
        addConsecutiveDaysOff(consecutiveDaysOff, currentGroup, optimizedDaysOff);
    }

    return consecutiveDaysOff;
}

// Get all weekends for a specific year
function getWeekends(year: number): Date[] {
    const weekends: Date[] = [];
    for (let month = 0; month < 12; month++) {
        for (let day = 1; day <= 31; day++) {
            const date = new Date(year, month, day);
            if (date.getMonth() !== month) break;
            if (isWeekend(date)) weekends.push(date);
        }
    }
    return weekends;
}

// Find gaps between days off
function findGaps(allDaysOffSet: Set<string>, year: number): { start: Date; end: Date; gapLength: number }[] {
    const gaps: { start: Date; end: Date; gapLength: number }[] = [];
    let currentGapStart: Date | null = null;

    for (let month = 0; month < 12; month++) {
        for (let day = 1; day <= 31; day++) {
            const date = new Date(year, month, day);
            if (date.getMonth() !== month) break;

            const isDayOff = allDaysOffSet.has(dateKey(date));

            if (!isDayOff && !isWeekend(date)) {
                if (!currentGapStart) currentGapStart = date;
            } else if (currentGapStart) {
                const gapLength = daysBetween(currentGapStart, date);
                if (gapLength > 0 && gapLength <= MAX_GAP_LENGTH) {
                    gaps.push({ start: currentGapStart, end: new Date(date.getTime() - MS_IN_A_DAY), gapLength });
                }
                currentGapStart = null;
            }
        }
    }

    if (currentGapStart) {
        const lastDayOfYear = new Date(year, 11, 31);
        const gapLength = daysBetween(currentGapStart, lastDayOfYear) + 1;
        if (gapLength > 0 && gapLength <= MAX_GAP_LENGTH) {
            gaps.push({ start: currentGapStart, end: lastDayOfYear, gapLength });
        }
    }

    return gaps;
}

// Rank gaps by efficiency
function rankGapsByEfficiency(gaps: { start: Date; end: Date; gapLength: number }[], allDaysOffSet: Set<string>): any[] {
    return gaps.map(gap => {
        const backward = calculateChain(gap.start, gap.gapLength, allDaysOffSet, 'backward');
        const forward = calculateChain(gap.end, gap.gapLength, allDaysOffSet, 'forward');

        return forward.chainLength > backward.chainLength || (forward.chainLength === backward.chainLength && forward.usedDaysOff <= backward.usedDaysOff)
            ? { ...gap, ...forward, fillFrom: 'end' }
            : { ...gap, ...backward, fillFrom: 'start' };
    }).sort((a, b) => a.gapLength - b.gapLength || b.chainLength - a.chainLength || a.usedDaysOff - b.usedDaysOff);
}

// Calculate potential chain length and days off used
function calculateChain(startDate: Date, gapLength: number, allDaysOffSet: Set<string>, direction: 'backward' | 'forward'): { chainLength: number; usedDaysOff: number } {
    let chainLength = gapLength;
    let usedDaysOff = 0;
    let currentDate = new Date(startDate);

    const increment = direction === 'backward' ? -1 : 1;
    const boundaryCheck = direction === 'backward' ? -MS_IN_A_DAY : MS_IN_A_DAY;

    while (allDaysOffSet.has(dateKey(new Date(currentDate.getTime() + boundaryCheck))) || isWeekend(new Date(currentDate.getTime() + boundaryCheck))) {
        chainLength++;
        currentDate.setDate(currentDate.getDate() + increment);
    }

    for (let i = 0; i < gapLength; i++) {
        const potentialDayOff = new Date(startDate);
        potentialDayOff.setDate(potentialDayOff.getDate() + (i * increment));
        if (!allDaysOffSet.has(dateKey(potentialDayOff)) && !isWeekend(potentialDayOff)) {
            usedDaysOff++;
        }
    }

    return { chainLength, usedDaysOff };
}

// Select days off based on ranked gaps
function selectDaysOff(rankedGaps: any[], daysOff: number, allDaysOffSet: Set<string>, year: number): Date[] {
    const selectedDays: Date[] = [];

    while (daysOff > 0 && rankedGaps.length > 0) {
        const gap = rankedGaps.shift();

        const increment = gap.fillFrom === 'start' ? 1 : -1;
        const startDate = gap.fillFrom === 'start' ? gap.start : gap.end;

        for (let i = 0; i < gap.gapLength && daysOff > 0; i++) {
            const potentialDayOff = new Date(startDate);
            potentialDayOff.setDate(potentialDayOff.getDate() + (i * increment));

            if (!allDaysOffSet.has(dateKey(potentialDayOff)) && !isWeekend(potentialDayOff)) {
                selectedDays.push(potentialDayOff);
                allDaysOffSet.add(dateKey(potentialDayOff));
                daysOff--;
            }
        }

        const newGaps = findGaps(allDaysOffSet, year);
        rankedGaps = rankGapsByEfficiency(newGaps, allDaysOffSet);
    }

    return selectedDays;
}

// Add consecutive days off to the list
function addConsecutiveDaysOff(consecutiveDaysOff: { startDate: Date; endDate: Date; usedDaysOff: number; totalDays: number }[], currentGroup: Date[], optimizedDaysOff: Date[]) {
    const startDate = currentGroup[0];
    const endDate = currentGroup[currentGroup.length - 1];
    const totalDays = daysBetween(startDate, endDate) + 1;
    const usedDaysOff = currentGroup.filter(d => isDayOff(d, new Set(optimizedDaysOff.map(d => dateKey(d))))).length;

    if (totalDays > 2) {
        consecutiveDaysOff.push({
            startDate,
            endDate,
            usedDaysOff,
            totalDays
        });
    }
}