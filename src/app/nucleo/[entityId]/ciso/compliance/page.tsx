'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Security Compliance"
            subtitle="CISO Compliance"
            department="ciso"
            accentColor="teal"
            description="Security framework compliance and certification tracking."
            features={['SOC 2 tracker', 'ISO 27001', 'Compliance matrix']}
        />
    );
}
