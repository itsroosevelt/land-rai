'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Financial Risk"
            subtitle="CFO Risk"
            department="cfo"
            accentColor="orange"
            description="Financial risk modeling and scenario analysis."
            features={['Risk scenarios', 'Stress testing', 'Mitigation plans']}
        />
    );
}
