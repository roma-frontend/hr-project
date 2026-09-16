/**
 * Public comparison data (`/compare`, `/compare/[competitor]`).
 *
 * This module holds only the parts of a comparison that are NOT prose: the
 * vendor list, their slugs/branding, and the feature matrix. Every human-readable
 * string lives in the `compare` group of the `landing` locale namespace
 * (en/ru/hy/de) and is resolved by key — so adding a language never touches code.
 *
 * Provenance of the vendor marks: public vendor material as of the date in
 * `COMPARE_VERIFIED`. Like the table in ROADMAP.md, they are indicative and must
 * be re-verified per deal before being quoted in a contract. Our own column is
 * checked against this repository.
 */

export const COMPARE_VERIFIED = '2026-09-16';

export const COMPARE_SLUGS = [
  'personio',
  'bamboohr',
  'hibob',
  'rippling',
  'leapsome',
  'deel',
] as const;

export type CompetitorSlug = (typeof COMPARE_SLUGS)[number];

/** `partial` = exists but limited (higher tier, add-on, single country, …). */
export type Support = 'yes' | 'partial' | 'no';

export interface Competitor {
  slug: CompetitorSlug;
  /** Trademark — never translated. */
  name: string;
  /** Brand accent used for the card/monogram. */
  color: string;
  /** Two-letter monogram for the comparison column header. */
  monogram: string;
  /** Public marketing site, shown as a link on the detail page. */
  site: string;
}

export const COMPETITORS: readonly Competitor[] = [
  {
    slug: 'personio',
    name: 'Personio',
    color: '#ff5c35',
    monogram: 'PE',
    site: 'https://www.personio.com',
  },
  {
    slug: 'bamboohr',
    name: 'BambooHR',
    color: '#7ac142',
    monogram: 'BH',
    site: 'https://www.bamboohr.com',
  },
  {
    slug: 'hibob',
    name: 'HiBob',
    color: '#4b4ded',
    monogram: 'HB',
    site: 'https://www.hibob.com',
  },
  {
    slug: 'rippling',
    name: 'Rippling',
    color: '#f5a623',
    monogram: 'RI',
    site: 'https://www.rippling.com',
  },
  {
    slug: 'leapsome',
    name: 'Leapsome',
    color: '#00b3a4',
    monogram: 'LE',
    site: 'https://www.leapsome.com',
  },
  {
    slug: 'deel',
    name: 'Deel',
    color: '#16a34a',
    monogram: 'DE',
    site: 'https://www.deel.com',
  },
];

export type RowCategory = 'people' | 'time' | 'talent' | 'ops' | 'platform' | 'local' | 'gaps';

/** Table section order — local-market rows and honest gaps come last on purpose. */
export const CATEGORY_ORDER: readonly RowCategory[] = [
  'people',
  'time',
  'talent',
  'ops',
  'platform',
  'local',
  'gaps',
];

export interface CompareRow {
  /** i18n key under `compare.rows.` */
  key: string;
  category: RowCategory;
  us: Support;
  vendors: Record<CompetitorSlug, Support>;
}

