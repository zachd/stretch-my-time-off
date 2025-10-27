<script lang="ts">
    import { onMount } from 'svelte';
    import countries from 'i18n-iso-countries';
    import enLocale from 'i18n-iso-countries/langs/en.json';
    import CalendarMonth from '../lib/CalendarMonth.svelte';
    import { getHolidaysForYear, optimizeDaysOff, calculateConsecutiveDaysOff } from '../lib/holidayUtils';
    import { ptoData } from '../lib/ptoData';
    import Holidays from 'date-holidays';

    let calendarComponent: any;

    countries.registerLocale(enLocale);
    let countriesList: Record<string, string> = countries.getNames('en');

    let startDate: string = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
    
    // Set default expiry to 1 year from start date
    const getDefaultExpiryDate = (start: string) => {
        const d = new Date(start);
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().split('T')[0];
    };
    
    // Generate list of months to display based on start and expiry dates
    $: monthsToDisplay = (() => {
        const start = new Date(startDate);
        const expiry = ptoExpiryDate ? new Date(ptoExpiryDate) : new Date(getDefaultExpiryDate(startDate));
        const months: Array<{ year: number; month: number }> = [];
        
        const current = new Date(start.getFullYear(), start.getMonth(), 1);
        const end = new Date(expiry.getFullYear(), expiry.getMonth(), 1);
        
        while (current <= end) {
            months.push({ year: current.getFullYear(), month: current.getMonth() });
            current.setMonth(current.getMonth() + 1);
        }
        
        return months;
    })();
    
    let selectedCountry: string = '';
    let holidays: Array<{ date: Date; name: string; hidden?: boolean }> = [];
    let chosenDaysOff: Array<Date> = [];
    let excludedDaysOff: Array<Date> = []; // Days user wants to exclude from optimization
    let daysOff: number = 0;
    let optimizedDaysOff: Date[] = [];
    let consecutiveDaysOff: Array<{ startDate: Date; endDate: Date; totalDays: number; fullConsecutiveDays: number }> = [];
    let countriesInput: HTMLInputElement | null = null;
    let statesInput: HTMLInputElement | null = null;
    let showHowItWorks: boolean = false;

    // Default settings
    let defaultCountry: string = '';
    let defaultDaysOff: number = 0;

    let selectedState: string = '';
    let selectedStateCode: string = '';
    let statesList: Record<string, string> = {};

    let showHolidaysList: boolean = false;
    let showWeekendSettings: boolean = false;

    let weekendDays: number[] = [];
    let ptoExpiryDate: string = getDefaultExpiryDate(startDate); // Default to 1 year from start date

    // Calculate stats about the date range
    $: dateRangeStats = (() => {
        const start = new Date(startDate);
        const expiry = ptoExpiryDate ? new Date(ptoExpiryDate) : new Date(getDefaultExpiryDate(startDate));
        const diffTime = Math.abs(expiry.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = monthsToDisplay.length;
        return { days: diffDays, months: diffMonths };
    })();

    // Calculate remaining PTO days
    $: remainingPtoDays = Math.max(0, daysOff - (chosenDaysOff.length + optimizedDaysOff.length));

    $: selectedCountryCode = Object.keys(countriesList).find(code => countriesList[code] === selectedCountry) || '';

    $: if (startDate && typeof window !== 'undefined') {
        localStorage.setItem('startDate', startDate);
        
        // Update expiry date if it hasn't been manually set or if it's before the new start date
        const startDateObj = new Date(startDate);
        const expiryDateObj = ptoExpiryDate ? new Date(ptoExpiryDate) : null;
        if (!expiryDateObj || expiryDateObj < startDateObj) {
            ptoExpiryDate = getDefaultExpiryDate(startDate);
        }
    }

    $: if (selectedCountryCode || selectedStateCode || daysOff || chosenDaysOff || ptoExpiryDate) {
        updateHolidays();
    }

    $: if (chosenDaysOff.length > 0 && typeof window !== 'undefined') {
        localStorage.setItem('chosenDaysOff', JSON.stringify(chosenDaysOff));
    }

    $: if (daysOff && typeof window !== 'undefined') {
        localStorage.setItem('daysOff', daysOff.toString());
    }

    $: if (ptoExpiryDate && typeof window !== 'undefined') {
        localStorage.setItem('ptoExpiryDate', ptoExpiryDate);
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
        localStorage.setItem('selectedState', selectedState);
        localStorage.setItem('selectedStateCode', selectedStateCode);
    }

    onMount(() => {

        fetchCountryCode().then(() => {
            defaultCountry = selectedCountry;
            defaultDaysOff = ptoData[selectedCountryCode] || 0;

            const storedCountry = localStorage.getItem('selectedCountry');
            const storedDaysOff = localStorage.getItem('daysOff');
            const storedChosenDaysOff = JSON.parse(localStorage.getItem('chosenDaysOff') || '[]');
            const storedExcludedDaysOff = JSON.parse(localStorage.getItem('excludedDaysOff') || '[]');
            const storedState = localStorage.getItem('selectedState');
            const storedStateCode = localStorage.getItem('selectedStateCode');
            const storedPtoExpiryDate = localStorage.getItem('ptoExpiryDate');
            const storedStartDate = localStorage.getItem('startDate');

            selectedCountry = storedCountry || defaultCountry;
            daysOff = storedDaysOff ? parseInt(storedDaysOff, 10) : defaultDaysOff;
            selectedState = storedState || '';
            selectedStateCode = storedStateCode || '';
            chosenDaysOff = storedChosenDaysOff.map((dateString: string) => {
              return new Date(dateString);
            });
            excludedDaysOff = storedExcludedDaysOff.map((dateString: string) => {
              return new Date(dateString);
            });
            ptoExpiryDate = storedPtoExpiryDate || '';
            startDate = storedStartDate || new Date().toISOString().split('T')[0];
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
        if (selectedCountryCode) {
            daysOff = ptoData[selectedCountryCode] || 0;
            selectedState = ''; // Reset state
            selectedStateCode = ''; // Reset state code
            updateStatesList(selectedCountryCode); // Update states list for the new country
            localStorage.setItem('selectedCountry', selectedCountry);
            localStorage.setItem('selectedState', selectedState);
            localStorage.setItem('selectedStateCode', selectedStateCode);
            localStorage.setItem('daysOff', daysOff.toString());
        }
    }

    function updateHolidays() {
        if (selectedCountryCode) {
            updateStatesList(selectedCountryCode);
            
            // Determine which years we need to fetch holidays for
            const startDateObj = new Date(startDate + 'T00:00:00');
            const expiryDateObj = new Date((ptoExpiryDate || getDefaultExpiryDate(startDate)) + 'T23:59:59');
            
            // Fetch holidays for all years in the range
            const yearsToFetch = new Set<number>();
            const startYear = startDateObj.getFullYear();
            const endYear = expiryDateObj.getFullYear();
            for (let y = startYear; y <= endYear; y++) {
                yearsToFetch.add(y);
            }
            
            // Fetch and combine holidays from all relevant years
            let allHolidays: Array<{ date: Date | string; name: string }> = [];
            yearsToFetch.forEach(y => {
                const yearHolidays = getHolidaysForYear(selectedCountryCode, y, selectedStateCode);
                allHolidays = [...allHolidays, ...yearHolidays];
            });
            
            holidays = allHolidays.map(holiday => {
                const holidayWithDate = {
                    ...holiday,
                    date: new Date(holiday.date)
                };
                return {
                    ...holidayWithDate,
                    hidden: isHolidayHidden(holidayWithDate)
                };
            });
            const visibleHolidays = holidays.filter(h => !h.hidden);
            optimizedDaysOff = optimizeDaysOff(visibleHolidays, chosenDaysOff, daysOff, weekendDays, startDateObj, expiryDateObj, excludedDaysOff);
            consecutiveDaysOff = calculateConsecutiveDaysOff(visibleHolidays, optimizedDaysOff, weekendDays, startDateObj, expiryDateObj, chosenDaysOff);
        } else {
            holidays = [];
            chosenDaysOff = [];
            optimizedDaysOff = [];
            consecutiveDaysOff = [];
        }
    }

    function resetToDefault() {
        selectedCountry = defaultCountry;
        selectedState = '';
        selectedStateCode = '';
        daysOff = defaultDaysOff;
        chosenDaysOff = [];
        excludedDaysOff = [];
        startDate = new Date().toISOString().split('T')[0];
        ptoExpiryDate = getDefaultExpiryDate(startDate);
        localStorage.setItem('selectedCountry', selectedCountry);
        localStorage.setItem('selectedState', selectedState);
        localStorage.setItem('selectedStateCode', selectedStateCode);
        localStorage.setItem('daysOff', daysOff.toString());
        localStorage.setItem('chosenDaysOff', JSON.stringify(chosenDaysOff));
        localStorage.setItem('excludedDaysOff', JSON.stringify(excludedDaysOff));
    }

    function setDateRangePreset(preset: 'rest-of-year' | '6-months' | '12-months') {
        const today = new Date();
        startDate = today.toISOString().split('T')[0];
        
        switch (preset) {
            case 'rest-of-year':
                const endOfYear = new Date(today.getFullYear(), 11, 31);
                ptoExpiryDate = endOfYear.toISOString().split('T')[0];
                break;
            case '6-months':
                const sixMonths = new Date(today);
                sixMonths.setMonth(sixMonths.getMonth() + 6);
                ptoExpiryDate = sixMonths.toISOString().split('T')[0];
                break;
            case '12-months':
                ptoExpiryDate = getDefaultExpiryDate(startDate);
                break;
        }
    }

    function handleKeyDown(event: KeyboardEvent) {
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                daysOff++;
                updateHolidays();
                break;
            case 'ArrowDown':
                event.preventDefault();
                if (daysOff > 0) {
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
            const weekFirstDay = new Intl.Locale(normalizedLocale)?.weekInfo?.firstDay;
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

    function onChosenDaysOff(chosenDate: Date | null) {
        if (!chosenDate)
            return;

        // Check if day is already chosen - if so, remove it
        if (calendarComponent.isChosenOff(chosenDate)) {
            removeChosen(chosenDate);
            return;
        }

        // A day cannot be both chosen and excluded - remove from excluded if present
        excludedDaysOff = excludedDaysOff.filter(d => d.toDateString() !== chosenDate.toDateString());

        chosenDaysOff.push(chosenDate);
        // This triggers a calendar re-render
        // https://github.com/sveltejs/svelte/issues/2362
        chosenDaysOff = chosenDaysOff;
        localStorage.setItem('chosenDaysOff', JSON.stringify(chosenDaysOff));
        localStorage.setItem('excludedDaysOff', JSON.stringify(excludedDaysOff));
        updateHolidays();
    }

    function removeChosen(toRemove: Date) {
        chosenDaysOff = chosenDaysOff.filter((date) => date.toDateString() !== toRemove.toDateString());
        localStorage.setItem('chosenDaysOff', JSON.stringify(chosenDaysOff));
        updateHolidays();
    }

    function handleDayClick(event: CustomEvent<{ date: Date; ctrlKey: boolean; metaKey: boolean }>) {
        const { date, ctrlKey, metaKey } = event.detail;
        
        // Ctrl/Cmd+Click: Toggle excluded status for any working day
        if (ctrlKey || metaKey) {
            const isExcluded = excludedDaysOff.some(d => d.toDateString() === date.toDateString());
            const isChosen = chosenDaysOff.some(d => d.toDateString() === date.toDateString());
            
            // A day cannot be both chosen and excluded
            if (isChosen) {
                return; // Don't allow excluding chosen days
            }
            
            if (isExcluded) {
                // Un-exclude this day
                excludedDaysOff = excludedDaysOff.filter(d => d.toDateString() !== date.toDateString());
                localStorage.setItem('excludedDaysOff', JSON.stringify(excludedDaysOff));
                updateHolidays();
            } else {
                // Exclude this day (works for any working day, not just optimized)
                excludedDaysOff.push(date);
                excludedDaysOff = excludedDaysOff;
                localStorage.setItem('excludedDaysOff', JSON.stringify(excludedDaysOff));
                updateHolidays();
            }
        } else {
            // Normal click: Toggle chosen status
            onChosenDaysOff(date);
        }
    }

    function getMinDate() {
        const startDateObj = new Date(startDate);
        return startDateObj;
    }

    function getMaxDate() {
        const expiryDate = ptoExpiryDate ? new Date(ptoExpiryDate) : new Date(getDefaultExpiryDate(startDate));
        return expiryDate;
    }
</script>

<style>
    :root {
      --date-picker-background: #111;
      --date-picker-foreground: #f7f7f7;
    }
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
        line-height: 2;
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

    .color-box.chosen {
        background-color: #2196f3 !important; /* Blue - user's active choice */
    }

    .color-box.excluded {
        background-color: #f44336; /* Red - rejected/blocked */
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
    .color-box.chosen {
        background-color: rgba(255,0,0,255);
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
        margin-left: 10px;
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
            </strong>, there are <strong>{holidays.length}</strong> public holidays{#if visibleHolidaysCount < holidays.length}&nbsp;(<strong>{visibleHolidaysCount} selected</strong>){/if} from <strong>{new Date(startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</strong> to <strong>{(ptoExpiryDate ? new Date(ptoExpiryDate) : new Date(getDefaultExpiryDate(startDate))).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</strong>. 
        </p>
        <p>
            {#if chosenDaysOff.length + optimizedDaysOff.length > 0}
                Using <strong>{chosenDaysOff.length + optimizedDaysOff.length} PTO days</strong>{#if chosenDaysOff.length > 0 || excludedDaysOff.length > 0} (<strong>{chosenDaysOff.length}</strong> chosen, <strong>{optimizedDaysOff.length}</strong> optimized{#if excludedDaysOff.length > 0}, <strong>{excludedDaysOff.length}</strong> excluded{/if}){/if}, you get <strong>{consecutiveDaysOff.reduce((total, group) => total + group.fullConsecutiveDays, 0)}&nbsp;days</strong> of time off! 
            {:else}
                Configure your PTO days below to see the magic ✨
            {/if}
            {#if chosenDaysOff.length + optimizedDaysOff.length > 0}
                (<a href="#how-it-works" on:click={toggleHowItWorks}>how?</a>)
            {/if}
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
                <button on:click={() => { if (daysOff > 0) { daysOff--; updateHolidays(); } }} aria-label="Decrease days off">▼</button>
                <span class="bold">{daysOff}</span>
                <button on:click={() => { daysOff++; updateHolidays(); }} aria-label="Increase days off">▲</button>
            </span>
            days&nbsp;off
        </p>
        <p>
            Calendar starts on:
            <input 
                type="date" 
                bind:value={startDate}
                aria-label="Calendar start date"
                style="margin: 0 5px; font-size: 1em; padding: 8px; background-color: transparent; border: 1px solid #555; border-radius: 5px; color: #fff;"
            />
            {#if startDate !== new Date().toISOString().split('T')[0]}
                <button on:click={() => { startDate = new Date().toISOString().split('T')[0]; }} aria-label="Reset to today" style="width: auto; padding: 5px 10px;">Today</button>
            {/if}
        </p>
        <p>
            PTO expires on:
            <input 
                type="date" 
                bind:value={ptoExpiryDate}
                placeholder="Optional"
                aria-label="PTO expiry date"
                style="margin: 0 5px; font-size: 1em; padding: 8px; background-color: transparent; border: 1px solid #555; border-radius: 5px; color: #fff;"
            />
            {#if ptoExpiryDate}
                <button on:click={() => { ptoExpiryDate = ''; }} aria-label="Clear expiry date" style="width: auto; padding: 5px 10px;">Clear</button>
            {/if}
        </p>
        
        <p style="margin: 15px 0; font-size: 0.9em;">
            <span style="color: #888;">Quick presets:</span>
            <button on:click={() => setDateRangePreset('rest-of-year')} aria-label="Rest of this year" style="width: auto; padding: 5px 10px; margin: 0 5px; font-size: 0.85em;">
                Rest of {new Date().getFullYear()}
            </button>
            <button on:click={() => setDateRangePreset('6-months')} aria-label="Next 6 months" style="width: auto; padding: 5px 10px; margin: 0 5px; font-size: 0.85em;">
                Next 6 months
            </button>
            <button on:click={() => setDateRangePreset('12-months')} aria-label="Next 12 months" style="width: auto; padding: 5px 10px; margin: 0 5px; font-size: 0.85em;">
                Next 12 months
            </button>
        </p>
        
        {#if ptoExpiryDate && startDate && new Date(ptoExpiryDate) < new Date(startDate)}
            <p style="color: #ff9800; font-size: 0.9em; margin: 10px 0;">
                ⚠️ Expiry date is before start date. Please adjust your dates.
            </p>
        {:else}
            <p style="color: #888; font-size: 0.9em; margin: 10px 0;">
                📅 Showing <strong>{dateRangeStats.months} month{dateRangeStats.months !== 1 ? 's' : ''}</strong> ({dateRangeStats.days} days)
                {#if remainingPtoDays > 0}
                    • <span style="color: #4CAF50;">{remainingPtoDays} PTO day{remainingPtoDays !== 1 ? 's' : ''} remaining</span>
                {/if}
            </p>
        {/if}
        
        {#if selectedCountry !== defaultCountry || daysOff !== defaultDaysOff}
            <a href="#" on:click|preventDefault={resetToDefault} class="reset-link">Reset to my country</a>
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
            <div class="key-item">
                <div class="key-label">
                    <span class="color-box chosen"></span>
                    <span>Chosen (manual)</span>
                </div>
            </div>
            <div class="key-item">
                <div class="key-label">
                    <span class="color-box optimized"></span>
                    <span>Optimized (recommended)</span>
                </div>
            </div>
            <div class="key-item">
                <div class="key-label">
                    <span class="color-box excluded"></span>
                    <span>Excluded (do not use)</span>
                </div>
            </div>
        </div>

        <p style="text-align: center; color: #888; font-size: 0.85em; margin: 10px 0;">
            💡 Click on any working day to add or remove it from your chosen days off<br/>
            <span style="font-size: 0.9em;">Hold Ctrl/Cmd and click on any working day to exclude it from optimization</span>
        </p>

        {#if showHolidaysList || showWeekendSettings}
        <div class="holidays-list">
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

        <div class="calendar-grid">
            {#each monthsToDisplay as { year, month }}
                <div class="calendar-container">
                    <CalendarMonth
                        bind:this={calendarComponent}
                        year={year}
                        month={month}
                        holidays={holidays}
                        chosenDaysOff={chosenDaysOff}
                        optimizedDaysOff={optimizedDaysOff}
                        excludedDaysOff={excludedDaysOff}
                        consecutiveDaysOff={consecutiveDaysOff}
                        selectedCountryCode={selectedCountryCode}
                        weekendDays={weekendDays}
                        on:dayClick={handleDayClick}
                    />
                </div>
            {/each}
        </div>
    </div>

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
