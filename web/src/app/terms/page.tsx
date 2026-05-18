import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — Time Keeper",
  description: "Terms for using Time Keeper.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        <strong className="text-tk-ink">Last updated:</strong> May 2026
      </p>
      <p>
        By using Time Keeper (&quot;the app&quot;), you agree to these terms. The
        app is provided as a personal productivity tool without charge.
      </p>
      <p className="font-medium text-tk-ink">Use of the service</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>You must provide accurate information (e.g. your email for sign-in).</li>
        <li>
          You are responsible for activity under your account and for keeping
          access to your email secure.
        </li>
        <li>
          Optional Google Calendar connection is read-only; you grant permission only
          for displaying events in the app.
        </li>
      </ul>
      <p className="font-medium text-tk-ink">Availability</p>
      <p>
        The app is provided &quot;as is.&quot; We may change, suspend, or discontinue
        features at any time. We do not guarantee uninterrupted availability.
      </p>
      <p className="font-medium text-tk-ink">Limitation of liability</p>
      <p>
        To the fullest extent permitted by law, the operator is not liable for
        indirect or consequential damages arising from use of the app. You use the
        app at your own risk.
      </p>
      <p className="font-medium text-tk-ink">Privacy</p>
      <p>
        Our{" "}
        <a href="/privacy" className="text-tk-honey hover:text-tk-cream">
          Privacy Policy
        </a>{" "}
        explains how we handle your data.
      </p>
      <p className="font-medium text-tk-ink">Changes</p>
      <p>
        We may update these terms. Continued use after changes means you accept the
        updated terms.
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
