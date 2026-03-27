"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "@/convex/_generated/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useOrgSelectorStore } from "@/store/useOrgSelectorStore";
import { ShieldLoader } from "@/components/ui/ShieldLoader";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Users, Shield, Building2, CheckCircle, Eye, LogOut } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Doc } from "@/convex/_generated/dataModel";

export default function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const selectedOrgId = useOrgSelectorStore((state) => state.selectedOrgId);
  const setSelectedOrgId = useOrgSelectorStore((state) => state.setSelectedOrgId);
  const clearSelection = useOrgSelectorStore((state) => state.clearSelection);
  const [assignEmail, setAssignEmail] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Check if user is superadmin BEFORE calling conditional hooks
  const isSuperadmin = user && (user.role === "superadmin" || user.email?.toLowerCase() === "romangulanyan@gmail.com");

  // Call hooks unconditionally (but they will use "skip" if not superadmin)
  const organizations = useQuery(
    api.organizations.listAll,
    isSuperadmin ? {} : "skip"
  );
  const assignUserAsOrgAdmin = useMutation(api.admin.assignUserAsOrgAdmin);

  // Check if user is superadmin
  if (!user || !isSuperadmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
          <p className="text-[var(--text-muted)]">{t('ui.onlySuperadminCanAccess')}</p>
        </div>
      </div>
    );
  }

  const handleAssign = async () => {
    if (!assignEmail.trim() || !selectedOrgId) {
      toast.error(t('admin.fillAllFields'));
      return;
    }

    setIsAssigning(true);
    try {
      const userId = user.id as Id<"users">;
      await assignUserAsOrgAdmin({
        superadminUserId: userId,
        userEmail: assignEmail.toLowerCase().trim(),
        organizationId: selectedOrgId as Id<"organizations">,
      });

      toast.success(t('admin.userAssignedSuccess'));
      setAssignEmail("");
      clearSelection();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('admin.failedToAssignUser');
      toast.error(errorMessage);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Shield className="w-6 h-6 text-[var(--primary)]" />
          {t('admin.superadminPanel')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {t('admin.manageSystemSettings')}
        </p>
      </div>

      {/* Assign User as Org Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('admin.assignUserAsAdmin')}
          </CardTitle>
          <CardDescription>
            {t('admin.assignUserDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">{t('labels.emailAddress')}</label>
            <input
              type="email"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <p className="text-xs text-[var(--text-muted)]">
              {t('admin.emailDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">{t('admin.selectOrganization')}</label>
            
            {/* Currently Selected Organization Badge */}
            {selectedOrgId && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-500 font-medium">
                    {t('superadmin.viewingOrganization')}: {organizations?.find((o: any) => o._id === selectedOrgId)?.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-blue-500 hover:text-blue-400"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Organization Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {organizations?.map((org: Doc<"organizations">) => (
                <Button
                  key={org._id}
                  variant={selectedOrgId === org._id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedOrgId(org._id)}
                  className="justify-start text-left h-auto py-2 px-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{org.plan}</p>
                  </div>
                  {selectedOrgId === org._id && (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 ml-2" />
                  )}
                </Button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {t('admin.selectOrgForAssignment')}
            </p>
          </div>

          <Button
            onClick={handleAssign}
            disabled={isAssigning || !assignEmail.trim() || !selectedOrgId}
            className="w-full"
            size="lg"
          >
            {isAssigning ? (
              <>
                <ShieldLoader size="xs" variant="inline" />
                {t('admin.assigning')}
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {t('admin.assignAsAdmin')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Organizations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('admin.organizationsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!organizations ? (
            <div className="flex items-center justify-center py-8">
              <ShieldLoader size="md" message={t('admin.loadingOrganizations')} />
            </div>
          ) : organizations.length === 0 ? (
            <p className="text-[var(--text-muted)] text-center py-8">{t('admin.noOrganizations')}</p>
          ) : (
            <div className="space-y-3">
              {organizations.map((org: Doc<"organizations">) => (
                <div key={org._id} className="flex items-center justify-between p-4 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)]">
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--text-primary)]">{org.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {t('admin.plan')}: <Badge variant="outline" className="ml-1">{org.plan}</Badge>
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge>{org.isActive ? t('admin.active') : t('admin.inactive')}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
