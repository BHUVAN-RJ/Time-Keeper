"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReminderHeaderBell } from "@/components/reminder-chrome";
import { SignOutButton } from "@/components/sign-out-button";

const MAIN_NAV = [
  { href: "/today", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/tasks", label: "Tasks" },
  { href: "/stats", label: "Stats" },
] as const;

const SETTINGS_NAV = { href: "/settings", label: "Settings" } as const;

function navClass(active: boolean) {
  return `shrink-0 rounded-lg px-3 py-2 whitespace-nowrap ${
    active
      ? "bg-tk-surface text-tk-ink"
      : "text-tk-ink-2 hover:bg-tk-surface hover:text-tk-ink"
  }`;
}

export function AppNav({
  reminderCount,
  remindersEnabled,
}: {
  reminderCount: number;
  remindersEnabled: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function onTodayClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === "/today") {
      e.preventDefault();
      router.refresh();
    }
  }

  const settingsActive = pathname === SETTINGS_NAV.href;

  return (
    <header className="sticky top-0 z-20 border-b border-tk-line bg-tk-bg-deep/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/today"
            onClick={onTodayClick}
            className="shrink-0 text-xl font-semibold tracking-tight text-tk-ink"
          >
            Time Keeper
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {remindersEnabled ? (
              <ReminderHeaderBell initialCount={reminderCount} />
            ) : null}
            <SignOutButton className="btn-ghost whitespace-nowrap px-3 py-2 text-[13px] text-tk-ink-2" />
          </div>
        </div>
        <nav
          className="flex items-center gap-1 overflow-x-auto text-[13px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Main"
        >
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.href === "/today" ? onTodayClick : undefined}
              className={navClass(
                pathname === item.href ||
                  (item.href === "/tasks" && pathname.startsWith("/tasks")),
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={SETTINGS_NAV.href}
            className={`${navClass(settingsActive)} ml-auto shrink-0`}
          >
            {SETTINGS_NAV.label}
          </Link>
        </nav>
      </div>
    </header>
  );
}
