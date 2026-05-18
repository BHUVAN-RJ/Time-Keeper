"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { setOverworkSplitPercent } from "@/actions/preferences";
import { BodyDoublingSettings } from "@/components/body-doubling-settings";
import { GoogleCalendarSettings } from "@/components/google-calendar-settings";
import { RemindersSettings } from "@/components/reminders-settings";
import { TagsSettings } from "@/components/tags-settings";
import { VacationSettings } from "@/components/vacation-settings";
import { formatOverworkMinutes } from "@/lib/overwork";
import {
  getShowScoreOnToday,
  setShowScoreOnToday,
} from "@/lib/display-settings";

type GoogleCal = Awaited<
  ReturnType<typeof import("@/actions/google-calendar").getGoogleCalendarSettings>
>;

type OverworkSettings = Awaited<
  ReturnType<typeof import("@/actions/preferences").getOverworkSettings>
>;

type Vacation = Awaited<
  ReturnType<typeof import("@/actions/vacations").getVacationSettings>
>;
type BodyDoubling = Awaited<
  ReturnType<typeof import("@/actions/preferences").getBodyDoublingSettings>
>;
type Tags = Awaited<
  ReturnType<typeof import("@/actions/preferences").getTagsSettings>
>;
type Reminders = Awaited<
  ReturnType<typeof import("@/actions/preferences").getRemindersSettings>
>;

export function SettingsClient({
  googleCalendar,
  overwork,
  vacation,
  bodyDoubling,
  tags,
  reminders,
  gcalStatus,
}: {
  googleCalendar: GoogleCal;
  overwork: OverworkSettings;
  vacation: Vacation;
  bodyDoubling: BodyDoubling;
  tags: Tags;
  reminders: Reminders;
  gcalStatus?: string;
}) {
  const showScore = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("tk-display-settings", onStoreChange);
      return () =>
        window.removeEventListener("tk-display-settings", onStoreChange);
    },
    () => getShowScoreOnToday(),
    () => false,
  );
  const [owPct, setOwPct] = useState(overwork.creditsPercent);
  const [owSaving, setOwSaving] = useState(false);

  const [prevOwPct, setPrevOwPct] = useState(overwork.creditsPercent);
  if (overwork.creditsPercent !== prevOwPct) {
    setPrevOwPct(overwork.creditsPercent);
    setOwPct(overwork.creditsPercent);
  }

  async function saveOverworkSplit() {
    setOwSaving(true);
    try {
      await setOverworkSplitPercent(owPct);
      toast.success("Overwork split saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setOwSaving(false);
    }
  }

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
        <h2 className="text-[13px] font-semibold text-tk-ink">Overwork</h2>
        <p className="mt-1 text-[12px] text-tk-ink-3">
          Minutes beyond your work-category goals on End Day are split between
          bonus credits and your freeze bank ({overwork.freezeMinutesPerCredit}{" "}
          banked minutes = 1 freeze credit).
        </p>
        <label className="mt-4 block text-[12px] text-tk-ink-2">
          Share to credits:{" "}
          <span className="mono font-medium text-tk-honey">{owPct}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            className="mt-2 w-full accent-tk-honey"
            value={owPct}
            onChange={(e) => setOwPct(Number(e.target.value))}
          />
          <span className="mt-1 flex justify-between text-[10px] text-tk-ink-4">
            <span>0% (all to freeze bank)</span>
            <span>100% (all to credits)</span>
          </span>
        </label>
        <button
          type="button"
          className="btn-primary mt-3 w-full py-2 text-[13px]"
          disabled={owSaving || owPct === overwork.creditsPercent}
          onClick={() => void saveOverworkSplit()}
        >
          Save overwork split
        </button>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-lg border border-tk-line bg-tk-surface-2 p-3">
            <dt className="text-tk-ink-4">Bank progress</dt>
            <dd className="mono mt-1 text-[15px] text-tk-ink">
              {formatOverworkMinutes(overwork.unbankedMinutes)}
            </dd>
            <dd className="text-[10px] text-tk-ink-4">toward next freeze</dd>
          </div>
          <div className="rounded-lg border border-tk-line bg-tk-surface-2 p-3">
            <dt className="text-tk-ink-4">Freeze credits banked</dt>
            <dd className="mono mt-1 text-[15px] text-tk-honey">
              {overwork.bankedFreezeCredits}
            </dd>
            <dd className="text-[10px] text-tk-ink-4">from overwork</dd>
          </div>
        </dl>
      </section>

      <VacationSettings
        today={vacation.today}
        upcomingVacationDates={vacation.upcomingVacationDates}
      />

      <BodyDoublingSettings initialInterval={bodyDoubling.intervalMinutes} />

      <TagsSettings initialEnabled={tags.enabled} />

      <RemindersSettings initialEnabled={reminders.enabled} />

      <section className="card p-4">
        <h2 className="text-[13px] font-semibold text-tk-ink">Categories</h2>
        <p className="mt-1 text-[12px] text-tk-ink-3">
          Manage categories, colors, and daily schedule goals.
        </p>
        <Link
          href="/categories"
          className="btn-primary mt-4 inline-flex w-full justify-center py-2.5 text-[13px]"
        >
          Manage categories
        </Link>
      </section>

      <section className="card p-4">
        <h2 className="text-[13px] font-semibold text-tk-ink">Display</h2>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={showScore}
            onChange={(e) => {
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
