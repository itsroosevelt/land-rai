'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReactFlow, {
    Background,
    Node,
    Edge,
    MarkerType,
    Handle,
    Position,
    NodeProps,
    useNodesState,
    useEdgesState,
    ReactFlowInstance,
    MiniMap,
    Controls
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    FileCheck, Scale, MessageSquare, TrendingUp, FileText, Megaphone, Cpu, Activity, Package, BookOpen, Contact, Brain, Users, Search, Award, Truck, Settings, Layout, Building, PieChart, Gavel, Coffee, Lightbulb, Briefcase, Share2, Server, Network, LifeBuoy, Calendar, Code2, Database, UserPlus, Globe, Shield, PenTool, Lock, Rocket, Landmark, Bot, Layers, ShieldAlert, CreditCard, Heart, Crown, GraduationCap, Target, BarChart, Send, Zap, DollarSign, ChevronDown, Handshake, Fingerprint, Key, Sun, Phone, Smartphone, ShoppingBag, Globe2, Terminal, Workflow, ZapOff, Anchor, Bell, Box, CheckCircle, Clipboard, Compass, Eye, Filter, Gift, HelpCircle, Image, Link, List, Mail, Map, MapPin, Mic, Moon, MousePointer, Music, Navigation, Paperclip, Play, Plus, Power, Printer, Radio, Save, Scissors, Send as SendIcon, Share, Star, Table, Tag, Thermometer, ThumbsUp, Trash, Video, Volume2, Watch, Wifi, Wind, Smile, X
} from "lucide-react";
import { WindowNode } from '@/components/shared/WindowNode';
import { SUITE_NODES } from '../constants';
import { cn } from '@/lib/utils';

const themes: Record<string, any> = {
    cyan: { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)', shadow: 'rgba(6,182,212,0.3)', blur: 'bg-cyan-500/30', iconBg: 'bg-cyan-500/20', iconText: 'text-cyan-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' },
    amber: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', shadow: 'rgba(245, 158, 11, 0.3)', blur: 'bg-amber-500/30', iconBg: 'bg-amber-500/20', iconText: 'text-amber-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(245, 158, 11, 0.6)]' },
    blue: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', shadow: 'rgba(59,130,246,0.3)', blur: 'bg-blue-500/30', iconBg: 'bg-blue-500/20', iconText: 'text-blue-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(59, 130, 246, 0.6)]' },
    emerald: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', shadow: 'rgba(16,185,129,0.3)', blur: 'bg-emerald-500/30', iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(16, 185, 129, 0.6)]' },
    rose: { bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)', shadow: 'rgba(244,63,94,0.3)', blur: 'bg-rose-500/30', iconBg: 'bg-rose-500/20', iconText: 'text-rose-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(244, 63, 94, 0.6)]' },
    purple: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)', shadow: 'rgba(168,85,247,0.3)', blur: 'bg-purple-500/30', iconBg: 'bg-purple-500/20', iconText: 'text-purple-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(168, 85, 247, 0.6)]' },
    orange: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', shadow: 'rgba(249,115,22,0.3)', blur: 'bg-orange-500/30', iconBg: 'bg-orange-500/20', iconText: 'text-orange-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(249, 115, 22, 0.6)]' },
    indigo: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)', shadow: 'rgba(99,102,241,0.3)', blur: 'bg-indigo-500/30', iconBg: 'bg-indigo-500/20', iconText: 'text-indigo-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(99, 102, 241, 0.6)]' },
    red: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', shadow: 'rgba(239,68,68,0.3)', blur: 'bg-red-500/30', iconBg: 'bg-red-500/20', iconText: 'text-red-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(239, 68, 68, 0.6)]' },
    slate: { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.3)', shadow: 'rgba(100,116,139,0.3)', blur: 'bg-slate-500/30', iconBg: 'bg-slate-500/20', iconText: 'text-slate-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(100, 116, 139, 0.6)]' }
};

