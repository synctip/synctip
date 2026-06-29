import { createFileRoute, Link } from "@tanstack/react-router";

import {
  LegalLayout,
  LegalList,
  LegalSection,
} from "@/components/legal-layout";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

const LAST_UPDATED = "June 29, 2026";

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated={LAST_UPDATED}>
      <p className="text-foreground/80">
        Synctip ("we", "us") provides a tip-management platform for service
        teams. This policy explains what personal data we collect, why we
        collect it, how we use it, and the rights you have over it.
      </p>

      <LegalSection id="what-we-collect" title="What we collect">
        <LegalList>
          <li>
            <strong className="text-foreground">Account data:</strong> your
            name, email address, phone number, and profile picture (if you sign
            in with Google).
          </li>
          <li>
            <strong className="text-foreground">Authentication data:</strong>{" "}
            session tokens stored in an HTTP-only cookie on your device. We do
            not store passwords in recoverable form.
          </li>
          <li>
            <strong className="text-foreground">Workspace data:</strong> shifts,
            tips, and payouts that you or members of your team enter into
            Synctip.
          </li>
          <li>
            <strong className="text-foreground">Operational logs:</strong>{" "}
            request metadata (IP address, user agent, timestamps) used for
            security and debugging. Retained for 30 days.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="why" title="Why we collect it">
        <LegalList>
          <li>To authenticate you and keep your account secure.</li>
          <li>To provide the core Synctip features you use.</li>
          <li>
            To comply with legal obligations (e.g. records related to payments).
          </li>
          <li>To detect, prevent, and respond to fraud or abuse.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="sharing" title="Who we share it with">
        <p>
          We do not sell your personal data and we do not share it with
          advertisers. We share data only with service providers strictly
          required to operate Synctip:
        </p>
        <LegalList>
          <li>
            <strong className="text-foreground">Twilio</strong> - to deliver SMS
            one-time passcodes for phone-number sign in.
          </li>
          <li>
            <strong className="text-foreground">Google</strong> - to
            authenticate you when you choose "Continue with Google".
          </li>
          <li>
            <strong className="text-foreground">Render</strong> - to host the
            Synctip API and database.
          </li>
          <li>
            <strong className="text-foreground">Sentry</strong> - to capture
            application errors so we can fix them.
          </li>
        </LegalList>
        <p>
          We may disclose data when required by law, court order, or to protect
          the rights and safety of Synctip users.
        </p>
      </LegalSection>

      <LegalSection id="google" title="How we use Google user data">
        <p>
          When you sign in with Google, we receive your name, email address, and
          profile picture from Google's OpenID Connect endpoints. We use this
          information only to create and authenticate your Synctip account. We
          do not use Google user data for advertising, and we do not share it
          with third parties beyond the service providers listed above.
        </p>
      </LegalSection>

      <LegalSection id="storage" title="How we store it">
        <p>
          Data is stored on managed Postgres infrastructure in the European
          Union. Connections to our services are encrypted in transit (HTTPS).
          Session cookies are flagged Secure and HttpOnly.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="Your rights">
        <LegalList>
          <li>
            <strong className="text-foreground">Access:</strong> request a copy
            of the personal data we hold about you.
          </li>
          <li>
            <strong className="text-foreground">Correction:</strong> update
            inaccurate or incomplete data from your account settings, or by
            contacting us.
          </li>
          <li>
            <strong className="text-foreground">Deletion:</strong> request
            deletion of your account and associated personal data. Some records
            may be retained for legal reasons (e.g. financial records).
          </li>
          <li>
            <strong className="text-foreground">Withdraw consent:</strong>{" "}
            disconnect Google or revoke phone-number sign in at any time from
            your account settings.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <p>
          Synctip is not directed at children under 16 and we do not knowingly
          collect personal data from them.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          We will post any updates to this policy on this page and update the
          "Last updated" date above. Material changes will be communicated by
          email or in-app notice.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions or requests can be sent to{" "}
          <a
            href="mailto:privacy@synctip.com"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            privacy@synctip.com
          </a>
          .
        </p>
        <p>
          See also our{" "}
          <Link
            to="/terms"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
