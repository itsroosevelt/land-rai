'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Employee Mediation"
            subtitle="CHRO Relations"
            department="chro"
            accentColor="rose"
            description="Conflict resolution and employee relations management."
            features={['Case management', 'Mediation scheduling', 'Resolution tracking']}
        />
    );
}
