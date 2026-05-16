import { getWeekData } from "@/actions/week";
import { WeekClient } from "@/components/week-client";

export default async function WeekPage() {
  const data = await getWeekData();
  return <WeekClient data={data} />;
}
