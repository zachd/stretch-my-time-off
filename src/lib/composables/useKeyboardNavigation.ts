export function createKeyboardHandler(
    getYear: () => number,
    setYear: (value: number) => void,
    getDaysOff: () => number,
    setDaysOff: (value: number) => void,
    onUpdate: () => void
): (event: KeyboardEvent) => void {
    return function handleKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                setYear(getYear() + 1);
                onUpdate();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                setYear(getYear() - 1);
                onUpdate();
                break;
            case 'ArrowUp':
                event.preventDefault();
                setDaysOff(getDaysOff() + 1);
                onUpdate();
                break;
            case 'ArrowDown':
                event.preventDefault();
                if (getDaysOff() > 0) {
                    setDaysOff(getDaysOff() - 1);
                    onUpdate();
                }
                break;
        }
    };
}

