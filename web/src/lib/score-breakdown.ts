import type { DaySnapshot } from "@/lib/day-compute";

export type ScoreBreakdownView = DaySnapshot["scoreBreakdown"];

export function formatScoreBreakdown(b: ScoreBreakdownView) {
  return [
    { label: "Time goals", value: b.timeComponent, detail: `${b.goalHitPercent}% hit` },
    { label: "Habits", value: b.habitComponent, detail: `${b.habitsPercent}%` },
    { label: "Tasks", value: b.taskComponent, detail: `${b.taskScore}%` },
    { label: "Quality", value: b.qualityComponent, detail: `${b.qualityScore}%` },
  ];
}
