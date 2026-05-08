'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Endpoint Protection"
            subtitle="CISO Endpoints"
            department="ciso"
            accentColor="cyan"
            description="Endpoint security monitoring and device management."
            features={['Device inventory', 'Patch status', 'Threat quarantine']}
        />
    );
}
