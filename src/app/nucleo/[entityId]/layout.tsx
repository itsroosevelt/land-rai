'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import SubscriptionGuard from '@/components/subscriptions/SubscriptionGuard';

export default function SuiteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const isDashboard = pathname === '/nucleo/roosevelt';

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white/20">

            <ProtectedRoute>
                <SubscriptionGuard>
                    {children}
                </SubscriptionGuard>
            </ProtectedRoute>
        </div>
    );
}

