"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createTaskFromQuickAddAction } from "@/actions/tasks";
import { QuickAddContext } from "@/components/quick-add-context";
import { parseQuickAdd } from "@/lib/quick-add-parse";

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      return parseQuickAdd(raw);
    } catch {
      return null;
    }
  }, [raw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onConfirm() {
    if (!raw.trim()) return;
    setPending(true);
    try {
      await createTaskFromQuickAddAction(raw);
      toast.success("Task created");
      setRaw("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse");
    } finally {
      setPending(false);
    }
  }

  return (
    <QuickAddContext.Provider value={{ openQuickAdd: () => setOpen(true) }}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
          <Dialog.Content className="card fixed left-1/2 top-[20%] z-50 w-[min(100vw-2rem,400px)] -translate-x-1/2 p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-tk-ink">
              Quick add task
            </Dialog.Title>
            <p className="mt-1 text-[12px] text-tk-ink-3">
              Natural language — order flexible. Examples:
            </p>
            <ul className="mt-2 list-inside list-disc text-[11px] text-tk-ink-3">
              <li>
                <span className="text-tk-ink-2">fix login bug 45m important due fri</span>
              </li>
              <li>
                <span className="text-tk-ink-2">urgent review PR due tomorrow</span>
              </li>
              <li>
                <span className="text-tk-ink-2">email dentist</span> (defaults 30m)
              </li>
            </ul>
            <input
              autoFocus
              className="mt-3 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
              placeholder="What needs doing?"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onConfirm();
              }}
            />
            {preview ? (
              <div className="mt-3 rounded-xl bg-tk-surface-2 p-3 text-[12px] text-tk-ink-2">
                <div className="font-medium text-tk-ink">{preview.title}</div>
                <div className="mt-1">
                  {preview.estimateMinutes}m · importance {preview.importance} · urgency{" "}
                  {preview.urgency}
                  {preview.dueDate ? ` · due ${preview.dueDate}` : ""}
                </div>
              </div>
            ) : raw.trim() ? (
              <p className="mt-2 text-[11px] text-tk-red/90">
                Add a short title after the keywords.
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="btn-ghost px-4 py-2">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="btn-primary px-4 py-2"
                disabled={pending || !preview}
                onClick={() => void onConfirm()}
              >
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </QuickAddContext.Provider>
  );
}
