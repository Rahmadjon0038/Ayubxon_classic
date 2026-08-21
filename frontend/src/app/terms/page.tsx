import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Message Assistant',
  description: 'Terms of service for Message Assistant',
};

const CONTACT_EMAIL = 'abdullayevrahmadjon821@gmail.com';

const sections = [
  { id: 'about', title: '1. About the Service' },
  { id: 'eligibility', title: '2. Eligibility and Your Account' },
  { id: 'instagram-connection', title: '3. Connecting Your Instagram Account' },
  { id: 'ai-features', title: '4. AI-Assisted Replies and Lead Insights' },
  { id: 'acceptable-use', title: '5. Acceptable Use' },
  { id: 'your-content', title: '6. Your Content and Responsibility' },
  { id: 'fees', title: '7. Fees' },
  { id: 'availability', title: '8. Availability and Changes to the Service' },
  { id: 'ip', title: '9. Intellectual Property' },
  { id: 'warranty', title: '10. Disclaimer of Warranties' },
  { id: 'liability', title: '11. Limitation of Liability' },
  { id: 'indemnification', title: '12. Indemnification' },
  { id: 'suspension', title: '13. Suspension and Termination' },
  { id: 'changes', title: '14. Changes to These Terms' },
  { id: 'law', title: '15. Governing Law' },
  { id: 'contact', title: '16. Contact' },
];

