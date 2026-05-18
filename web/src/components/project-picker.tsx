"use client";

export type ProjectOption = { id: string; name: string };

export function ProjectPicker({
  projects,
  value,
  onChange,
  label = "Project",
  className = "",
}: {
  projects: ProjectOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
}) {
  if (projects.length === 0) return null;

  return (
    <label className={`flex flex-col text-[11px] text-tk-ink-3 ${className}`}>
      {label}
      <select
        className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[13px] text-tk-ink"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— None —</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
