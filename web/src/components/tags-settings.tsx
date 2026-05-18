"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setTagsEnabled } from "@/actions/preferences";

export function TagsSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function onToggle(next: boolean) {
    setEnabled(next);
    setPending(true);
    try {
      await setTagsEnabled(next);
      toast.success(next ? "Tags enabled" : "Tags hidden");
    } catch (e) {
      setEnabled(!next);
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold text-tk-ink">Tags</h2>
      <p className="mt-1 text-[12px] text-tk-ink-3">
        Optional labels on tasks and time blocks for grouping and the month
        tag breakdown.
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={enabled}
          disabled={pending}
          onChange={(e) => void onToggle(e.target.checked)}
        />
        <span className="text-[13px] text-tk-ink-2">
          Show tags when creating tasks and stopping timers
          <span className="mt-1 block text-[11px] text-tk-ink-4">
            Off hides tag fields app-wide. Existing tagged data is kept if you
            turn tags back on.
          </span>
        </span>
      </label>
    </section>
  );
}
