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

export const COMPARE_VERIFIED = '2026-09-19';

export const GLOBAL_COMPARE_SLUGS = [
  'personio',
  'bamboohr',
  'hibob',
  'rippling',
  'leapsome',
  'deel',
] as const;

/**
 * Armenian and CIS vendors buyers actually shortlist in this market.
 *
 * `hirebee`, `listwork`, `resalt`, `sparkwork` and `ontime` were added on
 * 2026-09-19: the previous revision of this file assumed Armenia had no local
 * integrated HR platform beyond Armsoft/1C, which is not true in 2026 — these
 * four ship HR + payroll or attendance and are met in real shortlists, and
 * OnTime owns biometric *hardware* (ZKTeco) that we do not integrate with.
 * Their marks come from the vendors' own public product descriptions, and the
 * usual rule applies: re-verify per deal before quoting them to a customer.
 */
export const LOCAL_COMPARE_SLUGS = [
  'armsoft',
  'onec',
  'staffam',
  'peopleforce',
  'odoo',
  'hirebee',
  'listwork',
  'resalt',
  'sparkwork',
  'ontime',
] as const;

export const COMPARE_SLUGS = [...GLOBAL_COMPARE_SLUGS, ...LOCAL_COMPARE_SLUGS] as const;

export type CompetitorSlug = (typeof COMPARE_SLUGS)[number];
export type GlobalCompetitorSlug = (typeof GLOBAL_COMPARE_SLUGS)[number];

/** Which market a vendor belongs to — drives the grouped sections on /compare. */
export type CompetitorRegion = 'global' | 'local';

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
  /**
   * Public marketing site, shown as a link on the detail page.
   *
   * Optional on purpose: several Armenian vendors have no site we could
   * verify, and inventing a URL on a page that claims to be checkable is worse
   * than omitting the link.
   */
  site?: string;
  /** Global platform vs Armenian/CIS local vendor. */
  region: CompetitorRegion;
}

export const COMPETITORS: readonly Competitor[] = [
  {
    slug: 'personio',
    name: 'Personio',
    color: '#ff5c35',
    monogram: 'PE',
    site: 'https://www.personio.com',
    region: 'global',
  },
  {
    slug: 'bamboohr',
    name: 'BambooHR',
    color: '#7ac142',
    monogram: 'BH',
    site: 'https://www.bamboohr.com',
    region: 'global',
  },
  {
    slug: 'hibob',
    name: 'HiBob',
    color: '#4b4ded',
    monogram: 'HB',
    site: 'https://www.hibob.com',
    region: 'global',
  },
  {
    slug: 'rippling',
    name: 'Rippling',
    color: '#f5a623',
    monogram: 'RI',
    site: 'https://www.rippling.com',
    region: 'global',
  },
  {
    slug: 'leapsome',
    name: 'Leapsome',
    color: '#00b3a4',
    monogram: 'LE',
    site: 'https://www.leapsome.com',
    region: 'global',
  },
  {
    slug: 'deel',
    name: 'Deel',
    color: '#16a34a',
    monogram: 'DE',
    site: 'https://www.deel.com',
    region: 'global',
  },
  // ── Armenia & CIS ────────────────────────────────────────────────────────
  {
    slug: 'armsoft',
    name: 'Armsoft',
    color: '#0b5fa5',
    monogram: 'AS',
    site: 'https://armsoft.am',
    region: 'local',
  },
  {
    slug: 'onec',
    name: '1C:ZUP',
    color: '#d4a017',
    monogram: '1C',
    site: 'https://1c.ru',
    region: 'local',
  },
  {
    slug: 'staffam',
    name: 'Staff.am',
    color: '#e11d48',
    monogram: 'SA',
    site: 'https://staff.am',
    region: 'local',
  },
  {
    slug: 'peopleforce',
    name: 'PeopleForce',
    color: '#0ea5e9',
    monogram: 'PF',
    site: 'https://peopleforce.io',
    region: 'local',
  },
  {
    slug: 'odoo',
    name: 'Odoo',
    color: '#714b67',
    monogram: 'OD',
    site: 'https://www.odoo.com',
    region: 'local',
  },
  // Added 2026-09-19 — local integrated platforms met in Armenian shortlists.
  {
    slug: 'hirebee',
    name: 'Hirebee',
    color: '#e0a80d',
    monogram: 'HI',
    site: 'https://hirebee.ai',
    region: 'local',
  },
  {
    // No verified public site — deliberately no link rather than a guessed one.
    slug: 'listwork',
    name: 'List Work',
    color: '#0f766e',
    monogram: 'LW',
    region: 'local',
  },
  {
    slug: 'resalt',
    name: 'Resalt',
    color: '#7c3aed',
    monogram: 'RE',
    region: 'local',
  },
  {
    slug: 'sparkwork',
    name: 'Spark.work',
    color: '#ea580c',
    monogram: 'SP',
    site: 'https://spark.work',
    region: 'local',
  },
  {
    slug: 'ontime',
    name: 'OnTime',
    color: '#475569',
    monogram: 'OT',
    region: 'local',
  },
];

