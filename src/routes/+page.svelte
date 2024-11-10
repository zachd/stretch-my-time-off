<script>
    import countries from 'i18n-iso-countries';
    import enLocale from 'i18n-iso-countries/langs/en.json';
    import CalendarMonth from '../lib/CalendarMonth.svelte';
    import Holidays from 'date-holidays';

    countries.registerLocale(enLocale);
    let countriesList = countries.getNames('en');

    let year = new Date().getFullYear();
    let months = Array.from({ length: 12 }, (_, i) => i);
    let selectedCountry = 'Belgium'; // Default country name
    let holidays = [];
    let daysOff = 24; // Default days off per year
    let optimizedDaysOff = [];

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
            const hd = new Holidays(countryCode);
            holidays = hd.getHolidays(year)
                .filter(holiday => holiday.type === 'public') // Filter for public holidays
                .map(holiday => ({
                    date: new Date(holiday.date),
                    name: holiday.name
                }));
            console.log('Holidays:', holidays);
            optimizeDaysOff();
        }
    }

    function formatDate(date) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function handleDaysOffChange(event) {
        const value = parseInt(event.target.textContent);
        if (!isNaN(value)) {
            daysOff = value;
            optimizeDaysOff();
        } else {
            event.target.textContent = daysOff; // Revert to previous valid value if input is invalid
        }
    }

    function handleDaysOffInput(event) {
        const value = event.target.textContent;
        event.target.textContent = value.replace(/\D/g, '');
    }

    function optimizeDaysOff() {
        // Reset optimized days off
        optimizedDaysOff = [];

        // Combine holidays and weekends
        const allDays = holidays.map(h => h.date);
        let daysToUse = daysOff;

        for (let month = 0; month < 12; month++) {
            let currentStreak = [];
            let maxStreak = [];
            let maxStreakStart = null;

            for (let day = 1; day <= 31; day++) {
                const date = new Date(year, month, day);
                if (date.getMonth() !== month) break; // Skip invalid dates

                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isHoliday = allDays.some(d => d.getTime() === date.getTime());

                if (isWeekend || isHoliday) {
                    currentStreak.push(date);
                } else {
                    if (currentStreak.length > maxStreak.length) {
                        maxStreak = [...currentStreak];
                        maxStreakStart = currentStreak[0];
                    }
                    currentStreak = [];
                }
            }

            // Use days off to extend the longest streak in the current month
            if (maxStreakStart && daysToUse > 0) {
                let date = new Date(maxStreakStart);
                while (daysToUse > 0 && date.getFullYear() === year) {
                    date.setDate(date.getDate() - 1);
                    if (!allDays.some(d => d.getTime() === date.getTime()) && date.getDay() !== 0 && date.getDay() !== 6) {
                        optimizedDaysOff.push(new Date(date));
                        daysToUse--;
                    }
                }
            }
        }

        console.log('Optimized Days Off:', optimizedDaysOff);
    }

    // Initialize holidays on load
    updateHolidays();
</script>

<style>
    header {
        text-align: center;
        background-color: black;
        padding: 20px;
        color: white;
        font-size: 2em;
        font-family: 'Arial', sans-serif;
    }
    main {
        max-width: 800px;
        margin: 20px auto;
        padding: 20px;
        background-color: #333; /* Dark gray for main background */
        text-align: center;
        font-size: 1.2em;
        color: white; /* Ensure text is white for readability */
        border-radius: 10px; /* Add border-radius for a smoother look */
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* Add shadow for depth */
    }
    select, input {
        margin: 0 5px;
        font-size: 1em;
        padding: 5px;
        background-color: #555; /* Darker background for inputs */
        color: white; /* White text for inputs */
        border: none;
        border-radius: 5px;
    }
    ul {
        list-style-type: none; /* Remove bullet points */
        padding: 0;
    }
    li {
        margin: 10px 0;
    }
    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* Adjust to fit available space */
        gap: 10px;
        justify-items: center;
        padding: 20px;
    }
    .calendar-container {
        width: 100%;
        aspect-ratio: 1;
        background-color: #444; /* Slightly lighter gray for calendar */
        color: white;
        border-radius: 5px;
        padding: 10px;
        box-sizing: border-box; /* Ensure padding is included in width */
    }

    /* Media query for smaller screens */
    @media (max-width: 600px) {
        .calendar-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); /* Adjust for smaller screens */
        }
    }

    .editable-span {
        display: inline-block;
        border-bottom: 1px dotted white; /* Dotted underline */
        color: white;
        font-size: 1em;
        width: 3em; /* Adjust width as needed */
        text-align: center;
        margin: 0 5px;
        outline: none;
    }

    .editable-span:focus {
        border-bottom: 1px solid white; /* Solid underline on focus */
    }

    .highlight {
        background-color: #4caf50; /* Green color for highlighting */
        color: white;
    }
</style>

<main>
    I live in 
    <input list="countries" bind:value={selectedCountry} on:change={handleCountryChange} />
    <datalist id="countries">
        {#each Object.values(countriesList) as name}
            <option value={name}></option>
        {/each}
    </datalist>
    and have 
    <span contenteditable="true" class="editable-span" on:input={handleDaysOffInput} on:blur={handleDaysOffChange}>{daysOff}</span> days off per year

    <div>
        <label for="year">Select Year: </label>
        <input type="number" id="year" bind:value={year} on:input={handleYearChange} min="1900" max="2100" />
    </div>

    <div>
        There are {holidays.length} public holidays in {selectedCountry}:
        <ul>
            {#each holidays as holiday}
                <li class={optimizedDaysOff.some(d => d.getTime() === holiday.date.getTime()) ? 'highlight' : ''}>
                    {holiday.name} on {formatDate(holiday.date)}
                </li>
            {/each}
        </ul>
    </div>

    <div class="calendar-grid">
        {#each months as month}
            <div class="calendar-container">
                <CalendarMonth {year} {month} {holidays} {optimizedDaysOff} />
            </div>
        {/each}
    </div>
</main> 