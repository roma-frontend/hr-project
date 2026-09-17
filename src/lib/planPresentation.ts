/**
 * How a plan presents itself to a *visitor* — its name and its tagline.
 *
 * The three standard plans carry i18n strings (`pricing.starter`…,
 * `pricing.starterDesc`…) so a Russian or Armenian visitor reads them in their
 * own language. But the superadmin can rename a plan or write their own tagline
 * in the tariff editor, and when they do that text must win — on the landing
 * page and in the editor's live preview.
 *
 * The difficulty is telling "the superadmin wrote this" apart from "this is what
 * the seed wrote", because every plan row in Convex has concrete strings. Two
 * rules handle it:
 *
 *   - **Names** are compared exactly against the seed. Plan names are stable
 *     (`Starter` / `Pro` / `Enterprise`), so "differs from the seed" genuinely
 *     means "renamed" — that is how a renamed Enterprise (`Индивидуальная`)
 *     keeps its own name while the untouched Starter falls back to the locale.
 *
 *   - **Taglines** are compared on their descriptive head, ignoring a trailing
 *     marketing clause. The seed's tail has already changed once ("…" →
 *     "… — priced per seat"), and rows keep whatever wording they were seeded
 *     with. Comparing the whole string made every legacy row look hand-written,
 *     which silently disabled translation for the English copy. Comparing the
 *     head (text before an em/en dash or pipe) makes a seed that gained a tail
 *     still match its own row.
 *
 * Pure and shared, so the pricing section and the editor's preview always
 * resolve a plan identically.
 */

import { DEFAULT_PLANS, type PlanKey } from '../../convex/billing/defaults';

/** i18n keys of the plan *names* (the `pricing` namespace). */
export const PLAN_NAME_KEYS: Record<PlanKey, string> = {
  starter: 'pricing.starter',
  pro: 'pricing.professional',
  enterprise: 'pricing.enterprise',
};

/** i18n keys of the localized plan descriptions (the `pricing` namespace). */
export const PLAN_TAGLINE_KEYS: Record<PlanKey, string> = {
  starter: 'pricing.starterDesc',
  pro: 'pricing.professionalDesc',
  enterprise: 'pricing.enterpriseDesc',
};

function seedFor(planKey: string) {
  return DEFAULT_PLANS.find((p) => p.key === planKey);
}

/** The descriptive head of a tagline: everything before a marketing tail. */
function taglineHead(text: string): string {
  return (text.split(/[—–|]/)[0] ?? '').trim().toLowerCase();
}

/** True when the stored name is the seeded one, i.e. nobody renamed the plan. */
export function isDefaultName(planKey: string, name: string | null | undefined): boolean {
  const stored = name?.trim();
  if (!stored) return true;
  return stored === (seedFor(planKey)?.name ?? '').trim();
}

/** True when the stored tagline is the seeded default, i.e. nobody edited it. */
export function isDefaultTagline(planKey: string, tagline: string | null | undefined): boolean {
  // Whitespace-only is "no copy", not a deliberate edit — the editor's input can
  // be cleared to spaces and that must not blank the landing page.
  const stored = tagline?.trim();
  if (!stored) return true;
  return taglineHead(stored) === taglineHead(seedFor(planKey)?.tagline ?? '');
}

/** True when the superadmin typed a tagline of their own. */
export function isAuthoredTagline(planKey: string, tagline: string | null | undefined): boolean {
  return !isDefaultTagline(planKey, tagline);
}

type Translate = (key: string, options?: { defaultValue?: string }) => string;

/**
 * Resolve the plan name for a visitor: your rename wins, otherwise the
 * visitor's language. Unknown keys (custom plans) always keep their own name.
 */
export function resolvePlanName({
  planKey,
  name,
  t,
}: {
  planKey: string;
  name: string | null | undefined;
  t: Translate;
}): string | undefined {
  const stored = name?.trim() || undefined;
  const key = PLAN_NAME_KEYS[planKey as PlanKey];
  if (!key || !isDefaultName(planKey, name)) return stored;
  return t(key, { defaultValue: stored });
}

/**
 * Resolve the tagline for a visitor: an authored one wins in every language,
 * an untouched seeded one falls back to the visitor's language.
 */
export function resolvePlanTagline({
  planKey,
  tagline,
  t,
}: {
  planKey: string;
  tagline: string | null | undefined;
  t: Translate;
}): string | undefined {
  const authored = tagline?.trim() || undefined;
  const key = PLAN_TAGLINE_KEYS[planKey as PlanKey];
  if (!key) return authored;
  if (isAuthoredTagline(planKey, tagline)) return authored;
  return t(key, { defaultValue: authored });
}