const DEPARTMENTS_DATA: Record<string, { title: string, layers: any[] }> = {
    board: { title: "Board of Directors", layers: [{ id: 'governance', label: 'Protocol Governance', path: 'governance', icon: Gavel, theme: 'slate' }, { id: 'board-treasury', label: 'MultiSig Treasury', path: 'board-treasury', icon: Landmark, theme: 'slate' }, { id: 'legal-audit', label: 'Compliance Audit', path: 'legal-audit', icon: FileCheck, theme: 'slate' }] },
    ceo: { title: "Executive Center", layers: [{ id: 'kpis', label: 'Global KPIs', path: 'kpis', icon: BarChart, theme: 'amber' }, { id: 'strategy', label: 'Vision & Strategy', path: 'strategy', icon: Target, theme: 'amber' }, { id: 'culture', label: 'Culture Steering', path: 'culture-steering', icon: Heart, theme: 'amber' }, { id: 'innovation', label: 'Executive Dashboard', path: 'executive-dashboard', icon: Layout, theme: 'amber' }, { id: 'risk', label: 'Crisis Management', path: 'crisis-management', icon: ShieldAlert, theme: 'amber' }, { id: 'partnerships', label: 'Investor Relations', path: 'investor-relations', icon: Handshake, theme: 'amber' }] },
    coo: { title: "Operations Center", layers: [{ id: 'omnichannel', label: 'Omnichannel Engine', path: 'omnichannel', icon: MessageSquare, theme: 'cyan' }, { id: 'kamban', label: 'Operational Kamban', path: 'kamban', icon: Layout, theme: 'cyan' }, { id: 'whatsapp', label: 'WhatsApp Flows', path: 'whatsapp', icon: Smartphone, theme: 'cyan' }, { id: 'supply', label: 'Supply Chain', path: 'supply', icon: Truck, theme: 'cyan' }, { id: 'logistics', label: 'Neural Logistics', path: 'logistics', icon: Share2, theme: 'cyan' }, { id: 'procurement', label: 'Global Procurement', path: 'procurement', icon: ShoppingBag, theme: 'cyan' }, { id: 'quality', label: 'Quality Assurance', path: 'quality', icon: Award, theme: 'cyan' }, { id: 'team', label: 'Operations Team', path: 'team', icon: Users, theme: 'cyan' }, { id: 'visas', label: 'Global Visas', path: 'visas', icon: Globe, theme: 'cyan' }, { id: 'cx', label: 'Customer Experience', path: 'cx', icon: Smile, theme: 'cyan' }, { id: 'facilities', label: 'Facilities Management', path: 'facilities', icon: Building, theme: 'cyan' }] },
    cto: { title: "Technology Center", layers: [{ id: 'web-builder', label: 'AI Web Builder', path: 'web-builder', icon: Globe, theme: 'cyan' }, { id: 'orchestrator', label: 'AI Orchestrator', path: 'orchestrator', icon: Cpu, theme: 'cyan' }, { id: 'integrations', label: 'Cloud Integrations', path: 'integrations', icon: Network, theme: 'cyan' }, { id: 'security', label: 'Cyber Security', path: 'security', icon: Shield, theme: 'cyan' }, { id: 'voice-center', label: 'AI Voice Center', path: 'voice-center', icon: Phone, theme: 'cyan' }, { id: 'quantum', label: 'Quantum Protocols', path: 'quantum', icon: Zap, theme: 'cyan' }, { id: 'smart-contracts', label: 'Smart Contracts', path: 'smart-contracts', icon: FileText, theme: 'cyan' }, { id: 'api', label: 'API Gateway', path: 'api', icon: Code2, theme: 'cyan' }, { id: 'cloud', label: 'Cloud Infrastructure', path: 'cloud', icon: Server, theme: 'cyan' }, { id: 'devops', label: 'DevOps Pipeline', path: 'devops', icon: Terminal, theme: 'cyan' }, { id: 'data', label: 'Data Warehouse', path: 'data', icon: Database, theme: 'cyan' }, { id: 'automation', label: 'Neural Automation', path: 'automation', icon: Workflow, theme: 'cyan' }, { id: 'meet-agents', label: 'Meet AI Agents', path: 'meet-agents', icon: Bot, theme: 'cyan' }] },
    cfo: { title: "Financial Center", layers: [{ id: 'treasury', label: 'Cash Flow', path: 'cash-flow', icon: Landmark, theme: 'emerald' }, { id: 'revenue', label: 'Revenue Streams', path: 'revenue', icon: TrendingUp, theme: 'emerald' }, { id: 'expenses', label: 'Billing Engine', path: 'billing', icon: CreditCard, theme: 'emerald' }, { id: 'audit', label: 'Audit Prep', path: 'audit-prep', icon: FileCheck, theme: 'emerald' }, { id: 'tax', label: 'Tax Management', path: 'tax', icon: Gavel, theme: 'emerald' }] },
    cmo: { title: "Marketing Center", layers: [{ id: 'crm', label: 'Customer Relations', path: 'crm', icon: Contact, theme: 'orange' }, { id: 'analytics', label: 'Market Analytics', path: 'analytics', icon: BarChart, theme: 'orange' }, { id: 'campaigns', label: 'Omni Campaigns', path: 'campaigns', icon: Megaphone, theme: 'orange' }, { id: 'social', label: 'Social Media', path: 'social', icon: Share2, theme: 'orange' }, { id: 'affiliates', label: 'Affiliate Program', path: 'affiliates', icon: Link, theme: 'orange' }, { id: 'brand', label: 'Brand Identity', path: 'brand', icon: Award, theme: 'orange' }, { id: 'content', label: 'Content Factory', path: 'content', icon: PenTool, theme: 'orange' }, { id: 'events', label: 'Corporate Events', path: 'events', icon: Calendar, theme: 'orange' }, { id: 'goals', label: 'Marketing Goals', path: 'goals', icon: Target, theme: 'orange' }, { id: 'loyalty', label: 'Loyalty Programs', path: 'loyalty', icon: Gift, theme: 'orange' }, { id: 'market-share', label: 'Market Share', path: 'market-share', icon: PieChart, theme: 'orange' }, { id: 'seo', label: 'SEO Engine', path: 'seo', icon: Search, theme: 'orange' }] },
    chro: { title: "Human Resources Center", layers: [{ id: 'employees', label: 'HR Registry', path: 'hris', icon: Users, theme: 'purple' }, { id: 'recruitment', label: 'Talent Acquisition', path: 'recruitment', icon: UserPlus, theme: 'purple' }, { id: 'payroll', label: 'Payroll Engine', path: 'payroll', icon: DollarSign, theme: 'purple' }, { id: 'performance', label: 'Performance', path: 'performance', icon: Heart, theme: 'purple' }] },
    cso: { title: "Strategy Center", layers: [{ id: 'vision', label: 'Growth Strategy', path: 'growth', icon: Zap, theme: 'red' }, { id: 'expansion', label: 'Global Expansion', path: 'expansion', icon: Globe, theme: 'red' }] }
};

