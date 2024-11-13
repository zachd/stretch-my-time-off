<script>
    import { onMount } from 'svelte';
    import { injectSpeedInsights } from '@vercel/speed-insights';
    import { inject } from '@vercel/analytics'
    import countries from 'i18n-iso-countries';
    import enLocale from 'i18n-iso-countries/langs/en.json';
    import CalendarMonth from '../lib/CalendarMonth.svelte';
    import { getHolidaysForYear, optimizeDaysOff, calculateConsecutiveDaysOff } from '../lib/holidayUtils.js';
    import { ptoData } from '../lib/ptoData.js';
    import Holidays from 'date-holidays';

    countries.registerLocale(enLocale);
    let countriesList = countries.getNames('en');

    let year;
    let months = Array.from({ length: 12 }, (_, i) => i);
    let selectedCountry = '';
    let holidays = [];
    let daysOff = 0;
    let optimizedDaysOff = [];
    let consecutiveDaysOff = [];
    let placeholder = "Country";
    let countriesInput;
    let statesInput;
    let showHowItWorks = false;

    // Default settings
    let defaultYear = new Date().getFullYear();
    let defaultCountry = '';
    let defaultDaysOff = 0;

    let selectedState = '';
    let selectedStateCode = '';
    let statesList = [];

    let showHolidaysList = false; // State to toggle the visibility of the holidays list

    $: selectedCountryCode = Object.keys(countriesList).find(code => countriesList[code] === selectedCountry);

    $: if (selectedCountryCode || selectedStateCode || daysOff || year) {
        updateHolidays();
    }

    $: if (daysOff) {
        localStorage.setItem('daysOff', daysOff);
    }

    $: if (year) {
        localStorage.setItem('year', year);
    }

    function updateStatesList(countryCode) {
        const hd = new Holidays(countryCode);
        statesList = hd.getStates(countryCode) || [];
    }

    function handleStateChange(event) {
        const stateName = event.target.value;
        selectedStateCode = Object.keys(statesList).find(code => statesList[code] === stateName);
        selectedState = stateName;
        localStorage.setItem('selectedState', selectedState);
        localStorage.setItem('selectedStateCode', selectedStateCode);
    }

    onMount(() => {
        inject();
        injectSpeedInsights();

        // Always fetch the real country and PTO data
        fetchCountryCode().then(() => {
            defaultYear = new Date().getFullYear();
            defaultCountry = selectedCountry;
            defaultDaysOff = ptoData[selectedCountryCode];

            const storedYear = localStorage.getItem('year');
            const storedCountry = localStorage.getItem('selectedCountry');
            const storedDaysOff = localStorage.getItem('daysOff');
            const storedState = localStorage.getItem('selectedState');
            const storedStateCode = localStorage.getItem('selectedStateCode');

            year = storedYear ? parseInt(storedYear, 10) : defaultYear;
            selectedCountry = storedCountry || defaultCountry;
            daysOff = storedDaysOff ? parseInt(storedDaysOff, 10) : defaultDaysOff;
            selectedState = storedState || '';
            selectedStateCode = storedStateCode || '';
            updateHolidays();
        });

        if (selectedCountryCode) {
            updateStatesList(selectedCountryCode);
        }
        window.addEventListener('keydown', handleKeyDown);
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

    function handleCountryChange(event) {
        const fullValue = event.target.value;
        if (selectedCountryCode) {
            daysOff = ptoData[selectedCountryCode] || 0;
            selectedState = ''; // Reset state
            selectedStateCode = ''; // Reset state code
            updateStatesList(selectedCountryCode); // Update states list for the new country
            localStorage.setItem('selectedCountry', selectedCountry);
            localStorage.setItem('selectedState', selectedState);
            localStorage.setItem('selectedStateCode', selectedStateCode);
            localStorage.setItem('daysOff', daysOff);
        }
    }

    function updateHolidays() {
        if (selectedCountryCode) {
            updateStatesList(selectedCountryCode);
            let allHolidays = getHolidaysForYear(selectedCountryCode, year, selectedStateCode);
            holidays = allHolidays.map(holiday => ({
                ...holiday,
                hidden: isHolidayHidden(holiday)
            }));
            const visibleHolidays = holidays.filter(h => !h.hidden);
            optimizedDaysOff = optimizeDaysOff(visibleHolidays, year, daysOff);
            consecutiveDaysOff = calculateConsecutiveDaysOff(visibleHolidays, optimizedDaysOff, year);
        } else {
            holidays = [];
            optimizedDaysOff = [];
            consecutiveDaysOff = [];
        }
    }

    function resetToDefault() {
        year = defaultYear;
        selectedCountry = defaultCountry;
        selectedState = '';
        selectedStateCode = '';
        daysOff = defaultDaysOff;
        localStorage.setItem('year', year);
        localStorage.setItem('selectedCountry', selectedCountry);
        localStorage.setItem('selectedState', selectedState);
        localStorage.setItem('selectedStateCode', selectedStateCode);
        localStorage.setItem('daysOff', daysOff);
    }

    function handleKeyDown(event) {
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
                if (daysOff > 0) {
                    daysOff--;
                    updateHolidays();
                }
                break;
        }
    }

    function adjustInputWidth(inputElement, value) {
        if (typeof window !== 'undefined' && inputElement) { // Ensure this runs only in the browser
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

    // Reactive statements to adjust input width when values change
    $: if (countriesInput) adjustInputWidth(countriesInput, selectedCountry);
    $: if (statesInput) adjustInputWidth(statesInput, selectedState);

    function getFlagEmoji(countryCode) {
        if (!countryCode) return ''; // Return an empty string if countryCode is not available
        return countryCode
            .toUpperCase()
            .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt()));
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

    // Function to toggle the visibility of a holiday
    function toggleHolidayVisibility(holiday) {
        const countryCode = Object.keys(countriesList).find(code => countriesList[code] === selectedCountry);
        if (!countryCode) return;

        const storageKey = `hiddenHolidays_${countryCode}`;
        let hiddenHolidays = JSON.parse(localStorage.getItem(storageKey)) || {};

        // Toggle the hidden state of the holiday
        hiddenHolidays[holiday.date] = !hiddenHolidays[holiday.date];
        localStorage.setItem(storageKey, JSON.stringify(hiddenHolidays));

        // Update the holidays list to trigger reactivity
        holidays = holidays.map(h => {
            if (h.date === holiday.date) {
                return { ...h, hidden: hiddenHolidays[h.date] };
            }
            return h;
        });

        // Recalculate holidays to ensure hidden ones are excluded
        updateHolidays();
    }

    // Function to check if a holiday is hidden
    function isHolidayHidden(holiday) {
        const countryCode = Object.keys(countriesList).find(code => countriesList[code] === selectedCountry);
        if (!countryCode) return false;

        const storageKey = `hiddenHolidays_${countryCode}`;
        const hiddenHolidays = JSON.parse(localStorage.getItem(storageKey)) || {};

        return hiddenHolidays[holiday.date] || false;
    }

    // Function to format the date
    function formatDate(dateString) {
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-GB', options);
    }

    // Reactive statement to calculate the number of visible holidays
    $: visibleHolidaysCount = holidays.filter(h => !h.hidden).length;
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
            grid-template-columns: repeat(2, 1fr); /* Allow 2 columns on smaller screens */
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
        align-items: center;
        padding: 5px;
        border-radius: 5px;
        margin-bottom: 10px;
    }

    .key-item {
        display: flex;
        align-items: center;
        margin: 0 10px;
        font-size: 0.9em;
    }

    .color-box {
        width: 15px;
        height: 15px;
        margin-right: 5px;
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
        border-left: 4px solid #111; /* Lighter border on the left */
        border-top: 4px solid #111; /* Lighter border on the top */
        border-right: 4px solid #555; /* Darker border on the right */
        border-bottom: 4px solid #555; /* Darker border on the bottom */
        color: #fff;
        font-size: 0.8em; /* Smaller font size */
        cursor: pointer;
        padding: 3px; /* Reduced padding */
        margin: 0 3px; /* Reduced margin */
        border-radius: 4px; /* Slightly less rounded edges */
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        transition: transform 0.1s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px; /* Smaller width */
        height: 30px; /* Smaller height */
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

    .day {
        aspect-ratio: 1;
        text-align: center;
        font-size: 0.6em;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ddd;
        background-color: #222;
        position: relative;
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
    }

    .toggle-text:hover {
        color: #61dafb;
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
        margin-bottom: 10px;
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
    }

    .holidays-list ul {
        list-style-type: none;
        padding: 0;
    }

    .holidays-list li {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
    }

    .holidays-list button {
        margin-left: 10px;
        background-color: #444;
        border: none;
        color: #fff;
        padding: 5px 25px;
        cursor: pointer;
        border-radius: 5px;
    }

    .holidays-list button:hover {
        background-color: #555;
    }
</style>

<main>
    <div class="header">
        <h2>🌴 Stretch&nbsp;My Time&nbsp;Off</h2>
        <p>
            In 
            <strong>
                {getFlagEmoji(Object.keys(countriesList).find(code => countriesList[code] === selectedCountry))}
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
            <span class="flag" style="vertical-align: middle;">{getFlagEmoji(Object.keys(countriesList).find(code => countriesList[code] === selectedCountry))}</span>
            {#if Object.keys(statesList).length > 0}
                <input bind:this={statesInput} list="states" class="editable-input bold" bind:value={selectedState} on:input={(e) => { handleStateChange(e); }} on:focus={() => { statesInput.value = ''; }} placeholder="State" aria-label="State" />
                <datalist id="states">
                    {#each Object.entries(statesList) as [code, name]}
                        <option value={name}>{name}</option>
                    {/each}
                </datalist>
                in
            {/if}
            <input bind:this={countriesInput} list="countries" class="editable-input bold" bind:value={selectedCountry} placeholder={placeholder} on:input={(e) => { handleCountryChange(e); }} on:focus={() => { countriesInput.value = ''; }} aria-label="Select country" />
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
                <span class="color-box weekend"></span> Weekend
            </div>
            <div class="key-item">
                <span class="color-box optimized"></span> Day&nbsp;Off
            </div>
            <div class="key-item">
                <span class="color-box holiday"></span> Public&nbsp;Holiday
            </div>
            {#if holidays.length > 0}
                <a href="#" on:click|preventDefault={() => showHolidaysList = !showHolidaysList} class="edit-link">
                    (edit&nbsp;list)
                </a>
            {/if}
        </div>

        {#if showHolidaysList}
        <div class="holidays-list">
            <h3>Public Holidays</h3>
            <ul>
                {#each holidays as holiday}
                    <li>
                        <span class="color-box holiday"></span>
                        <span class={holiday.hidden ? 'strikethrough' : ''}>
                            {formatDate(holiday.date)}: {holiday.name}
                        </span>
                        <button on:click={() => toggleHolidayVisibility(holiday)}>
                            {holiday.hidden ? 'Show' : 'Hide'}
                        </button>
                    </li>
                {/each}
            </ul>
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
                    />
                </div>
            {/each}
        </div>
    </div>

    <div class="toggle-text" on:click={toggleHowItWorks}>
        {showHowItWorks ? 'Hide Details' : 'How does this work?'}
    </div>

    {#if showHowItWorks}
    <div id="how-it-works" class="content-box how-it-works">
        <h3>How does this work?</h3>
        <p>
            This tool detects your country from your IP, uses a default number of government-mandated days off from <a href="https://en.wikipedia.org/wiki/List_of_minimum_annual_leave_by_country" target="_blank" rel="noopener noreferrer">Wikipedia</a>, and a <a href={`https://github.com/commenthol/date-holidays/blob/master/data/countries/${Object.keys(countriesList).find(code => countriesList[code] === selectedCountry)}.yaml`} target="_blank" rel="noopener noreferrer">list of holidays</a> for {selectedCountry}.
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