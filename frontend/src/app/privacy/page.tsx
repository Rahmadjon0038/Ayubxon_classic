import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Message Assistant',
  description: 'Privacy policy and data deletion instructions for Message Assistant',
};

const CONTACT_EMAIL = 'abdullayevrahmadjon821@gmail.com';

const sections = [
  { id: 'scope', title: '1. Introduction and Scope' },
  { id: 'collect', title: '2. Information We Collect' },
  { id: 'use', title: '3. How We Use Information' },
  { id: 'ai', title: '4. AI Processing (OpenAI)' },
  { id: 'sharing', title: '5. Sharing and Third-Party Service Providers' },
  { id: 'legal-basis', title: '6. Legal Basis for Processing' },
  { id: 'security', title: '7. Storage, Security and Retention' },
  { id: 'rights', title: '8. Your Rights and Choices' },
  { id: 'deletion', title: '9. Data Deletion' },
  { id: 'children', title: '10. Children’s Privacy' },
  { id: 'transfers', title: '11. International Data Transfers' },
  { id: 'cookies', title: '12. Cookies and Local Storage' },
  { id: 'changes', title: '13. Changes to This Policy' },
  { id: 'contact', title: '14. Contact' },
];

// Meta App Review uchun ochiq sahifa — login talab qilinmaydi.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-800 dark:text-gray-200">
      <h1 className="text-3xl font-bold dark:text-gray-50">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Effective date: August 10, 2026</p>

      <p className="mt-6 leading-relaxed">
        Message Assistant (&quot;we&quot;, &quot;our&quot;, &quot;the app&quot;) is a customer
        messaging tool that allows a business to receive and reply to its own Instagram Direct
        messages from a web dashboard, with an optional AI assistant that can draft or send
        replies and organize conversations into leads. This Privacy Policy explains what
        information we collect, how we use and protect it, and the choices you have.
      </p>

      <nav className="mt-8 rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-2 font-semibold text-gray-600 dark:text-gray-300">On this page</p>
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
        <div id="scope">
          <h2 className="text-xl font-semibold">1. Introduction and Scope</h2>
          <p className="mt-2">
            This Policy applies to the Message Assistant dashboard and the data we process on
            behalf of a business (&quot;you&quot;) when you connect your Instagram professional
            account. It does not apply to Instagram, Meta, or OpenAI&apos;s own handling of data,
            which is governed by their respective privacy policies.
          </p>
        </div>

        <div id="collect">
          <h2 className="text-xl font-semibold">2. Information We Collect</h2>
          <p className="mt-2">When you connect your Instagram professional account, we receive and store, via the official Meta / Instagram API:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Your connected Instagram account&apos;s ID, username, name, and profile picture;</li>
            <li>Incoming and outgoing Direct messages of that account, including text and attachments (images, video, audio) and message reactions;</li>
            <li>Public profile information (Instagram-scoped ID, username, name, profile picture) of people who message your account (&quot;your contacts&quot;);</li>
            <li>Business information you configure yourself, such as services or courses offered, pricing, address, phone numbers, and promotions, used to power the AI assistant.</li>
          </ul>
          <p className="mt-2">We also collect the login email address and password (stored as a salted hash, never in plain text) of dashboard administrators, and minimal technical data such as request logs needed to operate and secure the Service.</p>
        </div>

        <div id="use">
          <h2 className="text-xl font-semibold">3. How We Use Information</h2>
          <p className="mt-2">We use the information described above to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Display your Instagram conversations in your dashboard inbox and let you reply to them;</li>
            <li>Let you organize contacts into leads with status labels (for example, interest level or whether they intend to sign up), including labels generated automatically by the AI assistant;</li>
            <li>Generate AI-assisted replies and conversation summaries when you enable that feature;</li>
            <li>Authenticate dashboard administrators and secure access to your data;</li>
            <li>Maintain and improve the reliability and security of the Service.</li>
          </ul>
          <p className="mt-2">We do not sell your data, show advertising based on it, or use it to train third-party advertising or profiling systems.</p>
        </div>

        <div id="ai">
          <h2 className="text-xl font-semibold">4. AI Processing (OpenAI)</h2>
          <p className="mt-2">
            If you enable the AI assistant, the text of a conversation (your contact&apos;s
            messages and recent conversation history) and the business information you configured
            are sent to OpenAI, a third-party AI service provider, in order to generate a reply
            and to classify the conversation for your leads view. OpenAI processes this data to
            return a response to us and, per its own policies, may retain API data briefly for
            abuse-monitoring purposes; we do not permit it to be used to train OpenAI&apos;s
            general-purpose models. No message content is sent to OpenAI unless the AI assistant
            is enabled for the relevant Instagram account. You can disable the AI assistant at any
            time from the dashboard, after which no further message content is sent to OpenAI.
          </p>
        </div>

        <div id="sharing">
          <h2 className="text-xl font-semibold">5. Sharing and Third-Party Service Providers</h2>
          <p className="mt-2">We do not sell or rent your data. We share data only with the service providers strictly necessary to operate the Service, currently:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Meta / Instagram — to send and receive your Direct messages via the official Instagram API;</li>
            <li>OpenAI — to generate AI-assisted replies and conversation classifications, only when you enable this feature (see Section 4);</li>
            <li>Our hosting and database infrastructure providers — to store and run the Service securely.</li>
          </ul>
          <p className="mt-2">We may also disclose information if required by law, legal process, or to protect the rights, property, or safety of our users or the public.</p>
        </div>

        <div id="legal-basis">
          <h2 className="text-xl font-semibold">6. Legal Basis for Processing</h2>
          <p className="mt-2">
            We process your data to perform our contract with you (providing the Service you
            signed up to use), based on your consent where you actively enable optional features
            such as the AI assistant, and based on our legitimate interest in operating, securing,
            and improving the Service.
          </p>
        </div>

        <div id="security">
          <h2 className="text-xl font-semibold">7. Storage, Security and Retention</h2>
          <p className="mt-2">
            Data is stored in a private database that is not publicly accessible. Instagram access
            tokens are encrypted at rest using AES-256-GCM. Access to the dashboard requires
            authentication, and administrator passwords are stored as salted hashes. We retain
            conversation and contact data for as long as your Instagram account remains connected
            and your dashboard account is active, so that you can continue to view your message
            history; we delete data upon request as described in Section 9, or automatically if an
            account has been disconnected and inactive for an extended period.
          </p>
        </div>

        <div id="rights">
          <h2 className="text-xl font-semibold">8. Your Rights and Choices</h2>
          <p className="mt-2">Depending on your location, you may have the right to request access to, correction of, or deletion of your data, to object to or restrict certain processing, and to receive a copy of your data in a portable format. You can exercise any of these rights by contacting us at the email address in Section 14.</p>
        </div>

        <div id="deletion">
          <h2 className="text-xl font-semibold">9. Data Deletion</h2>
          <p className="mt-2">
            You may request deletion of your data at any time by emailing{' '}
            <a className="text-blue-600 underline dark:text-blue-400" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{' '}
            from the email address associated with your account. Upon a verified request, we will
            delete all messages, contact records, business configuration, and access tokens
            associated with your account within 30 days, except where we are required to retain
            certain records to comply with legal obligations. Disconnecting the app from within
            Instagram (Settings → Apps and Websites → Remove) immediately revokes the Service&apos;s
            access to your Instagram account and stops any further data collection, independently
            of a deletion request.
          </p>
        </div>

        <div id="children">
          <h2 className="text-xl font-semibold">10. Children&rsquo;s Privacy</h2>
          <p className="mt-2">
            The Service is a business tool intended for use by adults managing a business
            Instagram account and is not directed at children. We do not knowingly collect
            personal information from children under 13 (or the minimum age required by local
            law) beyond what may incidentally appear in a Direct message sent to a connected
            business account by a third party.
          </p>
        </div>

        <div id="transfers">
          <h2 className="text-xl font-semibold">11. International Data Transfers</h2>
          <p className="mt-2">
            Our service providers, including OpenAI, may process data in countries other than
            your own, including the United States. Where this occurs, we rely on the safeguards
            provided by those providers, such as their standard contractual clauses and security
            certifications, to protect your data.
          </p>
        </div>

        <div id="cookies">
          <h2 className="text-xl font-semibold">12. Cookies and Local Storage</h2>
          <p className="mt-2">
            The dashboard does not use third-party advertising or tracking cookies. It stores a
            login session token and a small number of display preferences (such as whether the
            sidebar is collapsed) in your browser&apos;s local storage, solely to keep you signed
            in and to remember your interface preferences.
          </p>
        </div>

        <div id="changes">
          <h2 className="text-xl font-semibold">13. Changes to This Policy</h2>
          <p className="mt-2">
            We may update this Policy from time to time. The &quot;Effective date&quot; above
            reflects the date of the latest revision. If changes are material, we will make
            reasonable efforts to notify administrators of connected accounts.
          </p>
        </div>

        <div id="contact">
          <h2 className="text-xl font-semibold">14. Contact</h2>
          <p className="mt-2">
            Questions about this Policy, or requests regarding your data, can be sent to{' '}
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
