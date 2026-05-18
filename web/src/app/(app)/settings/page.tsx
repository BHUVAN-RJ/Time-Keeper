import { getGoogleCalendarSettings } from "@/actions/google-calendar";
import {
  getBodyDoublingSettings,
  getOverworkSettings,
  getRemindersSettings,
  getTagsSettings,
} from "@/actions/preferences";
import { getVacationSettings } from "@/actions/vacations";
import { SettingsClient } from "@/components/settings-client";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>;
}) {
  const sp = await searchParams;
  const [googleCalendar, overwork, vacation, bodyDoubling, tags, reminders] =
    await Promise.all([
      getGoogleCalendarSettings(),
      getOverworkSettings(),
      getVacationSettings(),
      getBodyDoublingSettings(),
      getTagsSettings(),
      getRemindersSettings(),
    ]);
  return (
    <SettingsClient
      googleCalendar={googleCalendar}
      overwork={overwork}
      vacation={vacation}
      bodyDoubling={bodyDoubling}
      tags={tags}
      reminders={reminders}
      gcalStatus={sp.gcal}
    />
  );
}
