'use client';

import React, { useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { EntityRouteResolver } from '@/components/EntityRouteResolver';
import { useLanguage } from '@/contexts/LanguageContext';
import { AskRooseveltBar } from '@/components/nucleo/AskRooseveltBar';
import { EntityLeftFloatingBar } from '@/components/nucleo/EntityLeftFloatingBar';
import { EntityRightFloatingBar } from '@/components/nucleo/EntityRightFloatingBar';

export default function SuiteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const pathname = usePathname();
    const segment = typeof params?.entityId === 'string' ? params.entityId : '';
    const { setLanguage } = useLanguage();

    const isWorkspace = pathname?.includes('/workspace');

    useEffect(() => {
        setLanguage('en');
    }, [setLanguage]);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white/20 relative">
            <ProtectedRoute>
                <EntityRouteResolver segment={segment}>
                    {!isWorkspace && (
                        <>
                            <EntityLeftFloatingBar />
                            <EntityRightFloatingBar />
                        </>
                    )}
                    {children}
                    <AskRooseveltBar />
                </EntityRouteResolver>
            </ProtectedRoute>
        </div>
    );
}
