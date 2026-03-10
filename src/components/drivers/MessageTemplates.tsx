/**
 * Driver Message Templates Component
 * Quick message templates for driver-passenger communication
 */

"use client";

import React from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MessageSquare, Phone, Copy, Send } from "lucide-react";

interface MessageTemplatesProps {
  passengerName?: string;
  passengerPhone?: string;
  tripInfo?: {
    from: string;
    to: string;
    purpose: string;
  };
  onSendMessage?: (message: string) => void;
}

const TEMPLATES = [
  {
    id: "arrived",
    label: "I've Arrived",
    message: "Hi! I've arrived at the pickup location. Ready when you are! 🚗",
  },
  {
    id: "delayed",
    label: "Running Late",
    message: "Hi! I'm running about 5 minutes late due to traffic. Apologies for the inconvenience! ⏰",
  },
  {
    id: "waiting",
    label: "Waiting",
    message: "Hi! I'm waiting at the pickup point. Please let me know when you're ready. 👋",
  },
  {
    id: "confirming",
    label: "Confirming Trip",
    message: "Hi! Confirming your trip from {from} to {to}. See you soon! ✅",
  },
  {
    id: "completed",
    label: "Trip Completed",
    message: "Thank you for choosing our service! Hope you had a great trip. Please rate your experience. ⭐",
  },
  {
    id: "cant_find",
    label: "Can't Find Location",
    message: "Hi! I'm having trouble finding the pickup location. Can you provide more details? 📍",
  },
  {
    id: "calling",
    label: "Request Call",
    message: "Hi! I'm calling you now to confirm the pickup details. 📞",
  },
];

export function MessageTemplates({ passengerName, passengerPhone, tripInfo, onSendMessage }: MessageTemplatesProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const handleSendMessage = (template: typeof TEMPLATES[0]) => {
    let message = template.message;
    
    // Replace placeholders
    if (tripInfo) {
      message = message.replace("{from}", tripInfo.from);
      message = message.replace("{to}", tripInfo.to);
    }
    
    if (passengerName) {
      message = `Hi ${passengerName}! ` + message;
    }

    if (onSendMessage) {
      onSendMessage(message);
    } else {
      // Copy to clipboard
      navigator.clipboard.writeText(message);
      toast.success("Message copied to clipboard");
    }
    
    setOpen(false);
  };

  const handleCall = () => {
    if (passengerPhone) {
      window.open(`tel:${passengerPhone}`);
    } else {
      toast.error("No phone number available");
    }
  };

  return (
    <div className="flex gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MessageSquare className="w-4 h-4 mr-2" />
            Quick Messages
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {TEMPLATES.map((template) => (
            <DropdownMenuItem
              key={template.id}
              onClick={() => handleSendMessage(template)}
              className="flex flex-col items-start gap-1 py-3"
            >
              <span className="font-medium">{template.label}</span>
              <span className="text-xs text-muted-foreground line-clamp-2">
                {template.message}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="sm" onClick={handleCall}>
        <Phone className="w-4 h-4 mr-2" />
        Call
      </Button>
    </div>
  );
}

// SMS integration (for future use with SMS API)
export async function sendSMS(phone: string, message: string) {
  // In production, integrate with SMS API (Twilio, etc.)
  // For now, open default SMS app
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    window.open(`sms:${phone}?body=${encodeURIComponent(message)}`);
  } else {
    // Copy to clipboard on desktop
    await navigator.clipboard.writeText(message);
    toast.success("Message copied to clipboard (SMS not supported on desktop)");
  }
}
