import Holidays from 'date-holidays';

// Constants
const MS_IN_A_DAY = 86400000;
const MAX_GAP_LENGTH = 5;

// Helper function to check if a date is a weekend
const isWeekend = date => date.getDay() === 0 || date.getDay() === 6;

// Helper function to check if two dates are the same day
const isSameDay = (date1, date2) => 
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();

// Helper function to generate a unique key for a date
const dateKey = date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

// Helper function to check if a date is a holiday
const isHoliday = (date, holidays) => holidays.some(h => isSameDay(h.date, date));

// Helper function to check if a date is a day off
const isDayOff = (date, allDaysOffSet) => allDaysOffSet.has(dateKey(date));

// Helper function to calculate the number of days between two dates
const daysBetween = (startDate, endDate) => Math.round((endDate - startDate) / MS_IN_A_DAY);

// Helper function to format a date
const formatDate = date => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Get holidays for a specific year and country
export function getHolidaysForYear(countryCode, year) {
    const hd = new Holidays(countryCode);
    return hd.getHolidays(year)
        .filter(holiday => holiday.type === 'public')
        .map(holiday => ({
            date: new Date(holiday.date),
            name: holiday.name
        }));
}

// Optimize days off to create the longest possible chains
export function optimizeDaysOff(holidays, year, daysOff) {
    const weekends = getWeekends(year);
    const allDaysOffSet = new Set([...holidays.map(h => dateKey(h.date)), ...weekends.map(d => dateKey(d))]);

    let rankedGaps = rankGapsByEfficiency(findGaps(allDaysOffSet, year), allDaysOffSet);

    return selectDaysOff(rankedGaps, daysOff, allDaysOffSet);
}

// Calculate consecutive days off
export function calculateConsecutiveDaysOff(holidays, optimizedDaysOff, year) {
    const allDays = [...holidays.map(h => h.date), ...optimizedDaysOff];
    allDays.sort((a, b) => a - b);

    return findConsecutiveDaysOff(allDays, holidays, optimizedDaysOff);
}

// Get all weekends for a specific year
function getWeekends(year) {
    const weekends = [];
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
function findGaps(allDaysOffSet, year) {
    const gaps = [];
    let currentGapStart = null;

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
function rankGapsByEfficiency(gaps, allDaysOffSet) {
    return gaps.map(gap => {
        const backward = calculateChain(gap.start, gap.gapLength, allDaysOffSet, 'backward');
        const forward = calculateChain(gap.end, gap.gapLength, allDaysOffSet, 'forward');

        return forward.chainLength > backward.chainLength || (forward.chainLength === backward.chainLength && forward.usedDaysOff <= backward.usedDaysOff)
            ? { ...gap, ...forward, fillFrom: 'end' }
            : { ...gap, ...backward, fillFrom: 'start' };
    }).sort((a, b) => a.gapLength - b.gapLength || b.chainLength - a.chainLength || a.usedDaysOff - b.usedDaysOff);
}

// Calculate potential chain length and days off used
function calculateChain(startDate, gapLength, allDaysOffSet, direction) {
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
function selectDaysOff(rankedGaps, daysOff, allDaysOffSet) {
    const selectedDays = [];

    while (daysOff > 0 && rankedGaps.length > 0) {
        const gap = rankedGaps.shift(); // Get the highest-ranked gap

        // Determine the direction and starting point for filling the gap
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

        // Recalculate gaps and re-rank them after each assignment
        const newGaps = findGaps(allDaysOffSet, new Date().getFullYear());
        rankedGaps = rankGapsByEfficiency(newGaps, allDaysOffSet);
    }

    return selectedDays;
}

// Find consecutive days off
function findConsecutiveDaysOff(allDays, holidays, optimizedDaysOff) {
    let consecutiveDaysOff = [];
    let currentGroup = [];
    let includesHoliday = false;

    allDays.forEach(date => {
        if (isWeekend(date) || isHoliday(date, holidays) || isDayOff(date, new Set(optimizedDaysOff.map(d => dateKey(d))))) {
            currentGroup.push(date);
            if (isHoliday(date, holidays)) includesHoliday = true;
        } else if (currentGroup.length > 0) {
            addConsecutiveDaysOff(consecutiveDaysOff, currentGroup, optimizedDaysOff, includesHoliday);
            currentGroup = [];
            includesHoliday = false;
        }
    });

    if (currentGroup.length > 0) {
        addConsecutiveDaysOff(consecutiveDaysOff, currentGroup, optimizedDaysOff, includesHoliday);
    }

    return consecutiveDaysOff;
}

// Add consecutive days off to the list
function addConsecutiveDaysOff(consecutiveDaysOff, currentGroup, optimizedDaysOff, includesHoliday) {
    if (currentGroup.some(d => isDayOff(d, new Set(optimizedDaysOff.map(d => dateKey(d)))))) {
        const startDate = currentGroup[0];
        const endDate = currentGroup[currentGroup.length - 1];
        const totalDays = daysBetween(startDate, endDate) + 1;
        const usedDaysOff = currentGroup.filter(d => isDayOff(d, new Set(optimizedDaysOff.map(d => dateKey(d))))).length;
        const message = `${usedDaysOff} days off -> ${totalDays} days`;

        consecutiveDaysOff.push({
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            includesHoliday,
            message
        });
    }
}