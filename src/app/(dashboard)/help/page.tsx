"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslation } from "react-i18next";
import type { Id } from "@/convex/_generated/dataModel";
import {
  HelpCircle,
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Search,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CreateTicketWizard } from "@/components/help/CreateTicketWizard";
import { t } from "i18next";

export default function HelpSupportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showPlanLimit, setShowPlanLimit] = useState(false);
  const [useWizard, setUseWizard] = useState(true); // Переключатель Wizard vs обычная форма

  const myTickets = useQuery(
    api.tickets.getMyTickets,
    user?.id ? { userId: user.id as Id<"users"> } : "skip"
  );

  const stats = useQuery(api.tickets.getTicketStats);
  
  // Get organization plan
  const userOrg = useQuery(
    api.organizations.getMyOrganization,
    user?.id ? { userId: user.id as Id<"users"> } : "skip"
  );

  // Check plan limitations
  const canCreateTickets = userOrg?.plan === "professional" || userOrg?.plan === "enterprise";
  const canUseCriticalPriority = userOrg?.plan === "enterprise";
  const hasSLA = userOrg?.plan === "enterprise";
  const ticketLimit = userOrg?.plan === "professional" ? 10 : null;
  const historyDays = userOrg?.plan === "professional" ? 30 : null;

  // Count tickets this month
  const currentMonthTickets = myTickets?.filter((t: any) => {
    const ticketDate = new Date(t.createdAt);
    const now = new Date();
    return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
  }).length || 0;

  const isLimitReached = ticketLimit ? currentMonthTickets >= ticketLimit : false;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  const openTickets = myTickets?.filter((t: any) => t.status !== "closed" && t.status !== "resolved") || [];
  const closedTickets = myTickets?.filter((t: any) => t.status === "closed" || t.status === "resolved") || [];

  const handleCreateTicket = () => {
    if (!canCreateTickets) {
      setShowPlanLimit(true);
      return;
    }
    if (isLimitReached) {
      setShowPlanLimit(true);
      return;
    }
    setCreateDialogOpen(true);
  };

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
                  🆘 {t('help.title')}
                </h1>
                {userOrg && (
                  <Badge
                    variant="outline"
                    className={
                      userOrg.plan === "enterprise"
                        ? "border-purple-500 text-purple-600"
                        : userOrg.plan === "professional"
                        ? "border-blue-500 text-blue-600"
                        : ""
                    }
                  >
                    {userOrg.plan.toUpperCase()}
                  </Badge>
                )}
              </div>
              <p className="text-sm md:text-base text-muted-foreground">
                {t('help.subtitle')}
              </p>
              {userOrg?.plan === "starter" && (
                <p className="text-xs md:text-sm text-orange-600 mt-2">
                  ⚠️ {t('help.planLimit.starter')}
                </p>
              )}
              {userOrg?.plan === "professional" && (
                <p className="text-xs md:text-sm text-blue-600 mt-2">
                  📊 {t('help.planLimit.professional', { used: currentMonthTickets, limit: ticketLimit })}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="gap-2 w-full sm:w-auto"
                    onClick={handleCreateTicket}
                    disabled={!canCreateTickets || isLimitReached}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('help.createTicket')}</span>
                    <span className="sm:hidden">{t('help.createTicket')}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] md:max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <span className="text-base md:text-lg">{t('help.createTicket')}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUseWizard(!useWizard)}
                          className="text-xs w-full sm:w-auto"
                        >
                          {useWizard ? "📝 Обычная форма" : "✨ Wizard"}
                        </Button>
                      </div>
                    </DialogTitle>
                    <DialogDescription className="text-xs md:text-sm">
                      {t('help.subtitle')}
                    </DialogDescription>
                  </DialogHeader>

                  {useWizard ? (
                    <CreateTicketWizard
                      userId={user.id as Id<"users">}
                      onComplete={() => setCreateDialogOpen(false)}
                      onCancel={() => setCreateDialogOpen(false)}
                    />
                  ) : (
                    <CreateTicketDialog
                      open={createDialogOpen}
                      onOpenChange={setCreateDialogOpen}
                      userId={user.id as Id<"users">}
                      organizationId={user.organizationId as Id<"organizations">}
                      canUseCriticalPriority={canUseCriticalPriority}
                      hasSLA={hasSLA}
                    />
                  )}
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                onClick={() => router.push('/superadmin/subscriptions')}
                className="gap-2 w-full sm:w-auto"
              >
                <span className="hidden sm:inline">💎 {t('help.upgradePlan')}</span>
                <span className="sm:hidden">💎</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <StatCard
            title={t('help.stats.total')}
            value={myTickets?.length || 0}
            icon={Ticket}
            color="blue"
          />
          <StatCard
            title={t('help.stats.open')}
            value={openTickets.length}
            icon={AlertCircle}
            color="orange"
          />
          <StatCard
            title={t('help.stats.resolved')}
            value={closedTickets.length}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title={t('help.stats.avgResponse')}
            value={stats?.avgResponseTime ? `${Math.round(stats.avgResponseTime)}ч` : "—"}
            icon={Clock}
            color="purple"
          />
        </div>

        {/* Tickets Tabs */}
        <Tabs defaultValue="open" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="open" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <AlertCircle className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{t('help.tabs.open')}</span>
              <span className="sm:hidden">Open</span>
              <Badge variant="secondary" className="ml-1 md:ml-2 text-xs">{openTickets.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="closed" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{t('help.tabs.closed')}</span>
              <span className="sm:hidden">Closed</span>
              <Badge variant="secondary" className="ml-1 md:ml-2 text-xs">{closedTickets.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open">
            <TicketList tickets={openTickets} emptyMessage={t('help.noOpenTickets')} />
          </TabsContent>

          <TabsContent value="closed">
            <TicketList tickets={closedTickets} emptyMessage={t('help.noClosedTickets')} />
          </TabsContent>
        </Tabs>

        {/* Quick Help */}
        <Card className="mt-6" style={{ background: "var(--card)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              {t('help.quickHelp.title')}
            </CardTitle>
            <CardDescription>
              {t('help.quickHelp.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <QuickHelpCard
                icon="📧"
                title={t('help.quickHelp.email.title')}
                description={t('help.quickHelp.email.desc')}
              />
              <QuickHelpCard
                icon="💬"
                title={t('help.quickHelp.chat.title')}
                description={t('help.quickHelp.chat.desc')}
                onClick={() => router.push('/chat')}
              />
              <QuickHelpCard
                icon="📚"
                title={t('help.quickHelp.docs.title')}
                description={t('help.quickHelp.docs.desc')}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: any;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "text-blue-500",
    green: "text-green-500",
    red: "text-red-500",
    purple: "text-purple-500",
    orange: "text-orange-500",
  };

  return (
    <Card style={{ background: "var(--background-subtle)" }}>
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center justify-between mb-1 md:mb-2">
          <p className="text-[10px] md:text-xs text-muted-foreground truncate">{title}</p>
          <Icon className={`w-3 h-3 md:w-4 md:h-4 flex-shrink-0 ${colorClasses[color]}`} />
        </div>
        <p className="text-lg md:text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

// Ticket List Component
function TicketList({
  tickets,
  emptyMessage,
}: {
  tickets: any[];
  emptyMessage: string;
}) {
  const { t } = useTranslation();

  if (tickets.length === 0) {
    return (
      <Card style={{ background: "var(--card)" }}>
        <CardContent className="py-8 md:py-12 text-center text-muted-foreground">
          <Ticket className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm md:text-base">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket: any) => (
        <Card key={ticket._id} style={{ background: "var(--card)" }}>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-2">
                  <span className="font-mono text-xs md:text-sm">{ticket.ticketNumber}</span>
                  <Badge
                    variant={
                      ticket.status === "closed" || ticket.status === "resolved"
                        ? "outline"
                        : "default"
                    }
                    className="text-xs"
                  >
                    {ticket.status}
                  </Badge>
                  <Badge
                    variant={
                      ticket.priority === "critical"
                        ? "destructive"
                        : ticket.priority === "high"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {ticket.priority}
                  </Badge>
                </div>
                <p className="font-semibold mb-1 text-sm md:text-base truncate" style={{ color: "var(--text-primary)" }}>
                  {ticket.title}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                  {ticket.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 md:mt-3 text-[10px] md:text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                  {ticket.assigneeName && (
                    <span className="truncate">👤 {ticket.assigneeName}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Quick Help Card Component
function QuickHelpCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-3 md:p-4 rounded-lg border cursor-pointer transition-colors hover:border-primary/50 ${onClick ? 'hover:bg-primary/5' : ''}`}
      style={{ background: "var(--background-subtle)" }}
    >
      <div className="text-xl md:text-2xl mb-2">{icon}</div>
      <h4 className="font-semibold mb-1 text-sm md:text-base" style={{ color: "var(--text-primary)" }}>
        {title}
      </h4>
      <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// Create Ticket Dialog Component (упрощенная версия для сотрудников)
function CreateTicketDialog({
  open,
  onOpenChange,
  userId,
  organizationId,
  canUseCriticalPriority,
  hasSLA,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  organizationId?: Id<"organizations">;
  canUseCriticalPriority: boolean;
  hasSLA: boolean;
}) {
  const { t } = useTranslation();
  const createTicket = useMutation(api.tickets.createTicket);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState<"technical" | "billing" | "access" | "feature_request" | "bug" | "other">("technical");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast.error(t('error.fillRequiredFields'));
      return;
    }

    try {
      const result = await createTicket({
        organizationId,
        createdBy: userId,
        title,
        description,
        priority,
        category,
      });

      toast.success(t('help.ticketCreated', { ticketNumber: result.ticketNumber }));
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCategory("technical");
    } catch (error) {
      toast.error(t('help.createError'));
      console.error(error);
    }
  };

  return (
    <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle className="text-base md:text-lg">{t('help.create.title')}</DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            {t('help.create.description')}
            {hasSLA && (
              <p className="text-green-600 text-xs md:text-sm mt-2">
                ✅ {t('help.create.slaNotice')}
              </p>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 md:space-y-4 py-4">
          <div>
            <Label htmlFor="title" className="text-sm">{t('help.create.titleLabel')}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('help.create.titlePlaceholder')}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <Label htmlFor="priority" className="text-sm">{t('help.create.priorityLabel')}</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('priority.low')}</SelectItem>
                  <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                  {canUseCriticalPriority && (
                    <>
                      <SelectItem value="high">{t('priority.high')}</SelectItem>
                      <SelectItem value="critical">{t('priority.critical')}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {!canUseCriticalPriority && (
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                  🔒 {t('help.create.priorityLimit')}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="category" className="text-sm">{t('help.create.categoryLabel')}</Label>
              <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">{t('category.technical')}</SelectItem>
                  <SelectItem value="billing">{t('category.billing')}</SelectItem>
                  <SelectItem value="access">{t('category.access')}</SelectItem>
                  <SelectItem value="feature_request">{t('category.featureRequest')}</SelectItem>
                  <SelectItem value="bug">{t('category.bug')}</SelectItem>
                  <SelectItem value="other">{t('category.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor={t('common.description')} className="text-sm">{t('help.create.descriptionLabel')}</Label>
            <Textarea
              id={t('common.description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('help.create.descriptionPlaceholder')}
              rows={6}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {t('actions.cancel')}
          </Button>
          <Button type="submit" className="w-full sm:w-auto">
            {t('help.create.submit')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// Plan Limit Dialog
function PlanLimitDialog({
  open,
  onOpenChange,
  userOrg,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userOrg: any;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base md:text-lg">{t('help.planLimit.title')}</DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            {t('help.planLimit.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <PlanCard
              name="Starter"
              price="$0"
              features={[
                { text: t('help.plans.starter.support'), included: false },
                { text: t('help.plans.starter.docs'), included: true },
                { text: t('help.plans.starter.community'), included: true },
              ]}
              current={userOrg?.plan === "starter"}
            />
            <PlanCard
              name={t('superadmin.professional')}
              price="$29"
              features={[
                { text: t('help.plans.professional.tickets'), included: true },
                { text: t('help.plans.professional.limit'), included: true },
                { text: t('help.plans.professional.email'), included: true },
                { text: t('help.plans.professional.sla'), included: false },
              ]}
              current={userOrg?.plan === "professional"}
              recommended
            />
            <PlanCard
              name={t('superadmin.enterprise')}
              price="$99"
              features={[
                { text: t('help.plans.enterprise.unlimited'), included: true },
                { text: t('help.plans.enterprise.priority'), included: true },
                { text: t('help.plans.enterprise.sla'), included: true },
                { text: t('help.plans.enterprise.manager'), included: true },
              ]}
              current={userOrg?.plan === "enterprise"}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {t('actions.close')}
          </Button>
          <Button onClick={() => router.push('/superadmin/subscriptions')} className="w-full sm:w-auto">
            {t('help.upgradePlan')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Plan Card Component
function PlanCard({
  name,
  price,
  features,
  current,
  recommended,
}: {
  name: string;
  price: string;
  features: { text: string; included: boolean }[];
  current?: boolean;
  recommended?: boolean;
}) {
  return (
    <div
      className={`p-3 md:p-4 rounded-lg border ${
        recommended ? 'border-blue-500 bg-blue-500/5' : ''
      } ${current ? 'border-green-500 bg-green-500/5' : ''}`}
    >
      <div className="text-center mb-3">
        <h4 className="font-bold text-sm md:text-base">{name}</h4>
        <p className="text-xl md:text-2xl font-bold">{price}</p>
        {current && (
          <Badge className="mt-2 bg-green-500 text-xs">
            {t('help.plans.current')}
          </Badge>
        )}
        {recommended && !current && (
          <Badge className="mt-2 bg-blue-500 text-xs">
            {t('help.plans.recommended')}
          </Badge>
        )}
      </div>
      <ul className="space-y-2 text-xs md:text-sm">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            {feature.included ? (
              <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-3 h-3 md:w-4 md:h-4 text-red-500 shrink-0 mt-0.5" />
            )}
            <span className={feature.included ? '' : 'text-muted-foreground'}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
