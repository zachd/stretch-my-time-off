<script>
    export let text = '';
</script>

<style>
    .tooltip {
        position: absolute;
        background-color: #333;
        color: #fff;
        padding: 5px;
        border-radius: 3px;
        font-size: 0.8em;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .tooltip::after {
        content: '';
        position: absolute;
        top: 100%; /* Position the tail at the bottom of the tooltip */
        left: 50%;
        transform: translateX(-50%);
        border-width: 5px;
        border-style: solid;
        border-color: #333 transparent transparent transparent;
    }

    .tooltip {
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
    }
</style>

<div class="tooltip">
    {text}
</div> 