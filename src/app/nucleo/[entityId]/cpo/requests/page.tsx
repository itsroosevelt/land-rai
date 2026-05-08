'use client';
import DepartmentPageShell from '@/components/DepartmentPageShell';
export default function Page() {
    return (
        <DepartmentPageShell
            title="Feature Requests"
            subtitle="CPO Feedback"
            department="cpo"
            accentColor="purple"
            description="User-submitted feature requests and voting."
            features={['Request voting', 'Priority scoring', 'Status tracking']}
        />
    );
}
