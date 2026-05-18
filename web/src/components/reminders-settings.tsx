"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setRemindersEnabled } from "@/actions/preferences";

export function RemindersSettings({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function onToggle(next: boolean) {
    setEnabled(next);
    setPending(true);
    try {
      await setRemindersEnabled(next);
      toast.success(next ? "Reminders enabled" : "Reminders hidden");
    } catch (e) {
      setEnabled(!next);
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold text-tk-ink">Reminders</h2>
      <p className="mt-1 text-[12px] text-tk-ink-3">
        Optional in-app reminders with a header bell and due banner. Off by
        default.
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
          Show reminders in the app
          <span className="mt-1 block text-[11px] text-tk-ink-4">
            When on, use the bell in the header or Settings to manage reminders.
          </span>
        </span>
      </label>
    </section>
  );
}
