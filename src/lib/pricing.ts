/**
 * International pricing — currency auto-selected by visitor country.
 * Prices are set per-region (purchasing-power adjusted), not raw FX conversion.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'AUD' | 'CAD' | 'JPY';

export interface CurrencyConfig {
    code: CurrencyCode;
    symbol: string;
    locale: string;
    pro: number;          // monthly, per user
    enterprise: number;   // monthly, per user
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
    INR: { code: 'INR', symbol: '₹',   locale: 'en-IN', pro: 999,  enterprise: 2499 },
    USD: { code: 'USD', symbol: '$',   locale: 'en-US', pro: 12,   enterprise: 29 },
    EUR: { code: 'EUR', symbol: '€',   locale: 'de-DE', pro: 11,   enterprise: 27 },
    GBP: { code: 'GBP', symbol: '£',   locale: 'en-GB', pro: 9,    enterprise: 24 },
    AED: { code: 'AED', symbol: 'AED ', locale: 'en-AE', pro: 45,  enterprise: 109 },
    SGD: { code: 'SGD', symbol: 'S$',  locale: 'en-SG', pro: 16,   enterprise: 39 },
    AUD: { code: 'AUD', symbol: 'A$',  locale: 'en-AU', pro: 18,   enterprise: 45 },
    CAD: { code: 'CAD', symbol: 'C$',  locale: 'en-CA', pro: 16,   enterprise: 39 },
    JPY: { code: 'JPY', symbol: '¥',   locale: 'ja-JP', pro: 1800, enterprise: 4400 },
};

// ISO country code → currency
const EURO_COUNTRIES = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'CY', 'MT'];

export const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
    IN: 'INR',
    US: 'USD',
    GB: 'GBP', UK: 'GBP',
    AE: 'AED',
    SG: 'SGD',
    AU: 'AUD', NZ: 'AUD',
    CA: 'CAD',
    JP: 'JPY',
    ...Object.fromEntries(EURO_COUNTRIES.map(c => [c, 'EUR' as CurrencyCode])),
};

export function currencyForCountry(country?: string | null): CurrencyCode {
    if (!country) return 'INR';                  // home-market default
    return COUNTRY_CURRENCY[country.toUpperCase()] ?? 'USD'; // unknown country → USD (international)
}

export function fmtPrice(amount: number, cfg: CurrencyConfig): string {
    // JPY/INR have no decimals; keep clean integer formatting
    const n = new Intl.NumberFormat(cfg.locale, { maximumFractionDigits: 0 }).format(amount);
    return `${cfg.symbol}${n}`;
}

// annual = ~10x monthly (2 months free → ~17% off)
export function annualPrice(monthly: number): number {
    return Math.round(monthly * 10);
}
