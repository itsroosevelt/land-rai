'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Capital Investments"
            subtitle="CFO Investments"
            department="cfo"
            accentColor="indigo"
            description="Investment portfolio management and asset allocation."
            features={['Portfolio overview', 'ROI tracking', 'Asset allocation']}
        />
    );
}
