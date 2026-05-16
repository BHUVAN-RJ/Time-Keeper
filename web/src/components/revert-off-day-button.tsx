"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { clearOffDayAction } from "@/actions/day-status";

export function RevertOffDayButton({
  date,
  className = "text-[11px] text-tk-honey hover:underline",
}: {
  date: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          try {
            await clearOffDayAction(date);
            toast.success("Not an off day anymore");
          } catch {
            toast.error("Could not revert off day");
          }
        })
      }
    >
      {pending ? "Reverting…" : "Not an off day"}
    </button>
  );
}
