"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { requestMagicLinkAction } from "@/actions/auth";

export function LoginForm({ resendTestMode }: { resendTestMode: boolean }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendLink() {
    if (!email.trim()) return;
    setPending(true);
    try {
      const res = await requestMagicLinkAction(email);
      if (!res.ok) {
        toast.error(res.message);
      } else {
        setSent(true);
      }
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendLink();
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-tk-bg-deep px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-[22px] font-semibold tracking-tight text-tk-ink">
          Time Keeper
        </h1>
        <p className="mb-4 text-[14px] text-tk-ink-2">
          Sign in with a magic link — no password. Use the same email as before
          if you already have an account.
        </p>
        {resendTestMode ? (
          <p className="mb-4 rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[12px] text-tk-ink-3">
            Dev note: emails from <span className="text-tk-ink-2">onboarding@resend.dev</span>{" "}
            only reach the address on your Resend account until you verify a
            domain in Resend.
          </p>
        ) : null}
        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="card p-4 text-[14px] text-tk-ink-2">
              <p className="font-medium text-tk-ink">Check your inbox</p>
              <p className="mt-2">
                We sent a sign-in link to{" "}
                <span className="text-tk-ink">{email.trim()}</span>. It expires
                in 24 hours.
              </p>
              <p className="mt-2 text-[13px] text-tk-ink-3">
                Deleted the email or don&apos;t see it? Check spam, then send
                another link below.
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => void sendLink()}
              className="btn-ghost py-2 text-[14px] text-tk-ink-2 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send another link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="text-[13px] text-tk-ink-3 hover:text-tk-ink-2"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="text-[12px] text-tk-ink-3">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-tk-line bg-tk-surface px-3 py-3 text-tk-ink"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="btn-primary py-3 text-[15px] disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
        <p className="mt-10 text-center text-[12px] text-tk-ink-4">
          <Link href="/privacy" className="hover:text-tk-ink-3">
            Privacy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-tk-ink-3">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
