"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { markOffDayAction } from "@/actions/day-status";

export function OffDayCheckModal({
  open,
  onOpenChange,
  offDaysIn30,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  offDaysIn30: number;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function proceed() {
    setPending(true);
    try {
      const res = await markOffDayAction({ acknowledgeHeavyUse: true });
      if (res.ok) {
        onOpenChange(false);
        onDone();
      } else if ("needsBank" in res && res.needsBank) {
        toast.error(res.error ?? "No off days in bank");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tk-modal-overlay z-50" />
        <Dialog.Content className="tk-modal-content z-[51] overflow-y-auto p-5">
          <Dialog.Title className="text-lg font-semibold text-tk-ink">
            Taking another off day?
          </Dialog.Title>
          <p className="mt-3 text-[13px] text-tk-ink-2">
            You&apos;ve marked {offDaysIn30} off days in the last 30. Is
            something going on?
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              className="btn-primary w-full py-2 text-[13px]"
              disabled={pending}
              onClick={() => void proceed()}
            >
              Yes, I need a real break
            </button>
            <Link
              href="/settings"
              className="btn-ghost w-full py-2 text-center text-[13px]"
              onClick={() => onOpenChange(false)}
            >
              Let me lower my goals instead
            </Link>
            <Dialog.Close asChild>
              <button type="button" className="btn-ghost w-full py-2 text-[13px]">
                Nevermind
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
