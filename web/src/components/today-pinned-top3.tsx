"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { getTodayDashboardExtras } from "@/actions/today-extras";
import { useCompleteTaskMutation } from "@/lib/mutations/use-task-mutations";
import { queryKeys } from "@/lib/queries/keys";

type Extras = Awaited<ReturnType<typeof getTodayDashboardExtras>>;

export function TodayPinnedTop3({
  items,
}: {
  items: Extras["pinnedTop3"];
}) {
  const qc = useQueryClient();
  const complete = useCompleteTaskMutation();

  if (items.length === 0) return null;

  async function onComplete(taskId: string) {
    try {
      const res = await complete.mutateAsync({ taskId });
      void qc.invalidateQueries({ queryKey: queryKeys.today.all });
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      if (!res) {
        toast.success("Task completed");
        return;
      }
      if (res.showScoreToast) {
        toast.success(`Score +${res.scoreDelta} → ${res.scoreAfter}`);
      } else {
        toast.success("Task completed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete task");
    }
  }

  return (
    <section className="card border border-tk-honey/25 bg-tk-honey/5 p-4">
      <div className="eyebrow text-tk-honey">Today&apos;s top 3</div>
      <ol className="mt-2 space-y-2 pl-0 text-[14px] font-medium text-tk-ink">
        {items.map((t, i) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-tk-line/60 bg-tk-surface/50 px-3 py-2"
          >
            <span>
              <span className="mr-2 text-tk-ink-4">{i + 1}.</span>
              {t.title}
            </span>
            <button
              type="button"
              className="btn-ghost flex shrink-0 items-center gap-1 px-2 py-1 text-[12px] text-tk-green"
              disabled={complete.isPending}
              onClick={() => void onComplete(t.id)}
              aria-label={`Mark ${t.title} done`}
            >
              <Check size={14} /> Done
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-tk-ink-4">
        From last night&apos;s plan
      </p>
    </section>
  );
}
