'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { EntityRouteResolver } from '@/components/EntityRouteResolver';

export default function SuiteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const segment = typeof params?.entityId === 'string' ? params.entityId : '';

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white/20">
            <ProtectedRoute>
                <EntityRouteResolver segment={segment}>
                    {children}
                </EntityRouteResolver>
            </ProtectedRoute>
        </div>
    );
}
