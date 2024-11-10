import Holidays from 'date-holidays';

// getHolidaysForYear(countryCode: string, year: number): { date: Date, name: string }[]
export function getHolidaysForYear(countryCode, year) {
    const hd = new Holidays(countryCode);
    return hd.getHolidays(year)
        .filter(holiday => holiday.type === 'public')
        .map(holiday => ({
            date: new Date(holiday.date),
            name: holiday.name
        }));
}

// optimizeDaysOff(holidays: { date: Date, name: string }[], year: number, daysOff: number): Date[]
export function optimizeDaysOff(holidays, year, daysOff) {
    const weekends = getWeekends(year);
    const allDaysOff = [...holidays.map(h => h.date), ...weekends];
    allDaysOff.sort((a, b) => a - b);

    const gaps = findGaps(allDaysOff, year);
    const rankedGaps = rankGapsByEfficiency(gaps);

    return selectDaysOff(rankedGaps, daysOff, allDaysOff);
}

// calculateConsecutiveDaysOff(holidays: { date: Date, name: string }[], optimizedDaysOff: Date[], year: number): { startDate: string, endDate: string, includesHoliday: boolean, message: string }[]
export function calculateConsecutiveDaysOff(holidays, optimizedDaysOff, year) {
    let consecutiveDaysOff = [];
    const allDays = [...holidays.map(h => h.date), ...optimizedDaysOff];
    allDays.sort((a, b) => a - b);

    let currentGroup = [];
    let includesHoliday = false;

    for (let month = 0; month < 12; month++) {
        for (let day = 1; day <= 31; day++) {
            const date = new Date(year, month, day);
            if (date.getMonth() !== month) break;

            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isHoliday = holidays.some(h => h.date.getTime() === date.getTime());
            const isDayOff = optimizedDaysOff.some(d => d.getTime() === date.getTime());

            if (isWeekend || isHoliday || isDayOff) {
                currentGroup.push(date);
                if (isHoliday) includesHoliday = true;
            } else if (currentGroup.length > 0) {
                if (currentGroup.some(d => optimizedDaysOff.some(od => od.getTime() === d.getTime()))) {
                    const startDate = currentGroup[0];
                    const endDate = currentGroup[currentGroup.length - 1];
                    const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24) + 1);
                    const usedDaysOff = currentGroup.filter(d => optimizedDaysOff.some(od => od.getTime() === d.getTime())).length;
                    const message = `${usedDaysOff} days off -> ${totalDays} days`;

                    consecutiveDaysOff.push({
                        startDate: formatDate(startDate),
                        endDate: formatDate(endDate),
                        includesHoliday,
                        message
                    });
                }
                currentGroup = [];
                includesHoliday = false;
            }
        }
    }

    if (currentGroup.length > 0 && currentGroup.some(d => optimizedDaysOff.some(od => od.getTime() === d.getTime()))) {
        const startDate = currentGroup[0];
        const endDate = currentGroup[currentGroup.length - 1];
        const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24) + 1);
        const usedDaysOff = currentGroup.filter(d => optimizedDaysOff.some(od => od.getTime() === d.getTime())).length;
        const message = `${usedDaysOff} day off turns into ${totalDays} days off`;

        consecutiveDaysOff.push({
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            includesHoliday,
            message
        });
    }

    return consecutiveDaysOff;
}

function getWeekends(year) {
    const weekends = [];
    for (let month = 0; month < 12; month++) {
        for (let day = 1; day <= 31; day++) {
            const date = new Date(year, month, day);
            if (date.getMonth() !== month) break;
            if (date.getDay() === 0 || date.getDay() === 6) {
                weekends.push(date);
            }
        }
    }
    return weekends;
}

function findGaps(allDaysOff, year) {
    const gaps = [];
    for (let i = 0; i < allDaysOff.length - 1; i++) {
        const start = allDaysOff[i];
        const end = allDaysOff[i + 1];
        const gapLength = (end - start) / (1000 * 60 * 60 * 24) - 1;
        if (gapLength > 0 && gapLength <= 4) {
            gaps.push({ start, end, gapLength });
        }
    }
    return gaps;
}

function rankGapsByEfficiency(gaps) {
    return gaps.map(gap => {
        const potentialChainLength = gap.gapLength + 2; // including weekends/holidays
        const efficiency = potentialChainLength / gap.gapLength;
        return { ...gap, potentialChainLength, efficiency };
    }).sort((a, b) => b.efficiency - a.efficiency);
}

function selectDaysOff(rankedGaps, daysOff, allDaysOff) {
    const selectedDays = [];
    const allDaysOffSet = new Set(allDaysOff.map(date => date.getTime()));

    for (const gap of rankedGaps) {
        for (let i = 1; i <= gap.gapLength && daysOff > 0; i++) {
            const potentialDayOff = new Date(gap.start);
            potentialDayOff.setDate(potentialDayOff.getDate() + i);

            // Ensure the day is not a weekend or holiday
            if (!allDaysOffSet.has(potentialDayOff.getTime()) && potentialDayOff.getDay() !== 0 && potentialDayOff.getDay() !== 6) {
                selectedDays.push(potentialDayOff);
                daysOff--;
            }
        }
        if (daysOff <= 0) break;
    }
    return selectedDays;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}