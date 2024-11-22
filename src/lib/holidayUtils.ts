import Holidays from 'date-holidays';

const MS_IN_A_DAY = 86400000;
const MAX_GAP_LENGTH = 5;

// Core date helper functions
const dateKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const isWeekend = (date: Date, weekendDays: number[]): boolean => weekendDays.includes(date.getDay());
const isHoliday = (date: Date, holidays: { date: Date }[]): boolean => holidays.some(h => dateKey(h.date) === dateKey(date));
const daysBetween = (start: Date, end: Date): number => Math.round((end.getTime() - start.getTime()) / MS_IN_A_DAY);

// Get holidays for a year, handling multi-day holidays and timezone differences
export function getHolidaysForYear(countryCode: string, year: number, stateCode?: string): { date: Date; name: string }[] {
    // Use browser's languages and timezone to get localized holiday names
    const opts = { 
        languages: navigator.languages.map(lang => lang.split('-')[0]),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone 
    };
    const hd = stateCode ? new Holidays(countryCode, stateCode, opts) : new Holidays(countryCode, opts);
    
    return hd.getHolidays(year)
        .filter(holiday => holiday.type === 'public')
        .flatMap(holiday => Array.from(
            { length: daysBetween(holiday.start, holiday.end) }, 
            (_, i) => ({
                date: new Date(holiday.start.getFullYear(), holiday.start.getMonth(), holiday.start.getDate() + i),
                name: holiday.name,
            })
        ))
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.name.localeCompare(b.name));
}

// Find optimal placement of PTO days to maximize consecutive time off
export function optimizeDaysOff(holidays: { date: Date }[], year: number, daysOff: number, weekendDays: number[] = [0, 6]): Date[] {
    const allDaysOff = new Set([
        ...holidays.filter(h => h.date.getFullYear() === year).map(h => dateKey(h.date)),
        ...getWeekends(year, weekendDays).map(d => dateKey(d))
    ]);

    const gaps = findGaps(allDaysOff, year, weekendDays);
    return selectDaysOff(rankGapsByEfficiency(gaps, allDaysOff, weekendDays), daysOff, allDaysOff, weekendDays);
}

// Calculate periods of consecutive days off (weekends + holidays + PTO)
export function calculateConsecutiveDaysOff(holidays: { date: Date }[], optimizedDaysOff: Date[], year: number, weekendDays: number[] = [0, 6]) {
    const allDaysOff = new Set([
        ...holidays.map(h => dateKey(h.date)),
        ...optimizedDaysOff.map(d => dateKey(d)),
        ...getWeekends(year, weekendDays).map(d => dateKey(d))
    ]);

    const consecutiveDaysOff = [];
    let currentGroup = [];

    for (let d = new Date(year, 0, 1); d <= new Date(year, 11, 31); d.setDate(d.getDate() + 1)) {
        if (isWeekend(d, weekendDays) || isHoliday(d, holidays) || allDaysOff.has(dateKey(d))) {
            currentGroup.push(new Date(d));
        } else if (currentGroup.length > 0) {
            if (isValidConsecutiveGroup(currentGroup, weekendDays)) {
                consecutiveDaysOff.push(createPeriod(currentGroup, optimizedDaysOff));
            }
            currentGroup = [];
        }
    }

    if (currentGroup.length > 0 && isValidConsecutiveGroup(currentGroup, weekendDays)) {
        consecutiveDaysOff.push(createPeriod(currentGroup, optimizedDaysOff));
    }

    return consecutiveDaysOff;
}

// Get all weekend days for a year
function getWeekends(year: number, weekendDays: number[]): Date[] {
    const weekends = [];
    for (let d = new Date(year, 0, 1); d <= new Date(year, 11, 31); d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === d.getMonth() && isWeekend(d, weekendDays)) {
            weekends.push(new Date(d));
        }
    }
    return weekends;
}

