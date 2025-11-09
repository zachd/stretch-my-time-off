<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { Holiday, ConsecutiveDaysOff } from '../lib/types';
    import CalendarMonth from '../lib/CalendarMonth.svelte';
    import HolidaySettings from '../lib/components/HolidaySettings.svelte';
    import WeekendSettings from '../lib/components/WeekendSettings.svelte';
    import { ptoData } from '../lib/ptoData';
    import { 
        getFlagEmoji, 
        formatDate, 
        getOrderedDays, 
        adjustInputWidth,
        getAppState, 
        saveAppState, 
        getWeekendDays, 
        setWeekendDays,
        getCountryCodeFromName,
        getDefaultDaysOff,
        toggleWeekendDay as toggleWeekendDayUtil
    } from '../lib/utils';
    import { 
        countriesList, 
        fetchCountryCode, 
        handleCountryChange as handleCountryChangeHelper,
        handleStateChange as handleStateChangeHelper,
        updateStatesList 
    } from '../lib/composables/useAppState';
    import { 
        updateHolidays as updateHolidaysHelper,
        toggleHolidayVisibility as toggleHolidayVisibilityHelper
    } from '../lib/composables/useHolidays';
    import { createKeyboardHandler } from '../lib/composables/useKeyboardNavigation';

    let year: number;
    let months: number[] = Array.from({ length: 12 }, (_, i) => i);
    let selectedCountry: string = '';
    let holidays: Holiday[] = [];
    let daysOff: number = 0;
    let optimizedDaysOff: Date[] = [];
    let consecutiveDaysOff: ConsecutiveDaysOff[] = [];
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
    let weekendDays: number[] = [];

    $: selectedCountryCode = getCountryCodeFromName(selectedCountry, countriesList);

    function updateHolidays(): void {
        if (selectedCountryCode) {
            statesList = updateStatesList(selectedCountryCode);
            const result = updateHolidaysHelper(selectedCountryCode, selectedStateCode, year, daysOff, weekendDays);
            holidays = result.holidays;
            optimizedDaysOff = result.optimizedDaysOff;
            consecutiveDaysOff = result.consecutiveDaysOff;
        } else {
            holidays = [];
            optimizedDaysOff = [];
            consecutiveDaysOff = [];
        }
    }

    $: if (selectedCountryCode || selectedStateCode || daysOff || year) {
        updateHolidays();
    }

    $: if (daysOff) {
        saveAppState({ daysOff });
    }

    $: if (year) {
        saveAppState({ year });
    }

    function handleStateChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        const stateName = target.value;
        handleStateChangeHelper(stateName, statesList, 
            (state) => { selectedState = state; },
            (code) => { selectedStateCode = code; }
        );
    }

    function handleCountryChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        if (selectedCountryCode) {
            handleCountryChangeHelper(selectedCountry, selectedCountryCode,
                (days) => { daysOff = days; },
                (state) => { selectedState = state; },
                (code) => { selectedStateCode = code; }
            );
            statesList = updateStatesList(selectedCountryCode);
        }
    }

    function resetToDefault(): void {
        year = defaultYear;
        selectedCountry = defaultCountry;
        selectedState = '';
        selectedStateCode = '';
        daysOff = defaultDaysOff;
        saveAppState({
            year,
            selectedCountry,
            selectedState,
            selectedStateCode,
            daysOff
        });
    }

    function toggleHolidayVisibility(holiday: Holiday): void {
        holidays = toggleHolidayVisibilityHelper(holiday, selectedCountryCode, holidays);
        updateHolidays();
    }

    function toggleWeekendDay(dayNumber: number): void {
        weekendDays = toggleWeekendDayUtil(weekendDays, dayNumber);
        setWeekendDays(weekendDays);
        updateHolidays();
    }

    function toggleHowItWorks(): void {
        showHowItWorks = !showHowItWorks;
        if (showHowItWorks) {
            const howItWorksElement = document.querySelector('.how-it-works');
            if (howItWorksElement) {
                howItWorksElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    $: visibleHolidaysCount = holidays.filter(h => !h.hidden).length;

    $: if (countriesInput) adjustInputWidth(countriesInput, selectedCountry);
    $: if (statesInput) adjustInputWidth(statesInput, selectedState);

    const handleKeyDown = createKeyboardHandler(
        () => year,
        (value) => { year = value; },
        () => daysOff,
        (value) => { daysOff = value; },
        () => updateHolidays()
    );

    onMount(() => {
        fetchCountryCode().then((country) => {
            selectedCountry = country;
            defaultYear = new Date().getFullYear();
            defaultCountry = selectedCountry;
            
            // Calculate country code immediately from country name
            const countryCode = getCountryCodeFromName(country, countriesList);
            defaultDaysOff = getDefaultDaysOff(countryCode, ptoData);

            const stored = getAppState(defaultYear, defaultCountry, defaultDaysOff);
            year = stored.year;
            selectedCountry = stored.selectedCountry || defaultCountry;
            selectedState = stored.selectedState;
            selectedStateCode = stored.selectedStateCode;
            
            // Recalculate country code after setting selectedCountry
            const currentCountryCode = getCountryCodeFromName(selectedCountry, countriesList);
            const countryDefaultDaysOff = getDefaultDaysOff(currentCountryCode, ptoData);
            
            // Use stored daysOff if it exists and is valid, otherwise use the default for the current country
            if (stored.daysOff && stored.daysOff > 0) {
                daysOff = stored.daysOff;
            } else {
                daysOff = countryDefaultDaysOff;
                // Save the default to localStorage so it persists
                if (countryDefaultDaysOff > 0) {
                    saveAppState({ daysOff: countryDefaultDaysOff });
                }
            }
            
            if (currentCountryCode) {
                statesList = updateStatesList(currentCountryCode);
            }
            updateHolidays();
        });

        // Load weekend days from localStorage
        weekendDays = getWeekendDays();
        setWeekendDays(weekendDays);

        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', handleKeyDown);
        }
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', handleKeyDown);
        }
    });
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
                <button on:click={() => { if (daysOff > 0) { daysOff--; updateHolidays(); } }} aria-label="Decrease days off">▼</button>
                <span class="bold">{daysOff}</span>
                <button on:click={() => { daysOff++; updateHolidays(); }} aria-label="Increase days off">▲</button>
            </span>
            days&nbsp;off in
            <span class="arrow-controls">
                <button on:click={() => { year--; updateHolidays(); }} aria-label="Previous year">◀</button>
                <span class="bold">{year}</span>
                <button on:click={() => { year++; updateHolidays(); }} aria-label="Next year">▶</button>
            </span>
        </p>
        {#if year !== defaultYear || selectedCountry !== defaultCountry || daysOff !== defaultDaysOff}
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
                    <span class="color-box optimized"></span>
                    <span>Day Off</span>
                </div>
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

        {#if showHolidaysList || showWeekendSettings}
        <div class="holidays-list">
            {#if showHolidaysList}
                <HolidaySettings {holidays} onToggle={toggleHolidayVisibility} />
            {/if}

            {#if showWeekendSettings}
                <WeekendSettings {weekendDays} {selectedCountryCode} onToggle={toggleWeekendDay} />
            {/if}
        </div>
        {/if}

        <div class="calendar-grid">
            {#each months as month}
                <div class="calendar-container">
                    <CalendarMonth
                        year={year}
                        month={month}
                        holidays={holidays}
                        optimizedDaysOff={optimizedDaysOff}
                        consecutiveDaysOff={consecutiveDaysOff}
                        selectedCountryCode={selectedCountryCode}
                        weekendDays={weekendDays}
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