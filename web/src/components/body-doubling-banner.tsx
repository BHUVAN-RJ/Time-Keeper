"use client";

import { useCallback, useEffect, useState } from "react";
import { getBodyDoublingPingState } from "@/actions/body-doubling";

const POLL_MS = 30_000;

export function BodyDoublingBanner() {
  const [ping, setPing] = useState<{
    blockId: string;
    statedIntent: string;
    categoryName: string;
  } | null>(null);
  const [dismissedUntil, setDismissedUntil] = useState(0);

  const refresh = useCallback(async () => {
    if (Date.now() < dismissedUntil) {
      setPing(null);
      return;
    }
    const state = await getBodyDoublingPingState();
    if (!state.running || state.intervalMinutes <= 0) {
      setPing(null);
      return;
    }

    const key = `body-doubling-last-${state.running.blockId}`;
    const started = new Date(state.running.startedAt).getTime();
    const last = Number(
      typeof window !== "undefined"
        ? sessionStorage.getItem(key) ?? started
        : started,
    );
    const elapsed = Date.now() - last;
    if (elapsed < state.intervalMinutes * 60 * 1000) {
      setPing(null);
      return;
    }

    setPing({
      blockId: state.running.blockId,
      statedIntent: state.running.statedIntent,
      categoryName: state.running.categoryName,
    });
  }, [dismissedUntil]);

  useEffect(() => {
    const tick = () => void refresh();
    const id = setInterval(tick, POLL_MS);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [refresh]);

  if (!ping) return null;

  function onDismiss() {
    const key = `body-doubling-last-${ping!.blockId}`;
    sessionStorage.setItem(key, String(Date.now()));
    setDismissedUntil(Date.now() + 5 * 60 * 1000);
    setPing(null);
  }

  return (
    <div
      role="status"
      className="border-b border-tk-line bg-tk-surface/90 px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-tk-ink-3">
            Still on it?
          </p>
          <p className="mt-0.5 text-[13px] text-tk-ink">
            You said you&apos;d be doing:{" "}
            <span className="font-medium text-tk-honey">{ping.statedIntent}</span>
          </p>
          <p className="text-[10px] text-tk-ink-4">{ping.categoryName}</p>
        </div>
        <button
          type="button"
          className="btn-ghost shrink-0 px-2 py-1 text-[11px]"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
