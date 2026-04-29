'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Data Visualization"
            subtitle="CDO Analytics"
            department="cdo"
            accentColor="cyan"
            description="Interactive dashboards and data visualization tools."
            features={['Dashboard builder', 'Chart library', 'Embed sharing']}
        />
    );
}
