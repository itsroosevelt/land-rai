'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Ethics Committee"
            subtitle="Board Ethics"
            department="board"
            accentColor="rose"
            description="Ethical standards enforcement and whistleblower management."
            features={['Code of conduct', 'Incident reporting', 'Ethics training']}
        />
    );
}
