'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Target, MessageSquare, PenTool, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CPODashboard() {
    const router = useRouter();
    const params = useParams();
    const entityId = params.entityId as string;

    const tools = [
        { name: 'Product Roadmap', description: 'Strategic product roadmap and feature timeline.', icon: Target, path: `/nucleo/${entityId}/cpo/roadmap`, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        { name: 'Feature Requests', description: 'User-submitted feature requests and voting.', icon: MessageSquare, path: `/nucleo/${entityId}/cpo/requests`, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
        { name: 'UX/UI Design System', description: 'Component library, design tokens, and style guide.', icon: PenTool, path: `/nucleo/${entityId}/cpo/design`, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white p-8 pt-24">
            <div className="max-w-6xl mx-auto">
                <header className="mb-12">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
                        <h6 className="text-purple-500 uppercase tracking-widest text-xs font-medium mb-2">Product Office</h6>
                        <h1 className="text-4xl md:text-5xl font-medium bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent tracking-tight">CPO Office</h1>
                        <p className="text-white/40 mt-4 max-w-xl text-lg font-light">Shape the product vision, manage the roadmap, and deliver exceptional user experiences.</p>
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
