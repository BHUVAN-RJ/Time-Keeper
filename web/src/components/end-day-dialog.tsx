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
import { formatOverworkMinutes } from "@/lib/overwork";
import { WeeklyReviewNudgeModal } from "@/components/weekly-review-nudge-modal";

type Preview = Awaited<ReturnType<typeof getEndDayPreview>>;

function resolutionChipClass(active: boolean, tone: "default" | "danger" = "default") {
  const base =
    "rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors";
  if (!active) return `${base} btn-ghost`;
  if (tone === "danger") {
    return `${base} border-2 border-tk-red bg-tk-red/25 text-tk-red ring-2 ring-tk-red/30`;
  }
  return `${base} border-2 border-tk-honey bg-tk-honey/30 text-tk-honey ring-2 ring-tk-honey/50`;
}

export function EndDayDialog({
  open,
  onOpenChange,
  runningBlockId,
  onNeedStop,
  closeDate,
  title,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  runningBlockId: string | null;
  onNeedStop: () => void;
  closeDate?: string;
  title?: string;
  onSuccess?: () => void;
}) {
  const [weeklyNudgeOpen, setWeeklyNudgeOpen] = useState(false);

  return (
    <>
      {open ? (
        <EndDayDialogBody
          key={closeDate ?? "today"}
          runningBlockId={runningBlockId}
          onNeedStop={onNeedStop}
          closeDate={closeDate}
          title={title}
          onSuccess={onSuccess}
          onOpenChange={onOpenChange}
          onWeeklyReviewNudge={() => setWeeklyNudgeOpen(true)}
        />
      ) : null}
      <WeeklyReviewNudgeModal
        open={weeklyNudgeOpen}
        onOpenChange={setWeeklyNudgeOpen}
      />
    </>
  );
}

