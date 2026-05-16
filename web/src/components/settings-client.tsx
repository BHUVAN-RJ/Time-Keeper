"use client";

import Link from "next/link";
import { useState } from "react";
import {
  getShowScoreOnToday,
  setShowScoreOnToday,
} from "@/lib/display-settings";

export function SettingsClient() {
  const [showScore, setShowScore] = useState(() =>
    typeof window !== "undefined" ? getShowScoreOnToday() : false,
  );

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">Settings</h1>
      </div>

      <section className="card p-4">
        <h2 className="text-[13px] font-semibold text-tk-ink">Display</h2>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={showScore}
            onChange={(e) => {
              setShowScore(e.target.checked);
              setShowScoreOnToday(e.target.checked);
            }}
          />
          <span className="text-[13px] text-tk-ink-2">
            Show productivity score on Today screen
            <span
              className="mt-1 block text-[11px] text-tk-ink-4"
              title="Off by default — research suggests constant score visibility can either dull reward or compound stress. Enable if you want it anyway."
            >
              Off by default. Small widget top-right when enabled — never the
              main focus.
            </span>
          </span>
        </label>
      </section>

      <Link href="/today" className="btn-ghost text-center text-[13px]">
        Back to Today
      </Link>
    </div>
  );
}
