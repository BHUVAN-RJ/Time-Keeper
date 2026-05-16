"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Square } from "lucide-react";
import { QualityPicker } from "@/components/quality-picker";
import { normalizeQuality, type Quality } from "@/lib/quality";

type Running = {
  id: string;
  categoryName: string;
  label: string | null;
  categoryId: string;
  quality: string | null;
};

export function FocusModeView({
  running,
  clock,
  stopOpen,
  setStopOpen,
  stopLabel,
  setStopLabel,
  stopQuality,
  setStopQuality,
  onOpenStop,
  onStopSubmit,
}: {
  running: Running;
  clock: React.ReactNode;
  stopOpen: boolean;
  setStopOpen: (v: boolean) => void;
  stopLabel: string;
  setStopLabel: (v: string) => void;
  stopQuality: Quality;
  setStopQuality: (v: Quality) => void;
  onOpenStop?: () => void;
  onStopSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-tk-bg-deep">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-16">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-tk-honey">
          <span className="pulse-dot h-2 w-2 rounded-full bg-tk-honey" />
          {running.categoryName}
        </div>
        {running.label ? (
          <p className="mt-3 max-w-md text-center text-[15px] text-tk-ink-2">
            {running.label}
          </p>
        ) : null}
        <div className="mt-10 w-full max-w-lg scale-110">{clock}</div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-tk-line/50 bg-tk-bg-deep/95 p-6 backdrop-blur-sm">
        <Dialog.Root open={stopOpen} onOpenChange={setStopOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="btn-stop mx-auto flex h-14 w-full max-w-md items-center justify-center gap-2 text-[16px] font-semibold"
              onClick={() => {
                onOpenStop?.();
                setStopLabel(running.label ?? "");
                setStopQuality(normalizeQuality(running.quality) ?? "useful");
              }}
              aria-label="Stop timer"
            >
              <Square size={14} fill="currentColor" /> Stop
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/80" />
            <Dialog.Content className="card fixed left-1/2 top-1/2 z-[120] w-[min(100vw-2rem,380px)] -translate-x-1/2 -translate-y-1/2 p-5 shadow-xl">
              <Dialog.Title className="text-lg font-semibold text-tk-ink">
                Stop timer
              </Dialog.Title>
              <div className="mt-4 flex flex-col gap-3">
                <label className="text-[12px] text-tk-ink-2">
                  Label
                  <input
                    className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                    value={stopLabel}
                    onChange={(e) => setStopLabel(e.target.value)}
                    placeholder="What did you do?"
                  />
                </label>
                <div>
                  <div className="text-[12px] text-tk-ink-2">Quality</div>
                  <QualityPicker
                    value={stopQuality}
                    onChange={setStopQuality}
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="btn-ghost px-4 py-2">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  className="btn-primary px-4 py-2"
                  onClick={onStopSubmit}
                >
                  Save
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
}
