"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createTagAction } from "@/actions/tags";
import type { TagRow } from "@/lib/tag-utils";

export function TagPicker({
  allTags,
  selectedIds,
  onChange,
  onTagsChange,
  disabled,
}: {
  allTags: TagRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onTagsChange?: (tags: TagRow[]) => void;
  disabled?: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  async function addTag() {
    const name = newName.trim();
    if (!name) return;
    setPending(true);
    try {
      const tag = await createTagAction(name);
      const next = [...allTags.filter((t) => t.id !== tag.id), tag].sort(
        (a, b) => a.name.localeCompare(b.name),
      );
      onTagsChange?.(next);
      if (!selectedIds.includes(tag.id)) {
        onChange([...selectedIds, tag.id]);
      }
      setNewName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add tag");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[12px] text-tk-ink-2">Tags</div>
      <p className="text-[11px] text-tk-ink-4">
        Optional — group time for stats (e.g. thesis, course, admin).
      </p>
      {allTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((t) => {
            const on = selectedIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(t.id)}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  on
                    ? "bg-tk-honey/20 text-tk-honey ring-1 ring-tk-honey/40"
                    : "bg-tk-surface-2 text-tk-ink-3 hover:text-tk-ink-2"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-tk-ink-4">No tags yet — add one below.</p>
      )}
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-1.5 text-[12px] text-tk-ink"
          placeholder="New tag"
          value={newName}
          disabled={disabled || pending}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addTag();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || pending || !newName.trim()}
          className="btn-ghost shrink-0 px-2 py-1.5 text-[11px]"
          onClick={() => void addTag()}
        >
          Add
        </button>
      </div>
    </div>
  );
}
