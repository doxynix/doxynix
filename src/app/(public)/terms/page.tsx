import type { Metadata } from "next";
import Link from "next/link";
import { MoveLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Doxynix Terms of Service.",
};

const SECTION_TITLE = "mb-3 text-lg font-bold text-foreground flex items-center gap-2";
const LIST_STYLES = "list-disc space-y-2 pl-5 marker:text-foreground";
const STRONG_TEXT = "font-medium text-foreground";

export default function TermsPage() {
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
        <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">Terms of Service</h1>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>Last updated: January 26, 2025</span>
        </div>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm md:text-base">
        <section>
          <h2 className={SECTION_TITLE}>1. Acceptance of Terms</h2>
          <p className="leading-relaxed">
            Welcome to Doxynix. By using our website (doxynix.space) and analytics tools, you
            unconditionally agree to these terms. The service is not intended for persons under 13.
            By registering with Doxynix, you confirm that you are 13 years of age or older. If you
            do not agree with any point, please stop using the service.
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>2. Usage Rules</h2>
          <p className="mb-3">
            You agree to use the service only for lawful purposes. You are prohibited from:
          </p>
          <ul className={LIST_STYLES}>
            <li>
              Using the service to analyze malware, viruses, or code that violates third-party
              rights.
            </li>
            <li>Attempting to disrupt the service (DDoS attacks, injections, API abuse).</li>
            <li>Attempting to access other users&apos; accounts or private data.</li>
            <li>Reverse engineering Doxynix algorithms.</li>
          </ul>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>3. Intellectual Property</h2>
          <div className="bg-muted/50 rounded-xl border p-4">
            <p className="mb-2">
              <span className={STRONG_TEXT}>Your Data:</span> We do not claim rights to your source
              code. All code you analyze via Doxynix remains your property.
            </p>
            <p>
              <span className={STRONG_TEXT}>Our Service:</span> The Doxynix interface itself, logos,
              documentation generation algorithms, and design are our intellectual property.
            </p>
          </div>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>4. Subscriptions & Billing</h2>
          <p>
            Basic features are provided for free. We reserve the right to introduce paid (Premium)
            plans in the future. You will be notified of billing changes in advance. Refunds for
            digital services are not provided unless required by law.
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>5. Disclaimer (AS IS)</h2>
          <p className="mb-2 italic">This is an important section. Please read it carefully.</p>
          <div className="border-muted-foreground border-l-2 pl-4">
            <p>
              The service is provided on an <strong>&quot;as is&quot;</strong> basis. We strive for
              analysis accuracy but do not guarantee that generated documentation will completely
              match your code or that the service will operate without errors or interruptions.
            </p>
            <p>
              We are not liable for any direct or indirect losses (including loss of data or profit)
              arising from the use of Doxynix. You use analysis results at your own risk.
            </p>
          </div>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>6. Termination of Access</h2>
          <p>
            We reserve the right to block or delete your account without prior notice if you violate
            these terms (e.g., attempting to crash our server).
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>7. Contact</h2>
          <p>For legal inquiries and service usage questions, contact us:</p>
          <div className="mt-4">
            <a
              href="mailto:support@doxynix.space?subject=Terms of Service Inquiry"
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
