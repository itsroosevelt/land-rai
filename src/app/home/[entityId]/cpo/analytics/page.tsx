'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Usage Analytics"
            subtitle="CPO Analytics"
            department="cpo"
            accentColor="teal"
            description="Product usage metrics and user behavior analytics."
            features={['Session tracking', 'Funnel analysis', 'Retention metrics']}
        />
    );
}
