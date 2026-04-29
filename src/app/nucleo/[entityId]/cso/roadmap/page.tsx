'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Strategic Roadmap"
            subtitle="CSO Planning"
            department="cso"
            accentColor="indigo"
            description="Long-term corporate strategy and milestone management."
            features={['Strategic goals', 'Quarterly OKRs', 'Progress tracking']}
        />
    );
}
