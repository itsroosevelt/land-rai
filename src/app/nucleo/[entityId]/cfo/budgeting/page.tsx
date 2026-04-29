'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Budgeting"
            subtitle="CFO Budget"
            department="cfo"
            accentColor="blue"
            description="Department budget allocation and expense tracking."
            features={['Budget allocation', 'Variance analysis', 'Forecasting']}
        />
    );
}
