'use client';

import { useTranslation } from 'react-i18next';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Users } from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const PRESENCE_CONFIG = {
  available: {
    dot: 'bg-green-500',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    labelKey: 'quickStats.available',
  },
  in_meeting: {
    dot: 'bg-yellow-500',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    labelKey: 'quickStats.inMeeting',
  },
  in_call: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    labelKey: 'quickStats.inCall',
  },
  out_of_office: {
    dot: 'bg-gray-500',
    badge: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20',
    labelKey: 'quickStats.outOfOffice',
  },
  busy: {
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
    labelKey: 'quickStats.busy',
  },
} as const;

export function TeamPresence() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  // Only pass requesterId if it looks like a valid Convex user ID (not organizationId or temp ID)
  const hasValidUserId =
    user?.id && !user.id.startsWith('nextauth-') && user.id !== user.organizationId;
  const teamMembers = useQuery(
    api.productivity.getTeamPresence,
    hasValidUserId ? { requesterId: user!.id as any } : 'skip',
  );

  if (!teamMembers) {
    return (
      <div className="flex items-center justify-center py-6">
        <ShieldLoader size="sm" />
      </div>
    );
  }

  const onlineCount = teamMembers.length;

  return (
    <div className="px-2 py-3">
      <div className="mb-3 px-2 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-(--text-muted)">
            {t('quickStats.teamOnline')}
          </h3>
          <p className="text-[10px] text-(--text-muted) mt-0.5">
            {onlineCount} {onlineCount === 1 ? t('quickStats.member') : t('quickStats.members')}{' '}
            active
          </p>
        </div>
        <Users className="w-4 h-4 text-(--text-muted)" />
      </div>

      {teamMembers.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-(--text-muted)">{t('quickStats.noTeamMembersOnline')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {teamMembers.map((member: any) => {
            const presenceConfig =
              PRESENCE_CONFIG[member.presenceStatus as keyof typeof PRESENCE_CONFIG] ||
              PRESENCE_CONFIG.available;
            const initials = member.name
              .split(' ')
              .map((n: any) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={member._id}
                className="flex items-center gap-3 rounded-lg p-2 transition-all hover:bg-(--background-subtle)"
              >
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    {member.avatarUrl ? (
                      <AvatarImage src={member.avatarUrl} alt={member.name} />
                    ) : (
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    )}
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--background)] ${presenceConfig.dot}`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--text-primary) truncate">
                    {member.name}
                  </p>
                  <p className="text-[10px] text-(--text-muted) truncate">
                    {member.department || member.role}
                  </p>
                </div>

                <span
                  className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${presenceConfig.badge}`}
                >
                  {t(presenceConfig.labelKey)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
