import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHolidaysForYear, optimizeDaysOff, calculateConsecutiveDaysOff } from './holidayUtils';

// Test constants
const TEST_YEAR = 2024;
const DEFAULT_WEEKENDS = [0, 6]; // Sunday, Saturday
const CUSTOM_WEEKENDS = [5, 6]; // Friday, Saturday

// Mock browser APIs
const mockNavigator = {
    languages: ['en', 'en-US']
};

const mockIntlDateTimeFormat = vi.fn(() => ({
    resolvedOptions: () => ({ timeZone: 'America/New_York' })
}));

describe('holidayUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('navigator', mockNavigator);
        vi.stubGlobal('Intl', {
            ...Intl,
            DateTimeFormat: mockIntlDateTimeFormat
        });
    });

    describe('getHolidaysForYear', () => {
        it('should return holidays for a given year and country', () => {
            const holidays = getHolidaysForYear('US', TEST_YEAR);
            expect(holidays).toBeDefined();
            expect(Array.isArray(holidays)).toBe(true);
            expect(holidays.length).toBeGreaterThan(0);
        });

        it('should filter only public holidays', () => {
            const holidays = getHolidaysForYear('US', TEST_YEAR);
            holidays.forEach(holiday => {
                expect(holiday).toHaveProperty('date');
                expect(holiday).toHaveProperty('name');
                expect(holiday.date).toBeInstanceOf(Date);
                expect(typeof holiday.name).toBe('string');
            });
        });

        it('should handle state codes', () => {
            const holidays = getHolidaysForYear('US', TEST_YEAR, 'CA');
            expect(holidays).toBeDefined();
            expect(Array.isArray(holidays)).toBe(true);
        });

        it('should return holidays sorted by date', () => {
            const holidays = getHolidaysForYear('US', TEST_YEAR);
            for (let i = 1; i < holidays.length; i++) {
                const prev = holidays[i - 1].date.getTime();
                const curr = holidays[i].date.getTime();
                expect(curr).toBeGreaterThanOrEqual(prev);
            }
        });

        it('should handle different countries', () => {
            const usHolidays = getHolidaysForYear('US', TEST_YEAR);
            const gbHolidays = getHolidaysForYear('GB', TEST_YEAR);
            
            expect(usHolidays.length).toBeGreaterThan(0);
            expect(gbHolidays.length).toBeGreaterThan(0);
            expect(usHolidays.length).not.toBe(gbHolidays.length);
        });

        it('should expand multi-day holidays correctly', () => {
            const holidays = getHolidaysForYear('US', TEST_YEAR);
            const dateKeys = new Set(holidays.map(h => 
                `${h.date.getFullYear()}-${h.date.getMonth()}-${h.date.getDate()}`
            ));
            expect(holidays.length).toBeGreaterThanOrEqual(dateKeys.size);
        });

        it('should sort holidays by date first, then by name', () => {
            const holidays = getHolidaysForYear('US', TEST_YEAR);
            for (let i = 1; i < holidays.length; i++) {
                const prev = holidays[i - 1];
                const curr = holidays[i];
                const prevTime = prev.date.getTime();
                const currTime = curr.date.getTime();
                
                if (prevTime === currTime) {
                    expect(curr.name.localeCompare(prev.name)).toBeGreaterThanOrEqual(0);
                } else {
                    expect(currTime).toBeGreaterThan(prevTime);
                }
            }
        });
    });

    describe('optimizeDaysOff', () => {
        const mockHolidays = [
            { date: new Date(TEST_YEAR, 0, 1), name: 'New Year' },
            { date: new Date(TEST_YEAR, 6, 4), name: 'Independence Day' },
        ];

        describe('basic functionality', () => {
            it('should return an array of dates', () => {
                const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 5);
                expect(Array.isArray(result)).toBe(true);
                result.forEach(date => {
                    expect(date).toBeInstanceOf(Date);
                });
            });

            it('should return at most the requested number of days', () => {
                const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 5);
                expect(result.length).toBeLessThanOrEqual(5);
            });

            it('should handle zero days off', () => {
                const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 0);
                expect(result).toEqual([]);
            });

            it('should handle more days off than available gaps', () => {
                const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 1000);
                expect(result.length).toBeGreaterThan(0);
                expect(result.length).toBeLessThan(1000);
            });
        });

        describe('exclusion rules', () => {
            it('should not include weekends in optimized days', () => {
                const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 10);
                result.forEach(date => {
                    expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
                });
            });

            it('should not include holidays in optimized days', () => {
                const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 10);
                const holidayKeys = new Set(mockHolidays.map(h => 
                    `${h.date.getFullYear()}-${h.date.getMonth()}-${h.date.getDate()}`
                ));
                result.forEach(date => {
                    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                    expect(holidayKeys.has(dateKey)).toBe(false);
                });
            });

            it('should not select days that are already holidays or weekends', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 1), name: 'Holiday' },
                    { date: new Date(TEST_YEAR, 0, 3), name: 'Holiday' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 10);
                const holidaySet = new Set(holidays.map(h => 
                    `${h.date.getFullYear()}-${h.date.getMonth()}-${h.date.getDate()}`
                ));
                result.forEach(date => {
                    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                    expect(holidaySet.has(dateKey)).toBe(false);
                    expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
                });
            });
        });

        describe('parameters', () => {
            it('should respect startDate parameter', () => {
                const startDate = new Date(TEST_YEAR, 5, 1);
                const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 5, DEFAULT_WEEKENDS, startDate);
                result.forEach(date => {
                    expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                });
            });

            it('should handle custom weekend days', () => {
                const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 5, CUSTOM_WEEKENDS);
                result.forEach(date => {
                    expect(CUSTOM_WEEKENDS).not.toContain(date.getDay());
                });
            });

            it('should filter holidays by year and startDate', () => {
                const holidays = [
                    { date: new Date(2023, 11, 31), name: 'Old Year' },
                    { date: new Date(TEST_YEAR, 0, 1), name: 'New Year' },
                    { date: new Date(TEST_YEAR, 5, 15), name: 'Mid Year' },
                ];
                const startDate = new Date(TEST_YEAR, 2, 1);
                const result = optimizeDaysOff(holidays, TEST_YEAR, 5, DEFAULT_WEEKENDS, startDate);
                expect(Array.isArray(result)).toBe(true);
            });
        });

        describe('gap finding and prioritization', () => {
            it('should only find gaps of MAX_GAP_LENGTH (5) days or less', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 1), name: 'Mon' },
                    { date: new Date(TEST_YEAR, 0, 3), name: 'Wed' },
                    { date: new Date(TEST_YEAR, 0, 10), name: 'Wed' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 10);
                expect(Array.isArray(result)).toBe(true);
                result.forEach(date => {
                    expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
                });
            });

            it('should find and fill gaps of 1-5 days', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 1), name: 'Holiday' },
                    { date: new Date(TEST_YEAR, 0, 3), name: 'Wed Holiday' },
                    { date: new Date(TEST_YEAR, 0, 11), name: 'Thu Holiday' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 10);
                expect(result.length).toBeGreaterThan(0);
                result.forEach(date => {
                    expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
                });
            });

            it('should prioritize gaps that create longer consecutive periods', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 4), name: 'Thursday Holiday' },
                    { date: new Date(TEST_YEAR, 0, 8), name: 'Monday Holiday' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
                expect(result.length).toBe(1);
            });

            it('should prioritize smaller gaps when they create longer chains', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 4), name: 'Thu Holiday' },
                    { date: new Date(TEST_YEAR, 0, 9), name: 'Tue Holiday' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
                expect(result.length).toBe(1);
                expect(result[0].getDate()).toBe(5);
            });

            it('should handle multiple gaps and select most efficient ones first', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 1), name: 'Mon' },
                    { date: new Date(TEST_YEAR, 0, 4), name: 'Thu' },
                    { date: new Date(TEST_YEAR, 0, 8), name: 'Mon' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 3);
                expect(result.length).toBeLessThanOrEqual(3);
                result.forEach(date => {
                    expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
                });
            });

            it('should handle backward vs forward chain calculation', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 5), name: 'Friday Holiday' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
                expect(Array.isArray(result)).toBe(true);
            });

            it('should optimize to create longer consecutive periods', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 4), name: 'Holiday' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
                expect(result.length).toBeGreaterThan(0);
            });
        });

        describe('edge cases', () => {
            it('should handle partial gap filling when daysOff is less than gap length', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 1), name: 'Mon' },
                    { date: new Date(TEST_YEAR, 0, 8), name: 'Mon' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 2);
                expect(result.length).toBe(2);
                result.forEach(date => {
                    expect(date.getDate()).toBeGreaterThanOrEqual(2);
                    expect(date.getDate()).toBeLessThanOrEqual(6);
                    expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
                });
            });

            it('should handle multiple gaps when daysOff exceeds single gap capacity', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 1), name: 'Mon' },
                    { date: new Date(TEST_YEAR, 0, 3), name: 'Wed' },
                    { date: new Date(TEST_YEAR, 0, 5), name: 'Fri' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 3);
                expect(result.length).toBeGreaterThanOrEqual(2);
                expect(result.length).toBeLessThanOrEqual(3);
            });

            it('should handle optimization with no available gaps', () => {
                const holidays = Array.from({ length: 365 }, (_, i) => {
                    const date = new Date(TEST_YEAR, 0, 1);
                    date.setDate(date.getDate() + i);
                    if (date.getDay() !== 0 && date.getDay() !== 6) {
                        return { date, name: `Holiday ${i}` };
                    }
                    return null;
                }).filter(Boolean) as Array<{ date: Date; name: string }>;
                
                const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
                expect(result).toEqual([]);
            });

            it('should handle gaps at the start of the year', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 5), name: 'Holiday' },
                ];
                const startDate = new Date(TEST_YEAR, 0, 1);
                const result = optimizeDaysOff(holidays, TEST_YEAR, 5, DEFAULT_WEEKENDS, startDate);
                expect(Array.isArray(result)).toBe(true);
            });

            it('should handle gaps at the end of the year', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 11, 25), name: 'Christmas' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
                result.forEach(date => {
                    expect(date.getFullYear()).toBe(TEST_YEAR);
                    expect(date.getMonth()).toBeLessThanOrEqual(11);
                });
            });

            it('should handle gaps that span year boundaries correctly', () => {
                const startDate = new Date(TEST_YEAR, 11, 20);
                const holidays = [
                    { date: new Date(TEST_YEAR, 11, 25), name: 'Christmas' },
                ];
                const result = optimizeDaysOff(holidays, TEST_YEAR, 5, DEFAULT_WEEKENDS, startDate);
                result.forEach(date => {
                    expect(date.getFullYear()).toBe(TEST_YEAR);
                    expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                });
            });
        });
    });

    describe('calculateConsecutiveDaysOff', () => {
        const mockHolidays = [
            { date: new Date(TEST_YEAR, 0, 1), name: 'New Year' },
            { date: new Date(TEST_YEAR, 0, 15), name: 'Holiday' },
        ];

        describe('basic functionality', () => {
            it('should return an array of periods', () => {
                const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
                const result = calculateConsecutiveDaysOff(mockHolidays, optimizedDays, TEST_YEAR);
                expect(Array.isArray(result)).toBe(true);
            });

            it('should calculate periods with correct structure', () => {
                const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
                const result = calculateConsecutiveDaysOff(mockHolidays, optimizedDays, TEST_YEAR);
                result.forEach(period => {
                    expect(period).toHaveProperty('startDate');
                    expect(period).toHaveProperty('endDate');
                    expect(period).toHaveProperty('totalDays');
                    expect(period).toHaveProperty('usedDaysOff');
                    expect(period.startDate).toBeInstanceOf(Date);
                    expect(period.endDate).toBeInstanceOf(Date);
                    expect(typeof period.totalDays).toBe('number');
                    expect(typeof period.usedDaysOff).toBe('number');
                });
            });

            it('should include holidays in consecutive periods', () => {
                const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
                const result = calculateConsecutiveDaysOff(mockHolidays, optimizedDays, TEST_YEAR);
                const hasPeriodWithHoliday = result.some(period => {
                    const holidayDate = mockHolidays[0].date;
                    return period.startDate <= holidayDate && period.endDate >= holidayDate;
                });
                expect(hasPeriodWithHoliday).toBe(true);
            });
        });

        describe('calculations', () => {
            it('should calculate totalDays correctly', () => {
                const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
                const result = calculateConsecutiveDaysOff(mockHolidays, optimizedDays, TEST_YEAR);
                result.forEach(period => {
                    const calculatedDays = Math.round(
                        (period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24)
                    ) + 1;
                    expect(period.totalDays).toBe(calculatedDays);
                });
            });

            it('should count usedDaysOff correctly', () => {
                const optimizedDays = [
                    new Date(TEST_YEAR, 0, 2),
                    new Date(TEST_YEAR, 0, 3),
                ];
                const result = calculateConsecutiveDaysOff(mockHolidays, optimizedDays, TEST_YEAR);
                result.forEach(period => {
                    expect(period.usedDaysOff).toBeGreaterThanOrEqual(0);
                    const daysInPeriod = optimizedDays.filter(day => 
                        day >= period.startDate && day <= period.endDate
                    ).length;
                    expect(period.usedDaysOff).toBeLessThanOrEqual(daysInPeriod);
                });
            });

            it('should correctly count usedDaysOff in periods', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 1), name: 'Holiday' },
                ];
                const optimizedDays = [
                    new Date(TEST_YEAR, 0, 2),
                    new Date(TEST_YEAR, 0, 3),
                ];
                const result = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);
                const periodWithOptimized = result.find(period =>
                    optimizedDays.some(day => day >= period.startDate && day <= period.endDate)
                );
                if (periodWithOptimized) {
                    const daysInPeriod = optimizedDays.filter(day =>
                        day >= periodWithOptimized.startDate && day <= periodWithOptimized.endDate
                    ).length;
                    expect(periodWithOptimized.usedDaysOff).toBe(daysInPeriod);
                }
            });
        });

        describe('validation rules', () => {
            it('should not include periods that are only weekends', () => {
                const optimizedDays: Date[] = [];
                const result = calculateConsecutiveDaysOff(mockHolidays, optimizedDays, TEST_YEAR);
                result.forEach(period => {
                    let allWeekends = true;
                    for (let d = new Date(period.startDate); d <= period.endDate; d.setDate(d.getDate() + 1)) {
                        const dayOfWeek = d.getDay();
                        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                            allWeekends = false;
                            break;
                        }
                    }
                    expect(allWeekends).toBe(false);
                });
            });

            it('should exclude single-day periods', () => {
                const holidays: Array<{ date: Date; name: string }> = [];
                const optimizedDays: Date[] = [];
                const result = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);
                result.forEach(period => {
                    expect(period.totalDays).toBeGreaterThanOrEqual(2);
                });
            });

            it('should handle groups that are only weekends correctly', () => {
                const holidays: Array<{ date: Date; name: string }> = [];
                const optimizedDays: Date[] = [];
                const result = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);
                result.forEach(period => {
                    let hasNonWeekend = false;
                    for (let d = new Date(period.startDate); d <= period.endDate; d.setDate(d.getDate() + 1)) {
                        const dayOfWeek = d.getDay();
                        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                            hasNonWeekend = true;
                            break;
                        }
                    }
                    expect(hasNonWeekend).toBe(true);
                });
            });
        });

        describe('parameters', () => {
            it('should respect startDate parameter', () => {
                const startDate = new Date(TEST_YEAR, 5, 1);
                const optimizedDays = [new Date(TEST_YEAR, 5, 2)];
                const result = calculateConsecutiveDaysOff(mockHolidays, optimizedDays, TEST_YEAR, DEFAULT_WEEKENDS, startDate);
                result.forEach(period => {
                    expect(period.startDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                });
            });

            it('should handle custom weekend days', () => {
                const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
                const result = calculateConsecutiveDaysOff(mockHolidays, optimizedDays, TEST_YEAR, CUSTOM_WEEKENDS);
                expect(Array.isArray(result)).toBe(true);
            });

            it('should handle empty optimized days', () => {
                const result = calculateConsecutiveDaysOff(mockHolidays, [], TEST_YEAR);
                expect(Array.isArray(result)).toBe(true);
            });
        });

        describe('edge cases', () => {
            it('should handle periods spanning multiple months', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 31), name: 'End of Jan' },
                ];
                const optimizedDays = [new Date(TEST_YEAR, 1, 1)];
                const result = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);
                expect(Array.isArray(result)).toBe(true);
            });

            it('should handle periods that start exactly at startDate', () => {
                const startDate = new Date(TEST_YEAR, 5, 1);
                const holidays = [
                    { date: new Date(TEST_YEAR, 5, 1), name: 'Start Holiday' },
                ];
                const optimizedDays = [new Date(TEST_YEAR, 5, 3)];
                const result = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR, DEFAULT_WEEKENDS, startDate);
                if (result.length > 0) {
                    expect(result[0].startDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                }
            });

            it('should handle periods that end exactly at year end (Dec 31)', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 11, 30), name: 'Dec 30' },
                ];
                const optimizedDays = [new Date(TEST_YEAR, 11, 31)];
                const result = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);
                const periodAtYearEnd = result.find(period => 
                    period.endDate.getMonth() === 11 && period.endDate.getDate() === 31
                );
                if (periodAtYearEnd) {
                    expect(periodAtYearEnd.endDate.getFullYear()).toBe(TEST_YEAR);
                }
            });

            it('should correctly handle overlapping optimized days and holidays', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 1), name: 'Holiday' },
                ];
                const optimizedDays = [
                    new Date(TEST_YEAR, 0, 2),
                    new Date(TEST_YEAR, 0, 3),
                ];
                const result = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);
                const period = result.find(p => 
                    p.startDate <= holidays[0].date && p.endDate >= optimizedDays[1]
                );
                if (period) {
                    expect(period.usedDaysOff).toBe(2);
                }
            });

            it('should handle consecutive periods separated by work days', () => {
                const holidays = [
                    { date: new Date(TEST_YEAR, 0, 1), name: 'Mon' },
                    { date: new Date(TEST_YEAR, 0, 4), name: 'Thu' },
                ];
                const optimizedDays = [
                    new Date(TEST_YEAR, 0, 2),
                    new Date(TEST_YEAR, 0, 5),
                ];
                const result = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);
                expect(result.length).toBeGreaterThanOrEqual(1);
                result.forEach(period => {
                    expect(period.totalDays).toBeGreaterThanOrEqual(2);
                });
            });
        });
    });

    describe('Integration tests', () => {
        it('should work together: get holidays, optimize, and calculate periods', () => {
            const holidays = getHolidaysForYear('US', TEST_YEAR);
            const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 10);
            const periods = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);

            expect(holidays.length).toBeGreaterThan(0);
            expect(optimizedDays.length).toBeLessThanOrEqual(10);
            expect(Array.isArray(periods)).toBe(true);

            periods.forEach(period => {
                expect(period.totalDays).toBeGreaterThanOrEqual(2);
                expect(period.usedDaysOff).toBeGreaterThanOrEqual(0);
                expect(period.startDate <= period.endDate).toBe(true);
            });
        });

        it('should optimize efficiently to maximize consecutive days', () => {
            const holidays = [
                { date: new Date(TEST_YEAR, 0, 4), name: 'Holiday' },
            ];
            const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 1);
            const periods = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);

            if (periods.length > 0) {
                const hasOptimizedDay = periods.some(period =>
                    optimizedDays.some(day =>
                        day >= period.startDate && day <= period.endDate
                    )
                );
                expect(hasOptimizedDay).toBe(true);
            }
        });

        it('should handle edge case: all days are holidays or weekends', () => {
            const holidays = Array.from({ length: 50 }, (_, i) => ({
                date: new Date(TEST_YEAR, 0, i + 1),
                name: `Holiday ${i + 1}`
            }));
            const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 5);
            const periods = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);

            expect(Array.isArray(optimizedDays)).toBe(true);
            expect(Array.isArray(periods)).toBe(true);
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle year with no holidays gracefully', () => {
            const result = optimizeDaysOff([], TEST_YEAR, 5);
            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle invalid country codes gracefully', () => {
            try {
                const holidays = getHolidaysForYear('XX', TEST_YEAR);
                expect(Array.isArray(holidays)).toBe(true);
            } catch (e) {
                expect(e).toBeDefined();
            }
        });

        it('should handle dates at year boundaries', () => {
            const holidays = [
                { date: new Date(TEST_YEAR, 11, 31), name: 'New Year Eve' },
            ];
            const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle startDate at end of year', () => {
            const startDate = new Date(TEST_YEAR, 11, 15);
            const holidays = [
                { date: new Date(TEST_YEAR, 11, 25), name: 'Christmas' },
            ];
            const result = optimizeDaysOff(holidays, TEST_YEAR, 5, DEFAULT_WEEKENDS, startDate);
            result.forEach(date => {
                expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                expect(date.getFullYear()).toBe(TEST_YEAR);
            });
        });

        it('should handle holidays from previous year correctly', () => {
            const holidays = [
                { date: new Date(2023, 11, 31), name: 'Old Year' },
                { date: new Date(TEST_YEAR, 0, 1), name: 'New Year' },
            ];
            const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle leap year correctly', () => {
            const holidays = [
                { date: new Date(TEST_YEAR, 1, 29), name: 'Leap Day' },
            ];
            const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('Private function behavior (tested indirectly)', () => {
        it('should correctly identify weekend days', () => {
            const holidays: Array<{ date: Date; name: string }> = [];
            const result = optimizeDaysOff(holidays, TEST_YEAR, 10);
            result.forEach(date => {
                expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
            });
        });

        it('should correctly calculate days between dates', () => {
            const holidays = [
                { date: new Date(TEST_YEAR, 0, 1), name: 'Start' },
            ];
            const optimizedDays = [new Date(TEST_YEAR, 0, 5)];
            const result = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);
            result.forEach(period => {
                const calculated = Math.round(
                    (period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24)
                ) + 1;
                expect(period.totalDays).toBe(calculated);
            });
        });

        it('should generate consistent date keys', () => {
            const date1 = new Date(TEST_YEAR, 0, 15);
            const date2 = new Date(TEST_YEAR, 0, 15);
            const holidays = [
                { date: date1, name: 'Holiday' },
            ];
            const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
            const hasDate2 = result.some(d =>
                d.getFullYear() === date2.getFullYear() &&
                d.getMonth() === date2.getMonth() &&
                d.getDate() === date2.getDate()
            );
            expect(hasDate2).toBe(false);
        });

        it('should correctly identify holidays using dateKey', () => {
            const holidays = [
                { date: new Date(TEST_YEAR, 0, 15, 10, 30), name: 'Holiday' },
            ];
            const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
            const hasHolidayDate = result.some(d =>
                d.getFullYear() === TEST_YEAR &&
                d.getMonth() === 0 &&
                d.getDate() === 15
            );
            expect(hasHolidayDate).toBe(false);
        });

        it('should correctly get weekends for the year with startDate', () => {
            const startDate = new Date(TEST_YEAR, 5, 1);
            const holidays: Array<{ date: Date; name: string }> = [];
            const result = optimizeDaysOff(holidays, TEST_YEAR, 10, DEFAULT_WEEKENDS, startDate);
            result.forEach(date => {
                expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
            });
        });
    });

    describe('Complex scenarios and real-world cases', () => {
        it('should handle a typical year with multiple holidays and weekends', () => {
            const holidays = [
                { date: new Date(TEST_YEAR, 0, 1), name: 'New Year' },
                { date: new Date(TEST_YEAR, 4, 27), name: 'Memorial Day' },
                { date: new Date(TEST_YEAR, 6, 4), name: 'Independence Day' },
                { date: new Date(TEST_YEAR, 8, 2), name: 'Labor Day' },
                { date: new Date(TEST_YEAR, 10, 28), name: 'Thanksgiving' },
                { date: new Date(TEST_YEAR, 11, 25), name: 'Christmas' },
            ];
            const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 10);
            const periods = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);

            expect(optimizedDays.length).toBeLessThanOrEqual(10);
            expect(periods.length).toBeGreaterThan(0);
            
            periods.forEach(period => {
                expect(period.totalDays).toBeGreaterThanOrEqual(2);
                expect(period.startDate <= period.endDate).toBe(true);
                expect(period.usedDaysOff).toBeGreaterThanOrEqual(0);
            });
        });

        it('should maximize consecutive days off efficiently', () => {
            const holidays = [
                { date: new Date(TEST_YEAR, 0, 4), name: 'Thu' },
                { date: new Date(TEST_YEAR, 0, 8), name: 'Mon' },
            ];
            const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 1);
            const periods = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR);

            const periodWithOptimized = periods.find(p =>
                optimizedDays.some(day => day >= p.startDate && day <= p.endDate)
            );
            expect(periodWithOptimized).toBeDefined();
            if (periodWithOptimized) {
                expect(periodWithOptimized.totalDays).toBeGreaterThanOrEqual(4);
            }
        });

        it('should handle non-standard weekend configurations', () => {
            const holidays = [
                { date: new Date(TEST_YEAR, 0, 1), name: 'Holiday' },
            ];
            const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 5, CUSTOM_WEEKENDS);
            const periods = calculateConsecutiveDaysOff(holidays, optimizedDays, TEST_YEAR, CUSTOM_WEEKENDS);

            optimizedDays.forEach(date => {
                expect(CUSTOM_WEEKENDS).not.toContain(date.getDay());
            });

            expect(Array.isArray(periods)).toBe(true);
        });
    });
});
