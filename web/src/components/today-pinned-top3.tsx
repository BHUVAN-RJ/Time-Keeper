"use client";

import type { getTodayDashboardExtras } from "@/actions/today-extras";

type Extras = Awaited<ReturnType<typeof getTodayDashboardExtras>>;

export function TodayPinnedTop3({
  items,
}: {
  items: Extras["pinnedTop3"];
}) {
  if (items.length === 0) return null;

  return (
    <section className="card border border-tk-honey/25 bg-tk-honey/5 p-4">
      <div className="eyebrow text-tk-honey">Today&apos;s top 3</div>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] font-medium text-tk-ink">
        {items.map((t) => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-tk-ink-4">
        From last night&apos;s plan
      </p>
    </section>
  );
}
