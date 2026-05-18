import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRemindersEnabledForUser } from "@/actions/preferences";
import { getReminderChromeData } from "@/actions/reminders";
import { AppNav } from "@/components/app-nav";
import { CalendarPollProvider } from "@/components/calendar-poll-provider";
import { BodyDoublingBanner } from "@/components/body-doubling-banner";
import { ReminderBanner } from "@/components/reminder-chrome";
import { QuickAddProvider } from "@/components/quick-add-provider";
import { googleCalendarConfigured } from "@/lib/google-calendar/config";
import { listGoogleCalendarAccounts } from "@/lib/google-calendar/service";

export default async function AppChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let calendarPoll = false;
  if (googleCalendarConfigured()) {
    const accounts = await listGoogleCalendarAccounts(session.user.id);
    calendarPoll = accounts.length > 0;
  }

  const remindersEnabled = await getRemindersEnabledForUser(session.user.id);
  const reminderChrome = remindersEnabled
    ? await getReminderChromeData()
    : { dueCount: 0, banner: null };

  return (
    <div className="flex min-h-full flex-col bg-tk-bg-deep">
      <AppNav
        reminderCount={reminderChrome.dueCount}
        remindersEnabled={remindersEnabled}
      />
      {remindersEnabled ? (
        <ReminderBanner
          key={reminderChrome.banner?.id ?? "none"}
          initial={reminderChrome.banner}
        />
      ) : null}
      <BodyDoublingBanner />
      <CalendarPollProvider enabled={calendarPoll}>
        <QuickAddProvider>
          <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-28 pt-2">
            {children}
          </main>
        </QuickAddProvider>
      </CalendarPollProvider>
    </div>
  );
}
