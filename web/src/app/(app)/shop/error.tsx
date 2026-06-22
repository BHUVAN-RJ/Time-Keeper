"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const needsMigration =
    /no such table|shop_items|shop_redemptions/i.test(error.message);

  return (
    <div className="flex flex-col gap-4 py-8 text-center">
      <h1 className="text-lg font-semibold text-tk-ink">Could not load shop</h1>
      <p className="text-[13px] text-tk-ink-3">
        {needsMigration
          ? "The shop database tables are missing. Run migration 0016 on production Turso, then refresh."
          : error.message || "Something went wrong. Try again."}
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
