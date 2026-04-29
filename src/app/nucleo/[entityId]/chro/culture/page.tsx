'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Culture & Wellness"
            subtitle="CHRO Culture"
            department="chro"
            accentColor="pink"
            description="Employee wellness programs and cultural initiatives."
            features={['Wellness programs', 'Team events', 'Satisfaction surveys']}
        />
    );
}
