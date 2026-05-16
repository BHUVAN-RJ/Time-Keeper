"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { getTodayDashboardExtras } from "@/actions/today-extras";
import { startBlockForTaskAction } from "@/actions/time-blocks";
import { EndDayDialog } from "@/components/end-day-dialog";
import { useQuickAdd } from "@/components/quick-add-context";

type Extras = Awaited<ReturnType<typeof getTodayDashboardExtras>>;

export function TodayV02Panel({
  extras,
  runningBlockId,
  onNeedStop,
}: {
  extras: Extras;
  runningBlockId: string | null;
  onNeedStop: () => void;
}) {
  const router = useRouter();
  const { openQuickAdd } = useQuickAdd();
  const [whatsNextOpen, setWhatsNextOpen] = useState(false);
  const [endDayOpen, setEndDayOpen] = useState(false);
  const [endDayKey, setEndDayKey] = useState(0);
  const [busy, setBusy] = useState(false);

  async function startWhatsNext() {
    if (!extras.whatsNext) return;
    setBusy(true);
    try {
      const res = await startBlockForTaskAction(extras.whatsNext.id);
      if (!res.ok) {
        toast.error("Stop the current timer first.");
        return;
      }
      toast.success("Started");
      setWhatsNextOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {extras.whatsNext ? (
        <div className="card p-4">
          <div className="eyebrow">Next up</div>
          <div className="mt-1 text-[16px] font-medium text-tk-ink">
            {extras.whatsNext.title}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary px-4 py-2 text-[13px]"
              disabled={busy}
              onClick={() => void startWhatsNext()}
            >
              Start
            </button>
            <button
              type="button"
              className="btn-ghost px-4 py-2 text-[13px]"
              onClick={() => setWhatsNextOpen(true)}
            >
              What&apos;s next
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-4 text-center text-[13px] text-tk-ink-3">
          No task scheduled for today.{" "}
          <button
            type="button"
            className="text-tk-honey underline"
            onClick={openQuickAdd}
          >
            Quick add
          </button>{" "}
          or{" "}
          <Link href="/tasks" className="text-tk-honey underline">
            Tasks
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost flex flex-1 items-center justify-center gap-2 py-3 text-[13px] min-w-[140px]"
          onClick={openQuickAdd}
        >
          <Plus size={16} /> Quick add task
        </button>
        <button
          type="button"
          className="btn-primary flex-1 py-3 text-[13px] font-semibold min-w-[140px]"
          disabled={!!extras.dayEnded}
          onClick={() => {
            if (runningBlockId) {
              onNeedStop();
              toast.message("Stop your timer, then End Day.");
              return;
            }
            setEndDayKey((k) => k + 1);
            setEndDayOpen(true);
          }}
        >
          {extras.dayEnded ? "Day closed" : "End Day"}
        </button>
      </div>

      <Dialog.Root open={whatsNextOpen} onOpenChange={setWhatsNextOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/80" />
          <Dialog.Content className="card fixed inset-4 z-50 flex flex-col items-center justify-center p-8 text-center sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(100vw-2rem,360px)] sm:-translate-x-1/2 sm:-translate-y-1/2">
            {extras.whatsNext ? (
              <>
                <Dialog.Title className="text-[11px] uppercase tracking-widest text-tk-ink-3">
                  What&apos;s next
                </Dialog.Title>
                <p className="mt-4 text-[20px] font-semibold text-tk-ink">
                  {extras.whatsNext.title}
                </p>
                <button
                  type="button"
                  className="btn-primary mt-8 px-8 py-3"
                  disabled={busy}
                  onClick={() => void startWhatsNext()}
                >
                  Start now
                </button>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <EndDayDialog
        key={endDayKey}
        open={endDayOpen}
        onOpenChange={setEndDayOpen}
        runningBlockId={runningBlockId}
        onNeedStop={onNeedStop}
      />
    </>
  );
}
