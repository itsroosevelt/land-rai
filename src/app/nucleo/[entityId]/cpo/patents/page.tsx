'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Product Patents"
            subtitle="CPO IP"
            department="cpo"
            accentColor="indigo"
            description="Intellectual property tracking and patent filings."
            features={['Patent registry', 'Filing status', 'Prior art search']}
        />
    );
}