/** Vendors filtered by market — used to render the two comparison sections. */
export function competitorsByRegion(region: CompetitorRegion): readonly Competitor[] {
  return COMPETITORS.filter((c) => c.region === region);
}

/**
 * Rows where our own mark alone would be read as a bigger claim than it is.
 *
 * The mark is the honest one; the footnote exists because a half-dot next to
 * "Armsoft integration" does not say *why*. Rendered as a footnote under the
 * matrix (i18n: `compare.notes.<rowKey>`), not only as a hover title — a good
 * share of `/compare` traffic reads it on a phone, where nothing hovers.
 *
 * Keep this list short: a page where every row needs a caveat reads as one
 * where nothing is true.
 */
export const ROWS_WITH_OUR_NOTE: readonly string[] = ['armsoft', 'localPay'];

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

/**
 * Row as authored: global vendor marks only. Local-market marks are folded in
 * from `LOCAL_MARKS` below so a row never has to repeat 11 vendor keys.
 */
interface BaseCompareRow extends Omit<CompareRow, 'vendors'> {
  vendors: Partial<Record<CompetitorSlug, Support>>;
}

const BASE_ROWS: readonly BaseCompareRow[] = [
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
    // `partial`, not `yes`: what we ship is a configured sync against an HTTP
    // API the customer's own ՀԾ installation has to expose (`syncArmsoft` in
    // `convex/integrations.ts` requires an endpoint AND a key). A chief
    // accountant reads "yes" as "certified connector" and finds out on the
    // first call that it is not — see `ROWS_WITH_OUR_NOTE` for the footnote
    // the page prints next to it.
    key: 'armsoft',
    category: 'local',
    us: 'partial',
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

/**
 * Armenia & CIS competitor marks, keyed by row. Any local vendor omitted for a
 * row is treated as `no`, so the table below only lists where they actually
 * ship something. Sources: public vendor material, to be re-verified per deal
 * like every other vendor mark.
 *
 * `no` here means "no public evidence", not "proven absent" — the distinction is
 * why the local section is labelled as indicative on the page. Payroll depth is
 * deliberately conservative for the local platforms: Hirebee, List Work and
 * Resalt all advertise payroll, but none publishes Armenian tax handling, so
 * they get `payroll: yes` without any of the `srcExport`/`localPay` credit.
 */
const LOCAL_MARKS: Record<string, Partial<Record<CompetitorSlug, Support>>> = {
  employees: {
    armsoft: 'yes',
    onec: 'yes',
    staffam: 'partial',
    peopleforce: 'yes',
    odoo: 'yes',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'yes',
    sparkwork: 'yes',
    ontime: 'partial',
  },
  leave: {
    armsoft: 'partial',
    onec: 'yes',
    peopleforce: 'yes',
    odoo: 'yes',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'yes',
    sparkwork: 'yes',
    // Absence tracking and request approvals, not a leave-management module.
    ontime: 'partial',
  },
  attendance: {
    armsoft: 'partial',
    onec: 'partial',
    peopleforce: 'yes',
    odoo: 'yes',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'partial',
    sparkwork: 'yes',
    ontime: 'yes',
  },
  shifts: {
    armsoft: 'partial',
    onec: 'yes',
    peopleforce: 'yes',
    odoo: 'yes',
    listwork: 'yes',
    ontime: 'yes',
  },
  recruitment: {
    onec: 'partial',
    staffam: 'yes',
    peopleforce: 'yes',
    odoo: 'yes',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'yes',
    sparkwork: 'yes',
  },
  onboarding: {
    onec: 'partial',
    peopleforce: 'yes',
    odoo: 'yes',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'yes',
  },
  performance: {
    onec: 'partial',
    peopleforce: 'yes',
    odoo: 'yes',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'yes',
    sparkwork: 'yes',
  },
  learning: {
    peopleforce: 'partial',
    odoo: 'partial',
    hirebee: 'yes',
    listwork: 'partial',
    resalt: 'partial',
    sparkwork: 'partial',
  },
  recognition: {
    peopleforce: 'yes',
    odoo: 'partial',
    listwork: 'yes',
    resalt: 'partial',
    sparkwork: 'yes',
  },
  payroll: {
    armsoft: 'yes',
    onec: 'yes',
    peopleforce: 'partial',
    odoo: 'partial',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'yes',
  },
  expenses: {
    armsoft: 'partial',
    onec: 'partial',
    peopleforce: 'partial',
    odoo: 'yes',
    listwork: 'partial',
  },
  documents: {
    armsoft: 'partial',
    onec: 'partial',
    peopleforce: 'partial',
    odoo: 'yes',
    hirebee: 'yes',
    listwork: 'partial',
    resalt: 'partial',
    sparkwork: 'yes',
  },
  assets: { onec: 'partial', odoo: 'partial', listwork: 'yes' },
  projects: { odoo: 'yes', listwork: 'yes', sparkwork: 'yes' },
  analytics: {
    armsoft: 'yes',
    onec: 'yes',
    staffam: 'partial',
    peopleforce: 'yes',
    odoo: 'yes',
    hirebee: 'yes',
    listwork: 'partial',
    resalt: 'yes',
    sparkwork: 'yes',
    ontime: 'partial',
  },
  chat: { staffam: 'partial', peopleforce: 'partial', odoo: 'partial', listwork: 'yes' },
  sso: { peopleforce: 'yes', odoo: 'partial' },
  publicApi: {
    armsoft: 'partial',
    onec: 'partial',
    peopleforce: 'yes',
    odoo: 'yes',
    hirebee: 'yes',
    // Power BI integration is real but it is not a documented customer API.
    sparkwork: 'partial',
  },
  srcExport: { armsoft: 'yes', onec: 'yes', odoo: 'partial' },
  armenianUi: {
    armsoft: 'yes',
    onec: 'yes',
    staffam: 'yes',
    peopleforce: 'partial',
    odoo: 'partial',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'yes',
    sparkwork: 'yes',
    ontime: 'yes',
  },
  armsoft: { armsoft: 'yes', onec: 'partial', ontime: 'partial' },
  supportLanguage: {
    armsoft: 'yes',
    onec: 'yes',
    staffam: 'yes',
    peopleforce: 'partial',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'yes',
    sparkwork: 'yes',
    ontime: 'yes',
  },
  mobileApp: {
    staffam: 'partial',
    peopleforce: 'yes',
    odoo: 'yes',
    hirebee: 'yes',
    listwork: 'yes',
    resalt: 'yes',
    sparkwork: 'yes',
  },
  faceKiosk: { ontime: 'yes' },
};

export const COMPARE_ROWS: readonly CompareRow[] = BASE_ROWS.map((row) => {
  const vendors = { ...row.vendors } as Record<CompetitorSlug, Support>;
  for (const slug of LOCAL_COMPARE_SLUGS) {
    vendors[slug] = LOCAL_MARKS[row.key]?.[slug] ?? 'no';
  }
  return { ...row, vendors };
});

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
