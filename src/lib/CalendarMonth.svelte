<script lang="ts">
    import Tooltip from './Tooltip.svelte';

    export let year: number;
    export let month: number;
    export let holidays: Array<{ date: Date; name: string; hidden?: boolean }>;
    export let optimizedDaysOff: Date[];
    export let consecutiveDaysOff: Array<{ startDate: Date; endDate: Date; totalDays: number }>;
    export let selectedCountryCode: string;

    // Function to determine the first day of the week based on locale
    function getFirstDayOfWeek(locale: string): number {
        const normalizedLocale = locale.toLowerCase() === 'us' ? 'en-US' : `en-${locale.toUpperCase()}`;
    
        try {
            // Try to get firstDay from Intl.Locale weekInfo
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

    function isWeekend(day: number): boolean {
        const dayOfWeek = (adjustedFirstDay + day - 1) % 7;
        const saturdayIndex = (6 - firstDayOfWeek + 7) % 7;
        const sundayIndex = (7 - firstDayOfWeek + 7) % 7;
        return dayOfWeek === saturdayIndex || dayOfWeek === sundayIndex;
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
        <div class="day {isWeekend(day) ? 'weekend' : ''} {getHoliday(day) ? 'holiday' : ''} {isOptimizedDayOff(day) ? 'optimized' : ''} {isConsecutiveDayOff(day) ? 'consecutive-day' : ''}">
            {day}
            {#if getHoliday(day)}
                <Tooltip text={getHoliday(day)?.name} />
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
        background-color: var(--content-bg);
        color: var(--text-color);
    }

    .day-initial {
        text-align: center;
        font-weight: bold;
        color: var(--text-color);
        font-size: 0.6em;
    }

    .day {
        aspect-ratio: 1;
        text-align: center;
        font-size: 0.7em;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-color);
        background-color: var(--content-bg);
        position: relative;
        border: 1px solid var(--border-color);
    }

    .day:hover {
        :global(.tooltip) {
            opacity: 1;
            pointer-events: auto;
        }
    }

    .weekend {
        background-color: var(--calendar-weekend);
    }

    .optimized {
        background-color: var(--calendar-optimized);
        color: var(--bg-color);
    }

    .holiday {
        background-color: var(--calendar-holiday);
        cursor: pointer;
        color: var(--bg-color);
    }

    .consecutive-day {
        border: 1px solid var(--border-color);
    }

    .month-name {
        grid-column: span 7;
        text-align: center;
        letter-spacing: 0.1em;
        font-size: 1em;
        text-transform: uppercase;
        color: var(--text-color);
        margin-bottom: 5px;
    }

    .consecutive-days-off {
        margin-top: 10px;
        color: var(--text-color);
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