"use client";

import * as React from "react";
import { Hotel, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { normalizeTime } from "@/lib/optimize";
import type { CheckInEvent } from "@/types/schedule";

interface CheckInEventProps {
  event: CheckInEvent;
  className?: string;
}

export function CheckInEventItem({ event, className }: CheckInEventProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-dashed bg-amber-50/60",
        className,
      )}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-100 text-amber-700">
        <Hotel className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{event.accommodationName}</p>
        <p className="text-xs text-muted-foreground">Check-in</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">
          {normalizeTime(event.startTime)} - {normalizeTime(event.endTime)}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
          <Clock className="h-3 w-3" />
          {event.durationMin} min
        </p>
      </div>
    </div>
  );
}
