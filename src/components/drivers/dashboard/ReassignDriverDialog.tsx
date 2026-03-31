"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface ReassignDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: Id<"driverRequests">;
  userId: Id<"users">;
  organizationId?: Id<"organizations">;
  currentDriverId: Id<"drivers">;
}

export const ReassignDriverDialog = React.memo(function ReassignDriverDialog({
  open,
  onOpenChange,
  requestId,
  userId,
  organizationId,
  currentDriverId,
}: ReassignDriverDialogProps) {
  const { t } = useTranslation();
  const [selectedNewDriver, setSelectedNewDriver] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const availableDrivers = useQuery(
    api.drivers.getAvailableDrivers,
    organizationId ? { organizationId } : "skip"
  );
  const reassign = useMutation(api.drivers.reassignDriverRequest);

  const otherDrivers = availableDrivers?.filter((d) => d && d._id !== currentDriverId) ?? [];

  const handleReassign = async () => {
    if (!selectedNewDriver) return;
    setSubmitting(true);
    try {
      await reassign({
        requestId,
        userId,
        newDriverId: selectedNewDriver as Id<"drivers">,
      });
      toast.success(t("driver.reassigned", "Request sent to new driver!"));
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("driver.failedToReassign", "Failed to reassign");
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            {t("driver.requestAnotherDriver", "Request Another Driver")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedNewDriver} onValueChange={setSelectedNewDriver}>
            <SelectTrigger>
              <SelectValue placeholder={t("driver.selectNewDriver", "Choose another driver")} />
            </SelectTrigger>
            <SelectContent>
              {otherDrivers.filter(Boolean).map((driver) => {
                if (!driver) return null;
                return (
                  <SelectItem key={driver._id} value={driver._id}>
                    <div className="flex items-center gap-2">
                      <span>{driver.userName}</span>
                      <span className="text-xs text-muted-foreground">
                        {driver.vehicleInfo.model} · ⭐{driver.rating.toFixed(1)}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={handleReassign} disabled={submitting || !selectedNewDriver}>
              {submitting ? "..." : t("driver.reassign", "Send Request")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
