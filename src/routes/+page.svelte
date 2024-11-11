<script>
    import { onMount } from 'svelte';
    import countries from 'i18n-iso-countries';
    import enLocale from 'i18n-iso-countries/langs/en.json';
    import CalendarMonth from '../lib/CalendarMonth.svelte';
    import { getHolidaysForYear, optimizeDaysOff, calculateConsecutiveDaysOff } from '../lib/holidayUtils.js';
    import { ptoData } from '../lib/ptoData.js';

    countries.registerLocale(enLocale);
    let countriesList = countries.getNames('en');

    let year = new Date().getFullYear();
    let months = Array.from({ length: 12 }, (_, i) => i);
    let selectedCountry = 'Belgium';
    let holidays = [];
    let daysOff = ptoData['BE'];
    let optimizedDaysOff = [];
    let consecutiveDaysOff = [];
    let placeholder = "Country";
    let inputElement;

    function handleCountryChange(event) {
        const fullValue = event.target.value;
        const countryCode = Object.keys(countriesList).find(code => countriesList[code] === fullValue);
        if (countryCode) {
            selectedCountry = fullValue;
            daysOff = ptoData[countryCode] || 0;
            updateHolidays();
        }
        adjustInputWidth(event.target);
    }

    function adjustInputWidth(inputElement) {
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.textContent = inputElement.value || inputElement.placeholder;
        document.body.appendChild(tempSpan);
        inputElement.style.width = `${tempSpan.offsetWidth + 50}px`;
        document.body.removeChild(tempSpan);
    }

    function updateHolidays() {
        const countryCode = Object.keys(countriesList).find(code => countriesList[code] === selectedCountry);
        if (countryCode) {
            holidays = getHolidaysForYear(countryCode, year);
            optimizedDaysOff = optimizeDaysOff(holidays, year, daysOff);
            consecutiveDaysOff = calculateConsecutiveDaysOff(holidays, optimizedDaysOff, year);
        } else {
            holidays = [];
            optimizedDaysOff = [];
            consecutiveDaysOff = [];
        }
        console.log('Year:', year);
        console.log('Holidays updated:', holidays);
        console.log('Optimized Days Off:', optimizedDaysOff);
        console.log('Consecutive Days Off:', consecutiveDaysOff);
    }

    function getFlagEmoji(countryCode) {
        return countryCode
            .toUpperCase()
            .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt()));
    }

    function handleKeyDown(event) {
        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                year++;
                updateHolidays(); // Recalculate holidays for the new year
                break;
            case 'ArrowLeft':
                event.preventDefault();
                year--;
                updateHolidays(); // Recalculate holidays for the new year
                break;
            case 'ArrowUp':
                event.preventDefault();
                daysOff++;
                updateHolidays(); // Recalculate holidays with updated days off
                break;
            case 'ArrowDown':
                event.preventDefault();
                if (daysOff > 0) {
                    daysOff--;
                    updateHolidays(); // Recalculate holidays with updated days off
                }
                break;
        }
    }

    onMount(() => {
        adjustInputWidth(inputElement);
        inputElement.addEventListener('input', () => {
            adjustInputWidth(inputElement);
            const countryCode = Object.keys(countriesList).find(code => countriesList[code] === inputElement.value);
        });
        inputElement.addEventListener('focus', () => {
            inputElement.value = '';
            adjustInputWidth(inputElement);
        });
        window.addEventListener('keydown', handleKeyDown);
    });

    updateHolidays();
    console.log(consecutiveDaysOff);
</script>

<style>
    .header {
        max-width: 800px;
        margin: 40px auto;
        text-align: center;
    }

    .header h2 {
        font-size: 2.5em; /* Slightly larger font size */
        margin: 0;
    }

    .header p {
        font-size: 1.1em;
    }

    .content-box {
        max-width: 1200px;
        margin: 40px auto;
        padding: 20px;
        background-color: #111;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        overflow: hidden;
    }

    .content-box p {
        text-align: center;
    }

    input {
        margin: 0 10px;
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
        grid-template-columns: repeat(3, 1fr); /* Default to 3 columns */
        gap: 20px;
        justify-items: center;
        padding: 20px;
    }

    @media (max-width: 1024px) {
        .calendar-grid {
            grid-template-columns: repeat(2, 1fr); /* Adjust to 2 columns for medium screens */
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

    @media (max-width: 400px) {
        .calendar-grid {
            grid-template-columns: repeat(1, 1fr); /* Adjust to 1 column for very small screens */
        }
    }

    .calendar-container {
        width: 100%;
        max-width: 300px;
        background-color: #111;
        color: #fff;
        border-radius: 5px;
        padding: 15px;
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
        padding: 10px;
        border-radius: 5px;
        margin-bottom: 20px;
    }

    .key-item {
        display: flex;
        align-items: center;
        margin: 0 15px;
    }

    .color-box {
        width: 20px;
        height: 20px;
        margin-right: 8px;
        border-radius: 3px;
    }

    .color-box.weekend {
        background-color: #585858; /* Muted gray/white */
    }

    .color-box.optimized {
        background-color: #4caf50;
    }

    .color-box.holiday {
        background-color: #3b1e6e;
    }

    footer {
        text-align: center;
        padding: 20px;
        color: #c5c6c7;
        font-size: 0.9em;
    }

    footer a {
        color: #66fcf1;
        text-decoration: none;
    }

    footer a:hover {
        text-decoration: underline;
    }

    .arrow-controls {
        display: inline-flex;
        align-items: center;
    }

    button {
        background-color: #333;
        border: 1px solid #444;
        color: #fff;
        font-size: 1em;
        cursor: pointer;
        padding: 5px 10px;
        margin: 0 10px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        transition: background-color 0.3s, color 0.3s, transform 0.1s;
    }

    button:hover {
        background-color: #444;
    }

    button:active {
        transform: translateY(2px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    button:focus {
        outline: 2px solid #61dafb;
    }

    .bold {
        font-weight: bold;
        font-size: 1.2em;
    }

    .flag {
        font-size: 2em;
    }

    .day {
        aspect-ratio: 1;
        text-align: center;
        font-size: 0.7em; /* Adjust font size for smaller screens */
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ddd;
        background-color: #222;
        position: relative;
    }
</style>

<main>
    <div class="header">
        <h2>Stretch My Time Off</h2>
        <p>
            In {selectedCountry}, there are {holidays.length} public holidays in {year}. 
            <br />
            Let's stretch your {daysOff} days off to {consecutiveDaysOff.reduce((total, group) => total + group.totalDays, 0)} vacation days.
        </p>
    </div>

    <div class="content-box">
        <p>
            I live in 
            <span class="flag" style="vertical-align: middle;">{getFlagEmoji(Object.keys(countriesList).find(code => countriesList[code] === selectedCountry))}</span>
            <input bind:this={inputElement} list="countries" class="editable-input bold" bind:value={selectedCountry} placeholder={placeholder} on:input={handleCountryChange} on:focus={() => { inputElement.value = ''; adjustInputWidth(); }} aria-label="Select country" />
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
                <span class="color-box optimized"></span> Day Off
            </div>
            <div class="key-item">
                <span class="color-box holiday"></span> Public Holiday
            </div>
        </div>
        <div class="calendar-grid">
            {#each months as month}
                <div class="calendar-container">
                    <CalendarMonth {year} {month} {holidays} {optimizedDaysOff} {consecutiveDaysOff} />
                </div>
            {/each}
        </div>
    </div>
</main>

<footer>
    <p>Made with <span style="color: red;">📅</span> by <a href="https://zach.ie" target="_blank">Zach</a></p>
</footer> 