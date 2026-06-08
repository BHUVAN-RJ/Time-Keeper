"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setActiveWindowAction } from "@/actions/preferences";

export function ActiveWindowSettings({
  initialStart,
  initialEnd,
}: {
  initialStart: string;
  initialEnd: string;
}) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [saving, setSaving] = useState(false);

  const dirty = start !== initialStart || end !== initialEnd;

  async function onSave() {
    setSaving(true);
    try {
      const res = await setActiveWindowAction(start, end);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Active window saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold text-tk-ink">Active window</h2>
      <p className="mt-1 text-[12px] text-tk-ink-3">
        Untracked time inside this window counts as wasted time and reduces your
        day&apos;s productivity. Logging a block over a gap reduces it
        automatically. Default 9:00 AM–9:00 PM.
      </p>
      <div className="mt-4 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-tk-ink-2">
          Start
          <input
            type="time"
            className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-tk-ink-2">
          End
          <input
            type="time"
            className="rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        className="btn-primary mt-3 w-full py-2 text-[13px]"
        disabled={saving || !dirty}
        onClick={() => void onSave()}
      >
        Save active window
      </button>
    </section>
  );
}
