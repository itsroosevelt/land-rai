'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Subsidiary Management"
            subtitle="Board Structure"
            department="board"
            accentColor="teal"
            description="Oversight of all subsidiary entities and their operations."
            features={['Entity hierarchy', 'Cross-entity reporting', 'Subsidiary KPIs']}
        />
    );
}
