"use client";

import { refreshGoogleCalendarCacheAction } from "@/actions/google-calendar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 15 * 60 * 1000;

export function CalendarPollProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      void refreshGoogleCalendarCacheAction().then(() => router.refresh());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, router]);

  return <>{children}</>;
}
