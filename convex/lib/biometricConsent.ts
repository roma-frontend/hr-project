/**
 * Biometric consent — the record behind Face ID enrolment.
 *
 * A face descriptor plus the enrolment photo are **biometric data**: special
 * category under GDPR Art. 9 and restricted personal data under Armenian law.
 * That means enrolment is not a setting you can switch on for somebody else —
 * it needs the subject's own, specific, informed consent, and it needs a
 * retention story: the data goes away when the reason for holding it does.
 *
 * This module is the single place that writes those records, so the three
 * moments that matter cannot drift apart:
 *
 *   - `grantBiometricConsent` — once, at enrolment, by the enrolling user;
 *   - `withdrawBiometricConsent` — when they switch Face ID off themselves;
 *   - for a leaver, `offboarding.completeProgram` erases the descriptor and
 *     withdraws the consent in the same transaction.
 *
 * Consent is stored in `consentRecords` keyed by `BIOMETRIC_CONSENT_TYPE`, with
 * the text version that was shown. Bumping `BIOMETRIC_CONSENT_VERSION` means the
 * enrolment text changed, so old rows stay traceable to what the person agreed
 * to rather than being silently re-pointed at new wording.
 */

import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { DEFAULT_LIST_CAP } from './limits';

/** Stored in `consentRecords.consentType`. */
export const BIOMETRIC_CONSENT_TYPE = 'biometric_face_id';

/**
 * Version of the enrolment text in `FaceRegistration.tsx`. Bump when that text
 * changes so the record says what was actually agreed to.
 */
export const BIOMETRIC_CONSENT_VERSION = '2026-09-20';

export interface GrantBiometricConsentArgs {
  userId: Id<'users'>;
  /** Required by the `consentRecords` schema; there is no org-less enrolment. */
  organizationId: Id<'organizations'>;
  version?: string;
  /** Free-form JSON: what was enrolled, from where. */
  metadata?: string;
}

/**
 * Records the enrollee's consent, refreshing the timestamp if they already
 * consented (re-enrolment, e.g. after removing and re-adding Face ID).
 */
export async function grantBiometricConsent(
  ctx: MutationCtx,
  args: GrantBiometricConsentArgs,
): Promise<Id<'consentRecords'>> {
  const now = Date.now();
  const existing = await ctx.db
    .query('consentRecords')
    .withIndex('by_user_consent', (q) =>
      q.eq('userId', args.userId).eq('consentType', BIOMETRIC_CONSENT_TYPE),
    )
    .filter((q) => q.eq(q.field('granted'), true))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      grantedAt: now,
      withdrawnAt: undefined,
      version: args.version ?? BIOMETRIC_CONSENT_VERSION,
      metadata: args.metadata,
    });
    return existing._id;
  }

  return await ctx.db.insert('consentRecords', {
    organizationId: args.organizationId,
    userId: args.userId,
    consentType: BIOMETRIC_CONSENT_TYPE,
    granted: true,
    grantedAt: now,
    version: args.version ?? BIOMETRIC_CONSENT_VERSION,
    metadata: args.metadata,
  });
}

/**
 * Marks every active biometric consent for the user as withdrawn. Returns how
 * many rows changed, so a caller can put it in an audit entry without a second
 * query. Idempotent: running it twice withdraws once.
 */
export async function withdrawBiometricConsent(
  ctx: MutationCtx,
  args: { userId: Id<'users'>; organizationId?: Id<'organizations'> },
): Promise<number> {
  const rows = await ctx.db
    .query('consentRecords')
    .withIndex('by_user_consent', (q) =>
      q.eq('userId', args.userId).eq('consentType', BIOMETRIC_CONSENT_TYPE),
    )
    .take(DEFAULT_LIST_CAP);

  const now = Date.now();
  let withdrawn = 0;
  for (const row of rows) {
    if (!row.granted || row.withdrawnAt) continue;
    if (args.organizationId && row.organizationId !== args.organizationId) continue;
    await ctx.db.patch(row._id, { granted: false, withdrawnAt: now });
    withdrawn += 1;
  }
  return withdrawn;
}
