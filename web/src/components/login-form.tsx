"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setPending(true);
    try {
      const res = await signIn("resend", {
        email: email.trim(),
        redirect: false,
        callbackUrl: "/today",
      });
      if (res?.error) {
        toast.error("Could not send link. Check Resend key and email.");
      } else {
        setSent(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-tk-bg-deep px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="text-tk-honey" aria-hidden>
            ◆
          </span>
          <h1 className="text-[22px] font-semibold tracking-tight text-tk-ink">
            Time Keeper
          </h1>
        </div>
        <p className="mb-6 text-[14px] text-tk-ink-2">
          Sign in with a magic link sent to your email.
        </p>
        {sent ? (
          <div className="card p-4 text-[14px] text-tk-ink-2">
            Check your inbox for the sign-in link. You can close this tab.
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
      </div>
    </div>
  );
}
