'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Phone, Video, Search, Info } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/stringUtils';
import { useTranslation } from 'react-i18next';

interface ChatHeaderProps {
  conversation: any;
  otherUser: any;
  displayName: string;
  membersCount: number;
  onBack: () => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onToggleSearch: () => void;
  onToggleInfo: () => void;
  showSearch: boolean;
}

export function ChatHeader({
  conversation,
  otherUser,
  displayName,
  membersCount,
  onBack,
  onStartCall,
  onToggleSearch,
  onToggleInfo,
  showSearch,
}: ChatHeaderProps) {
  const { t } = useTranslation();

  const getStatusText = () => {
    if (conversation?.type === 'group') {
      return `${membersCount} ${t('chat.members')}`;
    }
    switch (otherUser?.presenceStatus) {
      case 'available':
        return t('chat.activeNow');
      case 'in_meeting':
        return t('chat.inMeeting');
      case 'busy':
        return t('chat.busy');
      default:
        return t('chat.offline');
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
      style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
    >
      <button
        onClick={onBack}
        className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-70"
      >
        <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </button>

      <div className="relative shrink-0">
        {conversation?.type === 'direct' && otherUser?._id ? (
          <Link
            href={`/employees/${otherUser._id}`}
            className="block rounded-full transition-transform duration-200 hover:scale-110 hover:opacity-90"
            title={`View ${displayName}'s profile`}
          >
            <Avatar className="w-9 h-9">
              {otherUser?.avatarUrl && <AvatarImage src={otherUser.avatarUrl} />}
              <AvatarFallback
                className="text-xs font-bold text-white"
                style={{
                  background:
                    'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))',
                }}
              >
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Avatar className="w-9 h-9">
            {conversation?.avatarUrl && <AvatarImage src={conversation.avatarUrl} />}
            <AvatarFallback
              className="text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        )}
        {conversation?.type === 'direct' && otherUser?.presenceStatus === 'available' && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white pointer-events-none" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {displayName}
        </h3>
        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
          {getStatusText()}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {conversation?.name !== 'System Announcements' && (
          <>
            <button
              onClick={() => onStartCall('audio')}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-105"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title={t('chat.voiceCall')}
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => onStartCall('video')}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-105"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title={t('chat.videoCall')}
            >
              <Video className="w-4 h-4" />
            </button>
          </>
        )}
        <button
          onClick={onToggleSearch}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{
            color: showSearch ? 'var(--primary)' : 'var(--text-muted)',
            background: showSearch ? 'var(--sidebar-item-active)' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!showSearch) {
              e.currentTarget.style.background = 'var(--sidebar-item-hover)';
              e.currentTarget.style.color = 'var(--primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!showSearch) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
          title={t('chat.searchMessages')}
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleInfo}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--sidebar-item-hover)';
            e.currentTarget.style.color = 'var(--primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          title={t('chat.info')}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
