import { getTodayData } from "@/actions/time-blocks";
import { TodayClient } from "@/components/today-client";

export default async function TodayPage() {
  const initial = await getTodayData();
  return <TodayClient initial={initial} />;
}
