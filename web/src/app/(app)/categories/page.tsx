import { listCategoriesForUser } from "@/actions/categories";
import { getScheduleGoalsForToday } from "@/actions/schedule-goals";
import { CategoriesClient } from "@/components/categories-client";

export default async function CategoriesPage() {
  const [rows, goals] = await Promise.all([
    listCategoriesForUser(),
    getScheduleGoalsForToday(),
  ]);
  return <CategoriesClient initial={rows} scheduleGoals={goals} />;
}
