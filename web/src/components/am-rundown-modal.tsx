"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  batchCloseUnclosedDaysAction,
  dismissAmRundownAction,
  getAmRundownData,
} from "@/actions/am-rundown";
import { EndDayDialog } from "@/components/end-day-dialog";
import { RitualModal } from "@/components/ritual-modal";
import {
  useAmRundownQuery,
  type AmRundownData,
} from "@/lib/queries/am-rundown";
import { queryKeys } from "@/lib/queries/keys";

export function AmRundownModal({
  initialData,
  runningBlockId,
  onNeedStop,
}: {
  initialData: AmRundownData;
  runningBlockId: string | null;
  onNeedStop: () => void;
}) {
  const qc = useQueryClient();
  const { data: queryData } = useAmRundownQuery(initialData);
  const data = queryData ?? initialData;

  const [openOverride, setOpenOverride] = useState<boolean | null>(null);

  function refreshSynced() {
    void qc.invalidateQueries({ queryKey: queryKeys.amRundown.all });
    void qc.invalidateQueries({ queryKey: queryKeys.today.all });
    void qc.invalidateQueries({ queryKey: queryKeys.week.all });
  }

  const [pending, setPending] = useState(false);
  const [batchPending, setBatchPending] = useState(false);
  const [closeCatchUpOpen, setCloseCatchUpOpen] = useState(false);
  const [modeOverride, setModeOverride] = useState<AmRundownData["mode"] | null>(
    null,
  );

  const effectiveMode =
    data.mode !== "unclosed" ? data.mode : (modeOverride ?? data.mode);

  const [prevEffectiveMode, setPrevEffectiveMode] = useState(effectiveMode);
  if (effectiveMode !== prevEffectiveMode) {
    setPrevEffectiveMode(effectiveMode);
    setOpenOverride(null);
  }

  const open = openOverride ?? effectiveMode !== "hidden";

  const displayData = useMemo(
    () => (modeOverride ? { ...data, mode: modeOverride } : data),
    [data, modeOverride],
  );

  if (effectiveMode === "hidden") return null;

  async function onStartDay() {
    setPending(true);
    try {
      qc.setQueryData(queryKeys.amRundown.all, {
        ...data,
        mode: "hidden" as const,
      });
      await dismissAmRundownAction();
      setOpenOverride(false);
      refreshSynced();
    } finally {
      setPending(false);
    }
  }

  async function onCatchUpClosed() {
    setCloseCatchUpOpen(false);
    const fresh = await getAmRundownData();
    qc.setQueryData(queryKeys.amRundown.all, fresh);
    if (fresh.mode === "unclosed") {
      toast.error("Day did not save — try closing again.");
      setModeOverride(null);
      setOpenOverride(true);
      refreshSynced();
      return;
    }
    setModeOverride(fresh.mode);
    setOpenOverride(fresh.mode !== "hidden");
    refreshSynced();
  }

  async function onBatchClose() {
    const n = data.unclosedDays.length;
    if (
      n > 1 &&
      !confirm(
        `Close ${n} days in order (oldest first)? Incomplete tasks move to the next day.`,
      )
    ) {
      return;
    }
    setBatchPending(true);
    try {
      const res = await batchCloseUnclosedDaysAction();
      toast.success(
        res.closed === 0
          ? "No days left to close"
          : `Closed ${res.closed} day${res.closed === 1 ? "" : "s"}`,
      );
      const fresh = await getAmRundownData();
      qc.setQueryData(queryKeys.amRundown.all, fresh);
      setModeOverride(fresh.mode);
      setOpenOverride(fresh.mode !== "hidden");
      refreshSynced();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch close failed");
    } finally {
      setBatchPending(false);
    }
  }

  const unclosedCount = data.unclosedDays.length;
  const title =
    effectiveMode === "unclosed"
      ? unclosedCount === 1
        ? "A day wasn't closed"
        : `${unclosedCount} days weren't closed`
      : "Good morning";
  const description = data.today;

  return (
    <>
      <RitualModal
        open={open && !closeCatchUpOpen}
        onOpenChange={(next) => {
          if (effectiveMode === "unclosed") return;
          setOpenOverride(next);
        }}
        title={title}
        description={description}
        dismissible={effectiveMode !== "unclosed"}
        footer={
          effectiveMode === "rundown" ? (
            <button
              type="button"
              className="btn-primary w-full py-3"
              disabled={pending}
              onClick={() => void onStartDay()}
            >
              Start the day
            </button>
          ) : effectiveMode === "unclosed" ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary w-full py-3"
                onClick={() => setCloseCatchUpOpen(true)}
              >
                Close {data.closeTarget} now
              </button>
              {unclosedCount > 1 ? (
                <button
                  type="button"
                  className="btn-ghost w-full py-2 text-[13px]"
                  disabled={batchPending}
                  onClick={() => void onBatchClose()}
                >
                  {batchPending
                    ? "Closing…"
                    : `Close all ${unclosedCount} days (oldest first)`}
                </button>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {effectiveMode === "unclosed" ? (
          <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-tk-ink-2">
            <p>
              Close unclosed days before starting today so scores and habits stay
              accurate.
            </p>
            <ul className="flex flex-col gap-1 rounded-lg border border-tk-line bg-tk-surface-2 p-3 text-[13px]">
              {data.unclosedDays.map((d) => (
                <li key={d} className="flex justify-between gap-2">
                  <span className="font-medium text-tk-ink">{d}</span>
                  {d === data.closeTarget ? (
                    <span className="text-[11px] text-tk-honey">next</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <RundownBody data={displayData} />
        )}
      </RitualModal>

      <EndDayDialog
        open={closeCatchUpOpen}
        onOpenChange={setCloseCatchUpOpen}
        runningBlockId={runningBlockId}
        onNeedStop={onNeedStop}
        closeDate={data.closeTarget}
        title={data.closeTarget === data.yesterday ? "Close yesterday" : "Close day"}
        onSuccess={onCatchUpClosed}
      />
    </>
  );
}

function RundownBody({ data }: { data: AmRundownData }) {
  return (
    <div className="flex flex-col gap-5">
      {data.rollingAvg != null ? (
        <section>
          <div className="eyebrow">Your baseline</div>
          <p className="mt-1 text-[14px] text-tk-ink-2">
            Recent 7-day avg:{" "}
            <span className="mono font-semibold text-tk-honey">
              {data.rollingAvg}
            </span>
          </p>
        </section>
      ) : null}

      {(data.yesterdayScore != null || data.yesterdayCredits) && (
        <section>
          <div className="eyebrow">Yesterday</div>
          <p className="mt-1 text-[13px] text-tk-ink-2">
            {data.yesterdayScore != null ? (
              <>
                Score{" "}
                <span className="mono font-medium text-tk-ink">
                  {data.yesterdayScore}
                </span>
              </>
            ) : null}
            {data.yesterdayCredits ? (
              <>
                {data.yesterdayScore != null ? " · " : null}
                Credits {data.yesterdayCredits}
              </>
            ) : null}
          </p>
          {data.yesterdayHabits.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-0.5 text-[12px]">
              {data.yesterdayHabits.map((h) => (
                <li
                  key={h.id}
                  className={h.hit ? "text-tk-green" : "text-tk-red/90"}
                >
                  {h.offDaySkipped ? "☁ " : h.hit ? "✓ " : "○ "}
                  {h.name} ({h.count}/{h.targetPerDay}
                  {h.freezeUsed ? " ❄" : ""})
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}

      {data.pinnedTop3.length > 0 ? (
        <section>
          <div className="eyebrow">Today&apos;s top 3</div>
          <ol className="mt-2 list-decimal pl-5 text-[13px] text-tk-ink">
            {data.pinnedTop3.map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {data.scheduledToday.length > 0 ? (
        <section>
          <div className="eyebrow">Scheduled today</div>
          <ul className="mt-2 flex flex-col gap-1 text-[12px] text-tk-ink-2">
            {data.scheduledToday.slice(0, 8).map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.dueToday.length > 0 ? (
        <section>
          <div className="eyebrow">Due today</div>
          <ul className="mt-2 flex flex-col gap-1 text-[12px] text-tk-ink-2">
            {data.dueToday.slice(0, 8).map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.remindersToday.length > 0 ? (
        <section>
          <div className="eyebrow">Reminders today</div>
          <ul className="mt-2 flex flex-col gap-1 text-[12px] text-tk-ink-2">
            {data.remindersToday.map((r) => (
              <li key={r.id}>
                {r.title}{" "}
                <span className="text-tk-ink-4">({r.when})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.todayHabits.length > 0 ? (
        <section>
          <div className="eyebrow">Habits</div>
          {data.todayIsOffDay ? (
            <p className="mt-1 text-[12px] text-tk-ink-3">
              Off day — habits paused (no ❄ used)
            </p>
          ) : null}
          <ul className="mt-2 flex flex-col gap-1 text-[12px] text-tk-ink-2">
            {data.todayHabits.map((h) => (
              <li key={h.id}>
                {h.name}{" "}
                <span className="text-tk-ink-4">
                  {h.offDayPaused
                    ? "(rest day)"
                    : `(${h.todayCount}/${h.targetPerDay})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.calendarMeta.connected &&
      (data.calendarToday.length > 0 || data.calendarTomorrow.length > 0) ? (
        <section>
          <div className="eyebrow">Calendar</div>
          {data.calendarToday.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 text-[12px] text-tk-ink-2">
              {data.calendarToday.map((ev) => (
                <li key={ev.id}>
                  Today: <span className="text-tk-ink">{ev.title}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {data.calendarTomorrow.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 text-[12px] text-tk-ink-3">
              {data.calendarTomorrow.map((ev) => (
                <li key={ev.id}>
                  Tomorrow: <span className="text-tk-ink">{ev.title}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
