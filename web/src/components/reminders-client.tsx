"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  acknowledgeReminderAction,
  createReminderAction,
  deleteReminderAction,
  getRemindersPageData,
  snoozeReminderAction,
  updateReminderAction,
  type ReminderView,
} from "@/actions/reminders";
import { queryKeys } from "@/lib/queries/keys";
import type { RecurringKind } from "@/lib/reminders";

type RemindersData = Awaited<ReturnType<typeof getRemindersPageData>>;

export function RemindersClient({
  initial,
}: {
  initial: RemindersData;
}) {
  const qc = useQueryClient();
  const { data = initial } = useQuery({
    queryKey: queryKeys.reminders.all,
    queryFn: getRemindersPageData,
    initialData: initial,
    staleTime: 30_000,
  });

  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState(data.defaultRemindAtLocal);
  const [recurring, setRecurring] = useState<"" | RecurringKind>("");

  function invalidateReminders() {
    void qc.invalidateQueries({ queryKey: queryKeys.reminders.all });
  }

  const createReminder = useMutation({
    mutationFn: () =>
      createReminderAction({
        title: title.trim(),
        remindAtLocal: remindAt,
        recurring: recurring || null,
      }),
    onSuccess: () => {
      setTitle("");
      setRemindAt(data.defaultRemindAtLocal);
      setRecurring("");
      toast.success("Reminder created");
      invalidateReminders();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not create");
    },
  });

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createReminder.mutate();
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">Reminders</h1>
        <p className="mt-1 text-[13px] text-tk-ink-3">
          In-app only. Due reminders show a banner until you acknowledge or
          snooze.
        </p>
      </div>

      <form onSubmit={onCreate} className="card flex flex-col gap-3 p-4">
        <div className="eyebrow">New reminder</div>
        <input
          className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-[11px] text-tk-ink-3">
            When
            <input
              type="datetime-local"
              className="mt-1 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-[11px] text-tk-ink-3">
            Repeat
            <select
              className="mt-1 min-w-[120px] rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
              value={recurring}
              onChange={(e) =>
                setRecurring(e.target.value as "" | RecurringKind)
              }
            >
              <option value="">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={createReminder.isPending}
          className="btn-primary self-start"
        >
          Add reminder
        </button>
      </form>

      <section>
        <h2 className="eyebrow mb-2">Upcoming</h2>
        {data.upcoming.length === 0 ? (
          <p className="text-[13px] text-tk-ink-3">No upcoming reminders.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.upcoming.map((r) => (
              <ReminderRowCard
                key={r.id}
                reminder={r}
                onChange={invalidateReminders}
              />
            ))}
          </ul>
        )}
      </section>

      {data.past.length > 0 ? (
        <section>
          <h2 className="eyebrow mb-2">Recently done</h2>
          <ul className="flex flex-col gap-2 opacity-80">
            {data.past.map((r) => (
              <li key={r.id} className="card p-3 text-[13px] text-tk-ink-3">
                <span className="text-tk-ink">{r.title}</span>
                <span className="ml-2">· {r.remindAtLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReminderRowCard({
  reminder,
  onChange,
}: {
  reminder: ReminderView;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reminder.title);
  const [remindAt, setRemindAt] = useState(reminder.remindAtLocal);
  const [recurring, setRecurring] = useState<"" | RecurringKind>(
    reminder.recurring ?? "",
  );

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setTitle(reminder.title);
    setRemindAt(reminder.remindAtLocal);
    setRecurring(reminder.recurring ?? "");
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await run(async () => {
      await updateReminderAction({
        id: reminder.id,
        title: title.trim(),
        remindAtLocal: remindAt,
        recurring: recurring || null,
      });
      setEditing(false);
      toast.success("Reminder updated");
    });
  }

  return (
    <li
      className={`card flex flex-col gap-2 p-3 ${
        reminder.due ? "border-tk-honey/40" : ""
      }`}
    >
      {editing ? (
        <form onSubmit={(e) => void onSaveEdit(e)} className="flex flex-col gap-3">
          <input
            className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[13px] text-tk-ink"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col text-[11px] text-tk-ink-3">
              When
              <input
                type="datetime-local"
                className="mt-1 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="flex flex-col text-[11px] text-tk-ink-3">
              Repeat
              <select
                className="mt-1 min-w-[120px] rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                value={recurring}
                onChange={(e) =>
                  setRecurring(e.target.value as "" | RecurringKind)
                }
                disabled={busy}
              >
                <option value="">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary px-3 py-1.5 text-[12px]"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              className="btn-ghost px-3 py-1.5 text-[12px]"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-tk-ink">{reminder.title}</p>
              <p className="mt-0.5 text-[12px] text-tk-ink-3">
                {reminder.remindAtLabel}
                {reminder.recurring ? ` · ${reminder.recurring}` : ""}
                {reminder.due ? (
                  <span className="ml-1.5 text-tk-honey">· due now</span>
                ) : null}
                {reminder.snoozedLabel ? (
                  <span className="mt-0.5 block text-[11px] text-tk-ink-4">
                    Snoozed until {reminder.snoozedLabel}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={busy}
                className="btn-ghost px-2 py-1 text-[11px]"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn-ghost px-2 py-1 text-[11px] text-tk-warn"
                onClick={() =>
                  run(async () => {
                    await deleteReminderAction(reminder.id);
                    toast.success("Deleted");
                  })
                }
              >
                Delete
              </button>
            </div>
          </div>
          {reminder.due ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="btn-primary px-3 py-1.5 text-[12px]"
                onClick={() =>
                  run(async () => {
                    await acknowledgeReminderAction(reminder.id);
                    toast.success("Acknowledged");
                  })
                }
              >
                Done
              </button>
              {(["10m", "1h", "tomorrow"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={busy}
                  className="btn-ghost px-2.5 py-1 text-[11px]"
                  onClick={() =>
                    run(async () => {
                      await snoozeReminderAction(reminder.id, kind);
                      toast.success("Snoozed");
                    })
                  }
                >
                  {kind === "10m"
                    ? "10 min"
                    : kind === "1h"
                      ? "1 hr"
                      : "Tomorrow"}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </li>
  );
}
