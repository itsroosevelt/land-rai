'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Market Intelligence"
            subtitle="CSO Intel"
            department="cso"
            accentColor="emerald"
            description="Competitive intelligence and market trend analysis."
            features={['Competitor tracking', 'Market signals', 'Trend reports']}
        />
    );
}
