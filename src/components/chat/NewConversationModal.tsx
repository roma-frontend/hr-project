'use client';

import React, { useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Search, Users, MessageCircle, Check, Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrgSelectorStore } from '@/store/useOrgSelectorStore';
import { useTranslation } from 'react-i18next';
import { useAllOrganizations } from '@/hooks/useOrganizations';

const SUPERADMIN_EMAIL = 'superadmin@example.com';
import { useQuery } from '@tanstack/react-query';
import { useGetOrCreateDM, useCreateGroup } from '@/hooks/useChat';

interface Props {
  currentUserId: string;
  organizationId?: string;
  userRole: string;
  onClose: () => void;
  onCreated: (convId: string) => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n: any) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function NewConversationModal({
  currentUserId,
  organizationId,
  userRole,
  onClose,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  // Respect the org selector: null = "All orgs" (superadmin), else filter by org
  const orgStore = useOrgSelectorStore();
  const selectedOrgId = orgStore.selectedOrgId;
  const setSelectedOrgId = orgStore.setSelectedOrgId;

  const isSuperadmin = userRole === 'superadmin';
  // Use selectedOrgId if set (superadmin viewing specific org), else use the user's own org
  const effectiveOrgId = selectedOrgId ?? organizationId;

  // "All orgs" mode is available only for superadmin via sidebar selector.
  const isAllOrgs = selectedOrgId === null;

  // For superadmin we can fetch all organizations to power the inline org picker.
  const { data: organizations } = useAllOrganizations(isSuperadmin);

  // For a specific organization we keep using the lightweight chat.getOrgUsers query.
  const { data: orgScopedUsers } = useQuery({
    queryKey: ['chat-org-users', effectiveOrgId, currentUserId],
    queryFn: async () => {
      const res = await fetch(`/api/chat?action=get-org-users&organizationId=${effectiveOrgId}&currentUserId=${currentUserId}`);
      if (!res.ok) throw new Error(t('chat.failedToFetchUsers', 'Failed to fetch users'));
      const json = await res.json();
      return json.data;
    },
    enabled: !isAllOrgs && !!effectiveOrgId,
  });

  // In "All orgs" mode we load users via users.getAllUsers which,
  // for superadmin, returns employees from every organization.
  const { data: allOrgUsers } = useQuery({
    queryKey: ['all-org-users', currentUserId],
    queryFn: async () => {
      const res = await fetch(`/api/users?action=get-all-users&requesterId=${currentUserId}`);
      if (!res.ok) throw new Error(t('chat.failedToFetchUsers', 'Failed to fetch users'));
      const json = await res.json();
      return json.data;
    },
    enabled: isAllOrgs,
  });

  // Normalized users list used by the UI (always has organizationId attached).
  const users = React.useMemo(() => {
    if (isAllOrgs) {
      const list = (allOrgUsers ?? []) as any[];
      return list
        .filter(
          (u) =>
            u.id !== currentUserId && u.is_active && u.is_approved && u.email !== SUPERADMIN_EMAIL,
        )
        .map((u: any) => ({
          id: u.id as string,
          name: u.name ?? '',
          avatarUrl: u.avatar_url,
          department: u.department,
          position: u.position,
          presenceStatus: u.presence_status,
          organizationId: u.organization_id as string | undefined,
        }));
    }

    // orgScopedUsers already returns the normalized shape (including organizationId)
    return (orgScopedUsers ?? []) as Array<{
      id: string;
      name: string;
      avatarUrl?: string;
      department?: string;
      position?: string;
      presenceStatus?: string;
      organizationId?: string;
    }>;
  }, [isAllOrgs, allOrgUsers, orgScopedUsers, currentUserId]);
  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q) ||
        (u.position ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const handleCreateDMMutation = useGetOrCreateDM();
  const handleCreateGroupMutation = useCreateGroup();

  const handleCreateDM = async (targetId: string, targetUser: any) => {
    // For cross-org DM we host the conversation inside the target user's organization
    // so that they can see it in their own tenant. For non-superadmin / single-org
    // flow we fall back to the effectiveOrgId.
    const dmOrgId =
      isAllOrgs && targetUser?.organizationId ? targetUser.organization_id : effectiveOrgId;

    const result = await handleCreateDMMutation.mutateAsync({
      organizationId: dmOrgId,
      currentUserId,
      targetUserId: targetId,
    });
    return result.data;
  };

  const handleCreateGroup = async (groupName: string, memberIds: string[]) => {
    // In "All orgs" mode we only support groups inside a single organization.
    // If selected users span multiple organizations, we default the group to
    // the first user's org and log a warning instead of failing silently.
    let groupOrgId = effectiveOrgId;
    if (isAllOrgs) {
      const selected = users.filter((u) => selectedUsers.includes(u.id));
      const orgIds = Array.from(
        new Set(
          selected
            .map((u: any) => u.organization_id)
            .filter((id): id is string => !!id),
        ),
      );
      if (orgIds.length === 1) {
        groupOrgId = orgIds[0]!;
      } else if (orgIds.length > 1) {
        console.warn(t('chat.crossOrgGroupsNotSupported', 'Cross-organization groups are not fully supported yet; using first organization\'s ID for the group.'));
        groupOrgId = orgIds[0]!;
      }
    }

    const result = await handleCreateGroupMutation.mutateAsync({
      organizationId: groupOrgId ?? '',
      createdBy: currentUserId,
      name: groupName.trim(),
      memberIds,
    });
    return result.data;
  };

  const toggleUser = (uid: string) => {
    if (mode === 'dm') {
      setSelectedUsers([uid]);
    } else {
      setSelectedUsers((prev) =>
        prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
      );
    }
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;
    setLoading(true);
    try {
      if (mode === 'dm') {
        const targetId = selectedUsers[0];
        const targetUser = users.find((u) => u.id === targetId);

        if (!targetId) return;

        const convId = await handleCreateDM(targetId, targetUser);
        onCreated(convId);
      } else {
        if (!groupName.trim()) return;

        const convId = await handleCreateGroup(groupName.trim(), selectedUsers);
        onCreated(convId);
      }
    } catch (err) {
      console.error(t('chat.createConversationError', 'Error creating conversation:'), err);
    } finally {
      setLoading(false);
    }
  };

  const canCreate =
    mode === 'dm'
      ? selectedUsers.length === 1
      : selectedUsers.length >= 1 && groupName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--background)',
          border: '1px solid var(--border)',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b gap-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {t('chat.newConversation')}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSuperadmin && (
              <div className="relative">
                <button
                  onClick={() => setShowOrgDropdown((v) => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                  style={{
                    background: 'var(--background-subtle)',
                    borderColor: showOrgDropdown ? 'var(--primary)' : 'var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Globe className="w-3 h-3" />
                  <span className="max-w-[120px] truncate">
                    {isAllOrgs
                      ? t('chat.allOrgs')
                      : organizations?.find((o) => o.id === selectedOrgId)?.name ||
                        t('chat.allOrgs')}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showOrgDropdown && (
                  <div
                    className="absolute right-0 mt-1 w-56 rounded-lg border shadow-xl z-50 max-h-64 overflow-y-auto custom-scrollbar"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <button
                      onClick={() => {
                        setSelectedOrgId(null);
                        setShowOrgDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
                      style={{
                        background: isAllOrgs ? 'var(--sidebar-item-hover)' : 'transparent',
                        color: isAllOrgs ? 'var(--primary)' : 'var(--text-primary)',
                      }}
                    >
                      {t('chat.allOrgs')}
                    </button>
                    {organizations?.map((org: any) => (
                      <button
                        key={org.id}
                        onClick={() => {
                          setSelectedOrgId(org.id as string);
                          setShowOrgDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
                        style={{
                          background:
                            selectedOrgId === org.id ? 'var(--sidebar-item-hover)' : 'transparent',
                          color:
                            selectedOrgId === org.id ? 'var(--primary)' : 'var(--text-primary)',
                        }}
                      >
                        {org.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70 transition-opacity"
            >
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex p-3 gap-2">
          {(['dm', 'group'] as const).map((m: any) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setSelectedUsers([]);
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all',
              )}
              style={{
                background: mode === m ? 'var(--primary)' : 'var(--background-subtle)',
                color: mode === m ? 'white' : 'var(--text-muted)',
              }}
            >
              {m === 'dm' ? (
                <MessageCircle className="w-3.5 h-3.5" />
              ) : (
                <Users className="w-3.5 h-3.5" />
              )}
              {m === 'dm' ? t('chat.directMessage') : t('chat.group')}
            </button>
          ))}
        </div>

        {/* Group name */}
        {mode === 'group' && (
          <div className="px-3 pb-2">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t('chat.groupName')}
              className="w-full px-3 py-2 text-sm rounded-xl border border-(--input-border) bg-(--input) text-(--text-primary) outline-none"
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
        )}

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--text-disabled)' }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('chat.searchEmployees')}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none"
              style={{
                background: 'var(--background-subtle)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>

        {/* Selected chips (group mode) */}
        {mode === 'group' && selectedUsers.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1">
            {selectedUsers.map((uid: any) => {
              const u = users?.find((x) => x.id === uid);
              return (
                <span
                  key={uid}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  {u?.name ?? 'User'}
                  <button onClick={() => toggleUser(uid)}>
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {filtered.map((u: any) => {
            const isSelected = selectedUsers.includes(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggleUser(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                style={{
                  background: isSelected ? 'var(--sidebar-item-active)' : 'transparent',
                  color: isSelected ? 'var(--sidebar-item-active-text)' : 'var(--text-primary)',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Avatar className="w-9 h-9 shrink-0">
                  {u.avatarUrl && <AvatarImage src={u.avatarUrl} />}
                  <AvatarFallback
                    className="text-xs font-bold text-white"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))',
                    }}
                  >
                    {getInitials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {[u.position, u.department].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => {
              console.log(
                '[NewConversationModal] Create button clicked, canCreate:',
                canCreate,
                'loading:',
                loading,
              );
              handleCreate();
            }}
            disabled={!canCreate || loading}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))',
            }}
          >
            {loading
              ? t('chat.creating')
              : mode === 'dm'
                ? t('chat.openChat')
                : `${t('chat.createGroup')}${selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
