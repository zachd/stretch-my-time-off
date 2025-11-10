import { describe, it, expect, beforeEach } from 'vitest';

// Helper function to create a date key (same as in +page.svelte)
function dateKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Helper function to check if a day is already a day off
function isAlreadyDayOff(
    date: Date,
    weekendDays: number[],
    holidays: Array<{ date: Date; name: string }>,
    optimizedDaysOff: Date[]
): boolean {
    const isWeekendDay = weekendDays.includes(date.getDay());
    const isHolidayDay = holidays.some(h => 
        h.date.getFullYear() === date.getFullYear() &&
        h.date.getMonth() === date.getMonth() &&
        h.date.getDate() === date.getDate()
    );
    const isOptimizedDay = optimizedDaysOff.some(d => 
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
    );
    return isWeekendDay || isHolidayDay || isOptimizedDay;
}

// Simulate toggleFixedDayOff logic
function simulateToggleFixedDayOff(
    date: Date,
    fixedDaysOff: Date[],
    daysOff: number,
    weekendDays: number[],
    holidays: Array<{ date: Date; name: string }>,
    optimizedDaysOff: Date[]
): { fixedDaysOff: Date[]; daysOff: number } {
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dateKeyStr = dateKey(normalizedDate);
    
    const isAlreadyDayOffDay = isAlreadyDayOff(normalizedDate, weekendDays, holidays, optimizedDaysOff);
    
    const existingIndex = fixedDaysOff.findIndex(d => dateKey(d) === dateKeyStr);
    
    let newFixedDaysOff: Date[];
    let newDaysOff = daysOff;
    
    if (existingIndex >= 0) {
        // Remove if already exists - don't subtract from days off count
        newFixedDaysOff = fixedDaysOff.filter((_, i) => i !== existingIndex);
    } else {
        // Add if doesn't exist
        newFixedDaysOff = [...fixedDaysOff, normalizedDate];
        // Only increase days off if this day isn't already a day off for another reason
        if (!isAlreadyDayOffDay) {
            newDaysOff = daysOff + 1;
        }
    }
    
    return { fixedDaysOff: newFixedDaysOff, daysOff: newDaysOff };
}

// Helper to check minimum days off validation
function canDecreaseDaysOff(daysOff: number, fixedDaysOffCount: number): boolean {
    return daysOff > fixedDaysOffCount;
}

