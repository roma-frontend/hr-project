/**
 * Leave document generation — bilingual leave request and order documents.
 *
 * Flow:
 *   1. Employee requests leave → leave-request document sent to supervisor for signature
 *   2. Supervisor approves → leave-order document sent to HR for signature (if HR exists)
 *   3. If no HR → auto-generated (no signature needed)
 *   4. HR approves → done; HR rejects → cycle closes
 */
import { v } from 'convex/values';
import { internalMutation, query } from '../_generated/server';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { getAuthCaller } from '../lib/getAuthCaller';

import { insertSignatureDocument } from '../signatures';
import { allocateDocumentNumber } from '../lib/documentNumbers';
import { notify } from '../lib/notify';
import { hasCapability } from '../lib/capabilities';
import { SMALL_LIST_CAP } from '../lib/limits';
import { getAncestorIds, getOrgHeadId } from '../lib/reportingLine';

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Find active HR / admin holders of leave.approve.org in an organization. */
async function findOrgHrUsers(
  ctx: Pick<QueryCtx, 'db'>,
  organizationId: Id<'organizations'>,
): Promise<Doc<'users'>[]> {
  const admins = await ctx.db
    .query('users')
    .withIndex('by_org_role', (q) => q.eq('organizationId', organizationId).eq('role', 'admin'))
    .take(SMALL_LIST_CAP);
  return admins.filter(
    (u) => u.isActive && hasCapability(u, 'leave.approve.org') && !u.email?.endsWith('.internal'),
  );
}

/** Locales a leave document can be issued in: Armenian + one employee language. */
type LeaveDocLocale = 'hy' | 'ru' | 'en' | 'de';

/** Native language names printed as the captions above the two columns. */
const LOCALE_CAPTIONS: Record<LeaveDocLocale, string> = {
  hy: 'ՀԱՅԵՐԵՆ',
  ru: 'РУССКИЙ',
  en: 'ENGLISH',
  de: 'DEUTSCH',
};

/** Static labels of the signature grid, in the employee's language. */
const GRID_LABELS: Record<
  LeaveDocLocale,
  { signature: string; name: string; date: string; position: string }
> = {
  hy: { signature: 'Ստորագրություն', name: 'Անուն', date: 'Ամսաթիվ', position: 'Պաշտոն' },
  ru: { signature: 'Подпись', name: 'Имя', date: 'Дата', position: 'Должность' },
  en: { signature: 'Signature', name: 'Name', date: 'Date', position: 'Position' },
  de: { signature: 'Unterschrift', name: 'Name', date: 'Datum', position: 'Position' },
};

/**
 * Leave type key → a self-contained noun phrase per locale. Both documents read
 * "… is granted <label>", so the label has to carry the word for "leave" itself
 * ("paid leave", "оплачиваемый отпуск", "վճարովի արձակուրդ", "bezahlten Urlaub")
 * — a bare adjective breaks the sentence for maternity/paternity.
 */
const LEAVE_TYPE_LABELS: Record<string, Record<LeaveDocLocale, string>> = {
  paid: {
    en: 'paid leave',
    ru: 'оплачиваемый отпуск',
    hy: 'վճարովի արձակուրդ',
    de: 'bezahlten Urlaub',
  },
  unpaid: {
    en: 'unpaid leave',
    ru: 'отпуск без сохранения заработной платы',
    hy: 'անվճար արձակուրդ',
    de: 'unbezahlten Urlaub',
  },
  sick: {
    en: 'sick leave',
    ru: 'больничный отпуск',
    hy: 'հիվանդության արձակուրդ',
    de: 'Krankheitsurlaub',
  },
  family: {
    en: 'family leave',
    ru: 'семейный отпуск',
    hy: 'ընտանեկան արձակուրդ',
    de: 'Familienurlaub',
  },
  maternity: {
    en: 'maternity leave',
    ru: 'отпуск по беременности и родам',
    hy: 'մայրության արձակուրդ',
    de: 'Mutterschaftsurlaub',
  },
  paternity: {
    en: 'paternity leave',
    ru: 'отпуск по уходу за ребёнком',
    hy: 'հայրության արձակուրդ',
    de: 'Vaterschaftsurlaub',
  },
  study: {
    en: 'study leave',
    ru: 'учебный отпуск',
    hy: 'ուսումնական արձակուրդ',
    de: 'Studienurlaub',
  },
  doctor: {
    en: 'leave for a doctor visit',
    ru: 'отпуск для визита к врачу',
    hy: 'բժշկի այցի արձակուրդ',
    de: 'Arztbesuchsurlaub',
  },
  day_off: {
    en: 'day off',
    ru: 'отпуск без сохранения заработной платы (отгул)',
    hy: 'հատուկ արձակուրդ',
    de: 'Sonderurlaub',
  },
};

