'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Copy,
  Fingerprint,
  Inbox,
  Check,
  Ban,
  ChevronDown,
  ChevronRight,
  Server,
} from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { convexSiteUrl } from '@/lib/convexSiteUrl';
import {
  ZK_DEVICE_FAMILIES,
  ZK_HANDSHAKE_SETTINGS,
  ZK_REQUIRED_CAPABILITIES,
  ZK_SERVER_PATH,
  ZK_SETUP_STEPS,
  describeZkSetup,
} from '../../../convex/lib/zkteco';

/**
 * Inbound integrations — the reverse of Settings → Webhooks.
 *
 * Two jobs, both admin-only (the mutations enforce it server-side too):
 *
 *   1. Mint the token URL a device or a SaaS webhook posts to. The secret is
 *      shown exactly once, like a webhook signing secret.
 *   2. Review the punches that arrived. Attendance hardware writes to a journal,
 *      never straight into `timeTracking` — HR confirms a punch here, and only
 *      then does it become a check-in/check-out. That is deliberate: a typo in a
 *      табельный номер or a bad device clock must not move payroll.
 *
 * The promotion deliberately calls the existing `timeTracking.checkIn` /
 * `checkOut` mutations instead of writing attendance itself, so lateness,
 * worked minutes and overtime keep exactly one implementation.
 */
type Provider = 'device' | 'jira' | 'generic';

type PunchStatus = 'pending' | 'unmatched' | 'imported' | 'ignored' | 'duplicate';

