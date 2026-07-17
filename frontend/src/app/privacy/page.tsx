import Link from "next/link";
import { ThemeToggle } from "../themeToggle";

const PAGE_HEADING_CLASS =
  "font-serif text-5xl font-semibold tracking-normal text-[var(--color-text)] " +
  "sm:text-6xl";
const SECTION_HEADING_CLASS =
  "font-sans text-2xl font-semibold tracking-normal text-[var(--color-text)]";
const SUBSECTION_HEADING_CLASS =
  "font-sans text-base font-semibold text-[var(--color-text)]";
const BODY_TEXT_CLASS = "text-base leading-7 text-[var(--color-text)]";
const MUTED_TEXT_CLASS = "text-sm leading-6 text-[var(--color-text-muted)]";
const LIST_CLASS = "list-disc space-y-2 pl-6 text-base leading-7 text-[var(--color-text)]";
const SECTION_CLASS = "space-y-4 border-t border-[var(--color-text-muted)]/15 pt-10";

export default function PrivacyPage() {
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
          <h1 className={PAGE_HEADING_CLASS}>Privacy Policy</h1>
          <p className={MUTED_TEXT_CLASS}>
            Effective date: [DATE]. This is a placeholder date &mdash; update it when
            this policy is actually published.
          </p>
          <p className={BODY_TEXT_CLASS}>
            This Privacy Policy explains what information Preeve (&quot;Preeve,&quot;
            &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects when you use our website
            and app (the &quot;Service&quot;), how we use it, and the choices you have. By using
            Preeve, you agree to the practices described here. If you do not agree, please do not
            use the Service.
          </p>
        </header>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>1. Information we collect</h2>

          <h3 className={SUBSECTION_HEADING_CLASS}>Account information</h3>
          <p className={BODY_TEXT_CLASS}>
            We use Clerk, a third-party authentication provider, to handle sign-up and
            login. Depending on how you sign up, Clerk collects and manages your email
            address, password (stored by Clerk, never by us directly), and any
            information from a social/OAuth provider you choose to use. We receive your
            email address and account identifier from Clerk to associate your wardrobe
            data with your account.
          </p>

          <h3 className={SUBSECTION_HEADING_CLASS}>Photos you upload</h3>
          <p className={BODY_TEXT_CLASS}>
            When you scan or upload a photo of a clothing item, that photo is stored on
            our behalf by Cloudflare R2 (our cloud storage provider) and is sent to
            Replicate, a third-party machine learning inference provider, which runs an
            image-classification model to identify the item&apos;s category and color. We
            do not use your photos to train our own models, and we do not sell or share
            your photos with advertisers.
          </p>

          <h3 className={SUBSECTION_HEADING_CLASS}>Style preferences and wardrobe data</h3>
          <p className={BODY_TEXT_CLASS}>
            We store the style preferences you set (preferred colors, formality level),
            the classification results and any manual corrections for each item you
            scan, and the Buy/Maybe/Skip verdict we generate. This data is stored in our
            database and is used solely to operate the Service for your account.
          </p>

          <h3 className={SUBSECTION_HEADING_CLASS}>Local preferences</h3>
          <p className={BODY_TEXT_CLASS}>
            We store your light/dark theme preference in your browser&apos;s local storage.
            This stays on your device and is not sent to us.
          </p>

          <p className={BODY_TEXT_CLASS}>
            We do not currently run third-party advertising or analytics trackers on
            Preeve. If that changes, we&apos;ll update this section before we do.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>2. How we use your information</h2>
          <ul className={LIST_CLASS}>
            <li>To create and maintain your account and authenticate you.</li>
            <li>
              To classify the clothing items you photograph (category and color) using
              our third-party classification provider.
            </li>
            <li>
              To generate a personalized Buy/Maybe/Skip verdict based on your stated
              style preferences.
            </li>
            <li>To maintain your wardrobe log so you can view your scan history.</li>
            <li>To operate, maintain, and improve the Service.</li>
            <li>To comply with legal obligations and enforce our Terms of Service.</li>
          </ul>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>3. Who we share information with</h2>
          <p className={BODY_TEXT_CLASS}>
            We don&apos;t sell your personal information. We share information only with the
            service providers who help us run Preeve, each of whom is contractually
            limited to using your data to provide their service to us:
          </p>
          <ul className={LIST_CLASS}>
            <li>
              <strong>Clerk</strong> &mdash; authentication and account management.
            </li>
            <li>
              <strong>Cloudflare R2</strong> &mdash; storage for the photos you upload.
            </li>
            <li>
              <strong>Replicate</strong> &mdash; runs the machine learning model that
              identifies category and color from your photos.
            </li>
            <li>
              Our database and application hosting providers, who store and run the
              Service on our behalf.
            </li>
          </ul>
          <p className={BODY_TEXT_CLASS}>
            We may also disclose information if required by law, to protect the rights
            and safety of Preeve or our users, or as part of a business transition
            (such as a merger or acquisition), in which case your information may be
            transferred as one of the business&apos;s assets.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>4. Your rights and choices</h2>
          <p className={BODY_TEXT_CLASS}>
            You can review your account email and membership date, log out, or
            permanently delete your account at any time from the{" "}
            <Link className="font-semibold text-[var(--color-accent)]" href="/settings">
              Settings
            </Link>{" "}
            page. Deleting your account removes your wardrobe items, preferences, and
            scan history from our systems. Some information may be retained where
            required by law or for legitimate backup/audit purposes for a limited
            period after deletion.
          </p>
          <p className={BODY_TEXT_CLASS}>
            You can also contact us directly (see Section 8) to ask what information we
            hold about you or to request its deletion outside of the Settings page.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>5. Data retention and security</h2>
          <p className={BODY_TEXT_CLASS}>
            We retain your account and wardrobe data for as long as your account is
            active, or as needed to provide the Service. If you delete your account,
            we delete the associated data from our active systems, subject to the
            limited retention described above. We take reasonable technical and
            organizational measures to protect your information, but no method of
            transmission or storage is completely secure, and we can&apos;t guarantee
            absolute security.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>6. Children&apos;s privacy</h2>
          <p className={BODY_TEXT_CLASS}>
            Preeve is not directed at children under 13, and we don&apos;t knowingly collect
            personal information from anyone under 13. If you believe a child under 13
            has provided us with personal information, please contact us and we will
            delete it.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>7. Changes to this policy</h2>
          <p className={BODY_TEXT_CLASS}>
            We may update this Privacy Policy from time to time. If we make material
            changes, we&apos;ll update the effective date above and, where appropriate,
            notify you directly. Continuing to use Preeve after changes take effect
            means you accept the updated policy.
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_HEADING_CLASS}>8. Contact us</h2>
          <p className={BODY_TEXT_CLASS}>
            If you have questions about this Privacy Policy or want to exercise a
            privacy right described above, contact us at{" "}
            <span className="font-semibold">[your contact email]</span>.
          </p>
        </section>

        <footer className="border-t border-[var(--color-text-muted)]/15 pt-6 pb-4">
          <p className={MUTED_TEXT_CLASS}>
            This page is a starting-point template, not legal advice. Review it with a
            lawyer before relying on it for a live, public product.
          </p>
        </footer>
      </div>
    </main>
  );
}