function leaveTypeLabel(type: string, locale: LeaveDocLocale): string {
  return LEAVE_TYPE_LABELS[type]?.[locale] ?? type;
}

/** `1` → `день`, `2` → `дня`, `5` → `дней` — Russian counts noun forms. */
function daysWordRu(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/** `2026-09-07` → `7 сентября 2026 г.` (ru) / `07 September 2026` (en) / … */
function formatDate(dateStr: string, locale: LeaveDocLocale): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  try {
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

/** One row of text in both languages — the unit of column alignment. */
interface BilingualRow {
  primary: string;
  secondary: string;
}

/** Pair the rows into the frozen bilingual block list, captions included. */
function toBilingualBlocks(rows: BilingualRow[], secondary: LeaveDocLocale) {
  return rows.map((row) => ({
    type: 'bilingual' as const,
    left: [{ type: 'paragraph' as const, text: row.primary }],
    right: [{ type: 'paragraph' as const, text: row.secondary }],
    leftLabel: LOCALE_CAPTIONS.hy,
    rightLabel: LOCALE_CAPTIONS[secondary],
  }));
}

/** Locale of the secondary column for a leave document (Armenian + employee language). */
function secondaryLocale(employee: Doc<'users'>): LeaveDocLocale {
  // Armenian is always primary; secondary comes from employee preference or org default
  return (employee.language as LeaveDocLocale) ?? 'ru';
}

// ─── Build bilingual leave request content ─────────────────────────────────

/**
 * Build the bilingual blocks for a leave request document.
 * This document is the employee's formal leave request, sent to the supervisor for signature.
 */
function buildLeaveRequestContent(args: {
  orgName: string;
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  secondaryLocale: LeaveDocLocale;
  today: string;
}): string {
  const secondary = args.secondaryLocale;
  const range = (locale: LeaveDocLocale) =>
    `(${formatDate(args.startDate, locale)} – ${formatDate(args.endDate, locale)})`;
  const typeHy = leaveTypeLabel(args.leaveType, 'hy');
  const typeSecondary = leaveTypeLabel(args.leaveType, secondary);

  // Left column: Armenian (legally binding), a fixed set of rows.
  const primaryRows: string[] = [
    `${args.orgName} — ԴԻՄՈՒՄ ԱՐՁԱԿՈՒՐԴԻ ՀԱՄԱՐ`,
    `Ես՝ ${args.employeeName}, ${args.employeeDepartment} բաժնի ${args.employeePosition},`,
    `սույնով խնդրում եմ տրամադրել ${typeHy}՝ ${args.days} օր ժամկետով ${range('hy')}։`,
    'Արձակուրդը հավանության արժանանալուց հետո սույն դիմումը ստորագրում է նաև աշխատողը։',
    `Պատճառ՝ ${args.reason}`,
    `Ամսաթիվ՝ ${formatDate(args.today, 'hy')}`,
  ];

  // Right column: the employee's language, same rows in the same order.
  const secondaryRows: string[] =
    secondary === 'ru'
      ? [
          `${args.orgName} — ЗАЯВЛЕНИЕ НА ОТПУСК`,
          `Я, ${args.employeeName}, ${args.employeePosition} отдела ${args.employeeDepartment},`,
          `прошу предоставить ${typeSecondary} продолжительностью ${args.days} ${daysWordRu(args.days)} ${range('ru')}.`,
          'После одобрения отпуска ответственным лицом настоящее заявление также подписывает работник.',
          `Причина: ${args.reason}`,
          `Дата: ${formatDate(args.today, 'ru')}`,
        ]
      : secondary === 'de'
        ? [
            `${args.orgName} — URLAUBSANTRAG`,
            `Hiermit beantrage ich, ${args.employeeName} (${args.employeePosition}, Abteilung ${args.employeeDepartment}),`,
            `${typeSecondary} für ${args.days} ${args.days === 1 ? 'Tag' : 'Tage'} ${range('de')}.`,
            'Nach der Genehmigung des Urlaubs unterschreibt auch der Arbeitnehmer diesen Antrag.',
            `Grund: ${args.reason}`,
            `Datum: ${formatDate(args.today, 'de')}`,
          ]
        : [
            `${args.orgName} — LEAVE REQUEST`,
            `I, ${args.employeeName}, ${args.employeePosition} of the ${args.employeeDepartment} department,`,
            `hereby request ${typeSecondary} for ${args.days} ${args.days === 1 ? 'day' : 'days'} ${range('en')}.`,
            'Once the leave is approved, the employee countersigns this request.',
            `Reason: ${args.reason}`,
            `Date: ${formatDate(args.today, 'en')}`,
          ];

  // Pair row by row so the two columns always compare like with like.
  const rows: BilingualRow[] = primaryRows.map((primary, index) => ({
    primary,
    secondary: secondaryRows[index] ?? '',
  }));

  const blocks = toBilingualBlocks(rows, secondary);

  return (
    '__DOC__' +
    JSON.stringify({
      version: 2,
      source: 'catalog' as const,
      templateId: 'leave-request',
      // Armenian first — the binding language, mirroring the left column.
      title: '\u0534\u056b\u0574\u0578\u0582\u0574 / Leave Request',
      blocks,
      accent: 'emerald' as const,
      orgName: args.orgName,
      primaryLocale: 'hy',
      secondaryLocale: args.secondaryLocale,
      labels: GRID_LABELS[args.secondaryLocale],
    })
  );
}

/**
 * Build the bilingual blocks for a leave order document.
 * This document is the formal order issued after supervisor approval, sent to HR for countersignature.
 */
function buildLeaveOrderContent(args: {
  orgName: string;
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  supervisorName: string;
  supervisorPosition: string;
  secondaryLocale: LeaveDocLocale;
  today: string;
}): string {
  const secondary = args.secondaryLocale;
  const range = (locale: LeaveDocLocale) =>
    `(${formatDate(args.startDate, locale)} – ${formatDate(args.endDate, locale)})`;
  const typeHy = leaveTypeLabel(args.leaveType, 'hy');
  const typeSecondary = leaveTypeLabel(args.leaveType, secondary);

  // Left column: Armenian (legally binding).
  const primaryRows: string[] = [
    `${args.orgName} — ՀՐԱՄԱՆ ԱՐՁԱԿՈՒՐԴԻ ՄԱՍԻՆ`,
    `${args.orgName}-ի ${args.employeeDepartment} բաժնի ${args.employeePosition} ${args.employeeName}-ին տրամադրվում է ${typeHy}՝ ${args.days} օր ժամկետով ${range('hy')}։`,
    `Հիմք՝ ${args.supervisorName}-ի (${args.supervisorPosition}) հավանությունը։`,
    `Պատճառ՝ ${args.reason}`,
    `Ամսաթիվ՝ ${formatDate(args.today, 'hy')}`,
  ];

  // Right column: the employee's language, same rows in the same order.
  const secondaryRows: string[] =
    secondary === 'ru'
      ? [
          `${args.orgName} — ПРИКАЗ О ПРЕДОСТАВЛЕНИИ ОТПУСКА`,
          `Предоставить ${args.employeeName}, ${args.employeePosition} отдела ${args.employeeDepartment} организации ${args.orgName}, ${typeSecondary} продолжительностью ${args.days} ${daysWordRu(args.days)} ${range('ru')}.`,
          `Основание: одобрение ${args.supervisorName} (${args.supervisorPosition}).`,
          `Причина: ${args.reason}`,
          `Дата: ${formatDate(args.today, 'ru')}`,
        ]
      : secondary === 'de'
        ? [
            `${args.orgName} — URLAUBSANORDNUNG`,
            `${args.employeeName} (${args.employeePosition}, Abteilung ${args.employeeDepartment}) von ${args.orgName} erhält ${typeSecondary} für ${args.days} ${args.days === 1 ? 'Tag' : 'Tage'} ${range('de')}.`,
            `Grundlage: Genehmigung durch ${args.supervisorName} (${args.supervisorPosition}).`,
            `Grund: ${args.reason}`,
            `Datum: ${formatDate(args.today, 'de')}`,
          ]
        : [
            `${args.orgName} — LEAVE ORDER`,
            `${args.employeeName}, ${args.employeePosition} of the ${args.employeeDepartment} department of ${args.orgName}, is granted ${typeSecondary} for ${args.days} ${args.days === 1 ? 'day' : 'days'} ${range('en')}.`,
            `Basis: approval by ${args.supervisorName} (${args.supervisorPosition}).`,
            `Reason: ${args.reason}`,
            `Date: ${formatDate(args.today, 'en')}`,
          ];

  // Pair row by row so the two columns always compare like with like.
  const rows: BilingualRow[] = primaryRows.map((primary, index) => ({
    primary,
    secondary: secondaryRows[index] ?? '',
  }));

  const blocks = toBilingualBlocks(rows, secondary);

  return (
    '__DOC__' +
    JSON.stringify({
      version: 2,
      source: 'catalog' as const,
      templateId: 'leave-order',
      title: '\u0540\u0580\u0561\u0574\u0561\u0576 / Leave Order',
      blocks,
      accent: 'emerald' as const,
      orgName: args.orgName,
      primaryLocale: 'hy',
      secondaryLocale: args.secondaryLocale,
      labels: GRID_LABELS[args.secondaryLocale],
    })
  );
}

// ─── Generate leave request document ───────────────────────────────────────

/**
 * Called after `createLeave` to generate the bilingual leave-request document
 * and send it to the supervisor for signature.
 */
export const generateLeaveRequestDocument = internalMutation({
  args: {
    leaveId: v.id('leaveRequests'),
  },
  handler: async (ctx, args) => {
    // Auth is optional here: this function is called from ctx.scheduler.runAfter
    // (no auth context) as well as from ctx.runMutation (has auth). When called
    // from the scheduler we fall back to the leave's createdBy field.
    const caller = await getAuthCaller(ctx);

    const leave = await ctx.db.get(args.leaveId);
    if (!leave) throw new Error('Leave request not found');
    if (leave.status !== 'pending') throw new Error('Leave is not pending');
    if (leave.leaveRequestDocumentId) return { documentId: leave.leaveRequestDocumentId };

    const user = await ctx.db.get(leave.userId);
    if (!user) throw new Error('User not found');

    const org = leave.organizationId ? await ctx.db.get(leave.organizationId) : null;
    if (!org) throw new Error('Organization not found');

    // Resolve the actor for the audit trail: authenticated caller or the leave creator.
    const actorId = caller?._id ?? leave.createdBy;
    if (!actorId) throw new Error('Cannot determine document creator');

    const secLocale = secondaryLocale(user);
    const now = Date.now();

    // Build the bilingual content
    const content = buildLeaveRequestContent({
      orgName: org.name ?? 'Organization',
      employeeName: user.name ?? 'Employee',
      employeePosition: user.position ?? 'Employee',
      employeeDepartment: user.department ?? 'General',
      leaveType: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.days,
      reason: leave.reason,
      secondaryLocale: secLocale,
      today: new Date(now).toISOString().slice(0, 10),
    });

    // The supervisor (reviewer) signs first, then the employee.
    // When this runs from createLeave, leave.reviewedBy is not set yet (the
    // leave is still pending), so we resolve the approver from the reporting
    // line: the nearest active ancestor who holds `leave.approve`.
    const signers: Array<{ userId: Id<'users'>; name: string; email: string; order: number }> = [];

    // Order 1: the nearest approver in the reporting line
    let supervisorDoc: Doc<'users'> | null = null;
    if (leave.reviewedBy) {
      // Document generated after approval — reviewer is known.
      supervisorDoc = await ctx.db.get(leave.reviewedBy);
    } else {
      // Document generated during createLeave — walk the reporting line.
      const ancestorIds = await getAncestorIds(ctx, user._id);
      for (const ancestorId of ancestorIds) {
        const ancestor = await ctx.db.get(ancestorId);
        if (!ancestor || !ancestor.isActive) continue;
        if (!hasCapability(ancestor, 'leave.approve')) continue;
        supervisorDoc = ancestor;
        break;
      }
    }

    if (supervisorDoc) {
      signers.push({
        userId: supervisorDoc._id,
        name: supervisorDoc.name ?? '',
        email: supervisorDoc.email ?? '',
        order: 1,
      });
    }

    // Order 2+: the employee
    signers.push({
      userId: user._id,
      name: user.name ?? '',
      email: user.email ?? '',
      order: signers.length + 1,
    });

    if (signers.length === 0) {
      throw new Error('No signers found for leave request document');
    }

    const documentNumber = await allocateDocumentNumber(ctx, leave.organizationId!);

    const signatureDocumentId = await insertSignatureDocument(ctx, {
      organizationId: leave.organizationId!,
      title: `Leave Request — ${user.name ?? 'Employee'} (${leave.startDate} → ${leave.endDate})`,
      content,
      accent: 'emerald',
      orgName: org.name ?? 'Organization',
      signatureBlock: true,
      fieldDefinitions: [
        { id: 'signature', label: 'Signature', type: 'signature', required: true },
      ],
      signers,
      createdBy: actorId,
    });

    await ctx.db.patch(args.leaveId, {
      leaveRequestDocumentId: signatureDocumentId,
      updatedAt: now,
    });

    // Notify the supervisor about the document
    for (const signer of signers) {
      if (signer.userId === user._id) continue; // Don't notify the employee about their own doc
      await notify(ctx, {
        organizationId: leave.organizationId!,
        userId: signer.userId,
        type: 'system',
        titleKey: 'notifications.titles.documentAwaitingSignature',
        messageKey: 'notifications.messages.documentAwaitingSignature',
        params: { title: `Leave Request — ${user.name}` },
        fallbackTitle: '✍️ Leave request document awaiting signature',
        fallbackMessage: `Leave request for ${user.name} is waiting for your signature.`,
        relatedId: signatureDocumentId,
        route: '/signatures',
        createdAt: now,
      });
    }

    return { signatureDocumentId, documentNumber };
  },
});

// ─── Generate leave order document (after supervisor approval) ─────────────

/**
 * Called after `approveLeave` when the supervisor approves.
 * If HR exists, generates a leave-order document and sends it to HR for countersignature.
 * If no HR, the order is auto-recorded.
 */
export const generateLeaveOrderDocument = internalMutation({
  args: {
    leaveId: v.id('leaveRequests'),
  },
  handler: async (ctx, args) => {
    // Auth is optional: called from scheduler (no auth) and from mutations (has auth).
    const caller = await getAuthCaller(ctx);

    const leave = await ctx.db.get(args.leaveId);
    if (!leave) throw new Error('Leave request not found');
    if (leave.status !== 'approved') throw new Error('Leave must be approved');
    if (leave.leaveOrderDocumentId) return { documentId: leave.leaveOrderDocumentId };

    const user = await ctx.db.get(leave.userId);
    if (!user) throw new Error('User not found');

    const org = leave.organizationId ? await ctx.db.get(leave.organizationId) : null;
    if (!org) throw new Error('Organization not found');

    // Find HR users who can countersign
    const hrUsers = leave.organizationId ? await findOrgHrUsers(ctx, leave.organizationId) : [];

    // Filter out the reviewer (supervisor) from HR list to avoid self-signing
    let approverHrUsers = hrUsers.filter(
      (u) => u._id !== leave.reviewedBy && u._id !== leave.userId,
    );

    const secLocale = secondaryLocale(user);
    const now = Date.now();

    // Get supervisor info for the order
    const supervisor = leave.reviewedBy ? await ctx.db.get(leave.reviewedBy) : null;

    // Build the bilingual leave order content
    const content = buildLeaveOrderContent({
      orgName: org.name ?? 'Organization',
      employeeName: user.name ?? 'Employee',
      employeePosition: user.position ?? 'Employee',
      employeeDepartment: user.department ?? 'General',
      leaveType: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.days,
      reason: leave.reason,
      supervisorName: supervisor?.name ?? 'Supervisor',
      supervisorPosition: supervisor?.position ?? 'Supervisor',
      secondaryLocale: secLocale,
      today: new Date(now).toISOString().slice(0, 10),
    });

    if (approverHrUsers.length === 0) {
      // No HR available — fall back to the head of the organization (CEO)
      // as the countersigner. If the head is the employee or the supervisor,
      // or no head is declared, auto-approve without signature.
      const headId = await getOrgHeadId(ctx, leave.organizationId);
      if (headId && headId !== leave.userId && headId !== leave.reviewedBy) {
        const headDoc = await ctx.db.get(headId);
        if (headDoc && headDoc.isActive) {
          approverHrUsers = [headDoc];
        }
      }

      if (approverHrUsers.length === 0) {
        return { autoApproved: true, reason: 'no_hr' };
      }
    }

    // Build signers: employee first, then HR
    const signers: Array<{ userId: Id<'users'>; name: string; email: string; order: number }> = [
      {
        userId: user._id,
        name: user.name ?? '',
        email: user.email ?? '',
        order: 1,
      },
    ];

    // Add HR as countersigner
    for (const hr of approverHrUsers.slice(0, 2)) {
      signers.push({
        userId: hr._id,
        name: hr.name ?? '',
        email: hr.email ?? '',
        order: signers.length + 1,
      });
    }

    const documentNumber = await allocateDocumentNumber(ctx, leave.organizationId!);

    // Resolve actor for audit trail: authenticated caller, or the reviewer who approved the leave.
    const actorId = caller?._id ?? leave.reviewedBy ?? leave.userId;
    if (!actorId) throw new Error('Cannot determine document creator');

    const signatureDocumentId = await insertSignatureDocument(ctx, {
      organizationId: leave.organizationId!,
      title: `Leave Order — ${user.name ?? 'Employee'} (${leave.startDate} → ${leave.endDate})`,
      content,
      accent: 'emerald',
      orgName: org.name ?? 'Organization',
      signatureBlock: true,
      fieldDefinitions: [
        { id: 'signature', label: 'Signature', type: 'signature', required: true },
      ],
      signers,
      createdBy: actorId,
    });

    await ctx.db.patch(args.leaveId, {
      leaveOrderDocumentId: signatureDocumentId,
      updatedAt: now,
    });

    // Notify all signers
    for (const signer of signers) {
      await notify(ctx, {
        organizationId: leave.organizationId!,
        userId: signer.userId,
        type: 'system',
        titleKey: 'notifications.titles.documentAwaitingSignature',
        messageKey: 'notifications.messages.documentAwaitingSignature',
        params: { title: `Leave Order — ${user.name}` },
        fallbackTitle: '✍️ Leave order document awaiting signature',
        fallbackMessage: `Leave order for ${user.name} is waiting for your signature.`,
        relatedId: signatureDocumentId,
        route: '/signatures',
        createdAt: now,
      });
    }

    return { signatureDocumentId, documentNumber, autoApproved: false };
  },
});

// ─── Query: get leave document state ───────────────────────────────────────

export const getLeaveDocuments = query({
  args: {
    leaveId: v.id('leaveRequests'),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) return null;

    const leave = await ctx.db.get(args.leaveId);
    if (!leave) return null;

    const requestDoc = leave.leaveRequestDocumentId
      ? await ctx.db.get(leave.leaveRequestDocumentId)
      : null;
    const orderDoc = leave.leaveOrderDocumentId
      ? await ctx.db.get(leave.leaveOrderDocumentId)
      : null;

    return {
      leaveRequestDocument: requestDoc
        ? {
            id: requestDoc._id,
            title: requestDoc.title,
            status: requestDoc.status,
          }
        : null,
      leaveOrderDocument: orderDoc
        ? {
            id: orderDoc._id,
            title: orderDoc.title,
            status: orderDoc.status,
          }
        : null,
    };
  },
});

// ─── Release leave when signature is declined/cancelled ───────────────────

/**
 * Called from `declineDocument` / `cancelDocument` in `convex/signatures.ts`.
 * When a leave-order signature document (HR countersignature) is declined or
 * cancelled, the leave is marked as rejected and the balance is restored.
 *
 * When a leave-request signature document (supervisor signature) is declined,
 * the leave goes back to pending for re-assignment or is rejected.
 */
export async function releaseLeaveRow(
  ctx: MutationCtx,
  documentId: Id<'signatureDocuments'>,
): Promise<void> {
  // We need to search across all organizations, so we cannot use the
  // by_org index (it requires organizationId). A filter-based scan is
  // acceptable because leaveRequestDocumentId / leaveOrderDocumentId
  // mutations happen rarely (only on signature decline/cancel).
  const leaveAsRequest = await ctx.db
    .query('leaveRequests')
    .filter((q) => q.eq(q.field('leaveRequestDocumentId'), documentId))
    .first();

  if (leaveAsRequest && leaveAsRequest.status === 'pending') {
    // Supervisor declined the leave request document — reject the leave
    await rejectLeaveFromSignature(
      ctx,
      leaveAsRequest,
      'Supervisor declined the leave request document',
    );
    return;
  }

  const leaveAsOrder = await ctx.db
    .query('leaveRequests')
    .filter((q) => q.eq(q.field('leaveOrderDocumentId'), documentId))
    .first();

  if (leaveAsOrder && leaveAsOrder.status === 'approved') {
    // HR declined the leave order document — reject the leave
    await rejectLeaveFromSignature(ctx, leaveAsOrder, 'HR declined the leave order document');
    return;
  }
}

/**
 * Reject a leave from a signature decline/cancel event.
 * Restores the balance if it was deducted, notifies the employee, and logs it.
 */
async function rejectLeaveFromSignature(
  ctx: MutationCtx,
  leave: Doc<'leaveRequests'>,
  reason: string,
): Promise<void> {
  const now = Date.now();

  // Restore balance if it was already deducted (leave was approved)
  if (leave.status === 'approved') {
    const user = await ctx.db.get(leave.userId);
    if (user) {
      const { restoreLeaveBalance } = await import('./balances');
      await restoreLeaveBalance(ctx, leave.userId, user, leave.type, leave.days);
    }
  }

  // Update leave status to rejected
  await ctx.db.patch(leave._id, {
    status: 'rejected',
    reviewComment: reason,
    reviewedAt: now,
    updatedAt: now,
  });

  // Notify the employee
  await notify(ctx, {
    organizationId: leave.organizationId,
    userId: leave.userId,
    type: 'leave_rejected',
    titleKey: 'notifications.titles.leaveRejected',
    messageKey: 'notifications.messages.leaveRejectedBy',
    params: {
      type: leave.type,
      start: leave.startDate,
      end: leave.endDate,
      reviewerName: 'System',
      comment: reason,
    },
    fallbackTitle: '\u274c Leave Rejected',
    fallbackMessage: `Your ${leave.type} leave (${leave.startDate} \u2192 ${leave.endDate}) was rejected: ${reason}.`,
    relatedId: leave._id,
    route: '/leaves',
    createdAt: now,
  });

  // Audit log
  await ctx.db.insert('auditLogs', {
    organizationId: leave.organizationId,
    userId: leave.userId,
    action: 'leave_rejected',
    target: leave._id,
    details: JSON.stringify({
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.days,
      reason,
      source: 'signature_decline',
    }),
    createdAt: now,
  });
}
