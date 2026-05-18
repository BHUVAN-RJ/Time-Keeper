"use client";

import { useQuery } from "@tanstack/react-query";
import { getMonthPageData } from "@/actions/month";
import { MonthRecapView } from "@/components/month-recap-view";
import { PageLoadingShell } from "@/components/page-loading-shell";

export function MonthRecapPanel({ title = "Month" }: { title?: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["month"],
    queryFn: () => getMonthPageData(),
  });

  if (isLoading) {
    return <PageLoadingShell title={title} rows={5} />;
  }

  if (isError || !data) {
    return (
      <div className="py-8 text-center text-[13px] text-tk-ink-3">
        Could not load month.{" "}
        <button
          type="button"
          className="text-tk-honey underline"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return <MonthRecapView data={data} />;
}
