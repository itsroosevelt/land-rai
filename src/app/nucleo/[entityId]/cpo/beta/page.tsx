'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Beta Testing"
            subtitle="CPO Testing"
            department="cpo"
            accentColor="orange"
            description="Beta program management and user feedback collection."
            features={['Tester management', 'Bug tracking', 'Feedback analysis']}
        />
    );
}
