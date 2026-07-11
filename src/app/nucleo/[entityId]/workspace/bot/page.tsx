'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import KambanBoard from '../../coo/kamban/components/KambanBoard';

export default function WorkspaceBotKanbanPage() {
    const params = useParams();
    const entityId = params.entityId as string;

    return (
        <div className="flex min-h-screen md:h-screen overflow-hidden bg-black text-white flex-col font-sans tracking-tight">
            <div className="h-10 border-b border-white/5 flex items-center px-4 gap-3 shrink-0 bg-[#0a0a0a]">
                <Link href={`/nucleo/${entityId}/workspace/hub`} className="text-neutral-500 hover:text-white transition-colors">
                    <ArrowLeft size={16} />
                </Link>
                <span className="text-[11px] font-normal uppercase tracking-wider text-emerald-500/90">Kanban automático · Bot</span>
            </div>
            <main className="flex-1 overflow-hidden">
                <KambanBoard boardMode="bot" />
            </main>
        </div>
    );
}
