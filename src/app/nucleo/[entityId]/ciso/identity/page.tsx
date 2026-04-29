'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Identity & Access"
            subtitle="CISO IAM"
            department="ciso"
            accentColor="blue"
            description="Identity and access management across all systems."
            features={['User provisioning', 'Role management', 'Access reviews']}
        />
    );
}