function EndDayDialogBody({
  runningBlockId,
  onNeedStop,
  closeDate,
  title,
  onSuccess,
  onOpenChange,
  onWeeklyReviewNudge,
}: {
  runningBlockId: string | null;
  onNeedStop: () => void;
  closeDate?: string;
  title?: string;
  onSuccess?: () => void;
  onOpenChange: (v: boolean) => void;
  onWeeklyReviewNudge: () => void;
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
  const [pickDates, setPickDates] = useState<Record<string, string>>({});
  const [dropDrafts, setDropDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void getEndDayPreview(closeDate).then(setPreview);
  }, [closeDate]);

  const snapshot = preview?.snapshot;
  const scoreVsAvg = preview?.scoreVsAvg;
  const incomplete = preview?.incomplete ?? [];
  const habits = preview?.habits ?? [];
  const breakdown = snapshot
    ? formatScoreBreakdown(snapshot.scoreBreakdown)
    : [];
  const dialogTitle =
    title ?? (preview?.isCatchUp ? "Close yesterday" : "End Day");

  function setAction(
    taskId: string,
    action: "tomorrow" | "date" | "drop",
    date?: string,
  ) {
    if (action === "tomorrow") {
      setResolutions((r) => ({
        ...r,
        [taskId]: { taskId, action: "tomorrow" },
      }));
      return;
    }
    if (action === "date") {
      const d = date ?? pickDates[taskId] ?? preview?.nextDay ?? "";
      setResolutions((r) => ({
        ...r,
        [taskId]: { taskId, action: "date", date: d },
      }));
      return;
    }
    const reason = dropDrafts[taskId]?.trim() ?? "";
    setResolutions((r) => ({
      ...r,
      [taskId]: { taskId, action: "drop", reason },
    }));
  }

  function validateIncomplete(): string | null {
    for (const t of incomplete) {
      const r = resolutions[t.id];
      if (!r) return `Choose what to do with “${t.title}”.`;
      if (r.action === "drop" && !r.reason.trim()) {
        return `Add a drop reason for “${t.title}”.`;
      }
      if (r.action === "date" && !r.date) {
        return `Pick a date for “${t.title}”.`;
      }
    }
    return null;
  }

  async function onSubmit() {
    if (!preview || !snapshot) return;
    if (!closeDate && runningBlockId) {
      onNeedStop();
      toast.error("Stop the running timer first.");
      return;
    }
    const err = validateIncomplete();
    if (err) {
      toast.error(err);
      return;
    }
    const list: IncompleteResolution[] = incomplete.map((t) => {
      const r = resolutions[t.id];
      if (r) return r;
      return { taskId: t.id, action: "tomorrow" as const };
    });
    setPending(true);
    try {
      const result = await submitEndDayAction({
        closeDate: preview.closeDay,
        mood,
        notes,
        tomorrowsTop3: top3,
        incompleteResolutions: list,
      });
      const owNote =
        result.overworkMinutes > 0
          ? ` · +${formatCredits(result.overworkBonus)} overwork`
          : "";
      toast.success(
        preview.isCatchUp
          ? `Yesterday closed${owNote}`
          : `Day closed — see you tomorrow${owNote}`,
      );
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
      if (result.weeklyReviewNudge) {
        onWeeklyReviewNudge();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not end day");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ritual-overlay z-[60]" />
        <Dialog.Content className="ritual-content z-[61] max-h-[min(88vh,720px)] overflow-y-auto p-5">
          <Dialog.Title className="text-lg font-semibold text-tk-ink">
            {dialogTitle}
          </Dialog.Title>

          {!preview || !snapshot ? (
            <p className="mt-4 text-[13px] text-tk-ink-3">Loading…</p>
          ) : null}

          {preview && snapshot && step === 0 && preview.isCatchUp && preview.alreadyEnded ? (
            <div className="mt-4 flex flex-col gap-4">
              <p className="text-[14px] text-tk-ink-2">
                <span className="font-medium text-tk-ink">{preview.closeDay}</span> is
                already closed. You can continue with your morning rundown.
              </p>
              <button
                type="button"
                className="btn-primary w-full py-3"
                onClick={() => {
                  onOpenChange(false);
                  onSuccess?.();
                  router.refresh();
                }}
              >
                Continue
              </button>
            </div>
          ) : null}

          {preview && snapshot && step === 0 && !(preview.isCatchUp && preview.alreadyEnded) ? (
            <div className="mt-4 flex flex-col gap-4">
              <div className="rounded-xl bg-tk-surface-2 p-4 text-center">
                <div className="eyebrow">
                  {preview.isCatchUp ? preview.closeDay : "Today"}
                </div>
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
                {breakdownOpen ? "Hide" : "Show"} score breakdown
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
                {preview.overwork.minutes > 0 ? (
                  <span className="mt-1 block text-tk-amber">
                    Overwork {preview.overwork.label}: +
                    {formatCredits(preview.overwork.projectedCreditBonus)} credits
                    ({preview.overwork.creditsPercent}% split),{" "}
                    {formatOverworkMinutes(preview.overwork.projectedBankMinutes)}{" "}
                    to freeze bank
                  </span>
                ) : null}
              </div>
              {snapshot.categoryGoals.length > 0 ? (
                <div>
                  <div className="eyebrow mb-2">Time by category</div>
                  <ul className="flex flex-col gap-1.5 text-[12px]">
                    {snapshot.categoryGoals.map((g) => (
                      <li
                        key={g.categoryId}
                        className="flex justify-between gap-2 text-tk-ink-2"
                      >
                        <span style={{ color: g.color }}>{g.categoryName}</span>
                        <span className="mono text-tk-ink">
                          {g.actualMinutes}/{g.targetMinutes}m · {g.hitPercent}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {habits.length > 0 ? (
                <div>
                    <div className="eyebrow mb-2">Habits</div>
                  <ul className="flex flex-col gap-1 text-[12px]">
                    {habits.map((h) => (
                      <li
                        key={h.id}
                        className={h.hit ? "text-tk-green" : "text-tk-red/90"}
                      >
                        {h.hit ? "✓" : "○"} {h.name}{" "}
                        <span className="text-tk-ink-4">
                          ({h.count}/{h.targetPerDay}
                          {h.freezeUsed ? " ❄" : ""})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
              <p className="text-[13px] text-tk-ink-2">Incomplete for this day</p>
              {incomplete.map((t) => {
                const r = resolutions[t.id];
                const isDrop = r?.action === "drop";
                const isDate = r?.action === "date";
                return (
                  <div key={t.id} className="card p-3">
                    <div className="font-medium text-tk-ink">{t.title}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={resolutionChipClass(r?.action === "tomorrow")}
                        onClick={() => setAction(t.id, "tomorrow")}
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        className={resolutionChipClass(isDate)}
                        onClick={() => {
                          const d =
                            pickDates[t.id] ?? preview.nextDay ?? "";
                          setPickDates((p) => ({ ...p, [t.id]: d }));
                          setAction(t.id, "date", d);
                        }}
                      >
                        Pick date
                      </button>
                      <button
                        type="button"
                        className={resolutionChipClass(isDrop, "danger")}
                        onClick={() => setAction(t.id, "drop")}
                      >
                        Drop
                      </button>
                    </div>
                    {isDate ? (
                      <input
                        type="date"
                        className="mt-2 w-full rounded-lg border border-tk-line bg-tk-surface-2 px-2 py-1.5 text-[12px] text-tk-ink"
                        value={pickDates[t.id] ?? r?.date ?? preview.nextDay}
                        onChange={(e) => {
                          setPickDates((p) => ({
                            ...p,
                            [t.id]: e.target.value,
                          }));
                          setAction(t.id, "date", e.target.value);
                        }}
                      />
                    ) : null}
                    {isDrop || dropDrafts[t.id] !== undefined ? (
                      <textarea
                        className="mt-2 w-full rounded-lg border border-tk-line bg-tk-surface-2 px-2 py-1.5 text-[12px] text-tk-ink"
                        rows={2}
                        placeholder="Why drop? (required)"
                        value={dropDrafts[t.id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDropDrafts((p) => ({ ...p, [t.id]: v }));
                          setResolutions((res) => ({
                            ...res,
                            [t.id]: {
                              taskId: t.id,
                              action: "drop",
                              reason: v,
                            },
                          }));
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
              <button
                type="button"
                className="btn-primary w-full py-2"
                onClick={() => {
                  const err = validateIncomplete();
                  if (err) {
                    toast.error(err);
                    return;
                  }
                  setStep(2);
                }}
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
                {preview.isCatchUp ? "Today's" : "Tomorrow's"} top 3
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
                {preview.alreadyEnded ? "Already closed" : "Close the day"}
              </button>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
