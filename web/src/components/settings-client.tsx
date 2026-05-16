"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GoogleCalendarSettings } from "@/components/google-calendar-settings";
import {
  getShowScoreOnToday,
  setShowScoreOnToday,
} from "@/lib/display-settings";

type GoogleCal = Awaited<
  ReturnType<typeof import("@/actions/google-calendar").getGoogleCalendarSettings>
>;

export function SettingsClient({
  googleCalendar,
  gcalStatus,
}: {
  googleCalendar: GoogleCal;
  gcalStatus?: string;
}) {
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    setShowScore(getShowScoreOnToday());
  }, []);

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">Settings</h1>
      </div>

      <GoogleCalendarSettings
        configured={googleCalendar.configured}
        accounts={googleCalendar.accounts}
        statusKey={gcalStatus}
        redirectUri={googleCalendar.redirectUri}
        builtinExcludeSummary={googleCalendar.builtinExcludeSummary}
        excludeCustomLines={googleCalendar.excludeCustomLines}
      />

      <section className="card p-4">
        <h2 className="text-[13px] font-semibold text-tk-ink">Display</h2>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={showScore}
            onChange={(e) => {
              setShowScore(e.target.checked);
              setShowScoreOnToday(e.target.checked);
            }}
          />
          <span className="text-[13px] text-tk-ink-2">
            Show productivity score on Today screen
            <span className="mt-1 block text-[11px] text-tk-ink-4">
              Off by default. Small widget top-right when enabled.
            </span>
          </span>
        </label>
      </section>

      <Link href="/today" className="btn-ghost text-center text-[13px]">
        Back to Today
      </Link>
    </div>
  );
}
