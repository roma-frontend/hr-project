"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2 sm:p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3 sm:space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-1",
        caption_label: "text-xs sm:text-sm font-medium text-[var(--text-primary)] px-8",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-6 w-6 sm:h-7 sm:w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-0 sm:left-1",
        nav_button_next: "absolute right-0 sm:right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex justify-between gap-1",
        head_cell:
          "text-[var(--text-muted)] rounded-md w-7 sm:w-9 font-normal text-[0.7rem] sm:text-xs flex items-center justify-center",
        row: "flex w-full mt-1.5 sm:mt-2 justify-between gap-1",
        cell: "h-7 w-7 sm:h-9 sm:w-9 text-center text-xs sm:text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-[var(--accent)]/50 [&:has([aria-selected])]:bg-[var(--accent)] first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 sm:h-9 sm:w-9 p-0 font-normal aria-selected:opacity-100 text-xs sm:text-sm"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-[#2563eb] text-white hover:bg-[#2563eb] hover:text-white focus:bg-[#2563eb] focus:text-white",
        day_today: "bg-[var(--accent)] text-[var(--text-primary)] font-semibold",
        day_outside:
          "day-outside text-[var(--text-muted)] opacity-50 aria-selected:bg-[var(--accent)]/50 aria-selected:text-[var(--text-muted)] aria-selected:opacity-30",
        day_disabled: "text-[var(--text-muted)] opacity-50",
        day_range_middle:
          "aria-selected:bg-[var(--accent)] aria-selected:text-[var(--text-primary)]",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
