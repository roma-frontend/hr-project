"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: Id<"driverSchedules">;
  requestId?: Id<"driverRequests">;
  driverId: Id<"drivers">;
  driverName?: string;
  passengerId: Id<"users">;
  organizationId: Id<"organizations">;
}

export const RatingDialog = React.memo(function RatingDialog({
  open,
  onOpenChange,
  scheduleId,
  requestId,
  driverId,
  driverName,
  passengerId,
  organizationId,
}: RatingDialogProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitRating = useMutation(api.drivers.submitPassengerRating);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitRating({
        scheduleId,
        requestId,
        passengerId,
        driverId,
        organizationId,
        rating,
        comment: comment || undefined,
      });
      toast.success(t("driver.ratingSubmitted", "Rating submitted! Thank you."));
      onOpenChange(false);
      setRating(5);
      setComment("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("driver.failedToSubmitRating", "Failed to submit rating");
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
            <Star className="w-5 h-5 text-yellow-500" />
            {t("driver.rateDriver", "Rate Your Driver")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {driverName && (
            <p className="text-sm text-muted-foreground">
              {t("driver.howWasTrip", "How was your trip with")} <strong>{driverName}</strong>?
            </p>
          )}
          {/* Star rating */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  className={`w-8 h-8 ${star <= rating
                    ? "fill-yellow-500 text-yellow-500"
                    : "text-gray-300"
                    }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {rating === 1 && t("driver.poor", "Poor")}
            {rating === 2 && t("driver.fair", "Fair")}
            {rating === 3 && t("driver.good", "Good")}
            {rating === 4 && t("driver.veryGood", "Very Good")}
            {rating === 5 && t("driver.excellent", "Excellent")}
          </p>
          <div>
            <Label>{t("driver.comment", "Comment")} ({t("optional", "Optional")})</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("driver.commentPlaceholder", "Share your experience...")}
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "..." : t("driver.submitRating", "Submit Rating")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
