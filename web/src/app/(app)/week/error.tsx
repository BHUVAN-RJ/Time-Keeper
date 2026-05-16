"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function WeekError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 py-8 text-center">
      <h1 className="text-lg font-semibold text-tk-ink">Could not load week</h1>
      <p className="text-[13px] text-tk-ink-3">
        {error.message || "Something went wrong. Try again."}
      </p>
      <div className="flex flex-col gap-2">
        <button type="button" className="btn-primary py-2" onClick={reset}>
          Retry
        </button>
        <Link href="/today" className="btn-ghost text-[13px]">
          Back to Today
        </Link>
      </div>
    </div>
  );
}