const StackNode = ({ data }: NodeProps) => {
    const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const displayLayers = useMemo(() => {
        const result: any[] = [];
        let currentZ = 0;
        const reversedLayers = [...data.layers].reverse();
        for (const layer of reversedLayers) {
            result.push({ ...layer, calculatedZ: currentZ });
            currentZ += 75;
        }
        return result;
    }, [data.layers]);

    const hoveredIndex = displayLayers.findIndex((l: any) => l.id === hoveredLayer);

    return (
        <div 
            style={{ perspective: '99999px' }} 
            className="relative pointer-events-none w-screen md:w-[700px] h-[1200px] md:h-[1300px] flex flex-col items-center justify-start pt-0 md:pt-16 scale-[0.9] sm:scale-[1] origin-top"
        >
            <div className="absolute top-[10px] md:top-[10px] left-1/2 -translate-x-1/2 z-[200] pointer-events-none w-full flex flex-col items-center">
                <motion.div className="flex flex-col items-center text-center px-4 pointer-events-auto">
                    <div className="relative group mb-8">
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center gap-4 px-8 py-4 bg-[#0D0F14]/70 hover:bg-[#0D0F14]/90 backdrop-blur-3xl border border-white/10 rounded-2xl transition-all group pointer-events-auto shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
                        >
                            <h1 className="text-2xl md:text-5xl font-light text-white tracking-tight whitespace-nowrap">
                                {data.title}
                            </h1>
                            <ChevronDown className={cn("w-5 h-5 text-cyan-500 transition-transform duration-500", isMenuOpen && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                            {isMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[320px] bg-[#050505]/98 backdrop-blur-[50px] border border-white/10 rounded-[2rem] p-4 shadow-[0_50px_150px_rgba(0,0,0,1)] z-[300] grid grid-cols-1 gap-1.5 pointer-events-auto"
                                >
                                    <div className="px-5 py-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-2">
                                        Executive Division
                                    </div>
                                    {SUITE_NODES.map((node) => (
                                        <button
                                            key={node.id}
                                            onClick={() => {
                                                data.onRoleSwitch(node.id);
                                                setIsMenuOpen(false);
                                            }}
                                            className="flex items-center gap-4 p-4 hover:bg-white/[0.03] rounded-2xl transition-all group/item text-left"
                                        >
                                            <div className={`p-2.5 bg-${node.color}-500/10 rounded-xl border border-${node.color}-500/20`}>
                                                <node.icon className={`w-5 h-5 text-${node.color}-400 group-hover/item:scale-110 transition-transform`} />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="text-sm md:text-base font-medium text-white/80 group-hover/item:text-white transition-colors">{node.title}</span>
                                            </div>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-3 text-white/30 bg-white/[0.01] px-5 py-2 rounded-full backdrop-blur-md border border-white/5 w-max mb-6">
                        <p className="text-[9px] md:text-xs font-medium tracking-[0.15em] uppercase">
                            Spatial Intelligence Active
                        </p>
                    </div>
                    
                    <button 
                        onClick={(e) => { e.stopPropagation(); data.onGoToNucleo && data.onGoToNucleo(); }}
                        className="nodrag pointer-events-auto px-8 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-medium tracking-widest rounded-full border border-cyan-500/20 transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(6,182,212,0.15)] cursor-pointer text-[10px] uppercase"
                    >
                        <Network className="w-3.5 h-3.5" />
                        Go to Core
                    </button>
                </motion.div>
            </div>

            <div
                className="absolute top-[800px] left-1/2 -translate-x-1/2 w-[340px] md:w-[420px] h-[340px] md:h-[420px] pointer-events-none"
                style={{
                    transform: 'rotateX(58deg) rotateZ(-40deg)',
                    transformStyle: 'preserve-3d'
                }}
            >
                {displayLayers.map((layer: any, index: number) => {
                    const isHovered = hoveredLayer === layer.id;
                    const isAboveHovered = hoveredIndex !== -1 && index > hoveredIndex;
                    const zPosition = layer.calculatedZ + (isHovered ? 50 : isAboveHovered ? 160 : 0);
                    const layerTheme = themes[layer.theme || 'cyan'];

                    return (
                        <motion.div
                            key={layer.id}
                            onTap={() => data.onLayerClick(layer)}
                            className={`absolute inset-0 rounded-[3.5rem] backdrop-blur-[30px] transition-colors duration-500 flex items-center justify-center pointer-events-auto cursor-pointer`}
                            style={{
                                transformStyle: 'preserve-3d',
                                backgroundColor: isHovered ? layerTheme.bg : 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                boxShadow: isHovered ? `inset 0 0 60px ${layerTheme.shadow}` : 'none'
                            }}
                            animate={{ z: zPosition }}
                            onMouseEnter={() => setHoveredLayer(layer.id)}
                            onMouseLeave={() => setHoveredLayer(null)}
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className={cn(
                                    "p-5 rounded-3xl transition-all duration-500",
                                    isHovered ? layerTheme.iconBg : "bg-white/5",
                                    isHovered ? "scale-110 shadow-lg" : "scale-100"
                                )}>
                                    <layer.icon className={cn(
                                        "w-10 h-10 transition-colors duration-500",
                                        isHovered ? layerTheme.iconText : "text-white/20",
                                        isHovered && layerTheme.iconShadow
                                    )} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className={cn(
                                        "text-xs font-bold tracking-[0.2em] uppercase transition-all duration-500 whitespace-nowrap",
                                        isHovered ? "text-white opacity-100 translate-y-0" : "text-white/10 opacity-0 translate-y-2"
                                    )}>
                                        {layer.label}
                                    </span>
                                </div>
                            </div>

                            <Handle type="source" position={Position.Right} id={layer.id} className="opacity-0" />
                            <Handle type="target" position={Position.Left} id={layer.id} className="opacity-0" />
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

const nodeTypes = { stackNode: StackNode, windowNode: WindowNode };

export default function UnifiedWorkspace() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const entityId = params.entityId as string;
    const [activeRole, setActiveRole] = useState<string>(searchParams.get('role') || 'ceo');
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [openWindows, setOpenWindows] = useState<string[]>([]);

    const currentDeptData = useMemo(() => DEPARTMENTS_DATA[activeRole] || DEPARTMENTS_DATA.ceo, [activeRole]);

    const handleModuleClick = (layer: any) => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

        if (isMobile) {
            const finalUrl = `/nucleo/${entityId}/${activeRole}/${layer.path}`;
            window.location.href = finalUrl;
        } else {
            if (!openWindows.includes(layer.id)) {
                setOpenWindows(prev => [...prev, layer.id]);
                
                // Posicionamiento mucho más a la derecha y a una altura nivelada (no tan arriba)
                const targetX = 750 + openWindows.length * 40;
                const targetY = 150 + openWindows.length * 40;

                const newNode: Node = {
                    id: `window-${layer.id}`,
                    type: 'windowNode',
                    position: { x: targetX, y: targetY },
                    data: {
                        id: layer.id,
                        title: layer.label,
                        icon: layer.icon,
                        url: `/nucleo/${entityId}/${activeRole}/${layer.path}`,
                        origin: { x: 0, y: 0 }, // La torre está en el origen
                        onClose: () => {
                            setOpenWindows(prev => prev.filter(id => id !== layer.id));
                            setNodes(nds => nds.filter(n => n.id !== `window-${layer.id}`));
                        }
                    }
                };

                setNodes(nds => [...nds, newNode]);

                // Desplazar automáticamente la cámara hacia la nueva ventana despejada y nivelada
                if (reactFlowInstance) {
                    reactFlowInstance.setViewport({ 
                        x: -targetX + (window.innerWidth / 3), 
                        y: -targetY + (window.innerHeight / 3), 
                        zoom: 0.7 
                    }, { duration: 1000 });
                }
            }
        }
    };

    useEffect(() => {
        setNodes(nds => {
            const currentWindows = nds.filter(n => n.id.startsWith('window-'));
            const stackNode: Node = {
                id: 'stack',
                type: 'stackNode',
                position: { x: 0, y: 0 },
                draggable: false,
                data: {
                    title: currentDeptData.title,
                    layers: currentDeptData.layers,
                    onLayerClick: handleModuleClick,
                    onRoleSwitch: (roleId: string) => {
                        setActiveRole(roleId);
                        const newUrl = `/nucleo/${entityId}/workspace?role=${roleId}`;
                        router.push(newUrl);
                    },
                    onGoToNucleo: () => router.push(`/nucleo/${entityId}`)
                }
            };
            return [stackNode, ...currentWindows];
        });
    }, [activeRole, entityId, currentDeptData]);

    useEffect(() => {
        if (reactFlowInstance) {
            // Centrar la torre automáticamente usando fitView para precisión total
            reactFlowInstance.fitView({ 
                nodes: [{ id: 'stack' }], 
                padding: 0.2,
                duration: 1000 
            });
        }
    }, [reactFlowInstance, activeRole]);

    return (
        <div className="w-full h-screen bg-black flex flex-col relative overflow-hidden">
            <style jsx global>{`
                [class*="IdentitySwitcher"] { display: none !important; }
            `}</style>

            <div className="fixed bottom-8 left-8 z-[200] pointer-events-auto">
                <button 
                    onClick={() => router.push(`/nucleo/${entityId}`)}
                    className="w-14 h-14 bg-[#0D0F14]/80 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.8)] hover:border-cyan-500/30 transition-all active:scale-90"
                >
                    <span className="text-white/80 font-bold text-2xl">N</span>
                </button>
            </div>

            <div className="flex-1 w-full h-full relative z-0">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    onInit={setReactFlowInstance}
                    className="bg-[#050505]"
                    proOptions={{ hideAttribution: true }}
                    fitView={false}
                >
                    <Background color="#ffffff" gap={24} size={1} className="opacity-[0.03]" />
                    <MiniMap 
                        style={{ backgroundColor: '#0D0F14', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                        maskColor="rgba(0, 0, 0, 0.7)"
                        nodeColor={(n) => n.type === 'stackNode' ? '#06b6d4' : '#ffffff20'}
                        position="bottom-left"
                    />
                    <Controls 
                        position="bottom-left"
                        className="bg-[#0D0F14]/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden ml-4 mb-24"
                    />
                </ReactFlow>
            </div>
        </div>
    );
}
