'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bot, Hand, LayoutGrid, ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function KanbanHubPage() {
    const params = useParams();
    const entityId = params.entityId as string;
    const base = `/nucleo/${entityId}/workspace`;

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col">
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href={`${base}?role=coo`}
                        className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">COO · Kamban</p>
                        <h1 className="text-lg font-semibold tracking-tight">Hub</h1>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-6 md:p-12">
                <div className="w-full max-w-4xl grid gap-6 md:grid-cols-2">
                    <HubCard
                        href={`${base}/bot`}
                        icon={<Bot className="w-7 h-7 text-emerald-400" />}
                        title="Automated Kanban (Bot)"
                        description="Columnas sincronizadas con los nodos del chatbot. Las tarjetas se mueven automáticamente según el avance del lead en el flujo de IA."
                        accent="emerald"
                        badge="Automático"
                    />

                    <HubCard
                        href={`${base}/manual`}
                        icon={<Hand className="w-7 h-7 text-blue-400" />}
                        title="Manual Kanban & Follow-ups"
                        description="Embudo de seguimiento humano con 8 etapas fijas. Arrastra tarjetas libremente; el bot no altera tu organización manual."
                        accent="blue"
                        badge="CRM Humano"
                    />

                    <div className="md:col-span-2">
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 opacity-60">
                            <div className="p-3 rounded-xl bg-neutral-900 border border-white/5">
                                <Plus className="w-6 h-6 text-neutral-500" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium text-neutral-400">Create Custom Kanban</h3>
                                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">Próximamente</span>
                                </div>
                                <p className="text-sm text-neutral-600">Crea tableros personalizados con columnas y reglas propias.</p>
                            </div>
                            <Button disabled variant="outline" className="border-white/10 text-neutral-500 cursor-not-allowed shrink-0">
                                <Sparkles size={14} className="mr-2" />
                                Próximamente
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function HubCard({
    href,
    icon,
    title,
    description,
    accent,
    badge,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    accent: 'emerald' | 'blue';
    badge: string;
}) {
    const ring = accent === 'emerald' ? 'hover:border-emerald-500/40 hover:shadow-emerald-900/20' : 'hover:border-blue-500/40 hover:shadow-blue-900/20';
    const badgeCls = accent === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

    return (
        <Link
            href={href}
            className={cn(
                'group block rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 transition-all duration-300 hover:bg-[#0d0d0d] hover:shadow-2xl',
                ring
            )}
        >
            <div className="flex items-start justify-between mb-5">
                <div className="p-3 rounded-xl bg-black border border-white/10 group-hover:border-white/20 transition-colors">
                    {icon}
                </div>
                <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border', badgeCls)}>
                    {badge}
                </span>
            </div>
            <h2 className="text-xl font-semibold mb-2 group-hover:text-white transition-colors">{title}</h2>
            <p className="text-sm text-neutral-500 leading-relaxed mb-4">{description}</p>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 group-hover:text-white transition-colors">
                <LayoutGrid size={14} />
                Abrir tablero →
            </span>
        </Link>
    );
}
