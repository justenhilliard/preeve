import Link from "next/link";
import { ThemeToggle } from "../themeToggle";

const PAGE_HEADING_CLASS =
  "font-serif text-5xl font-semibold tracking-normal text-[var(--color-text)] " +
  "sm:text-6xl";
const SECTION_HEADING_CLASS =
  "font-sans text-2xl font-semibold tracking-normal text-[var(--color-text)]";
const BODY_TEXT_CLASS = "text-base leading-7 text-[var(--color-text)]";
const MUTED_TEXT_CLASS = "text-sm leading-6 text-[var(--color-text-muted)]";
const LIST_CLASS = "list-disc space-y-2 pl-6 text-base leading-7 text-[var(--color-text)]";
const SECTION_CLASS = "space-y-4 border-t border-[var(--color-text-muted)]/15 pt-10";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link className="auth-back-link" href="/">
            Back
          </Link>
          <ThemeToggle />
        </nav>

        <header className="space-y-3">
          <h1 className={PAGE_HEADING_CLASS}>Terms of Service</h1>
          <p className={MUTED_TEXT_CLASS}>
            Effective date: [DATE]. This is a placeholder date &mdash; update it when
            these terms are actually published.
          </p>
          <p className={BODY_TEXT_CLASS}>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of Preeve
            (&quot;Preeve,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), including our
            website and app (collectively, the &quot;Service&quot;). By creating an account or
            using Preeve, you agree to these Terms and our{" "}
            <Link className="font-semibold text-[var(--color-accent)]" href="/privacy">
              Privacy Policy
            </Link>
            . If you don&apos;t agree, please don&apos;t use the Service.
          </p>
        </header>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>1. What Preeve does</h2>
          <p className={BODY_TEXT_CLASS}>
            Preeve lets you photograph a clothing item and receive a Buy, Maybe, or
            Skip verdict based on your stated style preferences and existing wardrobe.
            To produce a verdict, Preeve uses a machine learning model to identify the
            item&apos;s category and color from your photo, then applies a rule-based
            scoring system to your preferences. Preeve is a personal styling tool, not
            a marketplace &mdash; your wardrobe and scan history are private to your
            account and are not shared with or visible to other users.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>2. Eligibility and your account</h2>
          <p className={BODY_TEXT_CLASS}>
            You must be at least 13 years old to use Preeve. You&apos;re responsible for
            maintaining the confidentiality of your account and for all activity that
            happens under it. Let us know right away if you believe your account has
            been compromised. You agree to provide accurate account information.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>3. Your content</h2>
          <p className={BODY_TEXT_CLASS}>
            &quot;Your Content&quot; means the photos, and any associated data, that you upload
            to Preeve. You retain ownership of Your Content. By uploading it, you grant
            Preeve a limited, non-exclusive license to store, process, and display Your
            Content back to you as part of operating the Service (including sending
            your photos to our third-party classification provider, as described in
            our Privacy Policy). We do not publish, publicly display, or share Your
            Content with other users or third parties for their own purposes.
          </p>
          <p className={BODY_TEXT_CLASS}>
            You represent that you own or have the right to upload any photo you
            submit to Preeve, and that doing so doesn&apos;t infringe anyone else&apos;s
            rights. You&apos;re solely responsible for Your Content.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>4. Verdicts are informational, not advice</h2>
          <p className={BODY_TEXT_CLASS}>
            Preeve&apos;s Buy/Maybe/Skip verdicts and item classifications are generated
            automatically and are provided for informational purposes only. They may
            be inaccurate, incomplete, or not reflect your actual taste or needs. A
            verdict is not professional styling, financial, or purchasing advice, and
            Preeve is not responsible for any purchase decision you make based on it.
            You&apos;re always free to disagree with and override a verdict.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>5. Acceptable use</h2>
          <p className={BODY_TEXT_CLASS}>When using Preeve, you agree not to:</p>
          <ul className={LIST_CLASS}>
            <li>
              Upload photos that are illegal, infringe someone else&apos;s intellectual
              property or other rights, or that you don&apos;t have the right to upload.
            </li>
            <li>Attempt to access another user&apos;s account or data without permission.</li>
            <li>
              Interfere with, disrupt, or attempt to circumvent the security of the
              Service.
            </li>
            <li>
              Use automated means (bots, scrapers) to access the Service outside of
              its intended use.
            </li>
            <li>Reverse-engineer or misuse the classification or verdict systems.</li>
            <li>Use the Service for any unlawful purpose.</li>
          </ul>
          <p className={BODY_TEXT_CLASS}>
            We may suspend or terminate your access if we believe you&apos;ve violated
            these Terms.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>6. Account deletion and termination</h2>
          <p className={BODY_TEXT_CLASS}>
            You can delete your account at any time from the{" "}
            <Link className="font-semibold text-[var(--color-accent)]" href="/settings">
              Settings
            </Link>{" "}
            page; this removes your wardrobe data as described in our Privacy Policy.
            We may suspend or terminate your account for violating these Terms, or
            discontinue the Service (in whole or in part) at any time. Sections of
            these Terms that by their nature should survive termination (such as
            intellectual property, disclaimers, and limitation of liability) will
            continue to apply.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>7. Intellectual property</h2>
          <p className={BODY_TEXT_CLASS}>
            Preeve&apos;s software, design, branding, and the verdict/classification systems
            are owned by us or our licensors and are protected by intellectual property
            law. Except for Your Content, nothing in these Terms grants you any right
            to use Preeve&apos;s trademarks, branding, or underlying technology outside of
            using the Service as intended.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>
            8. Copyright infringement / DMCA policy
          </h2>
          <p className={BODY_TEXT_CLASS}>
            Preeve respects intellectual property rights. If you believe content
            accessible through Preeve infringes your copyright, please send a written
            notice to our designated agent that includes:
          </p>
          <ul className={LIST_CLASS}>
            <li>Your physical or electronic signature.</li>
            <li>
              Identification of the copyrighted work you claim has been infringed.
            </li>
            <li>
              Identification of the material you claim is infringing, and information
              reasonably sufficient to let us locate it.
            </li>
            <li>Your contact information (address, phone number, email).</li>
            <li>
              A statement that you have a good-faith belief that the use is not
              authorized by the copyright owner, its agent, or the law.
            </li>
            <li>
              A statement, made under penalty of perjury, that the information in the
              notice is accurate and that you&apos;re authorized to act on behalf of the
              copyright owner.
            </li>
          </ul>
          <p className={BODY_TEXT_CLASS}>
            Designated agent contact: <span className="font-semibold">[Designated
            Agent name and contact information &mdash; register this agent with the
            U.S. Copyright Office at dmca.copyright.gov before relying on this
            section]</span>.
          </p>
          <p className={BODY_TEXT_CLASS}>
            If you believe your content was removed in error, you may submit a
            counter-notice with your contact information, identification of the
            removed material, a statement under penalty of perjury that you have a
            good-faith belief the material was removed by mistake, and a statement
            consenting to the jurisdiction of the federal court in your district (or,
            if outside the U.S., an appropriate judicial district).
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>9. Disclaimers</h2>
          <p className={BODY_TEXT_CLASS}>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DON&apos;T WARRANT
            THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT CLASSIFICATIONS
            OR VERDICTS WILL BE ACCURATE.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>10. Limitation of liability</h2>
          <p className={BODY_TEXT_CLASS}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, PREEVE WILL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
            LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE,
            EVEN IF WE&apos;VE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL
            LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER
            OF (A) THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS, OR (B) [PLACEHOLDER
            AMOUNT]. This limitation doesn&apos;t apply to liability that can&apos;t be limited
            by law.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>11. Dispute resolution and arbitration</h2>
          <p className={BODY_TEXT_CLASS}>
            Before filing a claim, you agree to first contact us and try to resolve
            the dispute informally. If we can&apos;t resolve it within 30 days, you and
            Preeve agree that any dispute, claim, or controversy arising out of or
            relating to these Terms or the Service will be resolved by binding
            individual arbitration, rather than in court, except that either party may
            bring an individual claim in small claims court if it qualifies.
          </p>
          <p className={BODY_TEXT_CLASS}>
            <strong>Class action waiver:</strong> You and Preeve agree that any
            arbitration or proceeding will be conducted only on an individual basis
            and not as a class, consolidated, or representative action.
          </p>
          <p className={MUTED_TEXT_CLASS}>
            [Placeholder: name the specific arbitration provider/rules you&apos;ll use
            (e.g. AAA Consumer Arbitration Rules) here once decided &mdash; this
            section needs a real arbitration body named to be enforceable.]
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>12. Governing law</h2>
          <p className={BODY_TEXT_CLASS}>
            These Terms are governed by the laws of{" "}
            <span className="font-semibold">[Your State]</span>, without regard to its
            conflict-of-laws principles, except where applicable law requires
            otherwise.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>13. Changes to these terms</h2>
          <p className={BODY_TEXT_CLASS}>
            We may revise these Terms from time to time. If we make material changes,
            we&apos;ll update the effective date above. Continuing to use Preeve after
            changes take effect means you accept the revised Terms.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>14. General terms</h2>
          <p className={BODY_TEXT_CLASS}>
            If any provision of these Terms is found unenforceable, the remaining
            provisions stay in effect. Our failure to enforce a provision isn&apos;t a
            waiver of it. These Terms, together with our Privacy Policy, are the
            entire agreement between you and Preeve regarding the Service.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>15. Contact us</h2>
          <p className={BODY_TEXT_CLASS}>
            Questions about these Terms? Contact us at{" "}
            <span className="font-semibold">[your contact email]</span>.
          </p>
        </section>

        <footer className="border-t border-[var(--color-text-muted)]/15 pt-6 pb-4">
          <p className={MUTED_TEXT_CLASS}>
            This page is a starting-point template, not legal advice. Review it with a
            lawyer &mdash; especially the arbitration and liability sections &mdash;
            before relying on it for a live, public product.
          </p>
        </footer>
      </div>
    </main>
  );
}
