<script>
    import { onMount } from 'svelte';
    import countries from 'i18n-iso-countries';
    import enLocale from 'i18n-iso-countries/langs/en.json';
    import CalendarMonth from '../lib/CalendarMonth.svelte';
    import { getHolidaysForYear, optimizeDaysOff, calculateConsecutiveDaysOff } from '../lib/holidayUtils.js';

    countries.registerLocale(enLocale);
    let countriesList = countries.getNames('en');

    let year = new Date().getFullYear();
    let months = Array.from({ length: 12 }, (_, i) => i);
    let selectedCountry = 'Belgium';
    let holidays = [];
    let daysOff = 24;
    let optimizedDaysOff = [];
    let consecutiveDaysOff = [];

    function handleYearChange(event) {
        year = parseInt(event.target.value);
        updateHolidays();
    }

    function handleCountryChange(event) {
        const countryName = event.target.value;
        const countryCode = Object.keys(countriesList).find(code => countriesList[code] === countryName);
        if (countryCode) {
            selectedCountry = countryName;
            updateHolidays();
        }
    }

    function updateHolidays() {
        const countryCode = Object.keys(countriesList).find(code => countriesList[code] === selectedCountry);
        if (countryCode) {
            holidays = getHolidaysForYear(countryCode, year);
            optimizedDaysOff = optimizeDaysOff(holidays, year, daysOff);
            consecutiveDaysOff = calculateConsecutiveDaysOff(holidays, optimizedDaysOff, year);
        }
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

    onMount(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    });

    updateHolidays();
</script>

<style>

    header, footer {
        text-align: center;
        color: #e0e0e0; /* Monochrome light text */
        padding: 15px;
        border-bottom: 1px solid #333; /* Subtle border for separation */
    }

    h1 {
        margin: 0;
        font-size: 2em;
    }

    footer {
        border-top: 1px solid #333;
        font-size: 0.9em;
    }

    .content-box {
        max-width: 900px;
        margin: 20px auto;
        padding: 10px 0;
        background-color: #1e1e1e; /* Slightly lighter dark background for content boxes */
        text-align: center;
        font-size: 1em; /* Slightly smaller font size */
        color: #e0e0e0; /* Light gray text */
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
        margin-bottom: 40px;
    }

    input {
        margin: 0 10px;
        font-size: 0.9em; /* Slightly smaller font size */
        padding: 8px;
        background-color: #2a2a2a; /* Darker gray for inputs */
        color: #e0e0e0; /* Light text for inputs */
        border: 1px solid #444;
        border-radius: 5px;
        transition: background-color 0.3s;
        width: auto; /* Dynamic width based on content */
    }

    input::hover {
        background-color: #333; /* Slightly lighter on hover */
    }

    ul {
        list-style-type: none;
        padding: 0;
    }

    li {
        margin: 15px 0;
        padding: 15px;
        background-color: #2a2a2a;
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }

    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr); /* Default to 3 columns */
        gap: 20px;
        justify-items: center;
        padding: 20px;
    }

    @media (max-width: 768px) {
        .calendar-grid {
            grid-template-columns: repeat(2, 1fr); /* 2 columns on smaller screens */
        }
    }

    .calendar-container {
        width: 100%;
        aspect-ratio: 1;
        background-color: #2a2a2a; /* Dark gray for calendar */
        color: #e0e0e0;
        border-radius: 5px;
        padding: 10px;
        box-sizing: border-box;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }

    .editable-input {
        border: none;
        border-bottom: 1px dotted #e0e0e0;
        background: none;
        color: inherit;
        font-size: inherit;
        font-family: inherit;
        width: auto;
        text-align: center;
        margin: 0 10px;
        outline: none;
    }

    .arrow-controls {
        display: inline-flex;
        align-items: center;
    }

    button {
        background-color: #2a2a2a;
        border: 1px solid #444;
        color: #e0e0e0;
        font-size: 1em; /* Slightly smaller font size */
        cursor: pointer;
        padding: 5px 10px;
        margin: 0 10px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        transition: background-color 0.3s, color 0.3s, transform 0.1s;
    }

    button:hover {
        background-color: #333;
        color: #fff; /* Change color on hover */
    }

    button:active {
        transform: translateY(2px); /* Simulate button press */
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    button:focus {
        outline: 2px solid #61dafb; /* Accessibility focus outline */
    }

    .bold {
        font-weight: bold;
        font-size: 1.2em;
    }
</style>

<header>
    <h1>Stretch My Holidays</h1>
</header>

<main>
    <div class="content-box">
        <p>
            I live in 
            <input list="countries" class="editable-input bold" bind:value={selectedCountry} on:change={handleCountryChange} aria-label="Select country" />
            and have 
            <span class="arrow-controls">
                <button on:click={() => { daysOff++; updateHolidays(); }} aria-label="Increase days off">▲</button>
                <span class="bold">{daysOff}</span>&nbsp;days off
                <button on:click={() => { if (daysOff > 0) { daysOff--; updateHolidays(); } }} aria-label="Decrease days off">▼</button>
            </span> in 
            <span class="arrow-controls">
                <button on:click={() => { year--; updateHolidays(); }} aria-label="Previous year">◀</button>
                <span class="bold">{year}</span>
                <button on:click={() => { year++; updateHolidays(); }} aria-label="Next year">▶</button>
            </span>
        </p>

        <datalist id="countries">
            {#each Object.values(countriesList) as name}
                <option value={name}></option>
            {/each}
        </datalist>
    </div>

    <div class="content-box">
        <div class="calendar-grid">
            {#each months as month}
                <div class="calendar-container">
                    <CalendarMonth {year} {month} {holidays} {optimizedDaysOff} />
                </div>
            {/each}
        </div>
    </div>
</main>

<footer>
    <p>© 2023 Stretch My Holidays. All rights reserved.</p>
</footer> 