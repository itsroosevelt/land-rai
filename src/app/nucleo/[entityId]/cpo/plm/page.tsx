'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Product Lifecycle"
            subtitle="CPO Lifecycle"
            department="cpo"
            accentColor="amber"
            description="End-to-end product lifecycle management."
            features={['Stage gates', 'Launch checklists', 'Sunset planning']}
        />
    );
}
