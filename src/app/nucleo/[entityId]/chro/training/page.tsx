'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Training & Dev"
            subtitle="CHRO Development"
            department="chro"
            accentColor="purple"
            description="Learning management and professional development."
            features={['Course catalog', 'Skill assessments', 'Certifications']}
        />
    );
}
