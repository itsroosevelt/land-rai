'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Regulatory Affairs"
            subtitle="CLO Regulatory"
            department="clo"
            accentColor="teal"
            description="Regulatory submissions and government relations."
            features={['Filing tracker', 'Regulatory calendar', 'Authority contacts']}
        />
    );
}
