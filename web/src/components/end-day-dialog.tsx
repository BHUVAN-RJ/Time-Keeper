"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getEndDayPreview,
  submitEndDayAction,
  type IncompleteResolution,
} from "@/actions/end-day";
import { formatScoreBreakdown } from "@/lib/score-breakdown";
import { formatCredits } from "@/lib/credits";

type Preview = Awaited<ReturnType<typeof getEndDayPreview>>;

export function EndDayDialog({
  open,
  onOpenChange,
  runningBlockId,
  onNeedStop,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  runningBlockId: string | null;
  onNeedStop: () => void;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [step, setStep] = useState(0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [top3, setTop3] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<
    Record<string, IncompleteResolution>
  >({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void getEndDayPreview().then(setPreview);
  }, []);

  if (!open) return null;

  async function onSubmit() {
    if (!preview) return;
    if (runningBlockId) {
      onNeedStop();
      toast.error("Stop the running timer first.");
      return;
    }
    const list: IncompleteResolution[] = preview.incomplete.map((t) => {
      const r = resolutions[t.id];
      if (r) return r;
      return { taskId: t.id, action: "tomorrow" as const };
    });
    setPending(true);
    try {
      await submitEndDayAction({
        mood,
        notes,
        tomorrowsTop3: top3,
        incompleteResolutions: list,
      });
      toast.success("Day closed — see you tomorrow");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not end day");
    } finally {
      setPending(false);
    }
  }

  const snapshot = preview?.snapshot;
  const scoreVsAvg = preview?.scoreVsAvg;
  const incomplete = preview?.incomplete ?? [];
  const breakdown = snapshot
    ? formatScoreBreakdown(snapshot.scoreBreakdown)
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content className="card fixed inset-x-4 bottom-4 z-50 max-h-[85vh] overflow-y-auto p-5 sm:left-1/2 sm:top-1/2 sm:w-[min(100vw-2rem,420px)] sm:-translate-x-1/2 sm:-translate-y-1/2">
          <Dialog.Title className="text-lg font-semibold text-tk-ink">
            End Day
          </Dialog.Title>

          {!preview || !snapshot ? (
            <p className="mt-4 text-[13px] text-tk-ink-3">Loading…</p>
          ) : null}

          {preview && snapshot && step === 0 ? (
            <div className="mt-4 flex flex-col gap-4">
              <div className="rounded-xl bg-tk-surface-2 p-4 text-center">
                <div className="eyebrow">Today</div>
                <div className="mono text-[42px] font-semibold leading-none text-tk-honey">
                  {snapshot.productivityScore}
                </div>
                {scoreVsAvg != null ? (
                  <div
                    className={`mt-2 text-[13px] ${
                      scoreVsAvg >= 0 ? "text-tk-honey" : "text-tk-red/80"
                    }`}
                  >
                    {scoreVsAvg >= 0 ? "+" : ""}
                    {scoreVsAvg} vs 7-day avg
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="text-left text-[12px] text-tk-ink-3 underline"
                onClick={() => setBreakdownOpen((o) => !o)}
              >
                {breakdownOpen ? "Hide" : "Show"} breakdown
              </button>
              {breakdownOpen ? (
                <ul className="flex flex-col gap-1 text-[12px] text-tk-ink-2">
                  {breakdown.map((row) => (
                    <li key={row.label} className="flex justify-between">
                      <span>{row.label}</span>
                      <span className="mono text-tk-ink">
                        +{row.value}{" "}
                        <span className="text-tk-ink-4">({row.detail})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="text-[13px] text-tk-ink-2">
                Goal hit: {snapshot.goalHitPercent}% · Credits:{" "}
                {formatCredits(snapshot.creditsEarned)} earned
              </div>
              <button
                type="button"
                className="btn-primary w-full py-3"
                onClick={() => setStep(incomplete.length > 0 ? 1 : 2)}
              >
                Continue
              </button>
            </div>
          ) : null}

          {preview && step === 1 ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-[13px] text-tk-ink-2">Incomplete for today</p>
              {incomplete.map((t) => (
                <div key={t.id} className="card p-3">
                  <div className="font-medium text-tk-ink">{t.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-[11px]"
                      onClick={() =>
                        setResolutions((r) => ({
                          ...r,
                          [t.id]: { taskId: t.id, action: "tomorrow" },
                        }))
                      }
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-[11px] text-tk-warn"
                      onClick={() =>
                        setResolutions((r) => ({
                          ...r,
                          [t.id]: {
                            taskId: t.id,
                            action: "drop",
                            reason: "End day drop",
                          },
                        }))
                      }
                    >
                      Drop
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-primary w-full py-2"
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          ) : null}

          {preview && step === 2 ? (
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-[12px] text-tk-ink-2">
                Mood (optional)
                <div className="mt-1 flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`h-9 w-9 rounded-full border text-[13px] ${
                        mood === n
                          ? "border-tk-honey bg-tk-honey/20 text-tk-honey"
                          : "border-tk-line text-tk-ink-2"
                      }`}
                      onClick={() => setMood(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </label>
              <label className="text-[12px] text-tk-ink-2">
                Notes
                <textarea
                  className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label className="text-[12px] text-tk-ink-2">
                Tomorrow&apos;s top 3
                <select
                  multiple
                  className="mt-1 h-24 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-2 py-1 text-[12px] text-tk-ink"
                  value={top3}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions).map(
                      (o) => o.value,
                    );
                    setTop3(opts.slice(0, 3));
                  }}
                >
                  {preview.pickableTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-primary w-full py-3 text-[15px] font-semibold"
                disabled={pending || preview.alreadyEnded}
                onClick={() => void onSubmit()}
              >
                {preview.alreadyEnded ? "Already ended" : "Close the day"}
              </button>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
