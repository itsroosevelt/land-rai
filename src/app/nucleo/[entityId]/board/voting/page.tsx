'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Shareholder Voting"
            subtitle="Board Voting"
            department="board"
            accentColor="blue"
            description="Democratic decision-making through shareholder participation."
            features={['Vote casting', 'Proposal creation', 'Results analytics']}
        />
    );
}
