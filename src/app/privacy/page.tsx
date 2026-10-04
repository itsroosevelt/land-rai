import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';

export const metadata = {
    title: 'Privacy Policy | Roosevelt',
    description: 'How Roosevelt, operated by Luxor Intelligence LLC, collects, uses and protects personal data.',
};

const CONTACT = 'legal@itsroosevelt.com';

const sections: LegalSection[] = [
    {
        heading: 'Who we are',
        body: [
            'Roosevelt (itsroosevelt.com) is an AI-powered assistant that helps people and businesses manage their communications, customers, marketing and operations. It is operated by Luxor Intelligence LLC ("Luxor Intelligence", "we", "us"), which also operates other products listed on luxorintelligence.com.',
            'This policy explains how we handle personal data when you use Roosevelt. Other products in our ecosystem may publish their own notices on their websites.',
            `Contact: ${CONTACT}.`,
        ],
    },
    {
        heading: 'Information we collect',
        body: [
            [
                'Account data: name, email address, profile picture and sign-in identifiers when you register or sign in with a provider such as Google.',
                'Workspace data you create: business or personal profiles, contacts, customer records, tasks, boards and settings.',
                'Connected-channel data: when you connect a channel (WhatsApp, Messenger, Instagram, Telegram, X, Gmail), we receive the messages, comments, sender identifiers, page or account identifiers and access tokens needed to operate that channel for you.',
                'Payment data: subscriptions are processed by Stripe or by on-chain payments on Solana. We do not store full card numbers; we keep payment identifiers, plan and status. Public wallet addresses and transaction signatures are public by nature.',
                'Technical data: IP address, device and browser information, logs and diagnostics used for security and reliability.',
            ],
        ],
    },
    {
        heading: 'Data we receive from Meta and other platforms',
        body: [
            'When you choose to connect a Facebook Page, Instagram professional account or WhatsApp Business account, we access only the data and permissions you grant through the provider\'s own authorization screen. This may include Page and account identifiers, messages sent to your business, comments on your posts, and basic profile information of people who contact you.',
            'We use this data only to provide the features you request: showing and answering conversations, running automations you configure, organizing contacts, publishing content and reporting. We do not sell this data, do not use it for advertising profiling, and do not transfer it to data brokers.',
            'Gmail: our use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. Gmail data is used only to provide the email features you enable inside the product.',
        ],
    },
    {
        heading: 'How we use information',
        body: [
            [
                'To provide, operate, secure and improve the platform and the channels you connect.',
                'To generate AI-assisted replies, summaries and reports at your request. Content you submit for these features is processed by our AI providers (for example Google Gemini) solely to return a result to you.',
                'To process payments, prevent fraud and abuse, and comply with legal obligations.',
                'To communicate with you about your account, security and service changes.',
            ],
            'Each customer\'s workspace is isolated: your data is stored under your own account and is not visible to other customers.',
        ],
    },
    {
        heading: 'Service providers and sharing',
        body: [
            'We share data only with providers that help us run the service, under appropriate agreements, and when required by law:',
            [
                'Google Cloud / Firebase (authentication, database, storage) and Vercel (hosting).',
                'Stripe (card payments) and Solana network infrastructure (on-chain payments).',
                'Meta Platforms, Google, Telegram and X, when you connect their services.',
                'AI model providers used for features you invoke.',
            ],
            'We may disclose information to comply with law, enforce our terms or protect rights and safety, or in connection with a merger or sale of assets (with notice to you where required).',
        ],
    },
    {
        heading: 'Retention',
        body: [
            'We keep data for as long as your account is active and as needed to provide the service. When you disconnect an integration, we stop receiving data from it and delete its access tokens. When you delete your account or request deletion, we delete or anonymize your data within 30 days, except where we must retain records for legal, tax or security reasons.',
        ],
    },
    {
        heading: 'Security',
        body: [
            'We use access controls, per-customer data isolation, encrypted transport, verification of webhook signatures from providers and least-privilege access to credentials. No system is perfectly secure; please protect your account credentials.',
        ],
    },
    {
        heading: 'Your rights and choices',
        body: [
            'Depending on where you live (for example under GDPR, UK GDPR or the CCPA/CPRA), you may have the right to access, correct, export or delete your personal data, to object to or restrict certain processing, and to withdraw consent. You can disconnect any channel at any time from the Integrations page, and revoke our access from the provider\'s settings (for example Facebook Settings → Business Integrations).',
            `To exercise your rights, email ${CONTACT}. See also our Data Deletion page at /data-deletion.`,
        ],
    },
    {
        heading: 'International transfers',
        body: ['Our providers may process data in the United States and other countries. Where required, we rely on appropriate safeguards for international transfers.'],
    },
    {
        heading: 'Children',
        body: ['Our services are not directed to children under 18 and we do not knowingly collect their personal data. If you believe a child has provided us data, contact us and we will delete it.'],
    },
    {
        heading: 'Changes to this policy',
        body: ['We may update this policy from time to time. We will post the new version here with a new "last updated" date and, for material changes, notify you through the product or by email.'],
    },
    {
        heading: 'Contact',
        body: [`Luxor Intelligence LLC, 470 W 200 N, Salt Lake City, UT 84103, USA. Email: ${CONTACT}. General support: support@itsroosevelt.com. Careers: careers@itsroosevelt.com.`],
    },
];

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            updated="October 4, 2026"
            intro="Your privacy matters to us. This Privacy Policy describes what personal data Roosevelt, operated by Luxor Intelligence LLC, collects, how we use it, and the choices you have."
            sections={sections}
        />
    );
}
