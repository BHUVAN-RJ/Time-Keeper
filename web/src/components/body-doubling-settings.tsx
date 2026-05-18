"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  setBodyDoublingInterval,
  type BodyDoublingInterval,
} from "@/actions/preferences";

const OPTIONS: { value: BodyDoublingInterval; label: string }[] = [
  { value: 0, label: "Off" },
  { value: 30, label: "Every 30 min" },
  { value: 60, label: "Every 60 min" },
  { value: 90, label: "Every 90 min" },
];

export function BodyDoublingSettings({
  initialInterval,
}: {
  initialInterval: BodyDoublingInterval;
}) {
  const [interval, setInterval] = useState(initialInterval);
  const [pending, setPending] = useState(false);

  async function save(next: BodyDoublingInterval) {
    setPending(true);
    try {
      await setBodyDoublingInterval(next);
      setInterval(next);
      toast.success("Body doubling updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold text-tk-ink">Body doubling</h2>
      <p className="mt-1 text-[12px] text-tk-ink-3">
        When you start deep work with a stated intent, Time Keeper pings you on
        this interval: &quot;Still on it?&quot; Non-blocking banner only.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={pending}
            className={`rounded-lg px-3 py-2 text-[12px] font-medium ${
              interval === o.value
                ? "bg-tk-honey/20 text-tk-honey ring-1 ring-tk-honey/40"
                : "bg-tk-surface-2 text-tk-ink-3 hover:text-tk-ink-2"
            }`}
            onClick={() => void save(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}
