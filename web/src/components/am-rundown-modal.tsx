"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { getAmRundownData } from "@/actions/am-rundown";
import { dismissAmRundownAction } from "@/actions/am-rundown";

type Data = Awaited<ReturnType<typeof getAmRundownData>>;

export function AmRundownModal({ data }: { data: Data }) {
  const router = useRouter();
  const [open, setOpen] = useState(data.show);
  const [pending, setPending] = useState(false);

  if (!data.show) return null;

  async function onDismiss() {
    setPending(true);
    try {
      await dismissAmRundownAction();
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content className="card fixed left-1/2 top-[12%] z-50 w-[min(100vw-2rem,400px)] -translate-x-1/2 p-6">
          <Dialog.Title className="text-lg font-semibold text-tk-ink">
            Good morning
          </Dialog.Title>
          {data.rollingAvg != null ? (
            <p className="mt-4 text-[14px] text-tk-ink-2">
              Your recent baseline:{" "}
              <span className="mono font-semibold text-tk-honey">
                {data.rollingAvg}
              </span>
            </p>
          ) : null}
          {data.yesterdayScore != null ? (
            <p className="mt-2 text-[13px] text-tk-ink-3">
              Yesterday: {data.yesterdayScore}
              {data.yesterdayHabitsLine
                ? `, ${data.yesterdayHabitsLine}`
                : ""}
            </p>
          ) : null}
          <p className="mt-4 text-[12px] text-tk-ink-4">
            Today&apos;s score stays hidden until you close the day.
          </p>
          <button
            type="button"
            className="btn-primary mt-6 w-full py-3"
            disabled={pending}
            onClick={() => void onDismiss()}
          >
            Start the day
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
