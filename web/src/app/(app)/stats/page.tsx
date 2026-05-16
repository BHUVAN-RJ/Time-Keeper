import { getStatsPageData } from "@/actions/stats";
import { StatsClient } from "@/components/stats-client";

export default async function StatsPage() {
  const data = await getStatsPageData();
  return <StatsClient data={data} />;
}
