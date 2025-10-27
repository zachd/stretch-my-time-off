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
export function optimizeDaysOff(holidays: { date: Date }[], chosen: Date[], daysOff: number, weekendDays: number[] = [0, 6], startDate: Date, expiryDate: Date, excluded: Date[] = []): Date[] {
    // Filter holidays and chosen days by the date range
    const filteredHolidays = holidays.filter(h => h.date >= startDate && h.date <= expiryDate);
    const filteredChosen = chosen.filter(h => h >= startDate && h <= expiryDate);
    const filteredExcluded = excluded.filter(h => h >= startDate && h <= expiryDate);
    
    // Get weekends for the entire date range (may span multiple years)
    const weekends = getWeekendsInRange(startDate, expiryDate, weekendDays);
    
    // For gap calculation, DON'T include excluded days - they're working days you must attend
    // Including them would make the algorithm think adjacent days are good to take off
    const allDaysOff = new Set([
        ...filteredHolidays.map(h => dateKey(h.date)),
        ...filteredChosen.map(h => dateKey(h)),
        ...weekends.map(d => dateKey(d))
    ]);

    // Find and rank gaps based on holidays/weekends/chosen days only
    const gaps = findGaps(allDaysOff, startDate, expiryDate, weekendDays);
    const excludedKeys = new Set(filteredExcluded.map(d => dateKey(d)));
    
    // Select days but skip any excluded days (they're unavailable)
    return selectDaysOff(rankGapsByEfficiency(gaps, allDaysOff, weekendDays), daysOff, allDaysOff, chosen, weekendDays, startDate, expiryDate, excludedKeys);
}

// Calculate periods of consecutive days off (weekends + holidays + PTO)
export function calculateConsecutiveDaysOff(holidays: { date: Date }[], optimizedDaysOff: Date[], weekendDays: number[] = [0, 6], startDate: Date, expiryDate: Date, chosenDaysOff: Date[] = []) {
    const weekends = getWeekendsInRange(startDate, expiryDate, weekendDays);
    const allDaysOff = new Set([
        ...holidays.map(h => dateKey(h.date)),
        ...optimizedDaysOff.map(d => dateKey(d)),
        ...chosenDaysOff.map(d => dateKey(d)), // Include chosen days
        ...weekends.map(d => dateKey(d))
    ]);

    const consecutiveDaysOff = [];
    let currentGroup = [];

    for (let d = new Date(startDate); d <= expiryDate; d.setDate(d.getDate() + 1)) {
        if (isWeekend(d, weekendDays) || isHoliday(d, holidays) || allDaysOff.has(dateKey(d))) {
            currentGroup.push(new Date(d));
        } else if (currentGroup.length > 0) {
            if (isValidConsecutiveGroup(currentGroup, weekendDays)) {
                consecutiveDaysOff.push(createPeriod(currentGroup, optimizedDaysOff, weekendDays));
            }
            currentGroup = [];
        }
    }

    if (currentGroup.length > 0 && isValidConsecutiveGroup(currentGroup, weekendDays)) {
        consecutiveDaysOff.push(createPeriod(currentGroup, optimizedDaysOff, weekendDays));
    }

    return consecutiveDaysOff;
}

// Get all weekend days within a date range
function getWeekendsInRange(startDate: Date, endDate: Date, weekendDays: number[]): Date[] {
    const weekends = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (isWeekend(d, weekendDays)) {
            weekends.push(new Date(d));
        }
    }
    return weekends;
}

// Find gaps between days off that could be filled with PTO
function findGaps(allDaysOff: Set<string>, searchStart: Date, searchEnd: Date, weekendDays: number[]) {
    const gaps = [];
    let gapStart = null;

    for (let d = new Date(searchStart); d <= searchEnd; d.setDate(d.getDate() + 1)) {
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
function selectDaysOff(rankedGaps: any[], daysOff: number, allDaysOff: Set<string>, chosen: Date[], weekendDays: number[], startDate: Date, expiryDate: Date, excludedKeys: Set<string> = new Set()): Date[] {
    // Filter chosen days by start and expiry dates
    const validChosenDays = chosen.filter(d => d >= startDate && d <= expiryDate);
    
    // Only return optimized days, not chosen days
    const optimizedDays: Date[] = [];
    let remainingDays = daysOff - validChosenDays.length;
    const chosenSet = new Set(chosen.map(h => dateKey(h)));

    for (const gap of rankedGaps) {
        if (remainingDays <= 0) break;

        const increment = gap.fillFrom === 'start' ? 1 : -1;
        const startDay = gap.fillFrom === 'start' ? gap.start : gap.end;

        for (let i = 0; i < gap.gapLength && remainingDays > 0; i++) {
            const day = new Date(startDay);
            day.setDate(day.getDate() + (i * increment));
            
            // Skip days outside the date range
            if (day < startDate || day > expiryDate) {
                continue;
            }
            
            // Skip excluded days - they're working days that must be attended
            const dayKey = dateKey(day);
            if (!chosenSet.has(dayKey) && !allDaysOff.has(dayKey) && !isWeekend(day, weekendDays) && !excludedKeys.has(dayKey)) {
                optimizedDays.push(day);
                remainingDays--;
            }
        }
    }

    return optimizedDays;
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
function createPeriod(group: Date[], optimizedDaysOff: Date[], weekendDays: number[]) {
    // Find first and last non-weekend days for display
    let displayStart = group[0];
    let displayEnd = group[group.length - 1];
    
    // Trim leading weekends
    for (let i = 0; i < group.length; i++) {
        if (!weekendDays.includes(group[i].getDay())) {
            displayStart = group[i];
            break;
        }
    }
    
    // Trim trailing weekends
    for (let i = group.length - 1; i >= 0; i--) {
        if (!weekendDays.includes(group[i].getDay())) {
            displayEnd = group[i];
            break;
        }
    }
    
    return {
        startDate: displayStart,
        endDate: displayEnd,
        totalDays: daysBetween(displayStart, displayEnd) + 1,
        fullConsecutiveDays: daysBetween(group[0], group[group.length - 1]) + 1, // Full period including all weekends
        usedDaysOff: group.filter(d => optimizedDaysOff.some(od => dateKey(od) === dateKey(d))).length
    };
}
