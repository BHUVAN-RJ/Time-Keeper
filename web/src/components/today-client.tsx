"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { getTodayDashboardExtras } from "@/actions/today-extras";
import {
  createManualBlockAction,
  deleteBlockAction,
  getTodayData,
  pollTodayData,
  startBlockAction,
  stopBlockAction,
  updateBlockAction,
  type TodayBlockRow,
} from "@/actions/time-blocks";
import { markOffDayAction } from "@/actions/day-status";
import { RevertOffDayButton } from "@/components/revert-off-day-button";
import { FocusModeView } from "@/components/focus-mode-view";
import { OffDayCheckModal } from "@/components/off-day-check-modal";
import { TodayScoreWidget } from "@/components/today-score-widget";
import type { getAmRundownData } from "@/actions/am-rundown";
import { AmRundownModal } from "@/components/am-rundown-modal";
import { TodayHabitsPanel } from "@/components/today-habits-panel";
import { TodayPinnedTop3 } from "@/components/today-pinned-top3";
import { TodayV03Panel } from "@/components/today-v03-panel";
import { TodayV02Panel } from "@/components/today-v02-panel";
import { ProjectPicker } from "@/components/project-picker";
import { TagPicker } from "@/components/tag-picker";
import { formatCredits } from "@/lib/credits";
import { QualityPicker } from "@/components/quality-picker";
import {
  normalizeQuality,
  qualityLabel,
  type Quality,
} from "@/lib/quality";
import {
  clearFocusSession,
  readFocusSession,
  writeFocusSession,
} from "@/lib/focus-session-storage";
import { todayDataFingerprint } from "@/lib/today-data-fingerprint";

type Initial = Awaited<ReturnType<typeof getTodayData>>;
type Extras = Awaited<ReturnType<typeof getTodayDashboardExtras>>;

