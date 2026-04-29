'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Compliance & Risk"
            subtitle="CLO Compliance"
            department="clo"
            accentColor="red"
            description="Regulatory compliance monitoring and risk management."
            features={['Compliance matrix', 'Risk register', 'Regulatory updates']}
        />
    );
}
