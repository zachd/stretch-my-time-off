import type { Holiday, DayInfo } from './types';

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get the first day of the week for a given locale
 * @param locale - Country code or locale string
 * @returns Day of week (0 = Sunday, 1 = Monday, etc.)
 */
export function getFirstDayOfWeek(locale: string): number {
    const normalizedLocale = locale.toLowerCase() === 'us' ? 'en-US' : `en-${locale.toUpperCase()}`;
    
    try {
        // @ts-ignore .weekInfo exists on all browsers except Firefox
        const weekFirstDay = new Intl.Locale(normalizedLocale)?.weekInfo?.firstDay;
        if (weekFirstDay !== undefined) {
            return weekFirstDay;
        }
    } catch (e) {
        // Fallback if weekInfo is not supported
    }

    // Fallback: US starts on Sunday (0), most others on Monday (1)
    return normalizedLocale === 'en-US' ? 0 : 1;
}

/**
 * Format a date to a readable string
 * @param date - Date to format
 * @returns Formatted date string (e.g., "01 Jan 2024")
 */
export function formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(date).toLocaleDateString('en-GB', options);
}

/**
 * Get ordered days of the week based on locale
 * @param countryCode - Country code to determine first day of week
 * @returns Array of day info objects ordered by locale
 */
export function getOrderedDays(countryCode: string = 'US'): DayInfo[] {
    const days: DayInfo[] = [
        { name: 'Sunday', index: 0 },
        { name: 'Monday', index: 1 },
        { name: 'Tuesday', index: 2 },
        { name: 'Wednesday', index: 3 },
        { name: 'Thursday', index: 4 },
        { name: 'Friday', index: 5 },
        { name: 'Saturday', index: 6 }
    ];
    
    const firstDay = getFirstDayOfWeek(countryCode);
    return [...days.slice(firstDay), ...days.slice(0, firstDay)];
}

// ============================================================================
// Country Utilities
// ============================================================================

/**
 * Get country code from country name
 * @param countryName - Full country name
 * @param countriesList - Map of country codes to country names
 * @returns Two-letter country code or empty string
 */
export function getCountryCodeFromName(countryName: string, countriesList: Record<string, string>): string {
    return Object.keys(countriesList).find(code => countriesList[code] === countryName) || '';
}

/**
 * Get default days off for a country
 * @param countryCode - Two-letter country code
 * @param ptoData - Map of country codes to default days off
 * @returns Default days off for the country, or 0 if not found
 */
export function getDefaultDaysOff(countryCode: string, ptoData: Record<string, number>): number {
    return ptoData[countryCode] || 0;
}

/**
 * Convert country code to flag emoji
 * @param countryCode - Two-letter country code
 * @returns Flag emoji string
 */
export function getFlagEmoji(countryCode: string): string {
    if (!countryCode) return '';
    return countryCode
        .toUpperCase()
        .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

// ============================================================================
// UI Utilities
// ============================================================================

/**
 * Adjust input width based on content
 * @param inputElement - HTML input element to adjust
 * @param value - Value to measure
 */
export function adjustInputWidth(inputElement: HTMLInputElement | null, value: string): void {
    if (typeof window !== 'undefined' && inputElement) {
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.textContent = value || inputElement.value || inputElement.placeholder;
        document.body.appendChild(tempSpan);
        inputElement.style.width = `${tempSpan.offsetWidth + 30}px`;
        document.body.removeChild(tempSpan);
    }
}

// ============================================================================
// Storage Utilities
// ============================================================================

/**
 * Get item from localStorage with error handling
 */
export function getStorageItem(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.error(`Error getting localStorage item ${key}:`, e);
        return null;
    }
}

/**
 * Set item in localStorage with error handling
 */
export function setStorageItem(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.error(`Error setting localStorage item ${key}:`, e);
    }
}

/**
 * Get weekend days from localStorage
 * @returns Array of weekend day numbers (default: [6, 0] for Sat, Sun)
 */
export function getWeekendDays(): number[] {
    const stored = getStorageItem('weekendDays');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing weekendDays from localStorage:', e);
        }
    }
    return [6, 0]; // Default to Saturday (6) and Sunday (0)
}

/**
 * Save weekend days to localStorage
 */
export function setWeekendDays(weekendDays: number[]): void {
    setStorageItem('weekendDays', JSON.stringify(weekendDays));
}

/**
 * Get hidden holidays for a country from localStorage
 * @param countryCode - Country code
 * @returns Object mapping date strings to boolean
 */
export function getHiddenHolidays(countryCode: string): Record<string, boolean> {
    if (!countryCode) return {};
    const storageKey = `hiddenHolidays_${countryCode}`;
    const stored = getStorageItem(storageKey);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error(`Error parsing hiddenHolidays for ${countryCode}:`, e);
        }
    }
    return {};
}

/**
 * Set hidden holiday state for a country
 */
export function setHiddenHoliday(countryCode: string, date: Date, hidden: boolean): void {
    if (!countryCode) return;
    const storageKey = `hiddenHolidays_${countryCode}`;
    const hiddenHolidays = getHiddenHolidays(countryCode);
    hiddenHolidays[date.toString()] = hidden;
    setStorageItem(storageKey, JSON.stringify(hiddenHolidays));
}

/**
 * Check if a holiday is hidden
 */
export function isHolidayHidden(holiday: Holiday, countryCode: string): boolean {
    if (!countryCode) return false;
    const hiddenHolidays = getHiddenHolidays(countryCode);
    return hiddenHolidays[holiday.date.toString()] || false;
}

/**
 * Get app state from localStorage
 */
export function getAppState(defaultYear: number, defaultCountry: string, defaultDaysOff: number): {
    year: number;
    selectedCountry: string;
    selectedState: string;
    selectedStateCode: string;
    daysOff: number;
} {
    return {
        year: parseInt(getStorageItem('year') || defaultYear.toString(), 10),
        selectedCountry: getStorageItem('selectedCountry') || defaultCountry,
        selectedState: getStorageItem('selectedState') || '',
        selectedStateCode: getStorageItem('selectedStateCode') || '',
        daysOff: parseInt(getStorageItem('daysOff') || defaultDaysOff.toString(), 10)
    };
}

/**
 * Save app state to localStorage
 */
export function saveAppState(state: {
    year?: number;
    selectedCountry?: string;
    selectedState?: string;
    selectedStateCode?: string;
    daysOff?: number;
}): void {
    if (state.year !== undefined) {
        setStorageItem('year', state.year.toString());
    }
    if (state.selectedCountry !== undefined) {
        setStorageItem('selectedCountry', state.selectedCountry);
    }
    if (state.selectedState !== undefined) {
        setStorageItem('selectedState', state.selectedState);
    }
    if (state.selectedStateCode !== undefined) {
        setStorageItem('selectedStateCode', state.selectedStateCode);
    }
    if (state.daysOff !== undefined) {
        setStorageItem('daysOff', state.daysOff.toString());
    }
}

/**
 * Toggle a weekend day in the weekend days array
 * @param weekendDays - Current array of weekend day numbers
 * @param dayNumber - Day number to toggle (0 = Sunday, 6 = Saturday)
 * @returns New array with the day toggled
 */
export function toggleWeekendDay(weekendDays: number[], dayNumber: number): number[] {
    const newWeekendDays = weekendDays.includes(dayNumber)
        ? weekendDays.filter(d => d !== dayNumber)
        : [...weekendDays, dayNumber];
    newWeekendDays.sort();
    return newWeekendDays;
}

