'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Risk Audit"
            subtitle="CISO Audit"
            department="ciso"
            accentColor="amber"
            description="Security risk assessment and vulnerability management."
            features={['Risk scoring', 'Vulnerability scans', 'Remediation tracking']}
        />
    );
}
