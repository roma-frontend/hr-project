import { PLAN_SEAT_PRICING } from '@/lib/pricing';

/**
 * Base prices in USD — PER SEAT, per month.
 *
 * These were flat plan prices ($29 / $79). The product is sold per seat with
 * volume tiers, so `useCurrency()` — the single place prices become AMD/RUB/EUR
 * — converts the per-seat entry rate now. Every surface that renders one of
 * these numbers must label it "per seat / month": the figure is a rate, not a
 * monthly bill. Derived from `src/lib/pricing.ts`, which mirrors
 * `convex/billing/defaults.ts` (pricing.test.ts keeps the three aligned).
 *
 * Enterprise is 0 on purpose: it is quoted, never self-served.
 */
export const BASE_PRICES = {
  starter: PLAN_SEAT_PRICING.starter.tiers[0]!.pricePerSeatMonthly,
  professional: PLAN_SEAT_PRICING.pro.tiers[0]!.pricePerSeatMonthly,
  enterprise: 0,
} as const;

// Fallback rates (updated manually as backup)
const FALLBACK_RATES: Record<string, { rate: number; symbol: string; code: string }> = {
  USD: { rate: 1, symbol: '$', code: 'USD' },
  RUB: { rate: 90, symbol: '₽', code: 'RUB' },
  AMD: { rate: 386, symbol: '֏', code: 'AMD' },
  EUR: { rate: 0.92, symbol: '€', code: 'EUR' },
};

// Locale to currency mapping
export const LOCALE_CURRENCY: Record<string, string> = {
  en: 'USD',
  ru: 'RUB',
  hy: 'AMD',
  de: 'EUR',
};

const CACHE_KEY = 'currency_rates_cache';
const CACHE_TTL = 3600000; // 1 hour

interface CachedRates {
  timestamp: number;
  rates: Record<string, number>;
}

async function fetchLiveRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch('/api/currency-rates');
    if (!res.ok) throw new Error('Failed to fetch rates');
    const data = (await res.json()) as { rates?: Record<string, number> };
    return data.rates || {};
  } catch {
    return {};
  }
}

export async function getExchangeRates(): Promise<Record<string, number>> {
  // Check cache first
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: CachedRates = JSON.parse(cached) as CachedRates;
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.rates;
      }
    }
  }

  // Fetch live rates
  const rates = await fetchLiveRates();

  // Cache the result
  if (typeof window !== 'undefined' && Object.keys(rates).length > 0) {
    const cache: CachedRates = { timestamp: Date.now(), rates };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  // Return live rates or fallback
  if (Object.keys(rates).length > 0) {
    return rates;
  }

  // Convert fallback rates to simple number map
  const fallback: Record<string, number> = {};
  for (const [code, config] of Object.entries(FALLBACK_RATES)) {
    fallback[code] = config.rate;
  }
  return fallback;
}

export interface LocalizedPrice {
  amount: number;
  formatted: string;
  currency: string;
  symbol: string;
  rate: number;
}

export async function convertPrice(
  usdAmount: number,
  locale: string = 'en',
): Promise<LocalizedPrice> {
  const targetCurrency = LOCALE_CURRENCY[locale] ?? 'USD';
  const rates = await getExchangeRates();
  const rate = rates[targetCurrency] ?? FALLBACK_RATES[targetCurrency]?.rate ?? 1;
  const config = FALLBACK_RATES[targetCurrency] ?? FALLBACK_RATES.USD;

  const converted = Math.round(usdAmount * rate);

  return {
    amount: converted,
    formatted: `${config!.symbol}${converted.toLocaleString()}`,
    currency: config!.code,
    symbol: config!.symbol,
    rate,
  };
}

export function getCurrencyConfig(locale: string = 'en'): { symbol: string; code: string } {
  const targetCurrency = LOCALE_CURRENCY[locale] ?? 'USD';
  const config = FALLBACK_RATES[targetCurrency] ?? FALLBACK_RATES.USD;
  return { symbol: config!.symbol, code: config!.code };
}

/**
 * Bundled fallback rate for a locale, available synchronously (no network).
 * Used as the starting point before live rates land, and as the last resort
 * when /api/currency-rates is unreachable.
 */
export function getFallbackRate(locale: string = 'en'): number {
  const targetCurrency = LOCALE_CURRENCY[locale] ?? 'USD';
  return FALLBACK_RATES[targetCurrency]?.rate ?? 1;
}

/**
 * Localize an arbitrary USD amount with an already-resolved rate.
 * Prices coming from the billing plan editor are stored in USD, so every
 * surface that renders them must run them through the active rate — otherwise
 * the symbol switches with the language while the digits stay in dollars.
 */
export function applyRate(usdAmount: number, rate: number): number {
  return Math.round(usdAmount * rate);
}

/**
 * Localize a USD amount keeping minor units (cents).
 *
 * `applyRate` rounds to whole units — right for a plan price (₽2,610 is not
 * shown with kopecks) but wrong for a *per-seat* rate: $5.50/seat became $6,
 * and a 100-seat total came out as $600 instead of $550. Anything per-seat, and
 * anything multiplied by a seat count, must use this instead.
 */
export function applyRatePrecise(usdAmount: number, rate: number): number {
  return Math.round(usdAmount * rate * 100) / 100;
}
