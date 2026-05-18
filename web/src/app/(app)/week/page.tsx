import { getPendingWeeklyReview } from "@/actions/weekly-review";
import { WeekClient } from "@/components/week-client";

export default async function WeekPage() {
  const retro = await getPendingWeeklyReview();
  return (
    <WeekClient
      retrospectiveWeekStarting={retro.weekStarting}
      retrospectivePending={retro.pending}
    />
  );
}
