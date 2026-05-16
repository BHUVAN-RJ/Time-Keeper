import { getGoogleCalendarSettings } from "@/actions/google-calendar";
import { SettingsClient } from "@/components/settings-client";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>;
}) {
  const sp = await searchParams;
  const googleCalendar = await getGoogleCalendarSettings();
  return (
    <SettingsClient
      googleCalendar={googleCalendar}
      gcalStatus={sp.gcal}
    />
  );
}
