'use client';

/**
 * Tenant-facing automation page.
 *
 * The builder and the run history live in `AutomationClient`, which is the same
 * component the operator dashboard uses — the queries and mutations behind it are
 * already organisation-scoped (`convex/automation.ts` filters by the caller's
 * organisation, `automationMutations` refuses rows belonging to anyone else), so a
 * tenant admin sees exactly their own workflows and nothing platform-level.
 *
 * ── Why the banner is built from the catalogue ──────────────────────────────
 * It used to hardcode "Supported actions today — send a notification, create a
 * task". That sentence went stale the moment four more actions were implemented,
 * and a stale sentence here is worse than none: it is the text an admin reads
 * before deciding whether a flow is worth building. The list now comes from
 * `convex/lib/workflowActions.ts`, which is also what the runner enforces, so the
 * banner cannot disagree with the product.
 *
 * The email card exists because transactional mail is optional infrastructure. A
 * deployment without a Resend key can still build workflows — it just cannot send
 * mail, and the person who needs to know that is the one about to build a flow
 * around it. "Send a test" answers "is it working?" without building a workflow to
 * find out.
 */

import nextDynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { Info, Mail, MailWarning, Send } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { WORKFLOW_ACTIONS } from '../../../../convex/lib/workflowActions';
import '@/i18n/config';

export const dynamic = 'force-dynamic';

const AutomationClient = nextDynamic(() => import('@/components/automation/AutomationClient'), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

/** Actions the runner can perform, straight from the shared catalogue. */
const IMPLEMENTED = WORKFLOW_ACTIONS.filter((action) => action.implemented);

export default function TenantAutomationPage() {
  const { t } = useTranslation();
  const emailConfig = useQuery(api.emails.getEmailConfiguration, {});
  const sendTest = useMutation(api.emails.sendTestEmail);
  const [sending, setSending] = useState(false);

  const runTest = async () => {
    setSending(true);
    try {
      const result = await sendTest({});
      if (!result.success) {
        // The mutation reports "not queued" rather than throwing, because a
        // deployment without mail is a configuration state, not an error.
        toast.error(t('automation.tenant.emailTestFailed', { reason: result.reason ?? 'unknown' }));
      } else if (result.redirected) {
        toast.warning(t('automation.tenant.emailTestRedirected', { to: result.to }));
      } else {
        toast.success(t('automation.tenant.emailTestSent', { to: result.to }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test email failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-2 rounded-xl border border-border/60 p-3 text-sm"
        role="note"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-(--text-muted)" />
        <div className="space-y-2">
          <p className="font-medium">{t('automation.tenant.title', 'Workflow automation')}</p>
          <p className="text-muted-foreground">
            {t(
              'automation.tenant.supportedHint',
              'Runs are real: workflows are planned from your steps and executed, and every run records why each step did or did not happen. Supported actions:',
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {IMPLEMENTED.map((action) => (
              <Badge key={action.id} variant="secondary" className="text-[10px]">
                {t(action.labelKey, action.id)}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              'automation.tenant.unsupportedHint',
              'Anything the builder does not offer is not implemented — it is shown disabled with the reason rather than silently doing nothing.',
            )}
          </p>
        </div>
      </div>

      {emailConfig && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm ${
            emailConfig.configured
              ? 'border-border/60'
              : 'border-(--warning-outline) bg-(--warning-quiet)'
          }`}
        >
          {emailConfig.configured ? (
            <Mail className="h-4 w-4 shrink-0 text-(--text-muted)" />
          ) : (
            <MailWarning className="h-4 w-4 shrink-0 text-(--warning-text)" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {emailConfig.configured
                ? t('automation.tenant.emailReady', 'Email delivery is configured')
                : t('automation.tenant.emailNotReady', 'Email delivery is not configured')}
            </p>
            <p className="text-xs text-muted-foreground">
              {emailConfig.configured
                ? emailConfig.redirectTo
                  ? t('automation.tenant.emailRedirectedTo', {
                      to: emailConfig.redirectTo,
                    })
                  : t('automation.tenant.emailSendsFrom', { from: emailConfig.from })
                : t('automation.tenant.emailProblem', { reason: emailConfig.problem ?? 'unknown' })}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={runTest} disabled={sending}>
            <Send className="mr-2 h-4 w-4" />
            {sending
              ? t('common.loading', '…')
              : t('automation.tenant.emailTest', 'Send test email')}
          </Button>
        </div>
      )}

      <AutomationClient />
    </div>
  );
}
