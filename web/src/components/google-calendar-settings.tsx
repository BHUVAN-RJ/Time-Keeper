"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  disconnectGoogleCalendarAccount,
  refreshGoogleCalendarCacheAction,
  saveCalendarExcludePatternsAction,
} from "@/actions/google-calendar";

type Account = {
  id: string;
  googleEmail: string;
  connectedAt: string;
};

const STATUS_MESSAGES: Record<string, string> = {
  connected: "Google account connected.",
  denied: "Google sign-in was cancelled.",
  error: "Could not connect Google Calendar. Try again.",
  invalid_state: "Session expired. Try connecting again.",
  no_refresh: "No refresh token received. Remove the app from Google Account permissions and retry.",
  not_configured: "Google Calendar env vars are missing on the server.",
};

export function GoogleCalendarSettings({
  configured,
  accounts,
  statusKey,
  redirectUri,
  builtinExcludeSummary,
  excludeCustomLines,
}: {
  configured: boolean;
  accounts: Account[];
  statusKey?: string;
  redirectUri: string | null;
  builtinExcludeSummary: string;
  excludeCustomLines: string[];
}) {
  const qc = useQueryClient();
  const [pending, startTransition] = useTransition();

  function invalidateCalendar() {
    void qc.invalidateQueries({ queryKey: ["week"] });
    void qc.invalidateQueries({ queryKey: ["today"] });
  }
  const [excludeText, setExcludeText] = useState(
    () => excludeCustomLines.join("\n"),
  );

  useEffect(() => {
    if (!statusKey || !STATUS_MESSAGES[statusKey]) return;
    const msg = STATUS_MESSAGES[statusKey]!;
    if (statusKey === "connected") toast.success(msg);
    else if (statusKey !== "not_configured") toast.error(msg);
  }, [statusKey]);

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold text-tk-ink">Google Calendar</h2>
      <p className="mt-1 text-[12px] text-tk-ink-3">
        Read-only. All calendars on each connected account. Events appear on
        Week, Today, and your morning rundown.
      </p>

      {!configured ? (
        <p className="mt-3 text-[12px] text-tk-warn">
          Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and
          GOOGLE_TOKEN_ENCRYPTION_KEY to the server environment.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/api/google-calendar/connect"
              className="btn-primary px-3 py-2 text-[12px]"
            >
              Connect another account
            </Link>
            {accounts.length > 0 ? (
              <button
                type="button"
                disabled={pending}
                className="btn-ghost px-3 py-2 text-[12px]"
                onClick={() =>
                  startTransition(async () => {
                    await refreshGoogleCalendarCacheAction();
                    toast.success("Calendar refreshed");
                    invalidateCalendar();
                  })
                }
              >
                Refresh now
              </button>
            ) : null}
          </div>

          {accounts.length === 0 ? (
            <p className="mt-3 text-[12px] text-tk-ink-3">
              No accounts connected yet.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-tk-line px-3 py-2"
                >
                  <div>
                    <div className="text-[13px] font-medium text-tk-ink">
                      {a.googleEmail}
                    </div>
                    <div className="text-[10px] text-tk-ink-4">Connected</div>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-[11px] text-tk-warn hover:underline"
                    onClick={() =>
                      startTransition(async () => {
                        await disconnectGoogleCalendarAccount(a.id);
                        toast.success("Disconnected");
                        invalidateCalendar();
                      })
                    }
                  >
                    Disconnect
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] text-tk-ink-4">
            Redirect URI for Google Cloud:{" "}
            <code className="text-tk-ink-3">
              {redirectUri ?? "Set AUTH_URL in environment"}
            </code>
          </p>

          <div className="mt-5 border-t border-tk-line pt-4">
            <h3 className="text-[12px] font-semibold text-tk-ink">
              Hide events by title
            </h3>
            <p className="mt-1 text-[11px] text-tk-ink-3">
              Always hidden: {builtinExcludeSummary}. Add more below (one per
              line). Matches event title only.
            </p>
            <textarea
              className="mt-2 min-h-[72px] w-full rounded-xl border border-tk-line bg-tk-surface-2 px-3 py-2 text-[12px] text-tk-ink"
              placeholder="e.g. OH&#10;Office Hours"
              value={excludeText}
              onChange={(e) => setExcludeText(e.target.value)}
            />
            <button
              type="button"
              disabled={pending}
              className="btn-ghost mt-2 px-3 py-1.5 text-[12px]"
              onClick={() =>
                startTransition(async () => {
                  await saveCalendarExcludePatternsAction(excludeText);
                  toast.success("Filter saved — calendar refreshed");
                  invalidateCalendar();
                })
              }
            >
              Save filters
            </button>
          </div>
        </>
      )}
    </section>
  );
}
