export interface Holiday {
    date: Date;
    name: string;
    hidden?: boolean;
}

export interface ConsecutiveDaysOff {
    startDate: Date;
    endDate: Date;
    totalDays: number;
    usedDaysOff?: number;
}

export interface AppState {
    year: number;
    selectedCountry: string;
    selectedState: string;
    selectedStateCode: string;
    daysOff: number;
}

export interface DayInfo {
    name: string;
    index: number;
}

