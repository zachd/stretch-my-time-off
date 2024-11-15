<script lang="ts">
    import { onMount } from 'svelte';

    let isDark = true; // Default to dark theme
    let mounted = false;

    onMount(() => {
        const savedTheme = localStorage.getItem('theme');
        isDark = savedTheme ? savedTheme === 'dark' : true;
        applyTheme();
        mounted = true;
    });

    function toggleTheme() {
        isDark = !isDark;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyTheme();
    }

    function applyTheme() {
        if (mounted) {
            document.documentElement.classList.toggle('light-theme', !isDark);
        }
    }
</script>

<button on:click={toggleTheme} class="theme-toggle" aria-label="Toggle theme">
    {#if isDark}
        ☀️
    {:else}
        🌙
    {/if}
</button>

<style>
    .theme-toggle {
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.3s;
        z-index: 1000;
    }

    .theme-toggle:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }
</style> 