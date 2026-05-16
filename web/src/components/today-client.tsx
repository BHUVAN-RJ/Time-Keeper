"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Plus, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createManualBlockAction,
  deleteBlockAction,
  getTodayData,
  startBlockAction,
  stopBlockAction,
  updateBlockAction,
  type TodayBlockRow,
} from "@/actions/time-blocks";
import type { Quality } from "@/lib/credits";
import { formatCredits } from "@/lib/credits";
import {
  clearFocusSession,
  readFocusSession,
  writeFocusSession,
} from "@/lib/focus-session-storage";

type Initial = Awaited<ReturnType<typeof getTodayData>>;

function fmt(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function splitElapsed(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { hh, mm, ss };
}

const FOCUS_PRESETS = [25, 45, 60, 90] as const;
/** Upper bound for custom / preset focus countdown (minutes). */
const FOCUS_MAX_MIN = 12 * 60;

function isFocusPresetMinutes(n: number): boolean {
  return (FOCUS_PRESETS as readonly number[]).includes(n);
}

function formatMmSs(totalSec: number) {
  const s = Math.abs(Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Running block primary clock: with a focus goal, only countdown (no elapsed).
 * Without a goal, elapsed time only.
 */
function RunningBlockPrimaryClock({
  blockId,
  startIso,
  serverSeconds,
}: {
  blockId: string;
  startIso: string;
  serverSeconds: number;
}) {
  const [targetMin, setTargetMin] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const s = readFocusSession();
    return s?.blockId === blockId && s.targetMinutes > 0
      ? s.targetMinutes
      : null;
  });
  const [remainSec, setRemainSec] = useState(() => {
    if (typeof window === "undefined") return 0;
    const s = readFocusSession();
    if (s?.blockId !== blockId || !(s.targetMinutes > 0)) return 0;
    const capSec = s.targetMinutes * 60;
    const elapsed = Math.floor(
      (Date.now() - new Date(startIso).getTime()) / 1000,
    );
    return capSec - elapsed;
  });
  const [elapsedSec, setElapsedSec] = useState(serverSeconds);

  useEffect(() => {
    queueMicrotask(() => {
      const s = readFocusSession();
      if (s?.blockId === blockId && s.targetMinutes > 0) {
        setTargetMin(s.targetMinutes);
      } else {
        setTargetMin(null);
      }
    });
  }, [blockId]);

  useEffect(() => {
    if (targetMin == null) return;
    const startMs = new Date(startIso).getTime();
    const capSec = targetMin * 60;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      setRemainSec(capSec - elapsed);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [blockId, startIso, targetMin]);

  useEffect(() => {
    if (targetMin != null) return;
    const startMs = new Date(startIso).getTime();
    const tick = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startIso, targetMin]);

  const digitsClass =
    "mono text-[40px] font-semibold leading-none sm:text-[44px]";

  if (targetMin != null) {
    const over = remainSec < 0;
    return (
      <div className="min-w-0 flex-1" suppressHydrationWarning>
        <div
          className={`${digitsClass} tabular-nums ${over ? "text-tk-red" : "text-tk-cream"}`}
        >
          {formatMmSs(over ? -remainSec : remainSec)}
        </div>
        <div
          className={`mt-1 text-[11px] ${over ? "text-tk-red/90" : "text-tk-ink-3"}`}
        >
          {over
            ? `Over focus goal · ${targetMin}m`
            : `Remaining · ${targetMin}m goal`}
        </div>
      </div>
    );
  }

  const elapsed = splitElapsed(elapsedSec);
  return (
    <div
      className={`${digitsClass} min-w-0 flex-1 text-tk-cream`}
      suppressHydrationWarning
    >
      {elapsed.hh}
      <span className="text-tk-ink-3">:</span>
      {elapsed.mm}
      <span className="text-tk-ink-3">:</span>
      <span className="text-tk-ink-2">{elapsed.ss}</span>
    </div>
  );
}

export function TodayClient({ initial }: { initial: Initial }) {
  const qc = useQueryClient();
  const { data = initial, isFetching } = useQuery({
    queryKey: ["today"],
    queryFn: () => getTodayData(),
    initialData: initial,
    staleTime: 8_000,
    refetchInterval: 20_000,
  });

  const tz = data.timezone;
  const activeCats = useMemo(
    () => data.categories.filter((c) => !c.archived),
    [data.categories],
  );
  const catOptions = (selectedId?: string) =>
    data.categories.filter((c) => !c.archived || c.id === selectedId);
  const firstActiveId = activeCats[0]?.id ?? "";
  const [startCatPick, setStartCatPick] = useState<string | null>(null);
  const validPick =
    startCatPick && activeCats.some((c) => c.id === startCatPick)
      ? startCatPick
      : null;
  const startCat = validPick ?? firstActiveId;

  const running = data.running;
  const [stopOpen, setStopOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editRow, setEditRow] = useState<TodayBlockRow | null>(null);

  const [stopLabel, setStopLabel] = useState("");
  const [stopCat, setStopCat] = useState("");
  const [stopQuality, setStopQuality] = useState<Quality>("useful");
  const [stopNotes, setStopNotes] = useState("");

  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [manualCat, setManualCat] = useState("");
  const [manualQuality, setManualQuality] = useState<Quality>("useful");
  const [focusTargetMin, setFocusTargetMin] = useState<number | null>(null);

  useEffect(() => {
    if (!data.running?.id) return;
    const s = readFocusSession();
    if (s && s.blockId !== data.running.id) clearFocusSession();
  }, [data.running?.id]);

  async function onStart() {
    if (!startCat) {
      toast.error("Add a category first.");
      return;
    }
    const res = await startBlockAction(startCat);
    if (!res.ok) {
      toast.error("A block is already running. Stop it first.");
      return;
    }
    if (focusTargetMin != null && focusTargetMin > 0) {
      writeFocusSession({
        blockId: res.blockId,
        targetMinutes: focusTargetMin,
      });
    } else {
      clearFocusSession();
    }
    toast.success("Timer started");
    await qc.invalidateQueries({ queryKey: ["today"] });
  }

  async function onStopSubmit() {
    if (!running) return;
    if (!stopLabel.trim()) {
      toast.error("Label is required.");
      return;
    }
    await stopBlockAction({
      blockId: running.id,
      categoryId: stopCat,
      label: stopLabel,
      quality: stopQuality,
      notes: stopNotes || undefined,
    });
    clearFocusSession();
    setStopOpen(false);
    setStopLabel("");
    setStopNotes("");
    toast.success("Saved");
    await qc.invalidateQueries({ queryKey: ["today"] });
  }

  async function onManualSubmit() {
    if (!manualCat || !manualLabel.trim()) {
      toast.error("Category and label required.");
      return;
    }
    try {
      await createManualBlockAction({
        categoryId: manualCat,
        startAt: manualStart,
        endAt: manualEnd,
        label: manualLabel,
        quality: manualQuality,
      });
      setManualOpen(false);
      setManualLabel("");
      toast.success("Block added");
      await qc.invalidateQueries({ queryKey: ["today"] });
    } catch {
      toast.error("Invalid times or overlap.");
    }
  }

  async function onEditSave() {
    if (!editRow || !editRow.endAt) return;
    if (!editRow.label?.trim()) {
      toast.error("Label required.");
      return;
    }
    const q = editRow.quality as Quality | null;
    if (!q || (q !== "useful" && q !== "meh" && q !== "wasted")) {
      toast.error("Quality required for completed blocks.");
      return;
    }
    await updateBlockAction({
      blockId: editRow.id,
      categoryId: editRow.categoryId,
      startAt: editRow.startAt,
      endAt: editRow.endAt,
      label: editRow.label,
      quality: q,
    });
    setEditRow(null);
    toast.success("Updated");
    await qc.invalidateQueries({ queryKey: ["today"] });
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this time block?")) return;
    await deleteBlockAction(id);
    toast.success("Deleted");
    await qc.invalidateQueries({ queryKey: ["today"] });
  }

  const todayLabel = data.calendarHeadline;

  const balanceColor =
    data.creditBalance < 0 ? "text-tk-red" : "text-tk-honey";

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      {isFetching ? (
        <div className="text-center text-[11px] text-tk-ink-4">Updating…</div>
      ) : null}

      <div className="flex items-baseline justify-between px-1">
        <div>
          <div className="text-[22px] font-semibold tracking-tight text-tk-ink">
            {todayLabel}
          </div>
          <div className="eyebrow mt-1">Credits (all time)</div>
          <div
            className={`mono mt-1 text-[20px] font-semibold ${balanceColor}`}
          >
            {formatCredits(data.creditBalance)}
          </div>
        </div>
      </div>

      {data.suspiciousLongRun ? (
        <div className="chip-red text-[12px]">
          Suspiciously long block — forget to stop?
        </div>
      ) : null}

      {running ? (
        <div className="ring-honey shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-[#1c160d] to-[#14100a]">
          <div className="hex-bg-warm px-4 pb-4 pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-tk-honey" />
                <span className="mono uppercase tracking-[0.16em] text-tk-honey">
                  Tracking
                </span>
                <span className="text-tk-ink-3">·</span>
                <span className="text-tk-ink-2">{running.categoryName}</span>
              </div>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <RunningBlockPrimaryClock
                key={`${running.id}-${data.runningElapsedSeconds}`}
                blockId={running.id}
                startIso={running.startAt}
                serverSeconds={data.runningElapsedSeconds}
              />
              <div className="shrink-0 self-end">
                <Dialog.Root open={stopOpen} onOpenChange={setStopOpen}>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className="btn-stop flex h-10 items-center gap-2 px-4 text-[13px] font-semibold"
                    onClick={() => {
                      setStopLabel(running.label ?? "");
                      setStopCat(running.categoryId);
                      setStopQuality(
                        (running.quality as Quality) || "useful",
                      );
                      setStopNotes("");
                    }}
                  >
                    <Square size={12} fill="currentColor" /> Stop
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
                  <Dialog.Content className="card fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,380px)] -translate-x-1/2 -translate-y-1/2 p-5 shadow-xl">
                    <Dialog.Title className="text-lg font-semibold text-tk-ink">
                      Stop timer
                    </Dialog.Title>
                    <p className="mt-1 text-[13px] text-tk-ink-3">
                      Required: label and quality.
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                      <label className="text-[12px] text-tk-ink-2">
                        Category
                        <select
                          className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                          value={stopCat}
                          onChange={(e) => setStopCat(e.target.value)}
                        >
                          {catOptions(running?.categoryId).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[12px] text-tk-ink-2">
                        Label
                        <input
                          className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                          value={stopLabel}
                          onChange={(e) => setStopLabel(e.target.value)}
                          placeholder="What did you do?"
                        />
                      </label>
                      <div>
                        <div className="text-[12px] text-tk-ink-2">Quality</div>
                        <div className="mt-1 flex gap-2">
                          {(
                            [
                              ["useful", "Useful"],
                              ["meh", "Meh"],
                              ["wasted", "Wasted"],
                            ] as const
                          ).map(([v, lab]) => (
                            <button
                              key={v}
                              type="button"
                              className={`flex-1 rounded-xl border px-2 py-2 text-[12px] font-medium ${
                                stopQuality === v
                                  ? "border-tk-honey bg-tk-honey/15 text-tk-honey"
                                  : "border-tk-line text-tk-ink-2"
                              }`}
                              onClick={() => setStopQuality(v)}
                            >
                              {lab}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="text-[12px] text-tk-ink-2">
                        Notes (optional)
                        <textarea
                          className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                          rows={2}
                          value={stopNotes}
                          onChange={(e) => setStopNotes(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="mt-5 flex justify-end gap-2">
                      <Dialog.Close asChild>
                        <button type="button" className="btn-ghost px-4 py-2">
                          Cancel
                        </button>
                      </Dialog.Close>
                      <button
                        type="button"
                        className="btn-primary px-4 py-2"
                        onClick={() => void onStopSubmit()}
                      >
                        Save
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
              </div>
            </div>
            {running.label ? (
              <div className="mt-2 truncate text-[12px] text-tk-ink-2">
                {running.label}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card flex flex-col gap-3 p-4">
          <div className="eyebrow">Start tracking</div>
          <div>
            <div className="mb-1.5 text-[11px] text-tk-ink-3">
              Optional focus length (countdown from block start)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1.5 text-[12px] ${
                  focusTargetMin === null
                    ? "border-tk-honey bg-tk-honey/15 text-tk-honey"
                    : "border-tk-line text-tk-ink-2"
                }`}
                onClick={() => setFocusTargetMin(null)}
              >
                Off
              </button>
              {FOCUS_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-[12px] ${
                    focusTargetMin === m
                      ? "border-tk-honey bg-tk-honey/15 text-tk-honey"
                      : "border-tk-line text-tk-ink-2"
                  }`}
                  onClick={() => setFocusTargetMin(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
            <label className="mt-2 flex flex-col gap-1.5 text-[11px] text-tk-ink-3">
              <span>Custom (minutes)</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={FOCUS_MAX_MIN}
                step={1}
                placeholder={`1–${FOCUS_MAX_MIN}`}
                className="w-full max-w-[200px] rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[14px] text-tk-ink placeholder:text-tk-ink-4"
                value={
                  focusTargetMin != null && !isFocusPresetMinutes(focusTargetMin)
                    ? focusTargetMin
                    : ""
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "" || raw === "-") {
                    setFocusTargetMin(null);
                    return;
                  }
                  const n = Number.parseInt(raw, 10);
                  if (!Number.isFinite(n) || n < 1) return;
                  setFocusTargetMin(Math.min(n, FOCUS_MAX_MIN));
                }}
              />
            </label>
          </div>
          <select
            className="w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
            value={startCat}
            onChange={(e) => setStartCatPick(e.target.value)}
          >
            {activeCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary py-3 text-[15px]"
            onClick={() => void onStart()}
          >
            Start
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <div className="eyebrow">Today</div>
        <div className="flex gap-2">
          <Dialog.Root open={manualOpen} onOpenChange={setManualOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="btn-ghost flex items-center gap-1 px-3 py-2 text-[12px]"
                onClick={() => {
                  const now = new Date();
                  const end = new Date(now.getTime() + 3600_000);
                  const toLocal = (d: Date) => {
                    const pad = (n: number) => String(n).padStart(2, "0");
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  };
                  setManualStart(toLocal(now));
                  setManualEnd(toLocal(end));
                  setManualCat(activeCats[0]?.id ?? "");
                }}
              >
                <Plus size={14} /> Manual
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
              <Dialog.Content className="card fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(100vw-2rem,400px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-5 shadow-xl">
                <Dialog.Title className="text-lg font-semibold text-tk-ink">
                  Manual block
                </Dialog.Title>
                <div className="mt-4 flex flex-col gap-3">
                  <label className="text-[12px] text-tk-ink-2">
                    Start
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                      value={manualStart}
                      onChange={(e) => setManualStart(e.target.value)}
                    />
                  </label>
                  <label className="text-[12px] text-tk-ink-2">
                    End
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                      value={manualEnd}
                      onChange={(e) => setManualEnd(e.target.value)}
                    />
                  </label>
                  <label className="text-[12px] text-tk-ink-2">
                    Category
                    <select
                      className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                      value={manualCat}
                      onChange={(e) => setManualCat(e.target.value)}
                    >
                      {catOptions(manualCat).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[12px] text-tk-ink-2">
                    Label
                    <input
                      className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                      value={manualLabel}
                      onChange={(e) => setManualLabel(e.target.value)}
                    />
                  </label>
                  <div>
                    <div className="text-[12px] text-tk-ink-2">Quality</div>
                    <div className="mt-1 flex gap-2">
                      {(
                        [
                          ["useful", "Useful"],
                          ["meh", "Meh"],
                          ["wasted", "Wasted"],
                        ] as const
                      ).map(([v, lab]) => (
                        <button
                          key={v}
                          type="button"
                          className={`flex-1 rounded-xl border px-2 py-2 text-[12px] ${
                            manualQuality === v
                              ? "border-tk-honey bg-tk-honey/15 text-tk-honey"
                              : "border-tk-line text-tk-ink-2"
                          }`}
                          onClick={() => setManualQuality(v)}
                        >
                          {lab}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <button type="button" className="btn-ghost px-4 py-2">
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    className="btn-primary px-4 py-2"
                    onClick={() => void onManualSubmit()}
                  >
                    Save
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>

      <div className="scroll-y flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
        {data.blocks.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-tk-ink-3">
            No blocks overlap today yet.
          </p>
        ) : (
          data.blocks.map((b) => (
            <div
              key={b.id}
              className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: b.categoryColor }}
                  />
                  <span className="truncate text-[14px] font-medium text-tk-ink">
                    {b.label || "(no label)"}
                  </span>
                  {b.manualEntry ? (
                    <span className="chip-line shrink-0 text-[10px]">Manual</span>
                  ) : null}
                </div>
                <div className="mt-1 text-[11px] text-tk-ink-3">
                  {b.categoryName} · {fmt(b.startAt, tz)}
                  {b.endAt ? ` → ${fmt(b.endAt, tz)}` : " · running"}
                  {b.quality ? ` · ${b.quality}` : ""}
                </div>
                {b.credits != null ? (
                  <div
                    className={`mono mt-1 text-[12px] ${b.credits < 0 ? "text-tk-red" : "text-tk-green"}`}
                  >
                    {b.credits < 0 ? "" : "+"}
                    {formatCredits(b.credits)} credits
                  </div>
                ) : null}
              </div>
              {b.endAt ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-tk-ink-3 hover:bg-tk-surface-2 hover:text-tk-ink"
                    aria-label="Edit"
                    onClick={() => setEditRow({ ...b })}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-tk-red/80 hover:bg-tk-surface-2"
                    aria-label="Delete"
                    onClick={() => void onDelete(b.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <Dialog.Root open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
          <Dialog.Content className="card fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(100vw-2rem,400px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-tk-ink">
              Edit block
            </Dialog.Title>
            {editRow ? (
              <EditBlockForm
                row={editRow}
                categoryOptions={catOptions(editRow.categoryId)}
                onChange={setEditRow}
                onSave={() => void onEditSave()}
              />
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function EditBlockForm({
  row,
  categoryOptions,
  onChange,
  onSave,
}: {
  row: TodayBlockRow;
  categoryOptions: {
    id: string;
    name: string;
    color: string;
    archived: boolean;
  }[];
  onChange: (r: TodayBlockRow) => void;
  onSave: () => void;
}) {
  const toLocal = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="text-[12px] text-tk-ink-2">
        Start
        <input
          type="datetime-local"
          className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          value={toLocal(row.startAt)}
          onChange={(e) =>
            onChange({
              ...row,
              startAt: new Date(e.target.value).toISOString(),
            })
          }
        />
      </label>
      <label className="text-[12px] text-tk-ink-2">
        End
        <input
          type="datetime-local"
          className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          value={row.endAt ? toLocal(row.endAt) : ""}
          onChange={(e) =>
            onChange({
              ...row,
              endAt: e.target.value
                ? new Date(e.target.value).toISOString()
                : null,
            })
          }
        />
      </label>
      <label className="text-[12px] text-tk-ink-2">
        Category
        <select
          className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          value={row.categoryId}
          onChange={(e) => {
            const c = categoryOptions.find((x) => x.id === e.target.value);
            onChange({
              ...row,
              categoryId: e.target.value,
              categoryName: c?.name ?? row.categoryName,
              categoryColor: c?.color ?? row.categoryColor,
            });
          }}
        >
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[12px] text-tk-ink-2">
        Label
        <input
          className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          value={row.label ?? ""}
          onChange={(e) => onChange({ ...row, label: e.target.value })}
        />
      </label>
      <div>
        <div className="text-[12px] text-tk-ink-2">Quality</div>
        <div className="mt-1 flex gap-2">
          {(["useful", "meh", "wasted"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`flex-1 rounded-xl border px-2 py-2 text-[12px] capitalize ${
                row.quality === v
                  ? "border-tk-honey bg-tk-honey/15 text-tk-honey"
                  : "border-tk-line text-tk-ink-2"
              }`}
              onClick={() => onChange({ ...row, quality: v })}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Dialog.Close asChild>
          <button type="button" className="btn-ghost px-4 py-2">
            Cancel
          </button>
        </Dialog.Close>
        <button type="button" className="btn-primary px-4 py-2" onClick={onSave}>
          Save
        </button>
      </div>
    </div>
  );
}
