'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Digital Forensics"
            subtitle="CISO Forensics"
            department="ciso"
            accentColor="purple"
            description="Digital evidence collection and forensic investigation."
            features={['Evidence chain', 'Investigation logs', 'Forensic tools']}
        />
    );
}