// Meta App Review uchun ochiq sahifa — login talab qilinmaydi.
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-800 dark:text-tg-text">
      <h1 className="text-3xl font-bold dark:text-tg-text">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-tg-textMuted">Effective date: August 10, 2026</p>

      <p className="mt-6 leading-relaxed">
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of Message
        Assistant (&quot;Message Assistant&quot;, &quot;the Service&quot;, &quot;we&quot;,
        &quot;us&quot;, &quot;our&quot;), a dashboard that lets a business manage the Direct
        messages of its own Instagram professional account through the official Meta / Instagram
        API, including optional AI-assisted reply and lead-organization features. By creating an
        account, connecting an Instagram professional account, or otherwise using the Service, you
        agree to be bound by these Terms. If you do not agree, do not use the Service.
      </p>

      <nav className="mt-8 rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm dark:border-tg-border dark:bg-tg-panel">
        <p className="mb-2 font-semibold text-gray-600 dark:text-tg-textMuted">On this page</p>
        <ol className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400" href={`#${s.id}`}>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section className="mt-10 space-y-8 leading-relaxed">
        <div id="about">
          <h2 className="text-xl font-semibold">1. About the Service</h2>
          <p className="mt-2">
            Message Assistant lets an authorized business team member connect one or more
            Instagram professional (business or creator) accounts, view and reply to Direct
            messages from a single web dashboard, organize contacts as &quot;leads&quot; with
            status labels, and optionally enable an AI assistant that drafts or sends first-line
            replies on the business&apos;s behalf, based on information the business provides
            (such as services offered, pricing, and location).
          </p>
        </div>

        <div id="eligibility">
          <h2 className="text-xl font-semibold">2. Eligibility and Your Account</h2>
          <p className="mt-2">
            You must be at least 18 years old and legally able to enter into a binding agreement
            to use the Service. You are responsible for maintaining the confidentiality of your
            login credentials and for all activity that occurs under your account. Notify us
            immediately at{' '}
            <a className="text-blue-600 underline dark:text-blue-400" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{' '}
            if you suspect unauthorized use of your account.
          </p>
        </div>

        <div id="instagram-connection">
          <h2 className="text-xl font-semibold">3. Connecting Your Instagram Account</h2>
          <p className="mt-2">
            By connecting an Instagram account to the Service, you represent and warrant that you
            are the owner of that account or are authorized by the owner to manage its Direct
            messages, and that you will use the Service in accordance with Instagram&apos;s Terms
            of Use, the Meta Platform Terms, and the Meta / Instagram Platform Policy. You may
            disconnect your Instagram account at any time from within Instagram (Settings →
            Apps and Websites → Remove) or by requesting removal from us; either action revokes
            the Service&apos;s access to your account.
          </p>
        </div>

        <div id="ai-features">
          <h2 className="text-xl font-semibold">4. AI-Assisted Replies and Lead Insights</h2>
          <p className="mt-2">
            If you enable the optional AI assistant, incoming Direct message text from your
            contacts, together with information you provide about your business, is sent to a
            third-party AI provider to generate a suggested or automatic reply, and to classify
            conversations (for example, by interest level or likelihood to purchase) so they can
            be organized in your leads view. AI-generated replies are produced automatically and
            may occasionally be inaccurate, incomplete, or inappropriate for a given situation.
            You remain solely responsible for the content sent to your customers through your
            connected Instagram account, whether written by you or generated by the AI assistant,
            and you can disable the AI assistant or take over any conversation at any time from
            the dashboard.
          </p>
        </div>

        <div id="acceptable-use">
          <h2 className="text-xl font-semibold">5. Acceptable Use</h2>
          <p className="mt-2">You agree not to use the Service to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Send unsolicited bulk messages, spam, or content that violates Instagram&apos;s Community Guidelines or the Meta Platform Policy;</li>
            <li>Send unlawful, fraudulent, deceptive, harassing, hateful, or sexually explicit content;</li>
            <li>Attempt to access another business&apos;s account, data, or conversations without authorization;</li>
            <li>Reverse-engineer, scrape, or interfere with the normal operation or security of the Service;</li>
            <li>Use the Service in any way that could cause Instagram or Meta to restrict, suspend, or terminate your account or ours.</li>
          </ul>
        </div>

        <div id="your-content">
          <h2 className="text-xl font-semibold">6. Your Content and Responsibility</h2>
          <p className="mt-2">
            &quot;Your Content&quot; means the business information you configure (such as
            services, pricing, and contact details), the messages you or the AI assistant send,
            and any files you upload or send through the dashboard. You retain ownership of Your
            Content. You are responsible for ensuring Your Content is accurate, lawful, and that
            you have all rights necessary to send it to your customers.
          </p>
        </div>

        <div id="fees">
          <h2 className="text-xl font-semibold">7. Fees</h2>
          <p className="mt-2">
            Unless otherwise agreed with you in writing, the Service is currently provided free of
            charge. We may introduce paid plans in the future; if we do, we will give you
            reasonable advance notice before any fees apply to your account.
          </p>
        </div>

        <div id="availability">
          <h2 className="text-xl font-semibold">8. Availability and Changes to the Service</h2>
          <p className="mt-2">
            The Service depends on the availability of the Meta / Instagram API and, when the AI
            assistant is enabled, on a third-party AI provider. We do not guarantee uninterrupted
            or error-free operation and are not responsible for outages, rate limits, or policy
            changes imposed by Meta or our other service providers. We may add, change, or remove
            features of the Service at any time.
          </p>
        </div>

        <div id="ip">
          <h2 className="text-xl font-semibold">9. Intellectual Property</h2>
          <p className="mt-2">
            The Service, including its software, design, and branding, is owned by us or our
            licensors and is protected by intellectual property laws. These Terms do not grant you
            any right to use our trademarks or branding without prior written permission.
          </p>
        </div>

        <div id="warranty">
          <h2 className="text-xl font-semibold">10. Disclaimer of Warranties</h2>
          <p className="mt-2">
            The Service is provided &quot;as is&quot; and &quot;as available&quot;, without
            warranties of any kind, whether express, implied, or statutory, including but not
            limited to warranties of merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that AI-generated content will be accurate or
            error-free.
          </p>
        </div>

        <div id="liability">
          <h2 className="text-xl font-semibold">11. Limitation of Liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, we will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or any loss of profits,
            revenue, data, or business opportunities, arising out of or related to your use of the
            Service, including messages sent by the AI assistant on your behalf.
          </p>
        </div>

        <div id="indemnification">
          <h2 className="text-xl font-semibold">12. Indemnification</h2>
          <p className="mt-2">
            You agree to indemnify and hold us harmless from any claims, damages, liabilities, and
            expenses (including reasonable legal fees) arising from your use of the Service, Your
            Content, or your violation of these Terms or applicable law.
          </p>
        </div>

        <div id="suspension">
          <h2 className="text-xl font-semibold">13. Suspension and Termination</h2>
          <p className="mt-2">
            We may suspend or terminate your access to the Service, in whole or in part, at any
            time and without prior notice, if we reasonably believe you have violated these Terms,
            misused the Service, or violated Instagram&apos;s or Meta&apos;s policies, or if
            required to do so by Meta. You may stop using the Service and disconnect your
            Instagram account at any time.
          </p>
        </div>

        <div id="changes">
          <h2 className="text-xl font-semibold">14. Changes to These Terms</h2>
          <p className="mt-2">
            We may update these Terms from time to time. The &quot;Effective date&quot; above
            reflects the date of the latest revision. Continuing to use the Service after changes
            take effect constitutes acceptance of the revised Terms. If changes are material, we
            will make reasonable efforts to notify you.
          </p>
        </div>

        <div id="law">
          <h2 className="text-xl font-semibold">15. Governing Law</h2>
          <p className="mt-2">
            These Terms are governed by the laws of the Republic of Uzbekistan, without regard to
            its conflict-of-law principles, unless a mandatory local law applicable to you
            provides otherwise.
          </p>
        </div>

        <div id="contact">
          <h2 className="text-xl font-semibold">16. Contact</h2>
          <p className="mt-2">
            Questions about these Terms can be sent to{' '}
            <a className="text-blue-600 underline dark:text-blue-400" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
