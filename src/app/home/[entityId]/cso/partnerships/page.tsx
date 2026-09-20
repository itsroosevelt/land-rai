'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Corporate Partnerships"
            subtitle="CSO Partnerships"
            department="cso"
            accentColor="blue"
            description="Strategic partnership management and deal flow."
            features={['Partner pipeline', 'Joint ventures', 'Partnership metrics']}
        />
    );
}
