'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Onboarding"
            subtitle="CHRO Onboarding"
            department="chro"
            accentColor="emerald"
            description="New hire onboarding workflows and training programs."
            features={['Onboarding checklists', 'Training modules', 'Mentor assignment']}
        />
    );
}
