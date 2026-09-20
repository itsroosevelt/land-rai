'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Data Lake"
            subtitle="CDO Storage"
            department="cdo"
            accentColor="blue"
            description="Centralized data lake for all corporate intelligence."
            features={['Data ingestion', 'Schema registry', 'Query optimization']}
        />
    );
}
