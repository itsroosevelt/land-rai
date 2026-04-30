'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="AI Engine"
            subtitle="CDO AI"
            department="cdo"
            accentColor="purple"
            description="Machine learning model management and AI operations."
            features={['Model registry', 'Training pipelines', 'Inference monitoring']}
        />
    );
}
