"use client";

import Link from "next/link";
import { RitualModal } from "@/components/ritual-modal";

export function WeeklyReviewNudgeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <RitualModal
      open={open}
      onOpenChange={onOpenChange}
      title="Weekly retrospective"
      description="Sunday evening"
      footer={
        <div className="flex flex-col gap-2">
          <Link
            href="/week"
            className="btn-primary w-full py-3 text-center text-[13px] font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Open Week
          </Link>
          <button
            type="button"
            className="btn-ghost w-full py-2 text-[12px] text-tk-ink-3"
            onClick={() => onOpenChange(false)}
          >
            Later
          </button>
        </div>
      }
    >
      <p className="text-[14px] leading-relaxed text-tk-ink-2">
        Your week is wrapped up. Head to the{" "}
        <span className="font-medium text-tk-ink">Week</span> tab to look back,
        set commitments, and prep what&apos;s next.
      </p>
    </RitualModal>
  );
}
