<script lang="ts">
    import Tooltip from './Tooltip.svelte';

    export let year: number;
    export let month: number;
    export let holidays: Array<{ date: Date; name: string; hidden?: boolean }>;
    export let optimizedDaysOff: Date[];
    export let consecutiveDaysOff: Array<{ startDate: Date; endDate: Date; totalDays: number }>;
    export let selectedCountryCode: string;
    export let weekendDays: number[] = [6, 0];
    export let startDate: Date = new Date(year, 0, 1);
    export let isActive: boolean = true;
    export let fixedDaysOff: Date[] = [];
    export let onDayClick: ((date: Date) => void) | undefined = undefined;

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

    function isFixedDayOff(day: number): boolean {
        return fixedDaysOff.some(date => 
            date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day
        );
    }

    function getDayTooltip(day: number): string {
        const date = new Date(year, month, day);
        if (isWeekend(date)) {
            return 'Weekend';
        } else if (isFixedDayOff(day)) {
            return 'Day off (fixed)';
        } else if (isOptimizedDayOff(day)) {
            return 'Day off (calculated)';
        } else {
            return 'Tap to add fixed day off';
        }
    }

    function handleDayClick(day: number) {
        const date = new Date(year, month, day);
        const holiday = getHoliday(day);
        if (isPastDate(day) || !onDayClick || isWeekend(date) || holiday) return;
        onDayClick(date);
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

    function isPastDate(day: number): boolean {
        const date = new Date(year, month, day);
        // Normalize startDate to current year for comparison
        const startDateInYear = new Date(year, startDate.getMonth(), startDate.getDate());
        return date < startDateInYear;
    }

    const dayInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    $: orderedDayInitials = dayInitials.slice(firstDayOfWeek).concat(dayInitials.slice(0, firstDayOfWeek));
</script>

<div class="calendar {isActive ? '' : 'excluded-month'}">
    <div class="month-name">{new Date(year, month).toLocaleString('default', { month: 'long' })}</div>
    
    {#each orderedDayInitials as dayInitial}
        <div class="day-initial">{dayInitial}</div>
    {/each}

    {#each Array.from({ length: adjustedFirstDay }) as _}
        <div class="day"></div>
    {/each}
    {#each Array.from({ length: daysInMonth }, (_, i) => i + 1) as day}
        {@const holiday = getHoliday(day)}
        {@const pastDate = isPastDate(day)}
        {@const fixedDay = isFixedDayOff(day)}
        {@const optimizedDay = isOptimizedDayOff(day)}
        {@const dayDate = new Date(year, month, day)}
        {@const isWeekendDay = isWeekend(dayDate)}
        {@const tooltipText = holiday ? holiday.name : getDayTooltip(day)}
        {@const canClick = onDayClick && !pastDate && !isWeekendDay && !holiday}
        <div 
            class="day {isWeekendDay ? 'weekend' : ''} {holiday ? 'holiday' : ''} {optimizedDay ? 'optimized' : ''} {fixedDay ? 'fixed' : ''} {isConsecutiveDayOff(day) ? 'consecutive-day' : ''} {pastDate ? 'past-date' : ''} {canClick ? 'clickable' : ''}"
            on:click={() => handleDayClick(day)}
            role={canClick ? 'button' : undefined}
            tabindex={canClick ? 0 : undefined}
        >
            <span class={holiday?.hidden ? 'strikethrough' : ''}>{day}</span>
            <Tooltip text={tooltipText} />
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
    .day-initial {
        text-align: center;
        font-weight: bold;
        color: #c5c6c7;
        font-size: 0.6em;
    }

    .excluded-month .month-name {
        color: #666;
    }

    .excluded-month .day-initial {
        color: #666;
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
    .fixed {
        background-color: #2e7d32;
        border: 2px solid #66bb6a;
    }
    .holiday {
        background-color: #3b1e6e;
    }
    .clickable {
        cursor: pointer;
    }
    .clickable:hover {
        opacity: 0.7;
        transform: scale(1.05);
        transition: transform 0.1s, opacity 0.1s;
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

    .past-date {
        opacity: 0.4;
    }

    .past-date span {
        text-decoration: line-through;
    }
</style> 