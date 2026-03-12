/**
 * Corporate Trip Request Fields Component
 * Priority, Category, Cost Center, Business Justification
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Briefcase, DollarSign, FileText } from 'lucide-react';

interface CorporateTripFieldsProps {
  priority: "P0" | "P1" | "P2" | "P3";
  tripCategory: "client_meeting" | "airport" | "office_transfer" | "emergency" | "team_event" | "personal";
  costCenter: string;
  businessJustification: string;
  requiresApproval: boolean;
  onPriorityChange: (value: "P0" | "P1" | "P2" | "P3") => void;
  onCategoryChange: (value: "client_meeting" | "airport" | "office_transfer" | "emergency" | "team_event" | "personal") => void;
  onCostCenterChange: (value: string) => void;
  onBusinessJustificationChange: (value: string) => void;
  onRequiresApprovalChange: (value: boolean) => void;
}

export function CorporateTripFields({
  priority,
  tripCategory,
  costCenter,
  businessJustification,
  requiresApproval,
  onPriorityChange,
  onCategoryChange,
  onCostCenterChange,
  onBusinessJustificationChange,
  onRequiresApprovalChange,
}: CorporateTripFieldsProps) {
  const { t } = useTranslation();

  const priorityLabels = {
    P0: { label: 'P0 - Executive', desc: 'CEO/Board - Immediate response', color: 'text-red-600' },
    P1: { label: 'P1 - Client', desc: 'Client-facing - Urgent', color: 'text-orange-600' },
    P2: { label: 'P2 - Standard', desc: 'Internal meetings - Standard', color: 'text-blue-600' },
    P3: { label: 'P3 - Personal', desc: 'Non-urgent - Lowest priority', color: 'text-gray-600' },
  };

  const categoryLabels = {
    client_meeting: '🤝 Client Meeting',
    airport: '✈️ Airport Transfer',
    office_transfer: '🏢 Office Transfer',
    emergency: '🚨 Emergency',
    team_event: '👥 Team Event',
    personal: '👤 Personal',
  };

  const needsApproval = priority === 'P0' || priority === 'P1' || tripCategory === 'emergency';

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Briefcase className="w-4 h-4" />
        Corporate Trip Details
      </div>

      {/* Priority */}
      <div>
        <Label>Trip Priority</Label>
        <Select value={priority} onValueChange={(v) => onPriorityChange(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(priorityLabels).map(([key, { label, desc, color }]) => (
              <SelectItem key={key} value={key}>
                <div className="flex flex-col">
                  <span className={color}>{label}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div>
        <Label>Trip Category</Label>
        <Select value={tripCategory} onValueChange={(v) => onCategoryChange(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cost Center */}
      <div>
        <Label className="flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Cost Center (Optional)
        </Label>
        <Input
          value={costCenter}
          onChange={(e) => onCostCenterChange(e.target.value)}
          placeholder="e.g., MKTG-001, ENG-002"
        />
      </div>

      {/* Business Justification */}
      <div>
        <Label className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Business Justification
        </Label>
        <Textarea
          value={businessJustification}
          onChange={(e) => onBusinessJustificationChange(e.target.value)}
          placeholder="Brief description of business purpose..."
          rows={3}
        />
      </div>

      {/* Approval Notice */}
      {needsApproval && (
        <Alert variant="info" className="bg-blue-50 border-blue-200">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            This trip requires manager approval due to {priority === 'P0' || priority === 'P1' ? 'high priority' : 'emergency category'}.
            You will be notified once approved.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
