'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Executive Compensation"
            subtitle="Board Compensation"
            department="board"
            accentColor="purple"
            description="Executive compensation planning and equity management."
            features={['Salary benchmarking', 'Equity vesting', 'Performance bonuses']}
        />
    );
}
