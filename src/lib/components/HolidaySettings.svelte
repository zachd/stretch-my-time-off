<script lang="ts">
    import type { Holiday } from '../types';
    import { formatDate } from '../utils';

    export let holidays: Holiday[];
    export let onToggle: (holiday: Holiday) => void;
</script>

<div class="settings-section">
    <h3>Public Holidays</h3>
    <ul>
        {#each holidays as holiday}
            <li>
                <div class="setting-item-label">
                    <span class="color-box holiday"></span>
                    <span class={holiday.hidden ? 'strikethrough' : ''}>
                        {formatDate(holiday.date)}: {holiday.name}
                    </span>
                </div>
                <button on:click={() => onToggle(holiday)}>
                    {holiday.hidden ? 'Show' : 'Hide'}
                </button>
            </li>
        {/each}
    </ul>
</div>

<style>
    .settings-section {
        margin-bottom: 20px;
    }

    .settings-section:last-child {
        margin-bottom: 0;
    }

    .settings-section h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #fff;
    }

    .settings-section ul {
        list-style-type: none;
        padding: 0;
    }

    .settings-section li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px;
        border-radius: 4px;
        gap: 5px;
    }

    .settings-section li:hover {
        background-color: #333;
    }

    .setting-item-label {
        display: flex;
        align-items: center;
        gap: 5px;
        flex: 1;
    }

    .color-box {
        width: 15px;
        height: 15px;
        min-width: 15px;
        border-radius: 3px;
    }

    .color-box.holiday {
        background-color: #3b1e6e;
    }

    .strikethrough {
        text-decoration: line-through;
    }

    button {
        margin-left: 10px;
        background-color: #444;
        border: none;
        color: #fff;
        padding: 5px 25px;
        cursor: pointer;
        border-radius: 5px;
        min-width: 100px;
    }

    button:hover {
        background-color: #555;
    }
</style>

