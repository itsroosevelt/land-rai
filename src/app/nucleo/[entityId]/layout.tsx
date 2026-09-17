'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { EntityRouteResolver } from '@/components/EntityRouteResolver';
import { WorkspaceUserMenu } from '@/components/WorkspaceUserMenu';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SuiteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const segment = typeof params?.entityId === 'string' ? params.entityId : '';
    const { setLanguage } = useLanguage();

    useEffect(() => {
        setLanguage('en');
    }, [setLanguage]);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white/20 relative">
            <ProtectedRoute>
                <EntityRouteResolver segment={segment}>
                    <WorkspaceUserMenu />
                    {children}
                </EntityRouteResolver>
            </ProtectedRoute>
        </div>
    );
}
