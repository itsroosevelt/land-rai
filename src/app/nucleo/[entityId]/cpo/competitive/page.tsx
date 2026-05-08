'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Market Benchmarking"
            subtitle="CPO Intel"
            department="cpo"
            accentColor="yellow"
            description="Competitive landscape analysis and market positioning."
            features={['Competitor profiles', 'Feature comparison', 'Market trends']}
        />
    );
}
