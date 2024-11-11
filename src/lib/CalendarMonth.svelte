<script>
    import Tooltip from './Tooltip.svelte';

    export let year;
    export let month;
    export let holidays = [];
    export let optimizedDaysOff = [];
    export let consecutiveDaysOff = [];

    // Reactive declarations
    $: daysInMonth = getDaysInMonth(year, month);
    $: firstDay = getFirstDayOfMonth(year, month);

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    function getHoliday(day) {
        return holidays.find(holiday => 
            holiday.date.getFullYear() === year &&
            holiday.date.getMonth() === month &&
            holiday.date.getDate() === day
        );
    }

    function isOptimizedDayOff(day) {
        return optimizedDaysOff.some(date => 
            date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day
        );
    }

    // Determine the dominant month for each consecutive days off period
    function getDominantMonth(period) {
        const startMonth = period.startDate.getMonth();
        const endMonth = period.endDate.getMonth();

        if (startMonth === endMonth) {
            return startMonth;
        }

        const startDays = getDaysInMonth(year, startMonth) - period.startDate.getDate() + 1;
        const endDays = period.endDate.getDate();

        return startDays > endDays ? startMonth : endMonth;
    }

    function isConsecutiveDayOff(day) {
        return consecutiveDaysOff.some(period => {
            const start = period.startDate;
            const end = period.endDate;
            const date = new Date(year, month, day);
            return date >= start && date <= end;
        });
    }
</script>

<div class="calendar">
    <div class="month-name">{new Date(year, month).toLocaleString('default', { month: 'long' })}</div>
    {#each Array.from({ length: firstDay }) as _}
        <div class="day"></div>
    {/each}
    {#each Array.from({ length: daysInMonth }, (_, i) => i + 1) as day}
        <div class="day {(firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6 ? 'weekend' : ''} {getHoliday(day) ? 'holiday' : ''} {isOptimizedDayOff(day) ? 'optimized' : ''} {isConsecutiveDayOff(day) ? 'consecutive-day' : ''}">
            {day}
            {#if getHoliday(day)}
                <Tooltip text={getHoliday(day).name} />
            {/if}
        </div>
    {/each}
</div>

<div class="consecutive-days-off">
    <ul>
        {#each consecutiveDaysOff.filter(period => getDominantMonth(period) === month) as period}
            <li>
                {period.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to 
                {period.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: 
                <strong>{period.totalDays} days</strong>
            </li>
        {/each}
    </ul>
</div>

<style>
    .calendar {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        box-sizing: border-box;
        width: 100%;
        height: auto;
    }
    .day {
        aspect-ratio: 1;
        text-align: center;
        font-size: 0.7em;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ddd;
        background-color: #222;
        position: relative;
    }
    .day:hover {
        :global(.tooltip) {
            opacity: 1;
            pointer-events: auto;
        }
    }
    .weekend {
        background-color: #585858;
    }
    .optimized {
        background-color: #4caf50;
    }
    .holiday {
        background-color: #3b1e6e;
        cursor: pointer;
    }
    .consecutive-day {
        border: 1px solid rgba(255, 255, 255, 0.7);
    }
    .month-name {
        grid-column: span 7;
        text-align: center;
        letter-spacing: 0.1em;
        font-size: 1em;
        text-transform: uppercase;
        color: #c5c6c7;
        margin-bottom: 5px;
    }
    .consecutive-days-off {
        margin-top: 10px;
        color: #fff;
    }
    .consecutive-days-off ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .consecutive-days-off li {
        font-size: 1em;
    }

    @media (max-width: 600px) {
        .month-name {
            font-size: 0.9em;
        }
        .consecutive-days-off li {
            font-size: 0.8em;
        }
    }
</style> 