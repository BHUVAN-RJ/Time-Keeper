"use client";

import { Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { ProjectPicker } from "@/components/project-picker";
import { QualityPicker } from "@/components/quality-picker";
import type { ProjectOption } from "@/components/project-picker";
import { normalizeQuality, type Quality } from "@/lib/quality";

type Running = {
  id: string;
  categoryName: string;
  label: string | null;
  statedIntent?: string | null;
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
  activeProjects = [],
  stopProjectId,
  setStopProjectId,
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
  activeProjects?: ProjectOption[];
  stopProjectId: string;
  setStopProjectId: (v: string) => void;
}) {
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!stopOpen) return;
    const t = window.setTimeout(() => labelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [stopOpen]);

  function openStopModal() {
    onOpenStop?.();
    setStopLabel(running.label ?? running.statedIntent ?? "");
    setStopQuality(normalizeQuality(running.quality) ?? "useful");
    setStopOpen(true);
  }

  function closeStopModal() {
    setStopOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-tk-bg-deep">
      <div className="pointer-events-none flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-16">
        <div className="flex w-full max-w-lg flex-col items-center text-center">
          <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em] text-tk-honey">
            <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-tk-honey" />
            {running.categoryName}
          </div>
          {running.label ? (
            <p className="mt-3 max-w-md text-[15px] text-tk-ink-2">
              {running.label}
            </p>
          ) : null}
          <div className="mt-10 flex w-full flex-col items-center justify-center">
            {clock}
          </div>
        </div>
      </div>

      <div className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[101] border-t border-tk-line/50 bg-tk-bg-deep/95 p-6 backdrop-blur-sm">
        <button
          type="button"
          className="btn-stop mx-auto flex h-14 w-full max-w-md items-center justify-center gap-2 text-[16px] font-semibold"
          onClick={openStopModal}
          aria-label="Stop timer"
        >
          <Square size={14} fill="currentColor" /> Stop
        </button>
      </div>

      {stopOpen ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[110] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stop-timer-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(10,9,8,0.78)] backdrop-blur-sm"
            aria-label="Close"
            onClick={closeStopModal}
          />
          <div
            className="relative z-[1] flex max-h-[min(88vh,720px)] w-full max-w-[440px] flex-col overflow-hidden rounded-[18px] border border-tk-line-strong bg-tk-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto p-5">
              <div className="flex items-start justify-between gap-3">
                <h2
                  id="stop-timer-title"
                  className="text-lg font-semibold text-tk-ink"
                >
                  Stop timer
                </h2>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-tk-ink-3 hover:bg-tk-surface-2 hover:text-tk-ink"
                  aria-label="Close"
                  onClick={closeStopModal}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-[12px] text-tk-ink-3">{running.categoryName}</p>
                <label className="text-[12px] text-tk-ink-2">
                  Label
                  <input
                    ref={labelRef}
                    className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-tk-ink"
                    value={stopLabel}
                    onChange={(e) => setStopLabel(e.target.value)}
                    placeholder="What did you work on?"
                  />
                </label>
                <ProjectPicker
                  projects={activeProjects}
                  value={stopProjectId}
                  onChange={setStopProjectId}
                />
                <div>
                  <div className="text-[12px] text-tk-ink-2">Quality</div>
                  <QualityPicker
                    value={stopQuality}
                    onChange={setStopQuality}
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-ghost px-4 py-2"
                  onClick={closeStopModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary px-4 py-2"
                  onClick={() => onStopSubmit()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
