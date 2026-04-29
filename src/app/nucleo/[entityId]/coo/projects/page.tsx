'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Project Management"
            subtitle="COO Projects"
            department="coo"
            accentColor="blue"
            description="End-to-end project management with timelines and milestones."
            features={['Gantt charts', 'Task management', 'Resource allocation']}
        />
    );
}
