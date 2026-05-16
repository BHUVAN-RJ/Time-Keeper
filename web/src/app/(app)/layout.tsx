import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/actions/auth";
import { QuickAddProvider } from "@/components/quick-add-provider";

export default async function AppChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
      <QuickAddProvider>
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-28 pt-2">
          {children}
        </main>
      </QuickAddProvider>
    </div>
  );
}
