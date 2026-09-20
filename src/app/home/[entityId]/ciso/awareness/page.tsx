'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Security Awareness"
            subtitle="CISO Training"
            department="ciso"
            accentColor="emerald"
            description="Employee security training and phishing simulation."
            features={['Training modules', 'Phishing tests', 'Completion tracking']}
        />
    );
}
