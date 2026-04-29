'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Product QA"
            subtitle="CPO Quality"
            department="cpo"
            accentColor="red"
            description="Quality assurance workflows and testing management."
            features={['Test suites', 'Bug triage', 'Release sign-off']}
        />
    );
}
