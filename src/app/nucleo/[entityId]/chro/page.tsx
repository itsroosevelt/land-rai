'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { UserPlus, GraduationCap, DollarSign, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CHRODashboard() {
    const router = useRouter();
    const params = useParams();
    const entityId = params.entityId as string;

    const tools = [
        { name: 'Recruitment', description: 'Talent acquisition pipeline and candidate management.', icon: UserPlus, path: `/nucleo/${entityId}/chro/recruitment`, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        { name: 'Onboarding', description: 'New hire onboarding workflows and training programs.', icon: GraduationCap, path: `/nucleo/${entityId}/chro/onboarding`, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
        { name: 'Payroll & Benefits', description: 'Employee compensation, benefits, and tax management.', icon: DollarSign, path: `/nucleo/${entityId}/chro/payroll`, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white p-8 pt-24">
            <div className="max-w-6xl mx-auto">
                <header className="mb-12">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
                        <h6 className="text-blue-500 uppercase tracking-widest text-xs font-medium mb-2">People & Culture</h6>
                        <h1 className="text-4xl md:text-5xl font-medium bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent tracking-tight">CHRO Office</h1>
                        <p className="text-white/40 mt-4 max-w-xl text-lg font-light">Attract, develop, and retain world-class talent across every department.</p>
                    </motion.div>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {tools.map((tool, idx) => (
                        <motion.div key={tool.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * idx }}
                            onClick={() => router.push(tool.path)} className={`group cursor-pointer p-8 rounded-2xl border ${tool.color} hover:bg-opacity-20 transition-all duration-300`}>
                            <tool.icon className="w-10 h-10 mb-6" />
                            <h3 className="text-xl font-medium mb-2 text-white/90 tracking-tight">{tool.name}</h3>
                            <p className="text-sm text-white/50 leading-relaxed mb-6">{tool.description}</p>
                            <div className="flex items-center text-xs font-medium uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
                                Launch Tool <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
