<script lang="ts">
    import { onMount } from 'svelte';
    import countries from 'i18n-iso-countries';
    import enLocale from 'i18n-iso-countries/langs/en.json';
    import CalendarMonth from '../lib/CalendarMonth.svelte';
    import { getHolidaysForYear, optimizeDaysOff, calculateConsecutiveDaysOff } from '../lib/holidayUtils';
    import { ptoData } from '../lib/ptoData';
    import Holidays from 'date-holidays';

    countries.registerLocale(enLocale);
    let countriesList: Record<string, string> = countries.getNames('en');

    let year: number;
    let months: number[] = Array.from({ length: 12 }, (_, i) => i);
    let selectedCountry: string = '';
    let holidays: Array<{ date: Date; name: string; hidden?: boolean }> = [];
    let daysOff: number = 0;
    let optimizedDaysOff: Date[] = [];
    let consecutiveDaysOff: Array<{ startDate: Date; endDate: Date; totalDays: number }> = [];
    let fixedDaysOff: Date[] = [];
    let showExcludedMonths: boolean = true;
    let visibleMonths: number[] = [];
    let countriesInput: HTMLInputElement | null = null;
    let statesInput: HTMLInputElement | null = null;
    let showHowItWorks: boolean = false;

    // Default settings
    let defaultYear: number = new Date().getFullYear();
    let defaultCountry: string = '';
    let defaultDaysOff: number = 0;

    let selectedState: string = '';
    let selectedStateCode: string = '';
    let statesList: Record<string, string> = {};

    let showHolidaysList: boolean = false;

    let showWeekendSettings: boolean = false;
    let showFixedDaysOffList: boolean = false;
    let weekendDays: number[] = [];

    // Start date state
    let startDate: Date = new Date(new Date().getFullYear(), 0, 1);
    let showDatePicker: boolean = false;
    let datePickerValue: string = '';

    $: selectedCountryCode = Object.keys(countriesList).find(code => countriesList[code] === selectedCountry) || '';

    // Reactive: when year changes, load start date and fixed days off for that year
    $: if (year !== undefined && year && typeof window !== 'undefined') {
        startDate = getStartDate(year);
        loadFixedDaysOff(year);
        // Adjust daysOff to include fixed days off if they exist
        // Calculate base days off (total - fixed days)
        const baseDaysOff = Math.max(0, daysOff - fixedDaysOff.length);
        // If we have fixed days but base is 0, get the country default and add fixed days
        if (fixedDaysOff.length > 0 && baseDaysOff === 0 && daysOff < fixedDaysOff.length) {
            const countryCode = Object.keys(countriesList).find(code => countriesList[code] === selectedCountry) || '';
            const currentDefaultDaysOff = ptoData[countryCode] || 0;
            daysOff = currentDefaultDaysOff + fixedDaysOff.length;
        }
    }

    $: if (selectedCountryCode && year !== undefined && year) {
        updateHolidays();
    }

    // Reactive: when fixedDaysOff changes, update calculations
    $: if (fixedDaysOff && year !== undefined && year) {
        updateHolidays();
    }
    
    // Reactive: when startDate or year changes, update excluded months visibility
    $: if (year !== undefined && year && startDate) {
        showExcludedMonths = !hasExcludedMonths();
    }

    $: if (daysOff !== undefined && typeof window !== 'undefined') {
        localStorage.setItem('daysOff', daysOff.toString());
    }

    $: if (year && typeof window !== 'undefined') {
        localStorage.setItem('year', year.toString());
    }

    function updateStatesList(countryCode: string) {
        const hd = new Holidays(countryCode);
        statesList = hd.getStates(countryCode) || {};
    }

    function handleStateChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const stateName = target.value;
        selectedStateCode = Object.keys(statesList).find(code => statesList[code] === stateName) || '';
        selectedState = stateName;
        // Save state per country
        if (selectedCountryCode) {
            localStorage.setItem(`selectedState_${selectedCountryCode}`, selectedState);
            localStorage.setItem(`selectedStateCode_${selectedCountryCode}`, selectedStateCode);
        }
    }

    onMount(() => {

        fetchCountryCode().then(() => {
            defaultYear = new Date().getFullYear();
            defaultCountry = selectedCountry;
            defaultDaysOff = ptoData[selectedCountryCode] || 0;

            const storedYear = localStorage.getItem('year');
            const storedCountry = localStorage.getItem('selectedCountry');
            const storedDaysOff = localStorage.getItem('daysOff');

            year = storedYear ? parseInt(storedYear, 10) : defaultYear;
            selectedCountry = storedCountry || defaultCountry;
            
            // Load state per country
            const countryCode = Object.keys(countriesList).find(code => countriesList[code] === selectedCountry) || '';
            if (countryCode) {
                selectedState = localStorage.getItem(`selectedState_${countryCode}`) || '';
                selectedStateCode = localStorage.getItem(`selectedStateCode_${countryCode}`) || '';
            } else {
                selectedState = '';
                selectedStateCode = '';
            }
            
            // Get the current country's default days off
            const currentDefaultDaysOff = ptoData[countryCode] || 0;
            
            startDate = getStartDate(year);
            loadFixedDaysOff(year);
            
            // Initialize daysOff: use stored value if it exists, otherwise use country default
            // Then add fixed days off to it
            if (storedDaysOff !== null && storedDaysOff !== '') {
                const storedValue = parseInt(storedDaysOff, 10);
                // If stored value is 0 and there are no fixed days, use default instead
                if (storedValue === 0 && fixedDaysOff.length === 0) {
                    daysOff = currentDefaultDaysOff;
                } else {
                    daysOff = storedValue;
                }
            } else {
                // No stored value, use country default
                daysOff = currentDefaultDaysOff;
            }
            
            // Add fixed days off to the base days off
            if (fixedDaysOff.length > 0) {
                // Calculate base: if daysOff is less than fixed days, base is 0, otherwise subtract fixed days
                const baseDaysOff = Math.max(0, daysOff - fixedDaysOff.length);
                // If base is 0 and we have fixed days, set base to default and add fixed days
                if (baseDaysOff === 0 && daysOff < fixedDaysOff.length) {
                    daysOff = currentDefaultDaysOff + fixedDaysOff.length;
                } else {
                    daysOff = baseDaysOff + fixedDaysOff.length;
                }
            }
            // showExcludedMonths will be set by reactive statement
            updateHolidays();
        });

        if (selectedCountryCode) {
            updateStatesList(selectedCountryCode);
        }
        window.addEventListener('keydown', handleKeyDown);

        // Load weekend days from localStorage or set defaults
        const storedWeekendDays = localStorage.getItem('weekendDays');
        weekendDays = storedWeekendDays 
            ? JSON.parse(storedWeekendDays) 
            : [6, 0]; // Default to Saturday (6) and Sunday (0)
        
        localStorage.setItem('weekendDays', JSON.stringify(weekendDays));
    });

    async function fetchCountryCode() {
        try {
            const response = await fetch('https://stretchmytimeoff.com/cdn-cgi/trace');
            const text = await response.text();
            const countryCodeMatch = text.match(/loc=(\w+)/);
            const countryCode = countryCodeMatch ? countryCodeMatch[1] : '';
            selectedCountry = countriesList[countryCode] || '';
        } catch (error) {
            console.error('Error fetching country code:', error);
        }
    }

    function handleCountryChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const fullValue = target.value;
        selectedCountry = fullValue;
        // Get the country code for the new country (selectedCountryCode will update reactively)
        const newCountryCode = Object.keys(countriesList).find(code => countriesList[code] === fullValue) || '';
        if (newCountryCode) {
            // Update days off to the new country's default
            daysOff = ptoData[newCountryCode] || 0;
            // Load state for the new country
            selectedState = localStorage.getItem(`selectedState_${newCountryCode}`) || '';
            selectedStateCode = localStorage.getItem(`selectedStateCode_${newCountryCode}`) || '';
            // updateStatesList and updateHolidays will be called by reactive statements
            localStorage.setItem('selectedCountry', selectedCountry);
            localStorage.setItem('daysOff', daysOff.toString());
        }
    }

    function updateHolidays() {
        if (selectedCountryCode && year !== undefined && year) {
            updateStatesList(selectedCountryCode);
            let allHolidays = getHolidaysForYear(selectedCountryCode, year, selectedStateCode);
            holidays = allHolidays.map(holiday => ({
                ...holiday,
                date: new Date(holiday.date),
                hidden: isHolidayHidden(holiday)
            }));
            const visibleHolidays = holidays.filter(h => !h.hidden);
            // Use baseDaysOff for optimization (not including fixed days in the budget)
            // Calculate it here to ensure it's always defined
            const budgetDaysOff = Math.max(0, (daysOff || 0) - (fixedDaysOff?.length || 0));
            optimizedDaysOff = optimizeDaysOff(visibleHolidays, year, budgetDaysOff, weekendDays, startDate, fixedDaysOff);
            consecutiveDaysOff = calculateConsecutiveDaysOff(visibleHolidays, optimizedDaysOff, year, weekendDays, startDate, fixedDaysOff);
        } else {
            holidays = [];
            optimizedDaysOff = [];
            consecutiveDaysOff = [];
        }
    }

    function toggleFixedDayOff(date: Date) {
        // Normalize date to remove time component
        const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dateKeyStr = dateKey(normalizedDate);
        
        // Check if this day is already a day off for any reason (holiday, weekend, or optimized)
        const isWeekendDay = weekendDays.includes(normalizedDate.getDay());
        const isHolidayDay = holidays.some(h => datesMatch(h.date, normalizedDate));
        const isOptimizedDay = optimizedDaysOff.some(d => datesMatch(d, normalizedDate));
        const isAlreadyDayOff = isWeekendDay || isHolidayDay || isOptimizedDay;
        
        // Check if date is already in fixedDaysOff
        const existingIndex = fixedDaysOff.findIndex(d => dateKey(d) === dateKeyStr);
        
        if (existingIndex >= 0) {
            // Remove if already exists - don't subtract from days off count
            fixedDaysOff = fixedDaysOff.filter((_, i) => i !== existingIndex);
        } else {
            // Add if doesn't exist
            fixedDaysOff = [...fixedDaysOff, normalizedDate];
            // Only increase days off if this day isn't already a day off for another reason
            if (!isAlreadyDayOff) {
                daysOff++;
            }
        }
        
        // Save to localStorage
        saveFixedDaysOff(year);
        localStorage.setItem('daysOff', daysOff.toString());
        
        // Update calculations (using baseDaysOff for optimization)
        updateHolidays();
    }

    function resetToDefault() {
        year = defaultYear;
        selectedCountry = defaultCountry;
        const defaultCountryCode = Object.keys(countriesList).find(code => countriesList[code] === defaultCountry) || '';
        // Load state for default country
        if (defaultCountryCode) {
            selectedState = localStorage.getItem(`selectedState_${defaultCountryCode}`) || '';
            selectedStateCode = localStorage.getItem(`selectedStateCode_${defaultCountryCode}`) || '';
        } else {
            selectedState = '';
            selectedStateCode = '';
        }
        // Keep current daysOff value, don't reset it
        localStorage.setItem('year', year.toString());
        localStorage.setItem('selectedCountry', selectedCountry);
    }

    function handleKeyDown(event: KeyboardEvent) {
        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                year++;
                updateHolidays();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                year--;
                updateHolidays();
                break;
            case 'ArrowUp':
                event.preventDefault();
                daysOff++;
                updateHolidays();
                break;
            case 'ArrowDown':
                event.preventDefault();
                const minDaysOff = fixedDaysOff.length;
                if (daysOff > minDaysOff) {
                    daysOff--;
                    updateHolidays();
                }
                break;
        }
    }

    function adjustInputWidth(inputElement: HTMLInputElement | null, value: string) {
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

    $: if (countriesInput) adjustInputWidth(countriesInput, selectedCountry);
    $: if (statesInput) adjustInputWidth(statesInput, selectedState);

    function getFlagEmoji(countryCode: string) {
        if (!countryCode) return '';
        return countryCode
            .toUpperCase()
            .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
    }

    function toggleHowItWorks() {
        showHowItWorks = !showHowItWorks;
        if (showHowItWorks) {
            const howItWorksElement = document.querySelector('.how-it-works');
            if (howItWorksElement) {
                howItWorksElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    function toggleHolidayVisibility(holiday: { date: Date; name: string; hidden?: boolean }) {
        if (!selectedCountryCode) return;

        const storageKey = `hiddenHolidays_${selectedCountryCode}`;
        let hiddenHolidays = JSON.parse(localStorage.getItem(storageKey) || '{}');

        hiddenHolidays[holiday.date.toString()] = !hiddenHolidays[holiday.date.toString()];
        localStorage.setItem(storageKey, JSON.stringify(hiddenHolidays));

        holidays = holidays.map(h => {
            if (h.date === holiday.date) {
                return { ...h, hidden: hiddenHolidays[h.date.toString()] };
            }
            return h;
        });

        updateHolidays();
    }

    function isHolidayHidden(holiday: { date: Date; name: string; hidden?: boolean }) {
        if (!selectedCountryCode) return false;

        const storageKey = `hiddenHolidays_${selectedCountryCode}`;
        const hiddenHolidays = JSON.parse(localStorage.getItem(storageKey) || '{}');

        return hiddenHolidays[holiday.date.toString()] || false;
    }

    function formatDate(date: Date) {
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        return new Date(date).toLocaleDateString('en-GB', options);
    }

    $: visibleHolidaysCount = holidays.filter(h => !h.hidden).length;

    // Get start date for a given year from localStorage
    function getStartDate(year: number): Date {
        try {
            const stored = localStorage.getItem('startDates');
            if (stored) {
                const startDates: string[] = JSON.parse(stored);
                // Find date that matches the year (extract year from date string)
                const dateStr = startDates.find(date => {
                    const dateYear = parseInt(date.split('-')[0] || date.split('T')[0].split('-')[0]);
                    return dateYear === year;
                });
                if (dateStr) {
                    // Parse date string - handle both YYYY-MM-DD and ISO format
                    const parsed = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
                    const [y, m, d] = parsed.split('-').map(Number);
                    return new Date(y, m - 1, d);
                }
            }
        } catch (e) {
            console.error('Error loading start date:', e);
        }
        return new Date(year, 0, 1); // Default to Jan 1st
    }

    // Save start date for a given year to localStorage
    function saveStartDate(year: number, date: Date) {
        try {
            const stored = localStorage.getItem('startDates');
            let startDates: string[] = stored ? JSON.parse(stored) : [];
            // Remove existing date for this year (extract year from date string)
            startDates = startDates.filter(dateStr => {
                const dateYear = parseInt(dateStr.split('-')[0] || dateStr.split('T')[0].split('-')[0]);
                return dateYear !== year;
            });
            // Add new date
            startDates.push(formatDateForInput(date));
            localStorage.setItem('startDates', JSON.stringify(startDates));
        } catch (e) {
            console.error('Error saving start date:', e);
        }
    }

    // Format date as YYYY-MM-DD for date input (no timezone conversion)
    function formatDateForInput(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Helper function to create a date key (same as in holidayUtils.ts)
    function dateKey(date: Date): string {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    // Helper function to check if a date matches another date (ignoring time)
    function datesMatch(date1: Date, date2: Date): boolean {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    // Load fixed days off for a given year from localStorage
    function loadFixedDaysOff(year: number) {
        try {
            const stored = localStorage.getItem(`fixedDaysOff_${year}`);
            if (stored) {
                const dateStrings: string[] = JSON.parse(stored);
                fixedDaysOff = dateStrings.map(dateStr => {
                    const [y, m, d] = dateStr.split('-').map(Number);
                    return new Date(y, m, d);
                });
            } else {
                fixedDaysOff = [];
            }
        } catch (e) {
            console.error('Error loading fixed days off:', e);
            fixedDaysOff = [];
        }
    }

    // Save fixed days off for a given year to localStorage
    function saveFixedDaysOff(year: number) {
        try {
            const dateStrings = fixedDaysOff.map(date => 
                `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            );
            localStorage.setItem(`fixedDaysOff_${year}`, JSON.stringify(dateStrings));
        } catch (e) {
            console.error('Error saving fixed days off:', e);
        }
    }

    // Format start date for display
    function formatStartDate(date: Date): string {
        const today = new Date();
        if (date.getTime() === new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() && date.getFullYear() === year) {
            return 'Today';
        }
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = date.getDate();
        const suffix = getDaySuffix(day);
        return `${monthNames[date.getMonth()]}&nbsp;${day}${suffix}`;
    }

    // Get day suffix (st, nd, rd, th)
    function getDaySuffix(day: number): string {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    // Handle start date change
    function handleStartDateChange(newDate: Date) {
        startDate = newDate;
        saveStartDate(year, newDate);
        updateHolidays();
        // showExcludedMonths will be updated by reactive statement
    }

    // Handle date picker input change (auto-save)
    function handleDatePickerChange() {
        if (datePickerValue) {
            // Parse YYYY-MM-DD format in local time (consistent with getStartDate)
            const [y, m, d] = datePickerValue.split('-').map(Number);
            const newDate = new Date(y, m - 1, d);
            handleStartDateChange(newDate);
        }
    }

    // Set start date to today
    function setStartDateToToday() {
        const today = new Date();
        if (today.getFullYear() === year) {
            handleStartDateChange(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
            showDatePicker = false;
        }
    }

    // Reset start date to Jan 1st
    function resetStartDateToJan1() {
        const jan1st = new Date(year, 0, 1);
        handleStartDateChange(jan1st);
        showDatePicker = false;
    }

    // Check if today is in the current year
    function isTodayInYear(): boolean {
        const today = new Date();
        return today.getFullYear() === year;
    }

    // Helper: Get start date normalized to the current year
    function getStartDateInYear(): Date {
        return new Date(year, startDate.getMonth(), startDate.getDate());
    }

    // Check if a month is active (not entirely before the start date)
    function isMonthActive(monthIndex: number): boolean {
        const startDateInYear = getStartDateInYear();
        const startMonth = startDateInYear.getMonth();
        
        // Month is active if:
        // 1. The start date falls within this month (same month), OR
        // 2. The month starts on or after the start date (later month)
        // This means only months entirely before the start date's month are excluded
        return monthIndex >= startMonth;
    }

    // Check if start date is Jan 1st
    function isStartDateJan1st(): boolean {
        const startDateInYear = getStartDateInYear();
        return startDateInYear.getTime() === new Date(year, 0, 1).getTime();
    }

    // Check if there are any excluded months (months entirely before the start date)
    function hasExcludedMonths(): boolean {
        return months.some(month => !isMonthActive(month));
    }

    // Filter months based on showExcludedMonths setting
    // Explicitly depend on startDate, year, and showExcludedMonths to ensure proper reactivity
    // Use a computed value that depends on all relevant variables
    $: visibleMonths = (startDate && year !== undefined && year) 
        ? (showExcludedMonths 
            ? months 
            : months.filter(month => isMonthActive(month)))
        : [];

    function toggleWeekendDay(dayNumber: number) {
        if (weekendDays.includes(dayNumber)) {
            weekendDays = weekendDays.filter(d => d !== dayNumber);
        } else {
            weekendDays = [...weekendDays, dayNumber];
        }
        weekendDays.sort();
        localStorage.setItem('weekendDays', JSON.stringify(weekendDays));
        updateHolidays();
    }

    function getFirstDayOfWeek(locale: string): number {
        const normalizedLocale = locale.toLowerCase() === 'us' ? 'en-US' : `en-${locale.toUpperCase()}`;
        try {
            // @ts-ignore
            const weekFirstDay = new Intl.Locale(normalizedLocale)?.getWeekInfo()?.firstDay;
            if (weekFirstDay !== undefined) {
                return weekFirstDay;
            }
        } catch (e) {
            // Fallback if weekInfo is not supported
        }
        return normalizedLocale === 'en-US' ? 0 : 1;
    }

    function getOrderedDays() {
        const days = [
            { name: 'Sunday', index: 0 },
            { name: 'Monday', index: 1 },
            { name: 'Tuesday', index: 2 },
            { name: 'Wednesday', index: 3 },
            { name: 'Thursday', index: 4 },
            { name: 'Friday', index: 5 },
            { name: 'Saturday', index: 6 }
        ];
        
        const firstDay = getFirstDayOfWeek(selectedCountryCode || 'US');
        return [...days.slice(firstDay), ...days.slice(0, firstDay)];
    }
</script>

<style>
    .header {
        max-width: 800px;
        margin: 20px auto;
        padding: 0 30px;
        text-align: center;
    }

    .header h2 {
        font-size: 2.3rem;
        margin: 0;
    }

    .content-box {
        max-width: 1200px;
        margin: 20px auto;
        padding: 15px;
        background-color: #111;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        overflow: hidden;
    }

    .content-box p {
        text-align: center;
        line-height: 3;
    }

    input {
        margin: 0 5px;
        font-size: 1em;
        padding: 8px;
        background-color: transparent;
        border: 1px solid #555;
        border-radius: 5px;
        color: #fff;
        transition: background-color 0.3s, color 0.3s;
        width: auto;
    }

    input:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    input:focus {
        outline: 2px solid #61dafb;
    }

    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        justify-items: center;
        padding: 20px;
    }

    @media (max-width: 1024px) {
        .calendar-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            padding: 10px;
        }
    }

    @media (max-width: 600px) {
        .calendar-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 5px;
            padding: 5px;
        }
    }

    .toggle-excluded-months-container {
        text-align: center;
        margin: 20px 0;
    }

    .toggle-excluded-months {
        padding: 8px 16px;
        background-color: #333;
        border: 1px solid #555;
        border-radius: 5px;
        color: #fff;
        cursor: pointer;
        font-size: 0.9em;
        transition: background-color 0.3s;
        width: auto;
        display: inline-block;
        white-space: nowrap;
    }

    .toggle-excluded-months:hover {
        background-color: #444;
    }

    .calendar-container {
        width: 100%;
        max-width: 300px;
        background-color: #111;
        color: #fff;
        border-radius: 5px;
        padding: 10px;
        box-sizing: border-box;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow: visible;
        display: flex;
        flex-direction: column;
    }

    .calendar-key {
        display: flex;
        justify-content: center;
        gap: 20px;
        padding: 5px;
        margin-bottom: 10px;
    }

    .key-item {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .key-label {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .color-box {
        width: 15px;
        height: 15px;
        min-width: 15px;
        border-radius: 3px;
    }

    .color-box.weekend {
        background-color: #585858;
    }

    .color-box.optimized {
        background-color: #4caf50;
    }

    .color-box.holiday {
        background-color: #3b1e6e;
    }

    footer {
        text-align: center;
        padding: 10px;
        color: #c5c6c7;
        font-size: 0.8em;
    }

    a {
        color: #66fcf1;
        text-decoration: none;
    }

    a:hover {
        color: #fff;
        text-decoration: none;
    }

    .arrow-controls {
        display: inline-flex;
        align-items: center;
    }

    button {
        background-color: #333;
        border-left: 4px solid #111;
        border-top: 4px solid #111;
        border-right: 4px solid #555;
        border-bottom: 4px solid #555;
        color: #fff;
        font-size: 0.8em;
        cursor: pointer;
        padding: 3px;
        margin: 0 3px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        transition: transform 0.1s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        font-weight: bold;
    }

    button:hover {
        background-color: #444;
    }

    button:active {
        transform: translateY(2px);
        box-shadow: none;
    }

    button:focus {
        outline: none;
    }

    .bold {
        font-weight: bold;
        font-size: 1em;
        margin: 0 5px;
    }

    .flag {
        font-size: 1.5em;
    }

    .how-it-works {
        margin: 20px auto;
        padding: 25px;
        background-color: #111;
        color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: max-height 0.3s ease;
        overflow: hidden;
    }

    .how-it-works p {
        text-align: left;
    }

    .how-it-works h3 {
        margin-top: 0;
    }

    .toggle-text {
        color: #fff;
        cursor: pointer;
        margin: 20px auto;
        display: block;
        text-align: center;
        font-size: 1em;
        transition: color 0.3s;
        display: block;
        width: auto;
        background: none;
        border: none;
        padding: 0;
    }

    .toggle-text:hover {
        color: #61dafb;
        background: none;
        border: none;
        padding: 0;
    }

    .toggle-text:focus {
        outline: none;
    }

    .reset-link {
        display: block;
        margin-top: 10px;
        text-align: center;
        font-size: 0.8em;
    }

    .color-box.holiday {
        background-color: #3b1e6e;
        display: inline-block;
        width: 15px;
        height: 15px;
        margin-right: 5px;
        border-radius: 3px;
    }

    .content-box ul {
        list-style-type: none;
        padding: 0;
    }

    .content-box li {
        display: flex;
        align-items: center;
    }

    .content-box button {
        background-color: #444;
        border: none;
        color: #fff;
        padding: 5px 10px;
        cursor: pointer;
        border-radius: 5px;
    }

    .content-box button:hover {
        background-color: #555;
    }

    .strikethrough {
        text-decoration: line-through;
    }

    .edit-link {
        cursor: pointer;
        font-size: 0.8em;
        text-decoration: none;
    }

    .edit-link:hover {
        color: #fff;
    }

    .holidays-list {
        margin: 10px;
        padding: 15px;
        background-color: #222;
        border-radius: 5px;
    }

    .holidays-list ul {
        list-style-type: none;
        padding: 0;
    }

    .holidays-list li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px;
        border-radius: 4px;
        gap: 5px;
    }

    .holidays-list li:hover {
        background-color: #333;
    }

    .holidays-list span {
        flex: 1;
    }

    .holidays-list button {
        margin-left: 10px;
        background-color: #444;
        border: none;
        color: #fff;
        padding: 5px 25px;
        cursor: pointer;
        border-radius: 5px;
        min-width: 100px;
    }

    .holidays-list button:hover {
        background-color: #555;
    }

    .settings-section {
        margin-bottom: 20px;
    }

    .settings-section:last-child {
        margin-bottom: 0;
    }

    .settings-section h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #fff;
    }

    .start-date-link {
        text-decoration: underline;
        text-decoration-style: dotted;
        cursor: pointer;
        color: inherit;
    }

    .start-date-link:hover {
        text-decoration-style: solid;
    }

    .date-picker-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .date-picker-modal {
        background-color: #222;
        border-radius: 10px;
        padding: 25px;
        max-width: min(400px, calc(100vw - 40px));
        width: 100%;
        box-sizing: border-box;
        position: relative;
        color: #fff;
    }

    .date-picker-close {
        position: absolute;
        top: 10px;
        right: 10px;
        background: transparent;
        border: none;
        color: #fff;
        font-size: 24px;
        cursor: pointer;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
    }

    .date-picker-close:hover,
    .date-picker-close:active,
    .date-picker-close:focus {
        background: transparent;
        color: #ccc;
    }

    .date-picker-modal h3 {
        margin: 0 0 10px 0;
        padding: 0;
        text-align: center;
        font-size: 1.5em;
    }

    .date-picker-modal p {
        margin: 0 0 20px 0;
        padding: 0;
        text-align: center;
        color: #ccc;
    }

    .date-picker-controls {
        margin: 0 0 20px 0;
        padding: 0;
        width: 100%;
    }

    .date-input {
        width: 100%;
        padding: 10px;
        font-size: 1em;
        background-color: #222;
        border: 1px solid #555;
        border-radius: 5px;
        color: #fff;
        box-sizing: border-box;
        text-align: center;
        margin: 0;
        display: block;
    }

    .date-input:focus {
        outline: 2px solid #61dafb;
        border-color: #61dafb;
    }

    /* Make calendar icon white */
    .date-input::-webkit-calendar-picker-indicator {
        filter: invert(1);
        cursor: pointer;
    }

    .date-input::-webkit-inner-spin-button,
    .date-input::-webkit-clear-button {
        filter: invert(1);
    }

    .date-picker-buttons {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin: 0 0 15px 0;
        width: 100%;
        box-sizing: border-box;
    }

    .date-picker-button,
    .date-picker-save {
        margin: 0;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s;
        box-sizing: border-box;
    }

    .date-picker-button {
        flex: 1;
        min-width: 0;
        padding: 20px;
        background-color: #444;
        color: #fff;
        font-size: 0.9em;
    }

    .date-picker-button:hover {
        background-color: #555;
    }

    .date-picker-save {
        width: 100%;
        margin: 0;
        font-size: 1.1em;
        font-weight: bold;
        background-color: #61dafb;
        color: #000;
    }

    .date-picker-save:hover {
        background-color: #4fa8c5;
    }
</style>

<main>
    <div class="header">
        <h2>🌴 Stretch&nbsp;My Time&nbsp;Off</h2>
        <p>
            In 
            <strong>
                {getFlagEmoji(selectedCountryCode)}
                {#if selectedState}
                    {selectedState}, 
                {/if}
                {selectedCountry}
            </strong>, there are <strong>{holidays.length}</strong> public holidays{#if visibleHolidaysCount < holidays.length}&nbsp;(<strong>{visibleHolidaysCount} selected</strong>){/if} in&nbsp;<strong>{year}</strong>. 
        </p>
        <p>
            Let's stretch your time off from <strong>{daysOff}&nbsp;days</strong> to <strong>{consecutiveDaysOff.reduce((total, group) => total + group.totalDays, 0)}&nbsp;days</strong> (<a href="#how-it-works" on:click={toggleHowItWorks}>how?</a>)
        </p>
    </div>

    <div class="content-box">
        <p>
            I live in 
            <span class="flag" style="vertical-align: middle;">{getFlagEmoji(selectedCountryCode)}</span>
            {#if Object.keys(statesList).length > 0}
                <input bind:this={statesInput} list="states" class="editable-input bold" bind:value={selectedState} 
                    on:input={(e) => handleStateChange(e)} 
                    on:focus={(e) => { (e.target as HTMLInputElement).value = ''; }} 
                    placeholder="State" 
                    aria-label="State" />
                <datalist id="states">
                    {#each Object.entries(statesList) as [code, name]}
                        <option value={name}>{name}</option>
                    {/each}
                </datalist>
                in
            {/if}
            <input bind:this={countriesInput} list="countries" class="editable-input bold" bind:value={selectedCountry} 
                on:input={(e) => handleCountryChange(e)} 
                on:focus={(e) => { (e.target as HTMLInputElement).value = ''; }} 
                placeholder="Country" 
                aria-label="Select country" />
            and have 
            <span class="arrow-controls">
                <button on:click={() => { const minDaysOff = fixedDaysOff.length; if (daysOff > minDaysOff) { daysOff--; updateHolidays(); } }} aria-label="Decrease days off">▼</button>
                <span class="bold">{daysOff}</span>
                <button on:click={() => { daysOff++; updateHolidays(); }} aria-label="Increase days off">▲</button>
            </span>
            days&nbsp;off from
            <a href="#" on:click|preventDefault={() => { showDatePicker = true; datePickerValue = formatDateForInput(startDate); }} class="bold start-date-link">
                {@html formatStartDate(startDate)}
            </a>
            until the&nbsp;end&nbsp;of
            <span class="arrow-controls">
                <button on:click={() => { year--; updateHolidays(); }} aria-label="Previous year">◀</button>
                <span class="bold">{year}</span>
                <button on:click={() => { year++; updateHolidays(); }} aria-label="Next year">▶</button>
            </span>
        </p>
        {#if year !== defaultYear || selectedCountry !== defaultCountry}
            {@const yearDifferent = year !== defaultYear}
            {@const countryDifferent = selectedCountry !== defaultCountry}
            <a href="#" on:click|preventDefault={resetToDefault} class="reset-link">
                {yearDifferent && countryDifferent 
                    ? 'Reset to current country and year'
                    : yearDifferent 
                    ? 'Reset to current year'
                    : 'Reset to current country'}
            </a>
        {/if}

        <datalist id="countries">
            {#each Object.entries(countriesList) as [code, name]}
                <option value={name}>{name}</option>
            {/each}
        </datalist>
    </div>

    <div class="content-box" id="calendar">
        <div class="calendar-key">
            <div class="key-item">
                <div class="key-label">
                    <span class="color-box optimized"></span>
                    <span>Day Off</span>
                </div>
                <a href="#" on:click|preventDefault={() => showFixedDaysOffList = !showFixedDaysOffList} class="edit-link">
                    (edit)
                </a>
            </div>
            <div class="key-item">
                <div class="key-label">
                    <span class="color-box holiday"></span>
                    <span>Public Holiday</span>
                </div>
                {#if holidays.length > 0}
                    <a href="#" on:click|preventDefault={() => showHolidaysList = !showHolidaysList} class="edit-link">
                        (edit)
                    </a>
                {/if}
            </div>
            <div class="key-item">
                <div class="key-label">
                    <span class="color-box weekend"></span>
                    <span>Weekend</span>
                </div>
                <a href="#" on:click|preventDefault={() => showWeekendSettings = !showWeekendSettings} class="edit-link">
                    (edit)
                </a>
            </div>
        </div>

        {#if showHolidaysList || showWeekendSettings || showFixedDaysOffList}
        <div class="holidays-list">
            {#if showFixedDaysOffList}
                <div class="settings-section">
                    <h3>Fixed Days Off</h3>
                    {#if fixedDaysOff.length > 0}
                        <ul>
                            {#each fixedDaysOff.sort((a, b) => a.getTime() - b.getTime()) as fixedDay}
                                <li>
                                    <div class="setting-item-label">
                                        <span class="color-box optimized"></span>
                                        <span>{formatDate(fixedDay)}</span>
                                    </div>
                                    <button on:click={() => toggleFixedDayOff(fixedDay)}>
                                        Remove
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {:else}
                        <p style="color: #ccc; text-align: center; padding: 20px;">
                            Tap on a calendar day below to select it as a fixed day off
                        </p>
                    {/if}
                </div>
            {/if}

            {#if showHolidaysList}
                <div class="settings-section">
                    <h3>Public Holidays</h3>
                    <ul>
                        {#each holidays as holiday}
                            <li>
                                <div class="setting-item-label">
                                    <span class="color-box holiday"></span>
                                    <span class={holiday.hidden ? 'strikethrough' : ''}>
                                        {formatDate(holiday.date)}: {holiday.name}
                                    </span>
                                </div>
                                <button on:click={() => toggleHolidayVisibility(holiday)}>
                                    {holiday.hidden ? 'Show' : 'Hide'}
                                </button>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}

            {#if showWeekendSettings}
                <div class="settings-section">
                    <h3>Weekend Days</h3>
                    <ul>
                        {#each getOrderedDays() as {name, index}}
                            <li>
                                <div class="setting-item-label">
                                    <span class="color-box weekend"></span>
                                    <span>{name}</span>
                                </div>
                                <button on:click={() => toggleWeekendDay(index)}>
                                    {weekendDays.includes(index) ? 'Remove' : 'Add'}
                                </button>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}
        </div>
        {/if}

        {#if hasExcludedMonths()}
        <div class="toggle-excluded-months-container">
            <button 
                class="toggle-excluded-months" 
                on:click={() => showExcludedMonths = !showExcludedMonths}
                aria-label={showExcludedMonths ? 'Hide excluded months' : 'Show excluded months'}
            >
                {showExcludedMonths ? 'Hide' : 'Show'} excluded months
            </button>
        </div>
        {/if}

        <div class="calendar-grid">
            {#each visibleMonths as month}
                <div class="calendar-container">
                    <CalendarMonth
                        year={year}
                        month={month}
                        holidays={holidays}
                        startDate={startDate}
                        isActive={isMonthActive(month)}
                        optimizedDaysOff={optimizedDaysOff}
                        consecutiveDaysOff={consecutiveDaysOff}
                        selectedCountryCode={selectedCountryCode}
                        weekendDays={weekendDays}
                        fixedDaysOff={fixedDaysOff}
                        onDayClick={toggleFixedDayOff}
                    />
                </div>
            {/each}
        </div>
    </div>

    {#if showDatePicker}
    <div class="date-picker-overlay" on:click|self={() => showDatePicker = false}>
        <div class="date-picker-modal" on:click|stopPropagation>
            <button class="date-picker-close" on:click={() => showDatePicker = false} aria-label="Close">×</button>
            <h3>Set Start Date</h3>
            <p>Choose when your time off period begins for {year}</p>
            <div class="date-picker-controls">
                <input 
                    type="date" 
                    bind:value={datePickerValue}
                    on:change={handleDatePickerChange}
                    class="date-input"
                    min={formatDateForInput(new Date(year, 0, 1))}
                    max={formatDateForInput(new Date(year, 11, 31))}
                />
            </div>
            <div class="date-picker-buttons">
                {#if isTodayInYear()}
                    <button on:click={setStartDateToToday} class="date-picker-button">
                        Set to today
                    </button>
                {/if}
                {#if !isStartDateJan1st()}
                    <button on:click={resetStartDateToJan1} class="date-picker-button">
                        Reset to Jan 1st
                    </button>
                {/if}
            </div>
            <button class="date-picker-button date-picker-save" on:click={() => showDatePicker = false}>
                Done
            </button>
        </div>
    </div>
    {/if}

    <button type="button" class="toggle-text" on:click={toggleHowItWorks}>
        {showHowItWorks ? 'Hide Details' : 'How does this work?'}
    </button>

    {#if showHowItWorks}
    <div id="how-it-works" class="content-box how-it-works">
        <h3>How does this work?</h3>
        <p>
            This tool detects your country from your IP, uses a default number of government-mandated days off from <a href="https://en.wikipedia.org/wiki/List_of_minimum_annual_leave_by_country" target="_blank" rel="noopener noreferrer">Wikipedia</a>, and a <a href={`https://github.com/commenthol/date-holidays/blob/master/data/countries/${selectedCountryCode}.yaml`} target="_blank" rel="noopener noreferrer">list of holidays</a> for {selectedCountry}.
        </p>
        <p>
            The algorithm prioritizes filling the shortest gaps first. It optimizes for spreading your holidays throughout the year to create the most number of consecutive vacation periods.
        </p>
        <p>
            For the calculation, it counts all vacation stretches that are 3 days or longer, including those lucky 3-day weekends thanks to public holidays. It's slightly optimistic, but captures the spirit of maximising time off.
        </p>
        <p>
            Built with <a href="https://kit.svelte.dev/" target="_blank" rel="noopener noreferrer">SvelteKit</a>. Hosted on <a href="https://vercel.com/" target="_blank" rel="noopener noreferrer">Vercel</a> with <a href="https://www.cloudflare.com/" target="_blank" rel="noopener noreferrer">Cloudflare</a>. Developed using <a href="https://www.cursor.com/" target="_blank" rel="noopener noreferrer">Cursor</a>, an AI-powered code editor, and <a href="https://openai.com/research/gpt-4" target="_blank" rel="noopener noreferrer">GPT-4o</a>.
        </p>
    </div>
    {/if}
</main>

<footer>
    <p>Made with ☕ by <a href="https://zach.ie" target="_blank">Zach</a> (+ GPT-4o)</p>
    <p><a href="https://github.com/zachd/stretch-my-time-off" target="_blank" rel="noopener noreferrer">View on GitHub</a></p>
</footer> 
