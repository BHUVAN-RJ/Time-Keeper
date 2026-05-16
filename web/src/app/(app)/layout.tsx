import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/actions/auth";
import { CalendarPollProvider } from "@/components/calendar-poll-provider";
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

  return (
    <div className="flex min-h-full flex-col bg-tk-bg-deep">
      <header className="sticky top-0 z-20 border-b border-tk-line bg-tk-bg-deep/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link href="/today" className="flex items-center gap-2">
            <span className="text-tk-honey" aria-hidden>
              ◆
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-tk-ink">
              Time Keeper
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-[13px]">
            <Link
              href="/today"
              className="rounded-lg px-3 py-2 text-tk-ink-2 hover:bg-tk-surface hover:text-tk-ink"
            >
              Today
            </Link>
            <Link
              href="/week"
              className="rounded-lg px-3 py-2 text-tk-ink-2 hover:bg-tk-surface hover:text-tk-ink"
            >
              Week
            </Link>
            <Link
              href="/tasks"
              className="rounded-lg px-3 py-2 text-tk-ink-2 hover:bg-tk-surface hover:text-tk-ink"
            >
              Tasks
            </Link>
            <Link
              href="/categories"
              className="rounded-lg px-3 py-2 text-tk-ink-2 hover:bg-tk-surface hover:text-tk-ink"
            >
              Categories
            </Link>
            <Link
              href="/stats"
              className="rounded-lg px-3 py-2 text-tk-ink-2 hover:bg-tk-surface hover:text-tk-ink"
            >
              Stats
            </Link>
            <Link
              href="/settings"
              className="rounded-lg px-3 py-2 text-tk-ink-2 hover:bg-tk-surface hover:text-tk-ink"
            >
              Settings
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="btn-ghost px-3 py-2 text-[13px] text-tk-ink-2"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
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
