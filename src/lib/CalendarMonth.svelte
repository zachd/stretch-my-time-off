<script>
    import Tooltip from './Tooltip.svelte';

    export let year;
    export let month;
    export let holidays = [];
    export let optimizedDaysOff = [];

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    let daysInMonth = getDaysInMonth(year, month);
    let firstDay = getFirstDayOfMonth(year, month);

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
</script>

<style>
    .calendar {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        border: 1px solid #444;
        padding: 5px;
        margin: 5px;
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
        background-color: #333;
    }
    .holiday {
        background-color: #555;
        cursor: pointer;
    }
    .optimized {
        background-color: #4caf50;
        color: white;
    }
    .month-name {
        grid-column: span 7;
        text-align: center;
        font-weight: bold;
        font-size: 0.8em;
        margin-bottom: 2px;
        color: #fff;
    }
</style>

<div class="calendar">
    <div class="month-name">{new Date(year, month).toLocaleString('default', { month: 'long' })}</div>
    {#each Array.from({ length: firstDay }) as _}
        <div class="day"></div>
    {/each}
    {#each Array.from({ length: daysInMonth }, (_, i) => i + 1) as day}
        <div class="day {(firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6 ? 'weekend' : ''} {getHoliday(day) ? 'holiday' : ''} {isOptimizedDayOff(day) ? 'optimized' : ''}">
            {day}
            {#if getHoliday(day)}
                <Tooltip text={getHoliday(day).name} />
            {/if}
        </div>
    {/each}
</div> 