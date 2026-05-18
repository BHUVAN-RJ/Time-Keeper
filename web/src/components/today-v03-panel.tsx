"use client";

import Link from "next/link";
import { useState } from "react";
import type { getTodayDashboardExtras } from "@/actions/today-extras";

type Extras = Awaited<ReturnType<typeof getTodayDashboardExtras>>;

export function TodayV03Panel({ extras }: { extras: Extras }) {
  const [dismissCapacity, setDismissCapacity] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {extras.showOffDayRestNudge ? (
        <div className="card border-tk-honey/30 bg-tk-honey/5 p-3 text-[13px] text-tk-ink-2">
          You have {extras.offDaysAvailable} off day
          {extras.offDaysAvailable === 1 ? "" : "s"} banked. When did you last
          actually rest?
          {extras.offDayForfeited > 0 ? (
            <span className="mt-1 block text-[11px] text-tk-ink-4">
              {extras.offDayForfeited} accrual
              {extras.offDayForfeited === 1 ? "" : "s"} forfeited at the cap.
            </span>
          ) : null}
        </div>
      ) : null}

      {extras.capacityWarning && !dismissCapacity ? (
        <div className="card border-amber-500/30 bg-amber-500/5 p-3 text-[13px] text-tk-ink-2">
          You&apos;ve scheduled{" "}
          {(extras.capacityScheduledMinutes / 60).toFixed(1)}h of work; goal is{" "}
          {(extras.capacityGoalMinutes / 60).toFixed(1)}h. Cut something?
          <button
            type="button"
            className="mt-2 block text-[12px] text-tk-honey"
            onClick={() => setDismissCapacity(true)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {extras.weeklyCommitments.length > 0 ? (
        <div className="card p-3">
          <p className="eyebrow text-tk-ink-4">This week&apos;s commitments</p>
          <ul className="mt-2 list-inside list-disc text-[13px] text-tk-ink-2">
            {extras.weeklyCommitments.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {extras.staleProjects.length > 0 ? (
        <div className="card p-3">
          <p className="eyebrow text-tk-ink-4">Stale projects</p>
          <ul className="mt-2 flex flex-col gap-2">
            {extras.staleProjects.slice(0, 3).map((p) => (
              <li key={p.id} className="text-[13px] text-tk-ink-2">
                <span className="font-medium text-tk-ink">{p.name}</span>
                {p.daysSince != null
                  ? ` — no activity in ${p.daysSince} days`
                  : " — no tracked time yet"}
                <Link href="/tasks?view=projects" className="ml-2 text-tk-honey">
                  Decide
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-tk-ink-4">
        Off-day bank: {extras.offDaysAvailable}/5
      </p>
    </div>
  );
}