describe('Fixed Days Off Logic', () => {
    const TEST_YEAR = 2024;
    const WEEKEND_DAYS = [0, 6]; // Sunday, Saturday
    
    describe('toggleFixedDayOff behavior', () => {
        it('should increase days off when adding a fixed day off to a regular day', () => {
            const regularDay = new Date(TEST_YEAR, 0, 15); // Monday, Jan 15
            const fixedDaysOff: Date[] = [];
            const daysOff = 10;
            const holidays: Array<{ date: Date; name: string }> = [];
            const optimizedDaysOff: Date[] = [];
            
            const result = simulateToggleFixedDayOff(
                regularDay,
                fixedDaysOff,
                daysOff,
                WEEKEND_DAYS,
                holidays,
                optimizedDaysOff
            );
            
            expect(result.fixedDaysOff.length).toBe(1);
            expect(result.daysOff).toBe(11); // Increased by 1
        });
        
        it('should NOT increase days off when adding a fixed day off to a weekend', () => {
            const weekendDay = new Date(TEST_YEAR, 0, 13); // Saturday, Jan 13
            const fixedDaysOff: Date[] = [];
            const daysOff = 10;
            const holidays: Array<{ date: Date; name: string }> = [];
            const optimizedDaysOff: Date[] = [];
            
            const result = simulateToggleFixedDayOff(
                weekendDay,
                fixedDaysOff,
                daysOff,
                WEEKEND_DAYS,
                holidays,
                optimizedDaysOff
            );
            
            expect(result.fixedDaysOff.length).toBe(1);
            expect(result.daysOff).toBe(10); // Not increased
        });
        
        it('should NOT increase days off when adding a fixed day off to a holiday', () => {
            const holidayDate = new Date(TEST_YEAR, 0, 1); // New Year's Day
            const fixedDaysOff: Date[] = [];
            const daysOff = 10;
            const holidays: Array<{ date: Date; name: string }> = [
                { date: new Date(TEST_YEAR, 0, 1), name: 'New Year\'s Day' }
            ];
            const optimizedDaysOff: Date[] = [];
            
            const result = simulateToggleFixedDayOff(
                holidayDate,
                fixedDaysOff,
                daysOff,
                WEEKEND_DAYS,
                holidays,
                optimizedDaysOff
            );
            
            expect(result.fixedDaysOff.length).toBe(1);
            expect(result.daysOff).toBe(10); // Not increased
        });
        
        it('should NOT increase days off when adding a fixed day off to an optimized day', () => {
            const optimizedDay = new Date(TEST_YEAR, 0, 15); // Monday, Jan 15
            const fixedDaysOff: Date[] = [];
            const daysOff = 10;
            const holidays: Array<{ date: Date; name: string }> = [];
            const optimizedDaysOff: Date[] = [new Date(TEST_YEAR, 0, 15)];
            
            const result = simulateToggleFixedDayOff(
                optimizedDay,
                fixedDaysOff,
                daysOff,
                WEEKEND_DAYS,
                holidays,
                optimizedDaysOff
            );
            
            expect(result.fixedDaysOff.length).toBe(1);
            expect(result.daysOff).toBe(10); // Not increased
        });
        
        it('should NOT decrease days off when removing a fixed day off', () => {
            const fixedDay = new Date(TEST_YEAR, 0, 15);
            const fixedDaysOff: Date[] = [fixedDay];
            const daysOff = 11;
            const holidays: Array<{ date: Date; name: string }> = [];
            const optimizedDaysOff: Date[] = [];
            
            const result = simulateToggleFixedDayOff(
                fixedDay,
                fixedDaysOff,
                daysOff,
                WEEKEND_DAYS,
                holidays,
                optimizedDaysOff
            );
            
            expect(result.fixedDaysOff.length).toBe(0);
            expect(result.daysOff).toBe(11); // Not decreased
        });
        
        it('should NOT decrease days off when removing a fixed day off that was on a weekend', () => {
            const weekendDay = new Date(TEST_YEAR, 0, 13); // Saturday
            const fixedDaysOff: Date[] = [weekendDay];
            const daysOff = 10;
            const holidays: Array<{ date: Date; name: string }> = [];
            const optimizedDaysOff: Date[] = [];
            
            const result = simulateToggleFixedDayOff(
                weekendDay,
                fixedDaysOff,
                daysOff,
                WEEKEND_DAYS,
                holidays,
                optimizedDaysOff
            );
            
            expect(result.fixedDaysOff.length).toBe(0);
            expect(result.daysOff).toBe(10); // Not decreased
        });
        
        it('should handle multiple fixed days off correctly', () => {
            const day1 = new Date(TEST_YEAR, 0, 15);
            const day2 = new Date(TEST_YEAR, 0, 16);
            const day3 = new Date(TEST_YEAR, 0, 17);
            let fixedDaysOff: Date[] = [];
            let daysOff = 10;
            const holidays: Array<{ date: Date; name: string }> = [];
            const optimizedDaysOff: Date[] = [];
            
            // Add first day
            let result = simulateToggleFixedDayOff(day1, fixedDaysOff, daysOff, WEEKEND_DAYS, holidays, optimizedDaysOff);
            fixedDaysOff = result.fixedDaysOff;
            daysOff = result.daysOff;
            expect(daysOff).toBe(11);
            
            // Add second day
            result = simulateToggleFixedDayOff(day2, fixedDaysOff, daysOff, WEEKEND_DAYS, holidays, optimizedDaysOff);
            fixedDaysOff = result.fixedDaysOff;
            daysOff = result.daysOff;
            expect(daysOff).toBe(12);
            
            // Add third day
            result = simulateToggleFixedDayOff(day3, fixedDaysOff, daysOff, WEEKEND_DAYS, holidays, optimizedDaysOff);
            fixedDaysOff = result.fixedDaysOff;
            daysOff = result.daysOff;
            expect(daysOff).toBe(13);
            
            // Remove one day - count should stay the same
            result = simulateToggleFixedDayOff(day2, fixedDaysOff, daysOff, WEEKEND_DAYS, holidays, optimizedDaysOff);
            expect(result.fixedDaysOff.length).toBe(2);
            expect(result.daysOff).toBe(13); // Not decreased
        });
    });
    
    describe('Minimum days off validation', () => {
        it('should allow decreasing when days off is greater than fixed days off count', () => {
            const daysOff = 15;
            const fixedDaysOffCount = 5;
            
            expect(canDecreaseDaysOff(daysOff, fixedDaysOffCount)).toBe(true);
        });
        
        it('should NOT allow decreasing when days off equals fixed days off count', () => {
            const daysOff = 5;
            const fixedDaysOffCount = 5;
            
            expect(canDecreaseDaysOff(daysOff, fixedDaysOffCount)).toBe(false);
        });
        
        it('should NOT allow decreasing when days off is less than fixed days off count', () => {
            const daysOff = 3;
            const fixedDaysOffCount = 5;
            
            expect(canDecreaseDaysOff(daysOff, fixedDaysOffCount)).toBe(false);
        });
        
        it('should allow decreasing when there are no fixed days off', () => {
            const daysOff = 10;
            const fixedDaysOffCount = 0;
            
            expect(canDecreaseDaysOff(daysOff, fixedDaysOffCount)).toBe(true);
        });
        
        it('should NOT allow decreasing when days off is 0 and there are no fixed days off', () => {
            const daysOff = 0;
            const fixedDaysOffCount = 0;
            
            expect(canDecreaseDaysOff(daysOff, fixedDaysOffCount)).toBe(false);
        });
    });
    
    describe('Edge cases', () => {
        it('should handle adding and removing the same day multiple times', () => {
            const day = new Date(TEST_YEAR, 0, 15);
            let fixedDaysOff: Date[] = [];
            let daysOff = 10;
            const holidays: Array<{ date: Date; name: string }> = [];
            const optimizedDaysOff: Date[] = [];
            
            // Add
            let result = simulateToggleFixedDayOff(day, fixedDaysOff, daysOff, WEEKEND_DAYS, holidays, optimizedDaysOff);
            fixedDaysOff = result.fixedDaysOff;
            daysOff = result.daysOff;
            expect(fixedDaysOff.length).toBe(1);
            expect(daysOff).toBe(11);
            
            // Remove
            result = simulateToggleFixedDayOff(day, fixedDaysOff, daysOff, WEEKEND_DAYS, holidays, optimizedDaysOff);
            fixedDaysOff = result.fixedDaysOff;
            daysOff = result.daysOff;
            expect(fixedDaysOff.length).toBe(0);
            expect(daysOff).toBe(11); // Not decreased
            
            // Add again
            result = simulateToggleFixedDayOff(day, fixedDaysOff, daysOff, WEEKEND_DAYS, holidays, optimizedDaysOff);
            expect(result.fixedDaysOff.length).toBe(1);
            expect(result.daysOff).toBe(12); // Increased again
        });
        
        it('should handle fixed day off on a day that becomes optimized later', () => {
            const day = new Date(TEST_YEAR, 0, 15);
            const fixedDaysOff: Date[] = [day];
            const daysOff = 10;
            const holidays: Array<{ date: Date; name: string }> = [];
            // Day is now optimized
            const optimizedDaysOff: Date[] = [day];
            
            // Removing fixed day off should not decrease count since it's now optimized
            const result = simulateToggleFixedDayOff(
                day,
                fixedDaysOff,
                daysOff,
                WEEKEND_DAYS,
                holidays,
                optimizedDaysOff
            );
            
            expect(result.fixedDaysOff.length).toBe(0);
            expect(result.daysOff).toBe(10); // Not decreased
        });
    });
});

