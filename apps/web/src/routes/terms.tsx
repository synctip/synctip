import { createFileRoute, Link } from "@tanstack/react-router";

import {
  LegalLayout,
  LegalList,
  LegalSection,
} from "@/components/legal-layout";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

const LAST_UPDATED = "June 29, 2026";

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated={LAST_UPDATED}>
      <p className="text-foreground/80">
        These Terms of Service ("Terms") govern your access to and use of
        Synctip ("the Service"), operated by Synctip ("we", "us"). By creating
        an account or using the Service, you agree to these Terms.
      </p>

      <LegalSection id="eligibility" title="1. Eligibility">
        <p>
          You must be at least 16 years old to use Synctip. By using the Service
          you confirm that you have the legal capacity to enter into this
          agreement, and that any information you provide is accurate.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="2. Accounts">
        <p>
          You are responsible for safeguarding access to your account, including
          your phone number and any connected sign-in method (e.g. Google). You
          are responsible for all activity that occurs under your account.
          Notify us promptly if you suspect unauthorized access.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="3. Acceptable use">
        <p>You agree not to:</p>
        <LegalList>
          <li>
            Use the Service for unlawful, fraudulent, or harmful purposes.
          </li>
          <li>
            Reverse engineer, scrape, or attempt to gain unauthorized access to
            the Service or its underlying infrastructure.
          </li>
          <li>
            Upload content that infringes intellectual property, violates
            privacy, or contains malware.
          </li>
          <li>
            Interfere with or disrupt the Service, including by sending
            excessive automated requests.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="content" title="4. Your content and data">
        <p>
          You retain ownership of the information you enter into Synctip
          (shifts, tips, team data). You grant us a limited license to host,
          process, and display that content solely to operate the Service for
          you and your team. We do not sell your content. Our handling of
          personal data is described in our{" "}
          <Link
            to="/privacy"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="billing" title="5. Plans and billing">
        <p>
          Where the Service is offered on a paid plan, fees, billing cycle, and
          payment terms will be presented at the time of purchase. Unless stated
          otherwise, fees are non-refundable. We may change pricing or plan
          terms with reasonable advance notice.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="6. Termination">
        <p>
          You may stop using the Service and delete your account at any time. We
          may suspend or terminate accounts that violate these Terms or that
          pose a security or legal risk. On termination, we will delete your
          personal data in accordance with our Privacy Policy, subject to legal
          retention requirements.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="7. Service availability">
        <p>
          We work to keep Synctip available and reliable but do not guarantee
          uninterrupted operation. The Service is provided on an "as is" and "as
          available" basis, without warranties of any kind, express or implied.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="8. Limitation of liability">
        <p>
          To the maximum extent permitted by law, Synctip and its operators will
          not be liable for indirect, incidental, special, or consequential
          damages, or for lost profits or revenues, arising from or related to
          your use of the Service.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes to these Terms">
        <p>
          We may update these Terms from time to time. Material changes will be
          communicated by email or in-app notice and will take effect on the
          date posted. Continued use of the Service after that date constitutes
          acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection id="law" title="10. Governing law">
        <p>
          These Terms are governed by the laws of the State of Israel, without
          regard to its conflict-of-law rules. Disputes will be resolved
          exclusively in the competent courts of Tel Aviv-Jaffa.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="11. Contact">
        <p>
          Questions about these Terms can be sent to{" "}
          <a
            href="mailto:legal@synctip.com"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            legal@synctip.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
