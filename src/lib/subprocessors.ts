/**
 * Subprocessor register — the data behind `/subprocessors`.
 *
 * Provenance: every entry here is a service the repository actually calls, not a
 * list copied from a template. The core set matches the vendor register in
 * `docs/soc2-type2-readiness.md` §2.4 (Stripe, Resend, Cloudinary, LiveKit,
 * Sentry, Upstash, Convex, Vercel — all eight are live dependencies); the
 * optional set is only reachable when a tenant switches the feature on.
 *
 * That `core` / `optional` split is the part buyers actually ask about: an
 * optional entry processes nothing until the tenant enables it, and saying so is
 * more useful than a flat list of twenty logos.
 *
 * Regions are the vendor's published default for this deployment. The
 * application itself is pinned to `fra1` (Frankfurt) in `vercel.json`.
 */

/** `core` = processes data for every tenant; `optional` = only when enabled. */
export type SubprocessorKind = 'core' | 'optional';

export interface Subprocessor {
  id: string;
  /** Trademark — never translated. */
  name: string;
  kind: SubprocessorKind;
  /** Where the vendor processes data. Proper nouns, so not translated. */
  region: string;
  /** Vendor trust/security page, for reports and their own sub-processor lists. */
  site: string;
}

export const SUBPROCESSORS: readonly Subprocessor[] = [
  // ── Core platform — required for every tenant ────────────────────────────
  {
    id: 'convex',
    name: 'Convex',
    kind: 'core',
    region: 'EU (Frankfurt)',
    site: 'https://www.convex.dev/legal/security',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    kind: 'core',
    region: 'EU (fra1, Frankfurt)',
    site: 'https://vercel.com/legal/privacy-policy',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    kind: 'core',
    region: 'EU (Frankfurt)',
    site: 'https://sentry.io/security/',
  },
  {
    id: 'upstash',
    name: 'Upstash',
    kind: 'core',
    region: 'EU (Frankfurt)',
    site: 'https://upstash.com/trust/security',
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    kind: 'core',
    region: 'US / vendor-managed',
    site: 'https://cloudinary.com/trust',
  },
  {
    id: 'resend',
    name: 'Resend',
    kind: 'core',
    region: 'US / vendor-managed',
    site: 'https://resend.com/legal/dpa',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    kind: 'core',
    region: 'US / vendor-managed',
    site: 'https://stripe.com/legal/dpa',
  },
  {
    id: 'livekit',
    name: 'LiveKit',
    kind: 'core',
    region: 'Vendor-managed',
    site: 'https://livekit.io/security',
  },

  // ── Optional — nothing is processed until the tenant enables the feature ──
  {
    id: 'google',
    name: 'Google',
    kind: 'optional',
    region: 'US / vendor-managed',
    site: 'https://cloud.google.com/security/compliance',
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    kind: 'optional',
    region: 'Vendor-managed',
    site: 'https://www.microsoft.com/trust-center',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'optional',
    region: 'US / vendor-managed',
    site: 'https://openai.com/security',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    kind: 'optional',
    region: 'Vendor-managed',
    site: 'https://telegram.org/privacy',
  },
  {
    id: 'imid',
    name: 'imID',
    kind: 'optional',
    region: 'Armenia',
    site: 'https://www.imid.am',
  },
  {
    id: 'idram',
    name: 'Idram / ArCa',
    kind: 'optional',
    region: 'Armenia',
    site: 'https://www.idram.am',
  },
  {
    id: 'luckycarrot',
    name: 'Lucky Carrot',
    kind: 'optional',
    region: 'Armenia',
    site: 'https://luckycarrot.am',
  },
];

export function subprocessorsByKind(kind: SubprocessorKind): Subprocessor[] {
  return SUBPROCESSORS.filter((entry) => entry.kind === kind);
}

export function subprocessorCounts(): { core: number; optional: number; total: number } {
  const core = subprocessorsByKind('core').length;
  const optional = subprocessorsByKind('optional').length;
  return { core, optional, total: core + optional };
}

/**
 * Policy commitments published alongside the register. Kept as data so the page
 * and the DPA template cannot drift apart — the wording in `docs/legal/`
 * describes the same numbers.
 */
export const SUBPROCESSOR_CHANGE_NOTICE_DAYS = 30;