function fmt(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatTimeInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
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
  size = "default",
}: {
  blockId: string;
  startIso: string;
  serverSeconds: number;
  size?: "default" | "focus";
}) {
  function focusClockState() {
    const s = readFocusSession();
    if (s?.blockId === blockId && s.targetMinutes > 0) {
      const capSec = s.targetMinutes * 60;
      const elapsed = Math.floor(
        (Date.now() - new Date(startIso).getTime()) / 1000,
      );
      return {
        targetMin: s.targetMinutes,
        remainSec: capSec - elapsed,
      };
    }
    return { targetMin: null as number | null, remainSec: 0 };
  }

  const [targetMin, setTargetMin] = useState<number | null>(
    () => focusClockState().targetMin,
  );
  const [remainSec, setRemainSec] = useState(() => focusClockState().remainSec);
  const [elapsedSec, setElapsedSec] = useState(serverSeconds);

  const [clockKey, setClockKey] = useState(`${blockId}:${startIso}`);
  if (`${blockId}:${startIso}` !== clockKey) {
    const next = focusClockState();
    setClockKey(`${blockId}:${startIso}`);
    setTargetMin(next.targetMin);
    setRemainSec(next.remainSec);
  }

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
    size === "focus"
      ? "mono text-[56px] font-semibold leading-none sm:text-[72px]"
      : "mono text-[40px] font-semibold leading-none sm:text-[44px]";

  const centered = size === "focus";

  if (targetMin != null) {
    const over = remainSec < 0;
    return (
      <div
        className={
          centered
            ? "flex w-full flex-col items-center text-center"
            : "min-w-0 flex-1"
        }
        suppressHydrationWarning
      >
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
      className={`${digitsClass} tabular-nums text-tk-cream ${
        centered ? "flex w-full justify-center" : "min-w-0 flex-1"
      }`}
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

type AmRundown = Awaited<ReturnType<typeof getAmRundownData>>;

export function TodayClient({
  initial,
  extras,
  amRundown,
}: {
  initial: Initial;
  extras: Extras;
  amRundown: AmRundown;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const initialRef = useRef(initial);
  useEffect(() => {
    initialRef.current = initial;
  });

  const { data = initial } = useQuery({
    queryKey: ["today"],
    queryFn: async () => {
      const res = await pollTodayData();
      if (!res.ok) {
        router.replace("/login");
        return initialRef.current;
      }
      return res.data;
    },
    initialData: initial,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
    structuralSharing: (prev, next) => {
      if (
        prev &&
        todayDataFingerprint(prev as Initial) === todayDataFingerprint(next as Initial)
      ) {
        return prev;
      }
      return next;
    },
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
  const startCatName =
    activeCats.find((c) => c.id === startCat)?.name ?? "";
  const isStartDeepWork = startCatName === "Deep work";

  const running = data.running;
  const [stopOpen, setStopOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editRow, setEditRow] = useState<TodayBlockRow | null>(null);

  const [stopLabel, setStopLabel] = useState("");
  const [stopCat, setStopCat] = useState("");
  const [stopQuality, setStopQuality] = useState<Quality>("useful");
  const [stopNotes, setStopNotes] = useState("");
  const [stopProjectId, setStopProjectId] = useState("");

  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const manualStartRef = useRef<HTMLInputElement>(null);
  const [manualLabel, setManualLabel] = useState("");
  const [manualCat, setManualCat] = useState("");
  const [manualQuality, setManualQuality] = useState<Quality>("useful");
  const [manualProjectId, setManualProjectId] = useState("");
  const [focusTargetMin, setFocusTargetMin] = useState<number | null>(null);
  const [startIntent, setStartIntent] = useState("");
  const [stopTagIds, setStopTagIds] = useState<string[]>([]);
  const [manualTagIds, setManualTagIds] = useState<string[]>([]);
  const [offDayCheckOpen, setOffDayCheckOpen] = useState(false);

  useEffect(() => {
    if (!manualOpen) return;
    const t = window.setTimeout(() => manualStartRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [manualOpen]);
  const [offDaysIn30, setOffDaysIn30] = useState(0);

  useEffect(() => {
    if (!data.running?.id) return;
    const s = readFocusSession();
    if (s && s.blockId !== data.running.id) clearFocusSession();
  }, [data.running?.id]);

  async function onStart() {
    if (!startCat) {
      toast.error("Add a label first.");
      return;
    }
    const intent =
      isStartDeepWork && startIntent.trim() ? startIntent.trim() : null;

    // --- Optimistic, local-first start (US3) ---
    // Transition to the focus screen immediately; sync to the server in the
    // background. On failure we roll back and surface a recovery path.
    const cat = activeCats.find((c) => c.id === startCat);
    const nowIso = new Date().toISOString();
    const optimisticId = `optimistic-${Date.now()}`;
    const prev = qc.getQueryData<Initial>(["today"]);
    const optimisticRunning: TodayBlockRow = {
      id: optimisticId,
      startAt: nowIso,
      endAt: null,
      label: intent,
      quality: null,
      manualEntry: false,
      categoryId: startCat,
      categoryName: cat?.name ?? startCatName,
      categoryColor: "color" in (cat ?? {}) ? (cat as { color?: string }).color ?? "#8a8167" : "#8a8167",
      isFreeTime: false,
      baseCreditRate: 0,
      credits: null,
      tagNames: [],
    };
    if (prev) {
      qc.setQueryData<Initial>(["today"], {
        ...prev,
        running: optimisticRunning,
        runningElapsedSeconds: 0,
      });
    }
    if (focusTargetMin != null && focusTargetMin > 0) {
      writeFocusSession({ blockId: optimisticId, targetMinutes: focusTargetMin });
    } else {
      clearFocusSession();
    }
    setStartIntent("");

    try {
      const res = await startBlockAction(startCat, null, intent);
      if (!res.ok) {
        // Roll back optimistic state and offer recovery.
        if (prev) qc.setQueryData<Initial>(["today"], prev);
        clearFocusSession();
        toast.error("A block is already running. Stop it first.");
        await qc.invalidateQueries({ queryKey: ["today"] });
        return;
      }
      // Re-point the focus session to the real block id.
      if (focusTargetMin != null && focusTargetMin > 0) {
        writeFocusSession({ blockId: res.blockId, targetMinutes: focusTargetMin });
      }
      await qc.invalidateQueries({ queryKey: ["today"] });
    } catch {
      if (prev) qc.setQueryData<Initial>(["today"], prev);
      clearFocusSession();
      toast.error("Couldn't start the timer. Please try again.");
      await qc.invalidateQueries({ queryKey: ["today"] });
    }
  }

  async function onStopSubmit() {
    if (!running) return;
    if (!stopLabel.trim()) {
      toast.error("Label is required.");
      return;
    }
    const categoryId = stopCat || running.categoryId;
    if (!categoryId) {
      toast.error("Label is required.");
      return;
    }
    try {
      const stopped = await stopBlockAction({
        blockId: running.id,
        categoryId,
        label: stopLabel,
        quality: stopQuality,
        notes: stopNotes || undefined,
        projectId: stopProjectId || null,
        tagIds: stopTagIds,
      });
      clearFocusSession();
      setStopOpen(false);
      setStopLabel("");
      setStopNotes("");
      setStopTagIds([]);
      if (stopped.luckyBonus) {
        toast.success("Lucky block — 1.5× credits");
      } else {
        toast.success("Saved");
      }
      await qc.invalidateQueries({ queryKey: ["today"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not stop timer");
    }
  }

  async function onManualSubmit() {
    if (!manualCat || !manualLabel.trim()) {
      toast.error("Category and label required.");
      return;
    }
    const res = await createManualBlockAction({
      categoryId: manualCat,
      startTime: manualStart,
      endTime: manualEnd,
      label: manualLabel,
      quality: manualQuality,
      projectId: manualProjectId || null,
      tagIds: manualTagIds,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setManualOpen(false);
    setManualLabel("");
    setManualTagIds([]);
    toast.success("Block added");
    await qc.invalidateQueries({ queryKey: ["today"] });
  }

  async function onEditSave() {
    if (!editRow || !editRow.endAt) return;
    if (!editRow.label?.trim()) {
      toast.error("Label required.");
      return;
    }
    const q = normalizeQuality(editRow.quality);
    if (!q) {
      toast.error("Quality required for completed blocks.");
      return;
    }
    const res = await updateBlockAction({
      blockId: editRow.id,
      categoryId: editRow.categoryId,
      startAt: editRow.startAt,
      endAt: editRow.endAt,
      label: editRow.label,
      quality: q,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
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

  function openStopDialog() {
    if (!running) return;
    setStopCat(running.categoryId);
    setStopLabel(running.label ?? running.statedIntent ?? "");
    setStopQuality(normalizeQuality(running.quality) ?? "useful");
    setStopProjectId("");
    setStopTagIds([]);
    setStopOpen(true);
  }

  async function onMarkOffDay() {
    const res = await markOffDayAction();
    if (!res.ok && res.needsCheckIn) {
      setOffDaysIn30(res.offDaysIn30);
      setOffDayCheckOpen(true);
    } else if (!res.ok && res.needsBank) {
      toast.error(res.error ?? "No off days in bank");
    } else if (res.ok) {
      toast.success("Today is an off day");
      await qc.invalidateQueries({ queryKey: ["today"] });
    }
  }

  return (
    <>
      <AmRundownModal
        data={amRundown}
        runningBlockId={running?.id ?? null}
        onNeedStop={openStopDialog}
      />
      <TodayScoreWidget />
      {running ? (
        <FocusModeView
          running={running}
          clock={
            <RunningBlockPrimaryClock
              key={`${running.id}-${data.runningElapsedSeconds}-focus`}
              blockId={running.id}
              startIso={running.startAt}
              serverSeconds={data.runningElapsedSeconds}
              size="focus"
            />
          }
          stopOpen={stopOpen}
          setStopOpen={setStopOpen}
          stopLabel={stopLabel}
          setStopLabel={setStopLabel}
          stopQuality={stopQuality}
          setStopQuality={setStopQuality}
          activeProjects={data.activeProjects}
          stopProjectId={stopProjectId}
          setStopProjectId={setStopProjectId}
          onOpenStop={() => {
            setStopCat(running.categoryId);
            setStopProjectId("");
            setStopTagIds([]);
          }}
          onStopSubmit={() => void onStopSubmit()}
        />
      ) : null}
      <OffDayCheckModal
        open={offDayCheckOpen}
        onOpenChange={setOffDayCheckOpen}
        offDaysIn30={offDaysIn30}
        onDone={() => void qc.invalidateQueries({ queryKey: ["today"] })}
      />
      <div
        className={`flex flex-1 flex-col gap-4 pb-8 ${running ? "hidden" : ""}`}
      >
      <TodayV02Panel
        extras={extras}
        runningBlockId={running?.id ?? null}
        yesterdayNeedsClose={amRundown.mode === "unclosed"}
        onNeedStop={openStopDialog}
      />

      <TodayPinnedTop3 items={extras.pinnedTop3} />
      <TodayV03Panel extras={extras} />

      <TodayHabitsPanel
        habits={extras.habits}
        isOffDay={extras.isOffDay}
        isVacation={extras.isVacation}
      />

      <div className="px-1">
          <div className="text-[22px] font-semibold tracking-tight text-tk-ink">
          {todayLabel}
        </div>
        {extras.isVacation ? (
          <p className="mt-1 text-[12px] text-tk-ink-3">Today is vacation</p>
        ) : extras.isOffDay ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-tk-ink-3">
            <span>Today is an off day</span>
            <RevertOffDayButton
              date={extras.today}
              className="text-[12px] text-tk-honey hover:underline"
            />
          </div>
        ) : null}
      </div>

      {!running ? (
        <>
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
          {isStartDeepWork ? (
            <label className="text-[12px] text-tk-ink-2">
              What are you doing in this block?
              <input
                className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                value={startIntent}
                onChange={(e) => setStartIntent(e.target.value)}
                placeholder="e.g. Draft Q3 OKRs"
              />
            </label>
          ) : null}
          <button
            type="button"
            className="btn-primary py-3 text-[15px]"
            onClick={() => void onStart()}
          >
            Start
          </button>
        </div>

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
                  setManualStart(formatTimeInTz(now, tz));
                  setManualEnd(formatTimeInTz(new Date(now.getTime() + 3600_000), tz));
                  setManualCat(activeCats[0]?.id ?? "");
                }}
              >
                <Plus size={14} /> Manual
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="tk-modal-overlay z-40" />
              <Dialog.Content className="tk-modal-content z-50 overflow-y-auto p-5">
                <Dialog.Title className="text-lg font-semibold text-tk-ink">
                  Manual block
                </Dialog.Title>
                <p className="mt-1 text-[12px] text-tk-ink-3">
                  For today · {todayLabel}
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[12px] text-tk-ink-2">
                      Start time
                      <input
                        ref={manualStartRef}
                        type="time"
                        className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                        value={manualStart}
                        onChange={(e) => setManualStart(e.target.value)}
                      />
                    </label>
                    <label className="text-[12px] text-tk-ink-2">
                      End time
                      <input
                        type="time"
                        className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                        value={manualEnd}
                        onChange={(e) => setManualEnd(e.target.value)}
                      />
                    </label>
                  </div>
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
                  <ProjectPicker
                    projects={data.activeProjects}
                    value={manualProjectId}
                    onChange={setManualProjectId}
                  />
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
                    <QualityPicker
                      value={manualQuality}
                      onChange={setManualQuality}
                      buttonClassName="flex-1 rounded-xl border px-2 py-2 text-[12px]"
                    />
                  </div>
                  {data.tagsEnabled ? (
                    <TagPicker
                      allTags={data.allTags}
                      selectedIds={manualTagIds}
                      onChange={setManualTagIds}
                      onTagsChange={() =>
                        void qc.invalidateQueries({ queryKey: ["today"] })
                      }
                    />
                  ) : null}
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
        </>
      ) : null}

      {data.suspiciousLongRun ? (
        <div className="chip-red text-[12px]">
          Suspiciously long block — forget to stop?
        </div>
      ) : null}

      {!running && data.wastedMinutes > 0 ? (
        <div className="chip-line text-[12px] text-tk-ink-3">
          {Math.floor(data.wastedMinutes / 60) > 0
            ? `${Math.floor(data.wastedMinutes / 60)}h ${data.wastedMinutes % 60}m`
            : `${data.wastedMinutes}m`}{" "}
          wasted so far · untracked time in your active window. Log a block to
          reduce it.
        </div>
      ) : null}

            <details className="group">
        <summary className="cursor-pointer text-[12px] text-tk-ink-3">Today&apos;s log</summary>
      <div className="scroll-y mt-2 flex max-h-[40vh] flex-col gap-2 overflow-y-auto pr-1">
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
                  {b.quality ? ` · ${qualityLabel(b.quality)}` : ""}
                </div>
                {data.tagsEnabled && b.tagNames.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {b.tagNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-md bg-tk-surface-2 px-1.5 py-0.5 text-[10px] text-tk-ink-3"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}
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
                    onClick={() =>
                      setEditRow({
                        ...b,
                        quality: normalizeQuality(b.quality) ?? b.quality,
                      })
                    }
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
      </details>

      <Dialog.Root open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="tk-modal-overlay z-40" />
          <Dialog.Content className="tk-modal-content z-50 overflow-y-auto p-5">
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

      {!extras.dayEnded && !extras.isOffDay ? (
        <button
          type="button"
          className="btn-ghost w-full py-2 text-[12px] text-tk-ink-3"
          onClick={() => void onMarkOffDay()}
        >
          Mark today as off day
        </button>
      ) : null}
    </div>
    </>
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
        <QualityPicker
          value={normalizeQuality(row.quality) ?? "useful"}
          onChange={(v) => onChange({ ...row, quality: v })}
          buttonClassName="flex-1 rounded-xl border px-2 py-2 text-[12px]"
        />
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
