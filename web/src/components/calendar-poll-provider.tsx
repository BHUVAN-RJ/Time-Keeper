"use client";

import { refreshGoogleCalendarCacheAction } from "@/actions/google-calendar";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/queries/keys";

const POLL_MS = 15 * 60 * 1000;

export function CalendarPollProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      void refreshGoogleCalendarCacheAction().then(() => {
        void qc.invalidateQueries({ queryKey: queryKeys.week.all });
      });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, qc]);

  return <>{children}</>;
}
