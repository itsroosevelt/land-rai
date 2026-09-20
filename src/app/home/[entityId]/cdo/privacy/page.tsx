'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Data Privacy"
            subtitle="CDO Privacy"
            department="cdo"
            accentColor="rose"
            description="Data privacy compliance and PII management."
            features={['GDPR compliance', 'Data requests', 'Consent management']}
        />
    );
}
