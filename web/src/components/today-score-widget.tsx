"use client";

import { useEffect, useState } from "react";
import { getTodayProductivityScore } from "@/actions/score-snapshot";
import { getShowScoreOnToday } from "@/lib/display-settings";

export function TodayScoreWidget() {
  const [enabled, setEnabled] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setEnabled(getShowScoreOnToday());
    sync();
    window.addEventListener("tk-display-settings", sync);
    return () => window.removeEventListener("tk-display-settings", sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void getTodayProductivityScore().then((r) => {
      if (r.hasActivity) setScore(r.score);
      else setScore(null);
    });
  }, [enabled]);

  if (!enabled || score == null) return null;

  return (
    <div className="fixed right-4 top-[4.5rem] z-30 rounded-xl border border-tk-line bg-tk-surface/95 px-3 py-2 text-right shadow-lg backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-wider text-tk-ink-4">Score</div>
      <div className="mono text-[18px] font-semibold text-tk-honey">{score}</div>
    </div>
  );
}
