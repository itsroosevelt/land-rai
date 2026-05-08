'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Data Mining"
            subtitle="CDO Mining"
            department="cdo"
            accentColor="amber"
            description="Pattern discovery and data mining operations."
            features={['Mining jobs', 'Pattern alerts', 'Anomaly detection']}
        />
    );
}