export function InboundIntegrationsSettings() {
  const { t } = useTranslation();

  const tokens = useQuery(api.inbound.listInboundTokens, {});
  const employees = useQuery(api.users.queries.getAllUsers, { limit: 100 });

  const mint = useMutation(api.inbound.mintInboundToken);
  const setEnabled = useMutation(api.inbound.setInboundTokenEnabled);
  const removeToken = useMutation(api.inbound.deleteInboundToken);
  const setSerial = useMutation(api.inbound.setDeviceSerial);
  const setEmployeeNumber = useMutation(api.inbound.setEmployeeNumber);
  const ignorePunch = useMutation(api.inbound.ignorePunch);
  const markImported = useMutation(api.inbound.markPunchImported);
  const checkIn = useMutation(api.timeTracking.checkIn);
  const checkOut = useMutation(api.timeTracking.checkOut);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<Provider>('device');
  const [label, setLabel] = useState('');
  const [assignee, setAssignee] = useState<string>('');
  const [mintedUrl, setMintedUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Id<'inboundTokens'> | null>(null);
  const [busyPunch, setBusyPunch] = useState<string | null>(null);
  // Terminal serial drafts, keyed by token id — a ZKTeco device authenticates by
  // SN, so binding one is the whole "connect the hardware" step.
  const [serialDrafts, setSerialDrafts] = useState<Record<string, string>>({});
  /** Terminal onboarding guide — collapsed by default; it is long and read once. */
  const [showGuide, setShowGuide] = useState(false);
  const [savingSerial, setSavingSerial] = useState<string | null>(null);

  const [punchStatus, setPunchStatus] = useState<PunchStatus>('pending');
  const [matchFor, setMatchFor] = useState<string | null>(null);
  const [matchUser, setMatchUser] = useState<string>('');
  const [matchNumber, setMatchNumber] = useState('');

  const punches = useQuery(api.inbound.listDevicePunches, { status: punchStatus });

  const employeeById = useMemo(() => {
    const map = new Map<string, { name: string; employeeNumber?: string }>();
    for (const user of (employees ?? []) as Array<{
      _id: string;
      name: string;
      employeeNumber?: string;
    }>) {
      map.set(user._id, { name: user.name, employeeNumber: user.employeeNumber });
    }
    return map;
  }, [employees]);

  const urlFor = (token: string) => `${convexSiteUrl()}/api/in/${token}`;

  /**
   * Where a terminal has to be pointed.
   *
   * Not the token URL: an ADMS device is configured with a host and a path, and
   * it authenticates by serial number against a bound token — it never sees the
   * token secret. Showing `/api/in/<token>` for a device would be actively
   * misleading, which is why the guide below uses the site origin instead.
   */
  const admsHost = useMemo(() => {
    try {
      return new URL(convexSiteUrl()).host;
    } catch {
      return convexSiteUrl().replace(/^https?:\/\//, '');
    }
  }, []);

  /**
   * Bind a terminal to this token by serial number.
   *
   * The device cannot use a secret URL — a ZKTeco terminal is configured with a
   * server address and identifies itself by SN on every request. The mutation
   * rejects a serial already bound elsewhere, so a typo cannot route one tenant's
   * terminal into another tenant's punch journal.
   */
  const bindSerial = async (tokenId: Id<'inboundTokens'>) => {
    const draft = serialDrafts[tokenId];
    if (draft === undefined) return;
    setSavingSerial(tokenId);
    try {
      await setSerial({ tokenId, deviceSerial: draft.trim() });
      toast.success(t('settings.inbound.deviceSerialSaved'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('settings.inbound.deviceSerialSaveError'),
      );
    } finally {
      setSavingSerial(null);
    }
  };

  const copy = (text: string, message: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(message);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const result = await mint({
        provider,
        label: label.trim() || t(`settings.inbound.providers.${provider}`),
        defaultAssigneeId: (assignee || undefined) as Id<'users'> | undefined,
      });
      setMintedUrl(urlFor(result.token));
      setCreating(false);
      setLabel('');
      setAssignee('');
      toast.success(t('settings.inbound.created'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.inbound.createError'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Turn a punch into real attendance: the *existing* attendance mutation
   * applies the schedule, lateness and overtime rules, and the journal then
   * remembers the row it produced.
   */
  const promote = async (punch: {
    _id: string;
    userId: string | null;
    punchAt: number;
    direction: string;
  }) => {
    if (!punch.userId) return;
    setBusyPunch(punch._id);
    try {
      const timeTrackingId =
        punch.direction === 'out'
          ? await checkOut({ userId: punch.userId as Id<'users'>, occurredAt: punch.punchAt })
          : await checkIn({ userId: punch.userId as Id<'users'>, occurredAt: punch.punchAt });
      await markImported({
        punchId: punch._id as Id<'devicePunches'>,
        timeTrackingId: timeTrackingId as Id<'timeTracking'>,
      });
      toast.success(t('settings.inbound.imported'));
    } catch (error) {
      // A punch older than the attendance window (36h) is refused by design;
      // say so instead of pretending it worked.
      toast.error(error instanceof Error ? error.message : t('settings.inbound.importError'));
    } finally {
      setBusyPunch(null);
    }
  };

  const punchRow = (punch: {
    _id: string;
    employeeNumberRaw: string;
    userId: string | null;
    punchAt: number;
    direction: string;
    status: string;
    note?: string | null;
  }) => {
    const employee = punch.userId ? employeeById.get(punch.userId) : undefined;
    return (
      <div
        key={punch._id}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 p-3 text-sm"
      >
        <Badge variant="secondary" className="font-mono">
          {punch.employeeNumberRaw}
        </Badge>
        <span className="text-muted-foreground">{new Date(punch.punchAt).toLocaleString()}</span>
        <Badge variant="outline">{t(`settings.inbound.direction.${punch.direction}`)}</Badge>
        <span className="flex-1 truncate">
          {employee ? employee.name : t('settings.inbound.noEmployee')}
        </span>
        <Badge
          variant={punch.status === 'unmatched' ? 'destructive' : 'outline'}
          className="shrink-0"
        >
          {t(`settings.inbound.status.${punch.status}`)}
        </Badge>

        {punch.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busyPunch === punch._id}
              onClick={() => void promote(punch)}
            >
              <Check className="h-4 w-4" />
              {t('settings.inbound.promote')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void ignorePunch({ punchId: punch._id as Id<'devicePunches'> })}
            >
              <Ban className="h-4 w-4" />
              {t('settings.inbound.ignore')}
            </Button>
          </div>
        )}

        {punch.status === 'unmatched' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setMatchFor(punch._id);
              setMatchUser('');
              setMatchNumber(punch.employeeNumberRaw);
            }}
          >
            {t('settings.inbound.match')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            {t('settings.inbound.tokensTitle')}
          </CardTitle>
          <CardDescription>{t('settings.inbound.tokensDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mintedUrl && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
              <p className="mb-2 text-sm font-medium">{t('settings.inbound.copyNow')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-background/60 px-2 py-1 text-xs">
                  {mintedUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(mintedUrl, t('settings.inbound.copied'))}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {tokens === undefined ? (
            <ShieldLoader />
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.inbound.noTokens')}</p>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
                <div
                  key={token._id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 p-3 text-sm"
                >
                  <span className="font-medium">{token.label}</span>
                  <Badge variant="outline">
                    {t(`settings.inbound.providers.${token.provider}`)}
                  </Badge>
                  {token.provider === 'device' && token.deviceSerial ? (
                    <Badge variant="secondary" className="font-mono">
                      {t('settings.inbound.deviceSerialBound', { serial: token.deviceSerial })}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">••••{token.tokenHint}</span>
                  )}
                  <span className="flex-1 text-xs text-muted-foreground">
                    {token.lastError
                      ? t('settings.inbound.lastError', { error: token.lastError })
                      : t('settings.inbound.received', { count: token.receivedCount })}
                  </span>
                  <Switch
                    checked={token.enabled}
                    onCheckedChange={(checked) =>
                      void setEnabled({ tokenId: token._id, enabled: checked })
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleting(token._id)}
                    aria-label={t('settings.inbound.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  {/* ZKTeco / Suprema: the terminal is pointed at this deployment
                      and identified by its serial number (ADMS push protocol).
                      Without a bound SN the device has no way to authenticate. */}
                  {token.provider === 'device' && (
                    <div className="flex w-full flex-wrap items-center gap-2">
                      <Input
                        value={serialDrafts[token._id] ?? token.deviceSerial ?? ''}
                        onChange={(e) =>
                          setSerialDrafts((prev) => ({ ...prev, [token._id]: e.target.value }))
                        }
                        placeholder={t('settings.inbound.deviceSerialPlaceholder')}
                        className="h-8 max-w-[220px] font-mono"
                        aria-label={t('settings.inbound.deviceSerial')}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void bindSerial(token._id)}
                        disabled={
                          savingSerial === token._id || serialDrafts[token._id] === undefined
                        }
                      >
                        {t('settings.inbound.deviceSerialSave')}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {t('settings.inbound.deviceSerialHint')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/*
            Terminal onboarding, rendered from `convex/lib/zkteco.ts` rather than
            written here: the steps describe the same handshake the HTTP layer
            implements, and the capability list is a check the admin can perform
            on their own device instead of a compatibility matrix nobody tested.
          */}
          <div className="rounded-lg border border-(--border)">
            <button
              type="button"
              onClick={() => setShowGuide((prev) => !prev)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
              aria-expanded={showGuide}
            >
              {showGuide ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Server className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t('settings.inbound.zkteco.title', 'Connecting a ZKTeco terminal')}
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {ZK_SERVER_PATH}
              </Badge>
            </button>

            {showGuide && (
              <div className="space-y-4 border-t border-(--border) px-4 py-4 text-sm">
                <p className="text-muted-foreground">{t('settings.inbound.zkteco.intro')}</p>

                <div>
                  <p className="mb-1 font-medium">{t('settings.inbound.zkteco.requirements')}</p>
                  <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                    {ZK_REQUIRED_CAPABILITIES.map((capability) => (
                      <li key={capability.id}>
                        <span className="text-foreground">{t(capability.labelKey)}</span> —{' '}
                        {t(capability.detailKey)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 font-medium">{t('settings.inbound.zkteco.stepsTitle')}</p>
                  <ol className="ml-4 list-decimal space-y-2 text-muted-foreground">
                    {ZK_SETUP_STEPS.map((step) => (
                      <li key={step.id}>
                        <span className="text-foreground">{t(step.labelKey)}</span>
                        <br />
                        {t(step.detailKey)}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-md bg-(--background-subtle) p-3 font-mono text-xs">
                  <div>
                    {t('settings.inbound.zkteco.serverAddress')}: <strong>{admsHost}</strong>
                  </div>
                  <div>
                    {t('settings.inbound.zkteco.serverPath')}: <strong>{ZK_SERVER_PATH}</strong>
                  </div>
                  <div>
                    {t('settings.inbound.zkteco.timeZone')}:{' '}
                    <strong>UTC+{ZK_HANDSHAKE_SETTINGS.timeZone}</strong>
                  </div>
                  <div>
                    {t('settings.inbound.zkteco.poll')}:{' '}
                    <strong>{ZK_HANDSHAKE_SETTINGS.pollSeconds}s</strong>
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-medium">{t('settings.inbound.zkteco.familiesTitle')}</p>
                  <ul className="space-y-2 text-muted-foreground">
                    {ZK_DEVICE_FAMILIES.map((family) => (
                      <li key={family.id}>
                        <span className="text-foreground">{t(family.labelKey)}</span>
                        {family.endpoint === 'generic' && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {t(
                              'settings.inbound.zkteco.genericEndpoint',
                              'via the generic webhook',
                            )}
                          </Badge>
                        )}
                        <br />
                        <span className="font-mono text-xs">{family.menuHints.join(' · ')}</span>
                        <br />
                        {t(family.noteKey)}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground">
                  {t('settings.inbound.zkteco.verificationNote')}
                </p>

                {/*
                  The step list as plain text, for the person who is going to walk
                  to the entrance with a phone. Same data, no JSX — see
                  `describeZkSetup`.
                */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copy(
                      describeZkSetup((key) => t(key)),
                      t('settings.inbound.zkteco.copied'),
                    )
                  }
                >
                  <Copy className="h-4 w-4" />
                  {t('settings.inbound.zkteco.copyInstructions')}
                </Button>
              </div>
            )}
          </div>

          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t('settings.inbound.create')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            {t('settings.inbound.punchesTitle')}
          </CardTitle>
          <CardDescription>{t('settings.inbound.punchesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['pending', 'unmatched', 'imported', 'ignored'] as PunchStatus[]).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={punchStatus === status ? 'default' : 'outline'}
                onClick={() => setPunchStatus(status)}
              >
                {t(`settings.inbound.status.${status}`)}
              </Button>
            ))}
          </div>

          {punches === undefined ? (
            <ShieldLoader />
          ) : punches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.inbound.noPunches')}</p>
          ) : (
            <div className="space-y-2">{punches.map(punchRow)}</div>
          )}
        </CardContent>
      </Card>

      {/* Create token */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.inbound.create')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['device', 'jira', 'generic'] as Provider[]).map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={provider === option ? 'default' : 'outline'}
                  onClick={() => setProvider(option)}
                >
                  {t(`settings.inbound.providers.${option}`)}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t(`settings.inbound.providerHints.${provider}`)}
            </p>

            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('settings.inbound.labelPlaceholder')}
            />

            {provider === 'jira' && (
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="inbound-assignee">
                  {t('settings.inbound.assignee')}
                </label>
                <select
                  id="inbound-assignee"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                >
                  <option value="">{t('settings.inbound.assigneePlaceholder')}</option>
                  {((employees ?? []) as Array<{ _id: string; name: string }>).map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {t('settings.inbound.assigneeHint')}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {t('settings.inbound.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match an unmatched punch: set the табельный номер on the employee */}
      <Dialog open={matchFor !== null} onOpenChange={(open) => !open && setMatchFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.inbound.matchTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('settings.inbound.matchDesc')}</p>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={matchUser}
              onChange={(event) => setMatchUser(event.target.value)}
            >
              <option value="">{t('settings.inbound.assigneePlaceholder')}</option>
              {((employees ?? []) as Array<{ _id: string; name: string }>).map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
            <Input
              value={matchNumber}
              onChange={(event) => setMatchNumber(event.target.value)}
              placeholder={t('settings.inbound.numberPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!matchUser || !matchNumber.trim()}
              onClick={async () => {
                try {
                  const result = await setEmployeeNumber({
                    userId: matchUser as Id<'users'>,
                    employeeNumber: matchNumber.trim(),
                  });
                  toast.success(t('settings.inbound.rematched', { count: result.rematched }));
                  setMatchFor(null);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : t('settings.inbound.createError'),
                  );
                }
              }}
            >
              {t('settings.inbound.saveNumber')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete token */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.inbound.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('settings.inbound.deleteDesc')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleting) return;
                await removeToken({ tokenId: deleting });
                setDeleting(null);
                toast.success(t('settings.inbound.deleted'));
              }}
            >
              {t('settings.inbound.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
