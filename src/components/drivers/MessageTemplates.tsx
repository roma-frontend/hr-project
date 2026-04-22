/**
 * Driver Message Templates Component
 * Quick message templates for driver-passenger communication
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MessageSquare, PhoneCall } from 'lucide-react';

interface MessageTemplatesProps {
  passengerName?: string;
  passengerPhone?: string;
  passengerUserId?: string;
  driverUserId?: string;
  driverName?: string;
  driverAvatar?: string;
  organizationId?: string;
  tripInfo?: {
    from: string;
    to: string;
    purpose: string;
  };
  onSendMessage?: (message: string) => void;
}

const TEMPLATES = [
  {
    id: 'arrived',
    labelKey: 'messageTemplates.arrived.label',
    messageKey: 'messageTemplates.arrived.message',
    label: "I've Arrived",
    message: "Hi {passengerName}! I've arrived at the pickup location. Ready when you are! 🚗",
  },
  {
    id: 'delayed',
    labelKey: 'messageTemplates.delayed.label',
    messageKey: 'messageTemplates.delayed.message',
    label: 'Running Late',
    message:
      "Hi {passengerName}! I'm running about 5 minutes late due to traffic. Apologies for the inconvenience! ⏰",
  },
  {
    id: 'waiting',
    labelKey: 'messageTemplates.waiting.label',
    messageKey: 'messageTemplates.waiting.message',
    label: 'Waiting',
    message: "Hi {passengerName}! I'm waiting at the pickup point. Please let me know when you're ready. 👋",
  },
  {
    id: 'confirming',
    labelKey: 'messageTemplates.confirming.label',
    messageKey: 'messageTemplates.confirming.message',
    label: 'Confirming Trip',
    message: 'Hi {passengerName}! Confirming your trip from {from} to {to}. See you soon! ✅',
  },
  {
    id: 'completed',
    labelKey: 'messageTemplates.completed.label',
    messageKey: 'messageTemplates.completed.message',
    label: 'Trip Completed',
    message:
      "Thank you for choosing our service {passengerName}! Hope you had a great trip. Please rate your experience. ⭐",
  },
];

export function MessageTemplates({
  passengerName,
  passengerPhone,
  passengerUserId,
  driverUserId,
  driverName,
  driverAvatar,
  organizationId,
  tripInfo,
  onSendMessage,
}: MessageTemplatesProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleSendMessage = async (template: (typeof TEMPLATES)[0]) => {
    let message = t(template.messageKey, template.message);

    if (tripInfo) {
      message = message.replace('{from}', tripInfo.from);
      message = message.replace('{to}', tripInfo.to);
    }

    if (passengerName) {
      message = message.replace(/\{passengerName\}/g, passengerName);
      if (message.includes('Hi!')) {
        message = message.replace('Hi!', `Hi ${passengerName}!`);
      }
    }

    if (onSendMessage) {
      onSendMessage(message);
      setOpen(false);
      return;
    }

    navigator.clipboard.writeText(message);
    toast.success(t('messageTemplates.copiedToClipboard', 'Message copied to clipboard'));
    setOpen(false);
  };

  const handleCall = useCallback(() => {
    if (passengerPhone) {
      window.open(`tel:${passengerPhone}`);
    } else {
      toast.error(t('messageTemplates.noPhoneAvailable', 'No phone number available'));
    }
  }, [passengerPhone]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm">
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">
                {t('messageTemplates.quickMessages', 'Quick Messages')}
              </span>
              <span className="sm:hidden">{t('messageTemplates.message', 'Message')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {TEMPLATES.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleSendMessage(template)}
                className="flex flex-col items-start gap-1 py-3"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-medium">{t(template.labelKey, template.label)}</span>
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {t(template.messageKey, template.message)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className="text-xs sm:text-sm"
          onClick={handleCall}
        >
          <PhoneCall className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          {t('messageTemplates.call', 'Call')}
        </Button>
      </div>
    </>
  );
}
