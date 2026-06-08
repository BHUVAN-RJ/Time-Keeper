import { getGoogleCalendarSettings } from "@/actions/google-calendar";
import {
  getActiveWindowSettings,
  getBodyDoublingSettings,
  getOverworkSettings,
  getRemindersSettings,
} from "@/actions/preferences";
import { getVacationSettings } from "@/actions/vacations";
import { SettingsClient } from "@/components/settings-client";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>;
}) {
  const sp = await searchParams;
  const [
    googleCalendar,
    overwork,
    vacation,
    bodyDoubling,
    reminders,
    activeWindow,
  ] = await Promise.all([
    getGoogleCalendarSettings(),
    getOverworkSettings(),
    getVacationSettings(),
    getBodyDoublingSettings(),
    getRemindersSettings(),
    getActiveWindowSettings(),
  ]);
  return (
    <SettingsClient
      googleCalendar={googleCalendar}
      overwork={overwork}
      vacation={vacation}
      bodyDoubling={bodyDoubling}
      reminders={reminders}
      activeWindow={activeWindow}
      gcalStatus={sp.gcal}
    />
  );
}
