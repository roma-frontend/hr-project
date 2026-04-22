'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Edit2, Trash2, MessageCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useServiceBroadcasts, useDeleteMessage } from '@/hooks/useAdmin';

interface ServiceBroadcastsManagerProps {
  organizationId: string;
  userId: string;
}

export function ServiceBroadcastsManager({
  organizationId,
  userId,
}: ServiceBroadcastsManagerProps) {
  const { t } = useTranslation();
  const { data: broadcasts, isLoading } = useServiceBroadcasts(organizationId);
  const deleteMessageMutation = useDeleteMessage();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (broadcastId: string) => {
    setSelectedBroadcastId(broadcastId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBroadcastId) return;

    try {
      setIsDeleting(true);
      console.log(
        `[ServiceBroadcastsManager] Deleting broadcast ${selectedBroadcastId} by user ${userId}`,
      );
      await deleteMessageMutation.mutateAsync({
        messageId: selectedBroadcastId,
        userId,
        deleteForEveryone: true,
      });
      console.log(`[ServiceBroadcastsManager] ✓ Broadcast deleted successfully`);
      setDeleteDialogOpen(false);
      setSelectedBroadcastId(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(t('admin.serviceBroadcast.deleteFailed', 'Failed to delete broadcast:'), errorMsg);
      alert(t('admin.serviceBroadcast.deleteFailedAlert', 'Failed to delete announcement: {{errorMsg}}', { errorMsg: errorMsg }));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading || !broadcasts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {t('admin.serviceBroadcast.historyTitle', 'Announcement History')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <ShieldLoader size="sm" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {t('admin.serviceBroadcast.historyTitle', 'Announcement History')}
          </CardTitle>
          <CardDescription>{t('admin.serviceBroadcast.noBroadcasts', 'No announcements sent in this organization')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {t('admin.serviceBroadcast.createNewHint', 'Create new announcements using the button above →')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {t('admin.serviceBroadcast.historyTitle', 'Announcement History')} ({broadcasts.length})
          </CardTitle>
          <CardDescription>
            {t('admin.serviceBroadcast.historyDescription', 'View, edit and delete sent messages')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {broadcasts.map((broadcast: any) => (
              <div
                key={broadcast.id}
                className="flex flex-col sm:flex-row  items-start justify-between gap-4 p-4 rounded-lg transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--card-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                {/* Left: Icon & Content */}
                <div className="flex flex-col sm:flex-row items-start gap-3 flex-1">
                  <div className="text-2xl shrink-0 pt-1">{broadcast.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {broadcast.title}
                    </div>
                    <p className="text-sm line-clamp-2 mt-1" style={{ color: 'var(--text-muted)' }}>
                      {broadcast.content}
                    </p>
                    <div
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(broadcast.createdAt), 'd MMM yyyy, HH:mm', {
                          locale: ru,
                        })}
                      </div>
                      <div>
                        {t('admin.serviceBroadcast.from', 'From')}{' '}
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {broadcast.senderName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled
                    title={t('admin.serviceBroadcast.editComingSoon', 'Editing announcements coming soon')}
                    style={{
                      backgroundColor: 'var(--background-subtle)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                    }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          'var(--card-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'var(--background-subtle)';
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleDeleteClick(broadcast.id)}
                    style={{
                      backgroundColor: 'var(--destructive)',
                      color: 'var(--destructive-foreground)',
                      borderColor: 'var(--destructive)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = '1';
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('common.delete', 'Delete')}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent
          style={{
            backgroundColor: 'var(--popover)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--text-primary)' }}>
              {t('admin.serviceBroadcast.confirmDeleteTitle', 'Delete announcement?')}
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--text-muted)' }}>
              {t('admin.serviceBroadcast.confirmDeleteDescription', 'This announcement will be deleted for all users in the organization. This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel
            type="button"
            disabled={isDeleting}
            onClick={() => setDeleteDialogOpen(false)}
            style={{
              backgroundColor: 'var(--background-subtle)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--card-hover)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--background-subtle)';
            }}
          >
            {t('common.cancel', 'Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            style={{
              backgroundColor: 'var(--destructive)',
              color: 'var(--destructive-foreground)',
              borderColor: 'var(--destructive)',
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                (e.currentTarget as HTMLElement).style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }}
          >
            {isDeleting ? t('common.deleting', 'Deleting...') : t('admin.serviceBroadcast.deleteForever', 'Delete permanently')}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
