/**
 * Public comparison pages (`/compare`, `/compare/[competitor]`).
 *
 * Two things can silently break these pages and neither is covered by the
 * generic locale-parity script:
 *   1. the matrix data drifting out of shape (a row missing a vendor mark
 *      renders an empty cell, a row outside `CATEGORY_ORDER` disappears);
 *   2. the *dynamic* translation keys — every `t(`compare.rows.${key}`)` and
 *      `t(`compare.competitors.${slug}.${field}`)` — which `check-i18n-keys.mjs`
 *      explicitly skips because they are template literals. A missing one shows
 *      a raw key on a public marketing page, in a language nobody on the team reads.
 *
 * So the key inventory is asserted explicitly, per locale, for every key the
 * components can ask for.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import CompareTable from '@/components/compare/CompareTable';
import CompareDetailPage from '@/app/compare/[competitor]/page';
import {
  CATEGORY_ORDER,
  COMPETITORS,
  COMPARE_ROWS,
  COMPARE_SLUGS,
  compareScore,
  groupedRows,
} from '@/lib/competitors';

const LOCALES = ['en', 'ru', 'hy', 'de'] as const;

type Compare = Record<string, unknown>;

function loadCompare(locale: string): Compare {
  const file = join(process.cwd(), 'public', 'locales', locale, 'landing.json');
  const json = JSON.parse(readFileSync(file, 'utf8')) as { compare?: Compare };
  return json.compare ?? {};
}

/** Dotted paths of every leaf under `compare`. */
function flatten(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') return [prefix];
  return Object.keys(node as Record<string, unknown>).flatMap((key) =>
    flatten((node as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key),
  );
}

function leaf(compare: Compare, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[part];
  }, compare);
}

/** Every key the UI resolves — literally (check-i18n sees these) or by template. */
const STATIC_KEYS = [
  'legend.yes',
  'legend.partial',
  'legend.no',
  'legend.us',
  'index.badge',
  'index.heroTitle',
  'index.heroSubtitle',
  'index.verifiedNote',
  'index.cardsTitle',
  'index.cardsSubtitle',
  'index.scoreOurs',
  'index.scoreTheirs',
  'index.viewComparison',
  'index.featureColumn',
  'index.usColumn',
  'index.tableTitle',
  'index.tableSubtitle',
  'index.ctaTitle',
  'index.ctaSubtitle',
  'index.ctaPrimary',
  'index.ctaSecondary',
  'detail.backToCompare',
  'detail.heroTitle',
  'detail.hqLabel',
  'detail.whereTheyWinTitle',
  'detail.whereWeWinTitle',
  'detail.verdictTitle',
  'detail.bestForTitle',
  'detail.notForTitle',
  'detail.tableTitle',
  'detail.tableSubtitle',
  'detail.otherTitle',
  'detail.ctaTitle',
  'detail.ctaSubtitle',
  'detail.ctaPrimary',
  'detail.ctaSecondary',
  'meta.indexTitle',
  'meta.indexDescription',
  'meta.indexOgTitle',
  'meta.indexOgDescription',
  'meta.detailTitle',
  'meta.detailDescription',
  'meta.detailOgTitle',
  'meta.detailOgDescription',
];

const COMPETITOR_FIELDS = [
  'hq',
  'tagline',
  'win1',
  'win2',
  'win3',
  'our1',
  'our2',
  'our3',
  'our4',
  'verdict',
  'bestFor',
  'notFor',
];

