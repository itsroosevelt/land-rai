import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';

export const metadata = {
    title: 'Data Deletion Instructions | Roosevelt',
    description: 'How to delete your data from Roosevelt and how to remove the app from Facebook, Instagram and WhatsApp.',
};

const CONTACT = 'legal@itsroosevelt.com';

const sections: LegalSection[] = [
    {
        heading: 'Remove the app from Facebook / Instagram',
        body: [
            'You can revoke Roosevelt\'s access at any time from Meta:',
            [
                'Facebook: Settings & privacy → Settings → Business Integrations (or "Apps and Websites") → select Roosevelt → Remove.',
                'Instagram: Settings → Website permissions / Apps and websites → select Roosevelt → Remove.',
            ],
            'After removal we can no longer receive new data from your Facebook Pages or Instagram accounts through Meta.',
        ],
    },
    {
        heading: 'Disconnect a channel inside Roosevelt',
        body: [
            'Sign in at itsroosevelt.com, open your workspace, go to CTO → Integrations, choose the channel (Messenger, Instagram, WhatsApp, Telegram, X, Gmail) and select Disconnect. We stop receiving data from that channel and delete its stored access tokens.',
        ],
    },
    {
        heading: 'Delete your data and account',
        body: [
            'To request deletion of your account and the data associated with it (including data received from Meta, Google and other connected platforms), email us:',
            [
                `To: ${CONTACT}`,
                'Subject: "Data deletion request"',
                'Include: the email address of your Roosevelt account and, if you contacted a business through Messenger, Instagram or WhatsApp, the name of that business and your profile name so we can locate your records.',
            ],
            'We will confirm receipt, verify that the request comes from you, and complete the deletion within 30 days. Once finished we will send you a confirmation.',
        ],
    },
    {
        heading: 'What is deleted and what may be kept',
        body: [
            [
                'Deleted: profile, workspace data, contacts, conversations, integration credentials and files associated with your account.',
                'May be retained for a limited time: records we are legally required to keep (for example payment and tax records), and backups, which are overwritten on their normal rotation.',
                'Public blockchain data (wallet addresses and transactions) cannot be deleted by anyone.',
            ],
        ],
    },
    {
        heading: 'If you are a customer of a business using Roosevelt',
        body: [
            'If you only messaged a business that uses Roosevelt, that business controls your conversation data. You can ask the business to delete it, or contact us at the address above and we will help route or process the request.',
        ],
    },
];

export default function DataDeletionPage() {
    return (
        <LegalPage
            title="Data Deletion Instructions"
            updated="October 4, 2026"
            intro="You are in control of your data. Here is how to disconnect Roosevelt from your accounts and how to have your data deleted."
            sections={sections}
        />
    );
}
