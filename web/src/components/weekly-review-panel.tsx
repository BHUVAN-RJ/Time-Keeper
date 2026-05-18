"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getWeeklyReviewDraft,
  submitWeeklyReviewAction,
} from "@/actions/weekly-review";
import { CategoryMinutesBars } from "@/components/category-minutes-bars";
import { EstimateAccuracyTrend } from "@/components/estimate-accuracy-trend";

export function WeeklyReviewPanel({
  weekStarting,
  onCompleted,
  embedded = false,
}: {
  weekStarting: string;
  onCompleted?: () => void;
  /** Inside Week collapsible — no outer card border. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Awaited<
    ReturnType<typeof getWeeklyReviewDraft>
  > | null>(null);
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [habitNote, setHabitNote] = useState("");
  const [dropId, setDropId] = useState<string>("");
  const [retireChosen, setRetireChosen] = useState(false);
  const [retireReason, setRetireReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void getWeeklyReviewDraft(weekStarting).then((d) => {
      setDraft(d);
      const [a, b, c] = d.commitments;
      setC1(a ?? "");
      setC2(b ?? "");
      setC3(c ?? "");
      setHabitNote(d.habitChangeNote);
      setDropId(d.droppedProjectId ?? "");
    });
  }, [weekStarting]);

  async function submit() {
    setPending(true);
    try {
      await submitWeeklyReviewAction({
        weekStarting,
        commitments: [c1, c2, c3],
        habitChangeNote: habitNote,
        droppedProjectId: dropId || null,
        retireDropped: retireChosen && !!dropId && !!retireReason.trim(),
        retireReason,
      });
      toast.success("Weekly review saved");
      onCompleted?.();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!draft) {
    return (
      <p className="p-4 text-[13px] text-tk-ink-3">
        Loading weekly retrospective…
      </p>
    );
  }

  return (
    <section
      className={
        embedded
          ? "flex flex-col gap-4 px-4 pb-4 pt-2"
          : "card flex flex-col gap-4 p-4"
      }
    >
      <div>
        <h2 className="text-[15px] font-semibold text-tk-ink">
          Weekly retrospective
        </h2>
        <p className="mt-0.5 text-[12px] text-tk-ink-3">
          {draft.weekStarting} → {draft.weekEnd}
        </p>
      </div>

      <div className="space-y-2 text-[13px] text-tk-ink-2">
        {draft.avgScore != null ? (
          <p>
            Avg productivity score:{" "}
            <span className="mono font-medium text-tk-honey">{draft.avgScore}</span>
          </p>
        ) : null}
        <p>
          Tasks: {draft.tasksCompleted} completed, {draft.tasksDropped} dropped
        </p>
        {draft.avoidanceTask ? (
          <p>
            Most rescheduled: {draft.avoidanceTask.title} (
            {draft.avoidanceTask.rescheduleCount}×)
          </p>
        ) : null}
      </div>

      {draft.categoryTotals.length > 0 ? (
        <div>
          <p className="eyebrow text-tk-ink-4">Time by category</p>
          <div className="mt-2">
            <CategoryMinutesBars rows={draft.categoryTotals} emptyMessage="" />
          </div>
        </div>
      ) : null}

      <div>
        <p className="eyebrow text-tk-ink-4">Estimate accuracy (4 weeks)</p>
        <div className="mt-2">
          <EstimateAccuracyTrend weeks={draft.estimateAccuracyTrend} />
        </div>
      </div>

      {draft.staleProjects.length > 0 ? (
        <div>
          <p className="eyebrow text-tk-ink-4">Stale projects</p>
          <ul className="mt-2 flex flex-col gap-2 text-[13px] text-tk-ink-2">
            {draft.staleProjects.map((s) => (
              <li key={s.project.id}>
                <span className="font-medium text-tk-ink">{s.project.name}</span>
                {s.daysSince != null ? (
                  <span className="text-tk-ink-3">
                    {" "}
                    — no activity in {s.daysSince} days
                  </span>
                ) : (
                  <span className="text-tk-ink-3"> — no tracked time yet</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="block text-[12px] text-tk-ink-4">
        Project to drop or pause
        <select
          className="input mt-1 w-full"
          value={dropId}
          onChange={(e) => {
            const id = e.target.value;
            setDropId(id);
            if (!id) {
              setRetireChosen(false);
              setRetireReason("");
            }
          }}
        >
          <option value="">None</option>
          {draft.activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {dropId ? (
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-tk-ink-2">
          <input
            type="checkbox"
            checked={retireChosen}
            onChange={(e) => {
              setRetireChosen(e.target.checked);
              if (!e.target.checked) setRetireReason("");
            }}
          />
          Retire this project
        </label>
      ) : null}
      {dropId && retireChosen ? (
        <label className="block text-[12px] text-tk-ink-4">
          Why retire?
          <textarea
            className="input mt-1 w-full text-[13px]"
            rows={2}
            placeholder="Required to retire"
            value={retireReason}
            onChange={(e) => setRetireReason(e.target.value)}
            autoFocus
          />
        </label>
      ) : null}

      <label className="block text-[12px] text-tk-ink-4">
        One habit to change
        <input
          className="input mt-1 w-full"
          value={habitNote}
          onChange={(e) => setHabitNote(e.target.value)}
        />
      </label>

      <div>
        <p className="eyebrow text-tk-ink-4">Three commitments</p>
        {[c1, c2, c3].map((v, i) => (
          <input
            key={i}
            className="input mt-2 w-full"
            placeholder={`Commitment ${i + 1}`}
            value={i === 0 ? c1 : i === 1 ? c2 : c3}
            onChange={(e) => {
              if (i === 0) setC1(e.target.value);
              else if (i === 1) setC2(e.target.value);
              else setC3(e.target.value);
            }}
          />
        ))}
      </div>

      <button
        type="button"
        className="btn-primary w-full py-2 text-[13px]"
        disabled={pending}
        onClick={() => void submit()}
      >
        Save review
      </button>
    </section>
  );
}
