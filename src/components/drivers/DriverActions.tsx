/**
 * Driver Actions - Helper components for driver interactions
 * Extracted from drivers/page.tsx for better maintainability
 */

'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PhoneCall, MessageSquare, Navigation2, ExternalLink, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { CallModal } from '@/components/chat/CallModal';
import type { ActiveCall } from '@/components/chat/CallModal';

// ─── Navigator Dropdown ─────────────────────────────────────────────────────

const NAVIGATORS = [
  {
    name: 'Google Maps',
    icon: '🗺️',
    url: (lat: number, lng: number) =>
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  },
  {
    name: 'Yandex Maps',
    icon: '🟡',
    url: (lat: number, lng: number) => `https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map`,
  },
  {
    name: '2GIS',
    icon: '🟢',
    url: (lat: number, lng: number) => `https://2gis.ru/geo/${lng},${lat}`,
  },
  {
    name: 'Waze',
    icon: '🔵',
    url: (lat: number, lng: number) => `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  },
];

interface NavigatorDropdownProps {
  label: string;
  coords: { lat: number; lng: number };
}

export function NavigatorDropdown({ label, coords }: NavigatorDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${coords.lat}, ${coords.lng}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <Navigation2 className="w-3 h-3" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {NAVIGATORS.map((nav) => (
          <DropdownMenuItem key={nav.name} asChild>
            <a
              href={nav.url(coords.lat, coords.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <span>{nav.icon}</span>
              <span className="flex-1">{nav.name}</span>
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={handleCopyCoords} className="gap-2">
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied ? t('driver.copied', 'Copied!') : t('driver.copyCoords', 'Copy Coords')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── In-App Call Button ─────────────────────────────────────────────────────

interface InAppCallButtonProps {
  callerUserId: Id<'users'>;
  callerName: string;
  callerAvatar?: string;
  remoteUserId: Id<'users'>;
  remoteName: string;
  remotePhone?: string;
  organizationId: Id<'organizations'>;
}

export function InAppCallButton({
  callerUserId,
  callerName,
  callerAvatar,
  remoteUserId,
  remoteName,
  remotePhone,
  organizationId,
}: InAppCallButtonProps) {
  const { t } = useTranslation();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [calling, setCalling] = useState(false);
  const initiateCall = useMutation(api.chat.calls.initiateCall);

  const handleCall = async () => {
    try {
      setCalling(true);
      const callId = await initiateCall({
        conversationId: 'temp' as Id<'chatConversations'>,
        organizationId,
        initiatorId: callerUserId,
        type: 'audio',
        participantIds: [remoteUserId],
      });
      setActiveCall({
        callId,
        conversationId: 'temp' as Id<'chatConversations'>,
        type: 'audio',
        isInitiator: true,
        remoteUserId,
        remoteUserName: remoteName,
      });
    } catch (error: any) {
      toast.error(error.message || t('driver.callStartFailed', 'Failed to start call'));
    } finally {
      setCalling(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCall}
        disabled={calling}
        className="gap-1 h-7 px-2 text-xs"
      >
        <PhoneCall className="w-3 h-3" />
        {t('driver.call', 'Call')}
      </Button>
      {activeCall && (
        <CallModal
          call={activeCall}
          currentUserId={callerUserId}
          currentUserName={callerName}
          currentUserAvatar={callerAvatar}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </>
  );
}

// ─── Driver Quick Message ────────────────────────────────────────────────────

interface DriverQuickMessageProps {
  passengerUserId: Id<'users'>;
  passengerName?: string;
  passengerPhone?: string;
  driverUserId: Id<'users'>;
  organizationId: Id<'organizations'>;
  tripInfo?: { from: string; to: string };
}

const DRIVER_TEMPLATES = [
  { id: 'on_way', label: 'On my way', message: "I'm on my way to pick you up." },
  { id: 'arrived', label: 'Arrived', message: "I've arrived at the pickup location." },
  {
    id: 'running_late',
    label: 'Running late',
    message: 'Running 5 minutes late, sorry for the delay.',
  },
  {
    id: 'where_are_you',
    label: 'Where are you?',
    message: "I'm at the pickup point. Where are you?",
  },
  { id: 'plate_number', label: 'Plate number', message: 'My plate number is: ___' },
];

export function DriverQuickMessage({
  passengerUserId,
  passengerName,
  passengerPhone,
  driverUserId,
  organizationId,
  tripInfo,
}: DriverQuickMessageProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const getOrCreateDM = useMutation(api.chat.mutations.getOrCreateDM);
  const sendMessage = useMutation(api.chat.mutations.sendMessage);

  const handleSend = async (message: string) => {
    try {
      const conversationId = await getOrCreateDM({
        organizationId,
        currentUserId: driverUserId,
        targetUserId: passengerUserId,
      });
      await sendMessage({
        conversationId,
        senderId: driverUserId,
        organizationId,
        type: 'text',
        content: message,
      });
      toast.success(t('toasts.messageSentToDriver', 'Message sent'));
      setOpen(false);
    } catch (error: any) {
      toast.error(t('toasts.messageFailedToSend', 'Failed to send message'));
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <MessageSquare className="w-3 h-3" />
          {t('driver.messagePassenger', 'Message')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {DRIVER_TEMPLATES.map((tpl) => (
          <DropdownMenuItem
            key={tpl.id}
            onClick={() => handleSend(tpl.message)}
            className="flex flex-col items-start gap-1 py-2"
          >
            <span className="font-medium text-sm">{tpl.label}</span>
            <span className="text-xs text-muted-foreground line-clamp-1">{tpl.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Passenger Quick Message ─────────────────────────────────────────────────

interface PassengerQuickMessageProps {
  driverUserId: Id<'users'>;
  driverName?: string;
  passengerUserId: Id<'users'>;
  organizationId: Id<'organizations'>;
  tripInfo?: { from: string; to: string };
}

const PASSENGER_TEMPLATES = [
  {
    id: 'where_are_you',
    label: 'Where are you?',
    message: "Where are you? I'm waiting at the pickup point.",
  },
  { id: 'ready', label: "I'm ready", message: "I'm ready for pickup." },
  {
    id: 'change_pickup',
    label: 'Change pickup',
    message: 'Can you pick me up at a different location?',
  },
  { id: 'running_late', label: 'Running late', message: "I'll be a few minutes late, sorry." },
  { id: 'cancel', label: 'Cancel trip', message: 'I need to cancel this trip.' },
];

export function PassengerQuickMessage({
  driverUserId,
  driverName,
  passengerUserId,
  organizationId,
  tripInfo,
}: PassengerQuickMessageProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const getOrCreateDM = useMutation(api.chat.mutations.getOrCreateDM);
  const sendMessage = useMutation(api.chat.mutations.sendMessage);

  const handleSend = async (message: string) => {
    try {
      const conversationId = await getOrCreateDM({
        organizationId,
        currentUserId: passengerUserId,
        targetUserId: driverUserId,
      });
      await sendMessage({
        conversationId,
        senderId: passengerUserId,
        organizationId,
        type: 'text',
        content: message,
      });
      toast.success(t('toasts.messageSentToDriver', 'Message sent'));
      setOpen(false);
    } catch (error: any) {
      toast.error(t('toasts.messageFailedToSend', 'Failed to send message'));
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <MessageSquare className="w-3 h-3" />
          {t('driver.messageDriver', 'Message Driver')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {PASSENGER_TEMPLATES.map((tpl) => (
          <DropdownMenuItem
            key={tpl.id}
            onClick={() => handleSend(tpl.message)}
            className="flex flex-col items-start gap-1 py-2"
          >
            <span className="font-medium text-sm">{tpl.label}</span>
            <span className="text-xs text-muted-foreground line-clamp-1">{tpl.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
