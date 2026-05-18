import { getRemindersPageData } from "@/actions/reminders";
import { RemindersClient } from "@/components/reminders-client";

export default async function RemindersPage() {
  const initial = await getRemindersPageData();
  return <RemindersClient initial={initial} />;
}
