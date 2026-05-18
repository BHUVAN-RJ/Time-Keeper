import { getAmRundownData } from "@/actions/am-rundown";
import { getTodayDashboardExtras } from "@/actions/today-extras";
import { getTodayData } from "@/actions/time-blocks";
import { TodayClient } from "@/components/today-client";

export default async function TodayPage() {
  const [initial, extras, amRundown] = await Promise.all([
    getTodayData(),
    getTodayDashboardExtras(),
    getAmRundownData(),
  ]);
  return (
    <TodayClient initial={initial} extras={extras} amRundown={amRundown} />
  );
}
