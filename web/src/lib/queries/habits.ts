import { listHabitsForManage } from "@/actions/habits";

export type HabitsManageData = Awaited<ReturnType<typeof listHabitsForManage>>;

export async function fetchHabitsManage(): Promise<HabitsManageData> {
  return listHabitsForManage();
}
