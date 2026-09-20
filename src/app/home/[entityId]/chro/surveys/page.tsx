'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Employee Feedback"
            subtitle="CHRO Engagement"
            department="chro"
            accentColor="orange"
            description="Employee engagement surveys and sentiment analysis."
            features={['Survey builder', 'Sentiment analysis', 'Action plans']}
        />
    );
}