// Find gaps between days off that could be filled with PTO
function findGaps(allDaysOff: Set<string>, year: number, weekendDays: number[]) {
    const gaps = [];
    let gapStart = null;

    for (let d = new Date(year, 0, 1); d <= new Date(year, 11, 31); d.setDate(d.getDate() + 1)) {
        if (!allDaysOff.has(dateKey(d)) && !isWeekend(d, weekendDays)) {
            if (!gapStart) gapStart = new Date(d);
        } else if (gapStart) {
            const gapLength = daysBetween(gapStart, d);
            if (gapLength > 0 && gapLength <= MAX_GAP_LENGTH) {
                gaps.push({ start: gapStart, end: new Date(d.getTime() - MS_IN_A_DAY), gapLength });
            }
            gapStart = null;
        }
    }
    return gaps;
}

// Rank gaps by how efficiently they can be used to create longer periods off
function rankGapsByEfficiency(gaps: any[], allDaysOff: Set<string>, weekendDays: number[]) {
    return gaps
        .map(gap => {
            const [backward, forward] = ['backward', 'forward'].map(direction => 
                calculateChain(direction === 'backward' ? gap.start : gap.end, gap.gapLength, allDaysOff, direction as 'backward' | 'forward', weekendDays)
            );
            return forward.chainLength > backward.chainLength || 
                   (forward.chainLength === backward.chainLength && forward.usedDaysOff <= backward.usedDaysOff)
                ? { ...gap, ...forward, fillFrom: 'end' }
                : { ...gap, ...backward, fillFrom: 'start' };
        })
        .sort((a, b) => a.gapLength - b.gapLength || b.chainLength - a.chainLength || a.usedDaysOff - b.usedDaysOff);
}

// Calculate potential chain length in either direction from a gap
function calculateChain(date: Date, gapLength: number, allDaysOff: Set<string>, direction: 'backward' | 'forward', weekendDays: number[]) {
    const increment = direction === 'backward' ? -1 : 1;
    let chainLength = gapLength;
    let currentDate = new Date(date);
    
    while (allDaysOff.has(dateKey(new Date(currentDate.getTime() + MS_IN_A_DAY * increment))) || 
           isWeekend(new Date(currentDate.getTime() + MS_IN_A_DAY * increment), weekendDays)) {
        chainLength++;
        currentDate.setDate(currentDate.getDate() + increment);
    }

    return { 
        chainLength, 
        usedDaysOff: Array.from({ length: gapLength }, (_, i) => {
            const d = new Date(date);
            d.setDate(d.getDate() + i * increment);
            return !allDaysOff.has(dateKey(d)) && !isWeekend(d, weekendDays);
        }).filter(Boolean).length
    };
}

// Select optimal days off based on ranked gaps
function selectDaysOff(rankedGaps: any[], daysOff: number, allDaysOff: Set<string>, weekendDays: number[]): Date[] {
    const selectedDays = [];
    let remainingDays = daysOff;

    for (const gap of rankedGaps) {
        if (remainingDays <= 0) break;
        
        const increment = gap.fillFrom === 'start' ? 1 : -1;
        const startDate = gap.fillFrom === 'start' ? gap.start : gap.end;

        for (let i = 0; i < gap.gapLength && remainingDays > 0; i++) {
            const day = new Date(startDate);
            day.setDate(day.getDate() + (i * increment));
            
            if (!allDaysOff.has(dateKey(day)) && !isWeekend(day, weekendDays)) {
                selectedDays.push(day);
                remainingDays--;
            }
        }
    }

    return selectedDays;
}

// Check if a group is valid (2+ days, not just weekends)
function isValidConsecutiveGroup(group: Date[], weekendDays: number[]): boolean {
    // Must be at least 2 days
    if (group.length < 2) return false;

    // Check if ALL days are weekends
    const allDaysAreWeekends = group.every(d => weekendDays.includes(d.getDay()));

    // Valid if not all days are weekends
    return !allDaysAreWeekends;
}

// Create a period object from a group of consecutive days
function createPeriod(group: Date[], optimizedDaysOff: Date[]) {
    return {
        startDate: group[0],
        endDate: group[group.length - 1],
        totalDays: daysBetween(group[0], group[group.length - 1]) + 1,
        usedDaysOff: group.filter(d => optimizedDaysOff.some(od => dateKey(od) === dateKey(d))).length
    };
}