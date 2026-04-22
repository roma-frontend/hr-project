import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function subscribeToChat(
  conversationId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`chat:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversationid=eq.${conversationId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToTyping(
  conversationId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`typing:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_typing',
        filter: `conversationid=eq.${conversationId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToNotifications(
  userId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `userid=eq.${userId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToTasks(
  userId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`tasks:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `assigned_to=eq.${userId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToLeaves(
  organizationId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`leaves:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'leave_requests',
        filter: `organizationId=eq.${organizationId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToDriverRequests(
  organizationId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`driver-requests:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'driver_requests',
        filter: `organizationId=eq.${organizationId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToPresence(
  userId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  const channel = supabase.channel(`presence:${userId}`);
  channel.on('system', { event: 'sync' }, callback);
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        userid: userId,
        online_at: Date.now(),
      });
    }
  });
  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}

export async function setTypingIndicator(
  conversationId: string,
  userId: string
) {
  const now = Math.floor(Date.now() / 1000);

  const { data: existing } = await supabase
    .from('chat_typing')
    .select('id')
    .eq('conversationid', conversationId)
    .eq('userid', userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('chat_typing')
      .update({ updated_at: now })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('chat_typing')
      .insert({
        conversationid: conversationId,
        userid: userId,
        updated_at: now,
      });
  }
}

export async function clearTypingIndicator(
  conversationId: string,
  userId: string
) {
  await supabase
    .from('chat_typing')
    .delete()
    .eq('conversationid', conversationId)
    .eq('userid', userId);
}
