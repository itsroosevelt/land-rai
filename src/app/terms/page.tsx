import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';

export const metadata = {
    title: 'Terms of Service | Roosevelt',
    description: 'The terms that govern the use of Roosevelt, operated by Luxor Intelligence LLC.',
};

const CONTACT = 'legal@itsroosevelt.com';

const sections: LegalSection[] = [
    {
        heading: 'Agreement',
        body: [
            'These Terms of Service ("Terms") govern your access to and use of Roosevelt (itsroosevelt.com) (the "Service"), operated by Luxor Intelligence LLC ("Luxor Intelligence", "we", "us"). Other products in our ecosystem may have their own terms on their websites. By creating an account or using the Service you agree to these Terms and to our Privacy Policy.',
        ],
    },
    {
        heading: 'Eligibility and accounts',
        body: [
            'You must be at least 18 years old and able to enter into a binding contract. You are responsible for your account credentials and for all activity under your account. You must provide accurate information and keep it up to date. If you use the Service on behalf of a business, you confirm you have authority to bind it.',
        ],
    },
    {
        heading: 'The Service',
        body: [
            'Roosevelt lets you create personal and business profiles and manage communications, customers, marketing, finances and operations, including by connecting third-party channels and using AI-assisted features. We may add, change or discontinue features. Some modules may be provided as previews or templates.',
        ],
    },
    {
        heading: 'Third-party services and integrations',
        body: [
            'You may connect third-party services such as Meta (Facebook, Instagram, WhatsApp), Google (Gmail), Telegram, X and Stripe. You authorize us to access and act on those accounts as you configure. You are responsible for holding the rights and permissions to connect them and for complying with their terms and policies (for example the WhatsApp Business and Meta Platform Terms), including rules on consent, messaging windows and templates. We are not responsible for third-party services, and they may change or restrict access at any time.',
        ],
    },
    {
        heading: 'Your content and data',
        body: [
            'You retain ownership of the content and data you submit or connect ("Customer Data"). You grant us a limited license to host, process and transmit it solely to provide and secure the Service as described in the Privacy Policy. You are responsible for the lawfulness of Customer Data and for having all required consents to message the people you contact through the Service.',
        ],
    },
    {
        heading: 'AI-assisted features',
        body: [
            'AI outputs may be inaccurate, incomplete or inappropriate. You are responsible for reviewing outputs and for decisions and messages sent using them, especially to customers. Do not rely on AI features for legal, medical, financial or other professional advice.',
        ],
    },
    {
        heading: 'Acceptable use',
        body: [
            'You agree not to:',
            [
                'send spam, unsolicited or unlawful messages, or violate the policies of any connected channel;',
                'attempt to access other customers\' data, bypass security or isolation, or probe or disrupt the Service;',
                'use the Service for illegal, deceptive, harassing, infringing or harmful activity;',
                'reverse engineer or resell the Service except as expressly permitted;',
                'upload malware or abuse API, messaging or AI resources.',
            ],
            'We may suspend or terminate access that we reasonably believe violates these Terms or puts the Service or others at risk.',
        ],
    },
    {
        heading: 'Plans, payments and cancellation',
        body: [
            'Paid plans are billed in advance through Stripe or via supported on-chain payments, at the price shown at checkout, and may renew automatically for the same period unless cancelled. You can cancel at any time from your account; cancellation takes effect at the end of the current billing period. Except where required by law, fees are non-refundable. On-chain transactions are irreversible. We may change prices with advance notice for future periods.',
        ],
    },
    {
        heading: 'Intellectual property',
        body: [
            'The Service, including software, design and trademarks, is owned by Luxor Intelligence LLC or its licensors and is protected by law. Subject to these Terms, we grant you a limited, non-exclusive, non-transferable right to use the Service. Feedback you provide may be used by us without obligation.',
        ],
    },
    {
        heading: 'Disclaimers',
        body: [
            'The Service is provided "as is" and "as available" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the Service will be uninterrupted or error-free, or that third-party channels will remain available.',
        ],
    },
    {
        heading: 'Limitation of liability',
        body: [
            'To the maximum extent permitted by law, Luxor Intelligence LLC will not be liable for indirect, incidental, special, consequential or punitive damages, or for loss of profits, revenue, data or goodwill. Our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the event giving rise to the claim.',
        ],
    },
    {
        heading: 'Indemnity',
        body: ['You will defend and indemnify Luxor Intelligence LLC against claims arising from your Customer Data, your use of connected channels, or your violation of these Terms or applicable law.'],
    },
    {
        heading: 'Termination',
        body: [
            'You may stop using the Service and delete your account at any time. We may suspend or terminate the Service or your access for breach of these Terms or as required by law. Sections that by their nature should survive termination will survive. See /data-deletion for how your data is deleted.',
        ],
    },
    {
        heading: 'Changes, governing law and contact',
        body: [
            'We may update these Terms; the updated version will be posted here with a new date, and continued use after the change means you accept it. These Terms are governed by the laws of the jurisdiction in which Luxor Intelligence LLC is organized, without regard to conflict-of-law rules, and disputes will be resolved in the competent courts of that jurisdiction unless the law requires otherwise.',
            `Legal questions: ${CONTACT}. Support: support@itsroosevelt.com.`,
        ],
    },
];

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            updated="October 4, 2026"
            intro="Please read these Terms carefully. They form a legal agreement between you and Luxor Intelligence LLC for the use of Roosevelt."
            sections={sections}
        />
    );
}
