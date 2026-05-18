import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-tk-bg-deep px-6 py-12 text-tk-ink-2">
      <article className="mx-auto max-w-lg">
        <Link
          href="/login"
          className="mb-8 inline-block text-[13px] text-tk-honey hover:text-tk-cream"
        >
          ← Time Keeper
        </Link>
        <h1 className="mb-6 text-[22px] font-semibold tracking-tight text-tk-ink">
          {title}
        </h1>
        <div className="space-y-4 text-[14px] leading-relaxed">{children}</div>
        <footer className="mt-10 flex gap-4 border-t border-tk-line pt-6 text-[12px] text-tk-ink-3">
          <Link href="/privacy" className="hover:text-tk-ink-2">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-tk-ink-2">
            Terms
          </Link>
        </footer>
      </article>
    </div>
  );
}
