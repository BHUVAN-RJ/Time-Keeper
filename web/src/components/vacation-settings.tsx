"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  applyVacationRangeAction,
  clearVacationRangeAction,
} from "@/actions/vacations";

export function VacationSettings({
  today,
  upcomingVacationDates,
}: {
  today: string;
  upcomingVacationDates: string[];
}) {
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [pending, setPending] = useState(false);

  async function onApply() {
    setPending(true);
    try {
      const res = await applyVacationRangeAction(start, end);
      toast.success(`Marked ${res.days} day${res.days === 1 ? "" : "s"} as vacation`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply");
    } finally {
      setPending(false);
    }
  }

  async function onClear() {
    setPending(true);
    try {
      const res = await clearVacationRangeAction(start, end);
      toast.success(`Cleared vacation on ${res.days} day${res.days === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold text-tk-ink">Vacation</h2>
      <p className="mt-1 text-[12px] text-tk-ink-3">
        Mark a date range as vacation. Those days are excluded from red-day logic
        and rolling averages (like off days, without spending your off-day bank).
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex flex-col text-[11px] text-tk-ink-3">
          From
          <input
            type="date"
            className="mt-1 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="flex flex-col text-[11px] text-tk-ink-3">
          To
          <input
            type="date"
            className="mt-1 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="btn-primary px-3 py-1.5 text-[12px]"
          onClick={() => void onApply()}
        >
          Apply vacation
        </button>
        <button
          type="button"
          disabled={pending}
          className="btn-ghost px-3 py-1.5 text-[12px]"
          onClick={() => void onClear()}
        >
          Clear range
        </button>
      </div>
      {upcomingVacationDates.length > 0 ? (
        <p className="mt-3 text-[11px] text-tk-ink-4">
          Upcoming vacation days: {upcomingVacationDates.slice(0, 14).join(", ")}
          {upcomingVacationDates.length > 14
            ? ` (+${upcomingVacationDates.length - 14} more)`
            : ""}
        </p>
      ) : null}
    </section>
  );
}
