import type { Metadata } from "next";
import Link from "next/link";
import { MoveLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How we collect, use, and protect your data.",
};

const SECTION_TITLE = "mb-3 text-lg font-bold text-foreground flex items-center gap-2";
const LIST_STYLES = "list-disc space-y-2 pl-5 marker:text-foreground";
const STRONG_TEXT = "font-medium text-foreground";
const LI_STYLES = "flex flex-col";
const SPAN_STYLES = "text-sm";

export default function PrivacyPage() {
  return (
    <div className="animate-fade-in container mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center text-sm transition-colors"
      >
        <MoveLeft size={16} className="mr-2" />
        Back to Home
      </Link>

      <header className="mb-10 border-b pb-6">
        <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>Effective date: January 26, 2025</span>
        </div>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm md:text-base">
        <section>
          <h2 className={SECTION_TITLE}>1. Introduction</h2>
          <p className="leading-relaxed">
            Welcome to Doxynix (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). We respect your
            privacy and are committed to protecting your personal data. This document explains what
            data we collect and how we use it when you use doxynix.space.
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>2. Data We Collect</h2>
          <ul className={LIST_STYLES}>
            <li>
              <span className={STRONG_TEXT}>Account:</span> Name, Email, and Avatar. We receive this
              data automatically when you sign in via GitHub, Google, Yandex, or Magic Link.
            </li>
            <li>
              <span className={STRONG_TEXT}>Technical Data:</span> IP address, device type, browser
              data, and Cookies (used solely for authentication and analytics, without sharing with
              third parties for advertising purposes).
            </li>
            <li>
              <p>
                <span className={STRONG_TEXT}>Source Code:</span> We access your repositories in{" "}
                <u>Read-Only</u> mode and only during documentation generation.
              </p>
            </li>
          </ul>
          <p>
            <span className="text-destructive font-medium">Important:</span> We{" "}
            <strong>do not store</strong> your code in our database. It is processed in RAM and
            deleted immediately after analysis.{" "}
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>3. How We Use Your Data</h2>
          <ul className={LIST_STYLES}>
            <li>To generate documentation, diagrams, and code metrics.</li>
            <li>For authorization and saving your report history.</li>
            <li>To send important notifications (e.g., API changes).</li>
          </ul>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>4. Third-Party Services (Subprocessors)</h2>
          <p className="mb-3">
            We use trusted partners to operate the service. We transfer only the data necessary to
            perform specific technical tasks:
          </p>
          <div className="bg-muted/50 rounded-xl border p-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              <li className={LI_STYLES}>
                <span className={STRONG_TEXT}>Vercel</span>
                <span className={SPAN_STYLES}>
                  Hosting, Edge Network, and performance analytics.
                </span>
              </li>

              <li className={LI_STYLES}>
                <span className={STRONG_TEXT}>Neon (PostgreSQL)</span>
                <span className={SPAN_STYLES}>Primary encrypted data storage.</span>
              </li>

              <li className={LI_STYLES}>
                <span className={STRONG_TEXT}>Resend</span>
                <span className={SPAN_STYLES}>Transactional emails for login.</span>{" "}
              </li>

              <li className={LI_STYLES}>
                <span className={STRONG_TEXT}>OAuth Providers</span>
                <span className={SPAN_STYLES}>GitHub, Google, Yandex</span>
              </li>

              <li className={LI_STYLES}>
                <span className={STRONG_TEXT}>Upstash / Redis</span>
                <span className={SPAN_STYLES}>Caching and task queue management.</span>
              </li>
              <li className={LI_STYLES}>
                <span className={STRONG_TEXT}>Axiom</span>
                <span className={SPAN_STYLES}>
                  System error logging and diagnostics (retained for 30 days).
                </span>
              </li>
              <li className={LI_STYLES}>
                <span className={STRONG_TEXT}>UploadThing</span>
                <span className={SPAN_STYLES}>Storage for user files and avatars.</span>
              </li>
              <li className={LI_STYLES}>
                <span className={STRONG_TEXT}>Pusher</span>
                <span className={SPAN_STYLES}>WebSocket support (real-time updates).</span>
              </li>
            </ul>
          </div>
          <p className="text-muted-foreground mt-4 text-sm italic">
            All listed providers are industry leaders and ensure data protection in accordance with
            international standards (GDPR, SOC2) as governed by their terms of use.
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>5. Your Rights</h2>
          <p>
            You have the right to request deletion of all your data at any time. To do this, email
            us or use the &quot;Delete Account&quot; button in profile settings. Deletion is
            irreversible.
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>6. Contact</h2>
          <p>If you have any questions, please contact us.</p>
          <div className="mt-4">
            <a
              href="mailto:support@doxynix.space?subject=Privacy Policy Question"
              className="hover:no-underline"
            >
              support@doxynix.space
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
