"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  acknowledgeReminderAction,
  pollReminderChromeData,
  snoozeReminderAction,
  type ReminderView,
} from "@/actions/reminders";

const POLL_MS = 30_000;

export function ReminderHeaderBell({
  initialCount,
  className = "",
}: {
  initialCount: number;
  className?: string;
}) {
  const [polledCount, setPolledCount] = useState<number | null>(null);
  const count = polledCount ?? initialCount;

  useEffect(() => {
    const refresh = () => {
      void pollReminderChromeData().then((res) => {
        if (res.ok) setPolledCount(res.data.dueCount);
      });
    };
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Link
      href="/reminders"
      className={`relative shrink-0 rounded-lg p-2 text-tk-ink-2 hover:bg-tk-surface hover:text-tk-ink ${className}`}
      aria-label={
        count > 0 ? `${count} due reminders` : "Reminders"
      }
    >
      <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-tk-honey px-1 text-[10px] font-bold text-[#1a1207]">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export function ReminderBanner({ initial }: { initial: ReminderView | null }) {
  const router = useRouter();
  const [banner, setBanner] = useState(initial);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void pollReminderChromeData().then((res) => {
      if (res.ok) setBanner(res.data.banner);
    });
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  if (!banner) return null;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      refresh();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update reminder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="border-b border-tk-honey/30 bg-tk-honey/10 px-4 py-3"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-tk-honey">
              Reminder
            </p>
            <p className="mt-0.5 text-[14px] font-medium text-tk-ink">
              {banner.title}
            </p>
            <p className="text-[12px] text-tk-ink-3">{banner.remindAtLabel}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            className="btn-primary shrink-0 px-3 py-1.5 text-[12px]"
            onClick={() =>
              run(async () => {
                await acknowledgeReminderAction(banner.id);
              })
            }
          >
            Done
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["10m", "1h", "tomorrow"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={busy}
              className="btn-ghost px-2.5 py-1 text-[11px]"
              onClick={() =>
                run(async () => {
                  await snoozeReminderAction(banner.id, kind);
                  toast.success(
                    kind === "tomorrow"
                      ? "Snoozed until tomorrow 9am"
                      : `Snoozed ${kind === "10m" ? "10 min" : "1 hour"}`,
                  );
                })
              }
            >
              {kind === "10m"
                ? "10 min"
                : kind === "1h"
                  ? "1 hr"
                  : "Tomorrow"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