describe('competitor matrix', () => {
  it('covers every competitor in every row', () => {
    for (const row of COMPARE_ROWS) {
      for (const slug of COMPARE_SLUGS) {
        expect(row.vendors[slug]).toMatch(/^(yes|partial|no)$/);
      }
      expect(row.us).toMatch(/^(yes|partial|no)$/);
    }
  });

  it('has unique row keys', () => {
    const keys = COMPARE_ROWS.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('puts every row in a known category and loses none in grouping', () => {
    for (const row of COMPARE_ROWS) {
      expect(CATEGORY_ORDER).toContain(row.category);
    }
    const grouped = groupedRows().flatMap((group) => group.rows);
    expect(grouped).toHaveLength(COMPARE_ROWS.length);
    expect(grouped.map((r) => r.key)).toEqual(COMPARE_ROWS.map((r) => r.key));
  });

  it('defines a competitor entry for every slug', () => {
    expect(COMPETITORS.map((c) => c.slug)).toEqual([...COMPARE_SLUGS]);
    for (const competitor of COMPETITORS) {
      expect(competitor.monogram).toHaveLength(2);
      expect(competitor.site.startsWith('https://')).toBe(true);
    }
  });

  it('counts a row for one side only when the other side ships nothing', () => {
    // Our own row: we ship local compliance, none of the six do — the entire
    // reason these pages exist, so it is asserted rather than assumed.
    for (const slug of COMPARE_SLUGS) {
      const score = compareScore(slug);
      expect(score.oursOnly).toBeGreaterThan(0);
      // The Armenian-market rows are exclusives for every competitor compared.
      expect(score.oursOnly).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps the published gaps honest (mobile apps and SOC 2 are not ours)', () => {
    const mobile = COMPARE_ROWS.find((row) => row.key === 'mobileApp');
    const soc2 = COMPARE_ROWS.find((row) => row.key === 'soc2');
    expect(mobile?.us).not.toBe('yes');
    expect(soc2?.us).not.toBe('yes');
    // …and they are published under the deliberate "where we are behind" group.
    expect(mobile?.category).toBe('gaps');
    expect(soc2?.category).toBe('gaps');
  });

  it('marks the Armenian-market rows as ours only', () => {
    const exclusive = ['srcExport', 'armenianUi', 'armsoft', 'imid', 'localPay'];
    for (const key of exclusive) {
      const row = COMPARE_ROWS.find((r) => r.key === key);
      expect(row?.us).toBe('yes');
      for (const slug of COMPARE_SLUGS) {
        expect(row?.vendors[slug]).toBe('no');
      }
    }
  });
});

describe('compare translations', () => {
  it.each(LOCALES)('has every static key the UI asks for (%s)', (locale) => {
    const compare = loadCompare(locale);
    const missing = STATIC_KEYS.filter((key) => typeof leaf(compare, key) !== 'string');
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('has a label for every matrix row and category (%s)', (locale) => {
    const compare = loadCompare(locale);
    const missing = [
      ...COMPARE_ROWS.map((row) => `rows.${row.key}`),
      ...CATEGORY_ORDER.map((category) => `categories.${category}`),
    ].filter((key) => typeof leaf(compare, key) !== 'string');
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('has every field for every competitor (%s)', (locale) => {
    const compare = loadCompare(locale);
    const missing: string[] = [];
    for (const slug of COMPARE_SLUGS) {
      for (const field of COMPETITOR_FIELDS) {
        if (typeof leaf(compare, `competitors.${slug}.${field}`) !== 'string') {
          missing.push(`${slug}.${field}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps all four locales on the same key set', () => {
    const reference = flatten(loadCompare('en')).sort();
    for (const locale of LOCALES) {
      expect(flatten(loadCompare(locale)).sort()).toEqual(reference);
    }
    expect(reference.length).toBeGreaterThan(100);
  });

  it('interpolates the placeholders the components pass', () => {
    for (const locale of LOCALES) {
      const compare = loadCompare(locale);
      expect(leaf(compare, 'index.scoreOurs')).toContain('{{n}}');
      expect(leaf(compare, 'index.scoreTheirs')).toContain('{{name}}');
      expect(leaf(compare, 'index.verifiedNote')).toContain('{{date}}');
      expect(leaf(compare, 'detail.heroTitle')).toContain('{{name}}');
      expect(leaf(compare, 'detail.tableSubtitle')).toContain('{{name}}');
      expect(leaf(compare, 'meta.detailTitle')).toContain('{{name}}');
    }
  });

  it('does not leak Russian text into the Armenian locale', () => {
    // A stray Cyrillic word in the Armenian marketing copy is the failure mode
    // that is invisible to a key-parity check.
    const serialized = JSON.stringify(loadCompare('hy'));
    expect(/[\u0400-\u04FF]/.test(serialized)).toBe(false);
  });
});

describe('CompareTable', () => {
  it('renders every vendor column and the legend', () => {
    render(<CompareTable initialLanguage="en" />);

    expect(screen.getByText('Employee records & org chart')).toBeInTheDocument();
    expect(screen.getByText('Generally available')).toBeInTheDocument();
    expect(screen.getByText('Not offered by the vendor')).toBeInTheDocument();
    for (const competitor of COMPETITORS) {
      expect(screen.getByTitle(competitor.name)).toBeInTheDocument();
    }
  });

  it('narrows to one vendor on a head-to-head page', () => {
    render(<CompareTable initialLanguage="en" only="rippling" />);

    expect(screen.getByTitle('Rippling')).toBeInTheDocument();
    expect(screen.queryByTitle('Personio')).toBeNull();
    expect(screen.queryByTitle('Deel')).toBeNull();
  });

  // The row labels are resolved through template literals (`compare.rows.${key}`),
  // so a real render is the only thing that proves the whole chain resolves in a
  // non-English language.
  it('renders row labels in Russian', async () => {
    await i18n.changeLanguage('ru');
    try {
      render(<CompareTable initialLanguage="ru" />);

      expect(screen.getByText('Посещаемость и учёт времени')).toBeInTheDocument();
      expect(screen.getByText('Терминалы с распознаванием лиц')).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('renders row labels in Armenian', async () => {
    await i18n.changeLanguage('hy');
    try {
      render(<CompareTable initialLanguage="hy" />);

      expect(screen.getByText('Հաճախումներ և աշխատաժամանակի հաշվառում')).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});

describe('/compare/[competitor]', () => {
  it('renders the 404 boundary for an unknown vendor', async () => {
    // The slug check runs before the locale cookie is read, so this needs no
    // request context. `notFound()` surfaces as an error whose digest carries
    // the status — that is the contract this page owes its callers.
    const error = await CompareDetailPage({
      params: Promise.resolve({ competitor: 'not-a-vendor' }),
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error & { digest?: string }).digest ?? error)).toContain('404');
  });

  it.each(COMPARE_SLUGS)('accepts %s as a vendor slug', async (slug) => {
    // Reaching the locale lookup (which throws outside a request scope) proves
    // the slug passed validation.
    const error = await CompareDetailPage({
      params: Promise.resolve({ competitor: slug }),
    }).catch((e: unknown) => e);

    expect(String((error as Error & { digest?: string }).digest ?? error)).not.toContain('404');
  });
});
