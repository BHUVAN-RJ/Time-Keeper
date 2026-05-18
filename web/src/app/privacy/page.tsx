import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Time Keeper",
  description: "How Time Keeper handles your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        <strong className="text-tk-ink">Last updated:</strong> May 2026
      </p>
      <p>
        Time Keeper is a personal productivity app operated by Bhuvan Rajanahally
        Jayakumar. This policy describes what we collect and why.
      </p>
      <p className="font-medium text-tk-ink">What we collect</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-tk-ink">Account email</strong> — for magic-link
          sign-in and to identify your account.
        </li>
        <li>
          <strong className="text-tk-ink">App data you enter</strong> — tasks,
          time blocks, habits, reminders, and related settings you save in the app.
        </li>
        <li>
          <strong className="text-tk-ink">Google Calendar (optional)</strong> — if
          you connect Google Calendar, we access your calendar events in{" "}
          <strong className="text-tk-ink">read-only</strong> mode to show them in
          your schedule. We do not modify or delete your calendar events.
        </li>
      </ul>
      <p className="font-medium text-tk-ink">How we use data</p>
      <p>
        Data is used only to provide Time Keeper features to you. We do not sell
        your personal information or use it for advertising.
      </p>
      <p className="font-medium text-tk-ink">Where data is stored</p>
      <p>
        Account and app data are stored in a hosted database (Turso). Email sign-in
        is sent via Resend. Google Calendar tokens are stored encrypted on our
        servers.
      </p>
      <p className="font-medium text-tk-ink">Third parties</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Google — OAuth and Calendar API (if you connect)</li>
        <li>Resend — transactional email for sign-in links</li>
        <li>Vercel — application hosting</li>
        <li>Turso — database hosting</li>
      </ul>
      <p className="font-medium text-tk-ink">Your choices</p>
      <p>
        Disconnect Google Calendar in Settings, or revoke access at{" "}
        <a
          href="https://myaccount.google.com/permissions"
          className="text-tk-honey hover:text-tk-cream"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Account permissions
        </a>
        . Contact the operator to request account deletion.
      </p>
      <p className="font-medium text-tk-ink">Contact</p>
      <p>
        Questions:{" "}
        <a
          href="mailto:auth@mail.bhuvanrj.me"
          className="text-tk-honey hover:text-tk-cream"
        >
          auth@mail.bhuvanrj.me
        </a>
      </p>
    </LegalPage>
  );
}
