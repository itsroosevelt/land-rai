'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Fundraising"
            subtitle="CFO Capital"
            department="cfo"
            accentColor="purple"
            description="Capital raising management and investor pipeline."
            features={['Round planning', 'Investor CRM', 'Term sheets']}
        />
    );
}
