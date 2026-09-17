'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { convertPrice, BASE_PRICES, getCurrencyConfig, getFallbackRate } from '@/lib/currency';

interface CurrencyState {
  starter: { amount: number; formatted: string; currency: string; symbol: string };
  professional: { amount: number; formatted: string; currency: string; symbol: string };
  locale: string;
  currency: string;
  symbol: string;
  /**
   * USD → current-currency multiplier that produced the amounts above.
   * Anything priced in USD outside BASE_PRICES (plans published from the
   * billing editor, add-ons, ROI calculators) must be multiplied by this, or it
   * renders with a localized symbol and dollar digits.
   */
  rate: number;
  loading: boolean;
}

export function useCurrency(): CurrencyState {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  // Pre-conversion defaults: BASE_PRICES holds PER-SEAT USD rates, so the
  // formatted strings must be built from them rather than hardcoded — the
  // initial render used to show $29 while `amount` was already the per-seat rate.
  const [state, setState] = useState<CurrencyState>({
    starter: {
      amount: BASE_PRICES.starter,
      formatted: `$${BASE_PRICES.starter}`,
      currency: 'USD',
      symbol: '$',
    },
    professional: {
      amount: BASE_PRICES.professional,
      formatted: `$${BASE_PRICES.professional}`,
      currency: 'USD',
      symbol: '$',
    },
    locale,
    currency: 'USD',
    symbol: '$',
    rate: 1,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const config = getCurrencyConfig(locale);
      const [starter, professional] = await Promise.all([
        convertPrice(BASE_PRICES.starter, locale),
        convertPrice(BASE_PRICES.professional, locale),
      ]);

      if (!cancelled) {
        setState({
          starter,
          professional,
          locale,
          currency: config.code,
          symbol: config.symbol,
          // convertPrice resolves the live rate; fall back to the bundled one so
          // `rate` is never left at 1 for a non-USD locale.
          rate: professional.rate || getFallbackRate(locale),
          loading: false,
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return state;
}