export const COMPARE_ROWS: readonly CompareRow[] = [
  // ── People ──────────────────────────────────────────────────────────────
  {
    key: 'employees',
    category: 'people',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'yes',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'partial',
      deel: 'yes',
    },
  },
  {
    key: 'leave',
    category: 'people',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'yes',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'no',
      deel: 'yes',
    },
  },
  // ── Time & attendance ───────────────────────────────────────────────────
  {
    key: 'attendance',
    category: 'time',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'yes',
      hibob: 'no',
      rippling: 'yes',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'faceKiosk',
    category: 'time',
    us: 'yes',
    vendors: {
      personio: 'no',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'no',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'shifts',
    category: 'time',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'no',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'no',
      deel: 'partial',
    },
  },
  // ── Talent ──────────────────────────────────────────────────────────────
  {
    key: 'recruitment',
    category: 'talent',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'yes',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'no',
      deel: 'yes',
    },
  },
  {
    key: 'onboarding',
    category: 'talent',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'yes',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'no',
      deel: 'partial',
    },
  },
  {
    key: 'performance',
    category: 'talent',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'partial',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'yes',
      deel: 'no',
    },
  },
  {
    key: 'learning',
    category: 'talent',
    us: 'yes',
    vendors: {
      personio: 'partial',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'partial',
      leapsome: 'yes',
      deel: 'no',
    },
  },
  {
    key: 'recognition',
    category: 'talent',
    us: 'yes',
    vendors: {
      personio: 'partial',
      bamboohr: 'partial',
      hibob: 'yes',
      rippling: 'no',
      leapsome: 'yes',
      deel: 'no',
    },
  },
  // ── Operations ──────────────────────────────────────────────────────────
  {
    key: 'payroll',
    category: 'ops',
    us: 'yes',
    vendors: {
      personio: 'partial',
      bamboohr: 'partial',
      hibob: 'no',
      rippling: 'yes',
      leapsome: 'no',
      deel: 'yes',
    },
  },
  {
    key: 'expenses',
    category: 'ops',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'partial',
      hibob: 'no',
      rippling: 'yes',
      leapsome: 'no',
      deel: 'partial',
    },
  },
  {
    key: 'documents',
    category: 'ops',
    us: 'yes',
    vendors: {
      personio: 'partial',
      bamboohr: 'partial',
      hibob: 'partial',
      rippling: 'partial',
      leapsome: 'no',
      deel: 'partial',
    },
  },
  {
    key: 'assets',
    category: 'ops',
    us: 'yes',
    vendors: {
      personio: 'partial',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'yes',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'projects',
    category: 'ops',
    us: 'yes',
    vendors: {
      personio: 'no',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'partial',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'analytics',
    category: 'ops',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'yes',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'yes',
      deel: 'partial',
    },
  },
  // ── Platform ────────────────────────────────────────────────────────────
  {
    key: 'chat',
    category: 'platform',
    us: 'yes',
    vendors: {
      personio: 'partial',
      bamboohr: 'partial',
      hibob: 'partial',
      rippling: 'no',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'video',
    category: 'platform',
    us: 'yes',
    vendors: {
      personio: 'no',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'no',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'sso',
    category: 'platform',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'partial',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'partial',
      deel: 'yes',
    },
  },
  {
    key: 'publicApi',
    category: 'platform',
    us: 'yes',
    vendors: {
      personio: 'yes',
      bamboohr: 'yes',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'yes',
      deel: 'yes',
    },
  },
  // ── Armenia & local market ──────────────────────────────────────────────
  {
    key: 'srcExport',
    category: 'local',
    us: 'yes',
    vendors: {
      personio: 'no',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'no',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'armenianUi',
    category: 'local',
    us: 'yes',
    vendors: {
      personio: 'no',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'no',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'armsoft',
    category: 'local',
    us: 'yes',
    vendors: {
      personio: 'no',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'no',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'imid',
    category: 'local',
    us: 'yes',
    vendors: {
      personio: 'no',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'no',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'localPay',
    category: 'local',
    us: 'yes',
    vendors: {
      personio: 'no',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'no',
      leapsome: 'no',
      deel: 'no',
    },
  },
  {
    key: 'supportLanguage',
    category: 'local',
    us: 'yes',
    vendors: {
      personio: 'partial',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'no',
      leapsome: 'no',
      deel: 'partial',
    },
  },
  // ── Where we are behind (published on purpose) ──────────────────────────
  {
    key: 'mobileApp',
    category: 'gaps',
    us: 'partial',
    vendors: {
      personio: 'yes',
      bamboohr: 'yes',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'yes',
      deel: 'yes',
    },
  },
  {
    key: 'globalPayroll',
    category: 'gaps',
    us: 'no',
    vendors: {
      personio: 'no',
      bamboohr: 'no',
      hibob: 'no',
      rippling: 'partial',
      leapsome: 'no',
      deel: 'yes',
    },
  },
  {
    key: 'soc2',
    category: 'gaps',
    us: 'partial',
    vendors: {
      personio: 'yes',
      bamboohr: 'yes',
      hibob: 'yes',
      rippling: 'yes',
      leapsome: 'yes',
      deel: 'yes',
    },
  },
];

export function getCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

export function isCompetitorSlug(slug: string): slug is CompetitorSlug {
  return (COMPARE_SLUGS as readonly string[]).includes(slug);
}

export interface CompareScore {
  /** Rows where we ship it and the vendor does not. */
  oursOnly: number;
  /** Rows where the vendor ships it and we do not. */
  theirsOnly: number;
}

/**
 * Head-to-head tally for the index cards. Rows where either side is `partial`
 * are deliberately counted for neither column — a comparison that scores every
 * row as a win is the kind of table buyers stop trusting.
 */
export function compareScore(slug: CompetitorSlug): CompareScore {
  let oursOnly = 0;
  let theirsOnly = 0;
  for (const row of COMPARE_ROWS) {
    const theirs = row.vendors[slug];
    if (row.us === 'yes' && theirs === 'no') oursOnly += 1;
    if (row.us === 'no' && theirs === 'yes') theirsOnly += 1;
  }
  return { oursOnly, theirsOnly };
}

/** Rows grouped in `CATEGORY_ORDER`, for the table body. */
export function groupedRows(): { category: RowCategory; rows: CompareRow[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    rows: COMPARE_ROWS.filter((row) => row.category === category),
  })).filter((group) => group.rows.length > 0);
}
