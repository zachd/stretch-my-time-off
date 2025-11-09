import type { Holiday, ConsecutiveDaysOff } from '../types';
import { getHolidaysForYear, optimizeDaysOff, calculateConsecutiveDaysOff } from '../holidayUtils';
import { getHiddenHolidays, setHiddenHoliday, isHolidayHidden as checkHolidayHidden } from '../utils';

export function updateHolidays(
    selectedCountryCode: string,
    selectedStateCode: string,
    year: number,
    daysOff: number,
    weekendDays: number[]
): {
    holidays: Holiday[];
    optimizedDaysOff: Date[];
    consecutiveDaysOff: ConsecutiveDaysOff[];
} {
    if (selectedCountryCode) {
        const allHolidays = getHolidaysForYear(selectedCountryCode, year, selectedStateCode);
        const holidays = allHolidays.map(holiday => ({
            ...holiday,
            date: new Date(holiday.date),
            hidden: checkHolidayHidden(holiday, selectedCountryCode)
        }));
        
        const visibleHolidays = holidays.filter(h => !h.hidden);
        const optimizedDaysOff = optimizeDaysOff(visibleHolidays, year, daysOff, weekendDays);
        const consecutiveDaysOff = calculateConsecutiveDaysOff(visibleHolidays, optimizedDaysOff, year, weekendDays);
        
        return { holidays, optimizedDaysOff, consecutiveDaysOff };
    } else {
        return { holidays: [], optimizedDaysOff: [], consecutiveDaysOff: [] };
    }
}

export function toggleHolidayVisibility(
    holiday: Holiday,
    selectedCountryCode: string,
    holidays: Holiday[]
): Holiday[] {
    if (!selectedCountryCode) return holidays;

    const hiddenHolidays = getHiddenHolidays(selectedCountryCode);
    const isHidden = !hiddenHolidays[holiday.date.toString()];
    
    setHiddenHoliday(selectedCountryCode, holiday.date, isHidden);

    return holidays.map(h => {
        if (h.date.getTime() === holiday.date.getTime()) {
            return { ...h, hidden: isHidden };
        }
        return h;
    });
}

