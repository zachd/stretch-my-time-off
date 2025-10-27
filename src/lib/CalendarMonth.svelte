<script lang="ts">
    import Tooltip from './Tooltip.svelte';
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let year: number;
    export let month: number;
    export let holidays: Array<{ date: Date; name: string; hidden?: boolean }>;
    export let chosenDaysOff: Array<Date>;
    export let optimizedDaysOff: Date[];
    export let excludedDaysOff: Date[] = [];
    export let consecutiveDaysOff: Array<{ startDate: Date; endDate: Date; totalDays: number; fullConsecutiveDays: number }>;
    export let selectedCountryCode: string;
    export let weekendDays: number[] = [6, 0];

    function handleDayClick(day: number, event: MouseEvent) {
        const date = new Date(year, month, day);
        const holiday = getHoliday(day);
        const isWeekendDay = isWeekend(date);
        
        // Don't allow clicking on weekends or holidays
        if (isWeekendDay || holiday) {
            return;
        }
        
        dispatch('dayClick', { date, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
    }

    // Function to determine the first day of the week based on locale
    function getFirstDayOfWeek(locale: string): number {
        const normalizedLocale = locale.toLowerCase() === 'us' ? 'en-US' : `en-${locale.toUpperCase()}`;
    
        try {
            // @ts-ignore .weekInfo exists on all browsers except Firefox
            const weekFirstDay = new Intl.Locale(normalizedLocale)?.weekInfo?.firstDay;
            if (weekFirstDay !== undefined) {
                return weekFirstDay;
            }
        } catch (e) {
            // Fallback if weekInfo is not supported
        }

        // Fallback: US starts on Sunday (0), most others on Monday (1)
        return normalizedLocale === 'en-US' ? 0 : 1;
    }

    // Reactive declarations
    $: daysInMonth = getDaysInMonth(year, month);
    $: locale = selectedCountryCode ? new Intl.Locale(selectedCountryCode).toString() : 'us';
    $: firstDayOfWeek = getFirstDayOfWeek(locale);
    $: adjustedFirstDay = (getFirstDayOfMonth(year, month) - firstDayOfWeek + 7) % 7;

    function getDaysInMonth(year: number, month: number): number {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year: number, month: number): number {
        return new Date(year, month, 1).getDay();
    }

    function getHoliday(day: number): { date: Date; name: string; hidden?: boolean } | undefined {
        return holidays.find(holiday => 
            holiday.date.getFullYear() === year &&
            holiday.date.getMonth() === month &&
            holiday.date.getDate() === day
        );
    }

    function isOptimizedDayOff(day: number): boolean {
        return optimizedDaysOff.some(date => 
            date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day
        );
    }

    function isExcludedDayOff(day: number): boolean {
        return excludedDaysOff.some(date => 
            date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day
        );
    }

    function getDominantMonth(period: { startDate: Date; endDate: Date }): number {
        const startMonth = period.startDate.getMonth();
        const endMonth = period.endDate.getMonth();

        if (startMonth === endMonth) {
            return startMonth;
        }

        const startDays = getDaysInMonth(year, startMonth) - period.startDate.getDate() + 1;
        const endDays = period.endDate.getDate();

        return startDays > endDays ? startMonth : endMonth;
    }

    function isConsecutiveDayOff(day: number): boolean {
        return consecutiveDaysOff.some(period => {
            const start = period.startDate;
            const end = period.endDate;
            const date = new Date(year, month, day);
            return date >= start && date <= end;
        });
    }

    function isWeekend(date: Date): boolean {
        return weekendDays.includes(date.getDay());
    }

    export function isChosenOff(date: Date): boolean {
        return chosenDaysOff.some(chosenDate => {
            return date.toDateString() === chosenDate.toDateString();
        });
    }

    const dayInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    $: orderedDayInitials = dayInitials.slice(firstDayOfWeek).concat(dayInitials.slice(0, firstDayOfWeek));
</script>

<div class="calendar">
    <div class="month-name">{new Date(year, month).toLocaleString('default', { month: 'long' })}</div>
    
    {#each orderedDayInitials as dayInitial}
        <div class="day-initial">{dayInitial}</div>
    {/each}

    {#each Array.from({ length: adjustedFirstDay }) as _}
        <div class="day"></div>
    {/each}
    {#each Array.from({ length: daysInMonth }, (_, i) => i + 1) as day}
        {@const holiday = getHoliday(day)}
        {@const isWeekendDay = isWeekend(new Date(year, month, day))}
        {@const isChosen = isChosenOff(new Date(year, month, day))}
        {@const isOptimized = isOptimizedDayOff(day)}
        {@const isExcluded = !isChosen && isExcludedDayOff(day)} <!-- Only show as excluded if NOT chosen -->
        {@const isClickable = !isWeekendDay && !holiday}
        {#if isClickable}
            <button
                class="day {isChosen ? 'chosen' : ''} {isOptimized && !isChosen ? 'optimized' : ''} {isExcluded ? 'excluded' : ''} {isConsecutiveDayOff(day) ? 'consecutive-day' : ''} clickable"
                on:click={(e) => handleDayClick(day, e)}
                aria-label="{isChosen ? 'Remove' : isExcluded ? 'Include' : 'Add'} day {day}"
            >
                <span>{day}</span>
            </button>
        {:else}
            <div class="day {isWeekendDay ? 'weekend' : ''} {holiday ? 'holiday' : ''} {isConsecutiveDayOff(day) ? 'consecutive-day' : ''}">
                <span class={holiday?.hidden ? 'strikethrough' : ''}>{day}</span>
                {#if holiday}
                    <Tooltip text={holiday.name} />
                {/if}
            </div>
        {/if}
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
    .day-initial {
        text-align: center;
        font-weight: bold;
        color: #c5c6c7;
        font-size: 0.6em;
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
        border: none;
        width: 100%;
        font-family: inherit;
        padding: 0;
    }
    .day.clickable {
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .day.clickable:hover {
        background-color: #333;
    }
    .day.clickable:focus {
        outline: 2px solid #4caf50;
        outline-offset: -2px;
    }
    .day:hover {
        :global(.tooltip) {
            opacity: 1;
            pointer-events: auto;
        }
    }
    .chosen {
        background-color: #2196f3 !important; /* Blue - user's active choice */
    }
    .chosen.clickable:hover {
        background-color: #42a5f5 !important;
    }
    .weekend {
        background-color: #585858;
    }
    .optimized {
        background-color: #4caf50; /* Green - good/recommended */
    }
    .optimized.clickable:hover {
        background-color: #66bb6a;
    }
    .excluded {
        background-color: #f44336; /* Red - rejected/blocked */
        opacity: 0.7;
    }
    .excluded.clickable:hover {
        background-color: #ef5350;
        opacity: 0.85;
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

    .strikethrough {
        text-decoration: line-through;
        opacity: 0.5;
    }
</style> 
