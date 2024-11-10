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
    let extendedHolidays = [];

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
            calculateExtendedHolidays();
        }
    }

    function optimizeDaysOff() {
        // Reset optimized days off
        optimizedDaysOff = [];

        // Combine holidays and weekends
        const allDays = holidays.map(h => h.date);
        let daysToUse = daysOff;

        // Create a list of potential days to take off, sorted by their potential to extend holidays
        const potentialDaysOff = [];

        for (let month = 0; month < 12; month++) {
            for (let day = 1; day <= 31; day++) {
                const date = new Date(year, month, day);
                if (date.getMonth() !== month) break; // Skip invalid dates

                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isHoliday = allDays.some(d => d.getTime() === date.getTime());

                if (!isWeekend && !isHoliday) {
                    const prevDay = new Date(date);
                    prevDay.setDate(date.getDate() - 1);
                    const nextDay = new Date(date);
                    nextDay.setDate(date.getDate() + 1);

                    const extendsHoliday = 
                        allDays.some(d => d.getTime() === prevDay.getTime()) ||
                        allDays.some(d => d.getTime() === nextDay.getTime());

                    if (extendsHoliday) {
                        potentialDaysOff.push(date);
                    }
                }
            }
        }

        // Sort potential days off by their ability to extend existing chains with multiple holidays
        potentialDaysOff.sort((a, b) => {
            const aConsecutive = calculateConsecutiveDaysIncludingHoliday(a, allDays);
            const bConsecutive = calculateConsecutiveDaysIncludingHoliday(b, allDays);
            return bConsecutive - aConsecutive || a.getTime() - b.getTime();
        });

        // Select days off from the sorted list, prioritizing those that extend chains with multiple holidays
        for (let i = 0; i < potentialDaysOff.length && daysToUse > 0; i++) {
            const date = potentialDaysOff[i];
            const prevDay = new Date(date);
            prevDay.setDate(date.getDate() - 1);
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);

            // Check if adding this day creates a longer chain with multiple holidays
            if (calculateConsecutiveDaysIncludingHoliday(date, allDays) > 0) {
                optimizedDaysOff.push(date);
                daysToUse--;
            }
        }

        // Attempt to create full week chains
        if (daysToUse > 0) {
            for (let i = 0; i < optimizedDaysOff.length && daysToUse > 0; i++) {
                const date = optimizedDaysOff[i];
                const startOfWeek = new Date(date);
                startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Start of the week (Monday)
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 4); // End of the week (Friday)

                for (let d = new Date(startOfWeek); d <= endOfWeek && daysToUse > 0; d.setDate(d.getDate() + 1)) {
                    if (!optimizedDaysOff.some(optDate => optDate.getTime() === d.getTime()) && !allDays.some(holiday => holiday.getTime() === d.getTime())) {
                        optimizedDaysOff.push(new Date(d));
                        daysToUse--;
                    }
                }
            }
        }

        console.log('Optimized Days Off:', optimizedDaysOff);
    }

    function calculateConsecutiveDaysIncludingHoliday(date, allDays) {
        let consecutiveDays = 0;
        let prevDay = new Date(date);
        let nextDay = new Date(date);
        let includesHoliday = false;
        let holidayCount = 0;

        // Count consecutive days before the date
        while (true) {
            prevDay.setDate(prevDay.getDate() - 1);
            if (prevDay.getDay() === 0 || prevDay.getDay() === 6 || allDays.some(d => d.getTime() === prevDay.getTime())) {
                consecutiveDays++;
                if (allDays.some(d => d.getTime() === prevDay.getTime())) {
                    includesHoliday = true;
                    holidayCount++;
                }
            } else {
                break;
            }
        }

        // Count consecutive days after the date
        while (true) {
            nextDay.setDate(nextDay.getDate() + 1);
            if (nextDay.getDay() === 0 || nextDay.getDay() === 6 || allDays.some(d => d.getTime() === nextDay.getTime())) {
                consecutiveDays++;
                if (allDays.some(d => d.getTime() === nextDay.getTime())) {
                    includesHoliday = true;
                    holidayCount++;
                }
            } else {
                break;
            }
        }

        return includesHoliday ? holidayCount : 0;
    }

    function formatDate(date) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function handleDaysOffChange(event) {
        const value = parseInt(event.target.textContent);
        if (!isNaN(value)) {
            daysOff = value;
            optimizeDaysOff();
            calculateExtendedHolidays();
        } else {
            event.target.textContent = daysOff; // Revert to previous valid value if input is invalid
        }
    }

    function handleDaysOffInput(event) {
        const value = event.target.textContent;
        event.target.textContent = value.replace(/\D/g, '');
    }

    function calculateExtendedHolidays() {
        const allDays = holidays.map(h => h.date); // Include all holiday dates
        let remainingDaysOff = daysOff; // Track remaining days off

        extendedHolidays = holidays
            .filter(holiday => holiday.date.getDay() !== 0 && holiday.date.getDay() !== 6) // Only non-weekend holidays
            .map(holiday => {
                let startDate = new Date(holiday.date);
                let endDate = new Date(holiday.date);
                let daysUsed = 0;

                // Extend before the holiday
                while (daysUsed < remainingDaysOff) {
                    const prevDay = new Date(startDate);
                    prevDay.setDate(startDate.getDate() - 1);
                    if (!allDays.some(d => d.getTime() === prevDay.getTime()) && prevDay.getDay() !== 0 && prevDay.getDay() !== 6) {
                        startDate = prevDay;
                        daysUsed++;
                    } else {
                        break;
                    }
                }

                // Extend after the holiday
                while (daysUsed < remainingDaysOff) {
                    const nextDay = new Date(endDate);
                    nextDay.setDate(endDate.getDate() + 1);
                    if (!allDays.some(d => d.getTime() === nextDay.getTime()) && nextDay.getDay() !== 0 && nextDay.getDay() !== 6) {
                        endDate = nextDay;
                        daysUsed++;
                    } else {
                        break;
                    }
                }

                remainingDaysOff -= daysUsed; // Deduct used days from remaining

                // Calculate total consecutive days including weekends
                const totalDays = calculateTotalConsecutiveDays(startDate, endDate, allDays);

                return {
                    holidayName: holiday.name,
                    startDate: formatDate(startDate),
                    endDate: formatDate(endDate),
                    totalDays
                };
            });

        // If there are remaining days off, try to use them to extend any holiday further
        if (remainingDaysOff > 0) {
            extendedHolidays.forEach(extended => {
                let startDate = new Date(extended.startDate);
                let endDate = new Date(extended.endDate);

                // Extend before the holiday
                while (remainingDaysOff > 0) {
                    const prevDay = new Date(startDate);
                    prevDay.setDate(startDate.getDate() - 1);
                    if (!allDays.some(d => d.getTime() === prevDay.getTime()) && prevDay.getDay() !== 0 && prevDay.getDay() !== 6) {
                        startDate = prevDay;
                        remainingDaysOff--;
                    } else {
                        break;
                    }
                }

                // Extend after the holiday
                while (remainingDaysOff > 0) {
                    const nextDay = new Date(endDate);
                    nextDay.setDate(endDate.getDate() + 1);
                    if (!allDays.some(d => d.getTime() === nextDay.getTime()) && nextDay.getDay() !== 0 && nextDay.getDay() !== 6) {
                        endDate = nextDay;
                        remainingDaysOff--;
                    } else {
                        break;
                    }
                }

                extended.startDate = formatDate(startDate);
                extended.endDate = formatDate(endDate);
                extended.totalDays = calculateTotalConsecutiveDays(startDate, endDate, allDays);
            });
        }
    }

    function calculateTotalConsecutiveDays(startDate, endDate, allDays) {
        let totalDays = 0;
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
            const isHoliday = allDays.some(d => d.getTime() === currentDate.getTime());

            if (isWeekend || isHoliday || optimizedDaysOff.some(d => d.getTime() === currentDate.getTime())) {
                totalDays++;
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return totalDays;
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
        Extended Holidays:
        <ul>
            {#each extendedHolidays as extended}
                <li>
                    {extended.totalDays} day holiday, including {extended.holidayName} from {extended.startDate} to {extended.endDate}
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