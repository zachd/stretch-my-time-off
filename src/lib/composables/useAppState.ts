import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import Holidays from 'date-holidays';
import { ptoData } from '../ptoData';
import { saveAppState, getDefaultDaysOff, getCountryCodeFromName } from '../utils';

countries.registerLocale(enLocale);
export const countriesList: Record<string, string> = countries.getNames('en');

export function updateStatesList(countryCode: string): Record<string, string> {
    const hd = new Holidays(countryCode);
    return hd.getStates(countryCode) || {};
}

export async function fetchCountryCode(): Promise<string> {
    try {
        const response = await fetch('https://stretchmytimeoff.com/cdn-cgi/trace');
        const text = await response.text();
        const countryCodeMatch = text.match(/loc=(\w+)/);
        const countryCode = countryCodeMatch ? countryCodeMatch[1] : '';
        return countriesList[countryCode] || '';
    } catch (error) {
        console.error('Error fetching country code:', error);
        return '';
    }
}

export function handleCountryChange(
    selectedCountry: string,
    selectedCountryCode: string,
    setDaysOff: (days: number) => void,
    setSelectedState: (state: string) => void,
    setSelectedStateCode: (code: string) => void
): void {
    if (selectedCountryCode) {
        const defaultDays = getDefaultDaysOff(selectedCountryCode, ptoData);
        setDaysOff(defaultDays);
        setSelectedState('');
        setSelectedStateCode('');
        saveAppState({
            selectedCountry,
            selectedState: '',
            selectedStateCode: '',
            daysOff: defaultDays
        });
    }
}

export function handleStateChange(
    stateName: string,
    statesList: Record<string, string>,
    setSelectedState: (state: string) => void,
    setSelectedStateCode: (code: string) => void
): void {
    const selectedStateCode = getCountryCodeFromName(stateName, statesList);
    setSelectedState(stateName);
    setSelectedStateCode(selectedStateCode);
    saveAppState({ selectedState: stateName, selectedStateCode });
}

