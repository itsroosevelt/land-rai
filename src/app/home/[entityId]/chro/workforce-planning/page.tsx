'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Workforce Planning"
            subtitle="CHRO Planning"
            department="chro"
            accentColor="teal"
            description="Headcount planning and organizational design."
            features={['Org chart', 'Headcount forecast', 'Succession planning']}
        />
    );
}
