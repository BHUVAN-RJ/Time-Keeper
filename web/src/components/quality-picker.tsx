"use client";

import type { Quality } from "@/lib/quality";
import { MEH_HINT, QUALITY_OPTIONS } from "@/lib/quality";

export function QualityPicker({
  value,
  onChange,
  buttonClassName = "flex-1 rounded-xl border px-2 py-2 text-[12px] font-medium",
}: {
  value: Quality;
  onChange: (q: Quality) => void;
  buttonClassName?: string;
}) {
  return (
    <div>
      <div className="mt-1 flex flex-wrap gap-2">
        {QUALITY_OPTIONS.map(({ value: v, label }) => (
          <button
            key={v}
            type="button"
            className={`${buttonClassName} ${
              value === v
                ? "border-tk-honey bg-tk-honey/15 text-tk-honey"
                : "border-tk-line text-tk-ink-2"
            }`}
            onClick={() => onChange(v)}
          >
            {label}
          </button>
        ))}
      </div>
      {value === "meh" ? (
        <p className="mt-1.5 text-[11px] text-tk-ink-4">{MEH_HINT}</p>
      ) : null}
    </div>
  );
}
