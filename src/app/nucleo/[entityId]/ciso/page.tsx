'use client';

import React, { useCallback, useMemo, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReactFlow, {
    Background,
    Controls,
    Node,
    Edge,
    MarkerType,
    Handle,
    Position,
    NodeProps,
    useNodesState,
    useEdgesState,
    ReactFlowInstance
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    FileCheck, Scale, MessageSquare, TrendingUp, FileText, Megaphone, Cpu, Activity, Package, BookOpen, Contact, Brain, Users, Search, Award, Truck, Settings, Layout, Building, PieChart, Gavel, Coffee, Lightbulb, Briefcase, Share2, Server, Network, LifeBuoy, Calendar, Code2, Database, UserPlus, Globe, Shield, PenTool, Lock, Rocket, Landmark, Bot, Layers, ShieldAlert, CreditCard, Heart, Crown, GraduationCap, Target, BarChart, Send, Zap, DollarSign
} from "lucide-react";
import { WindowNode } from '@/components/shared/WindowNode';

const themes: Record<string, any> = {
    cyan: { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)', shadow: 'rgba(6,182,212,0.3)', blur: 'bg-cyan-500/30', iconBg: 'bg-cyan-500/20', iconText: 'text-cyan-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' },
    amber: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', shadow: 'rgba(245,158,11,0.3)', blur: 'bg-amber-500/30', iconBg: 'bg-amber-500/20', iconText: 'text-amber-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' },
    blue: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', shadow: 'rgba(59,130,246,0.3)', blur: 'bg-blue-500/30', iconBg: 'bg-blue-500/20', iconText: 'text-blue-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' },
    emerald: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', shadow: 'rgba(16,185,129,0.3)', blur: 'bg-emerald-500/30', iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' },
    rose: { bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)', shadow: 'rgba(244,63,94,0.3)', blur: 'bg-rose-500/30', iconBg: 'bg-rose-500/20', iconText: 'text-rose-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' },
    purple: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)', shadow: 'rgba(168,85,247,0.3)', blur: 'bg-purple-500/30', iconBg: 'bg-purple-500/20', iconText: 'text-purple-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]' },
    orange: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', shadow: 'rgba(249,115,22,0.3)', blur: 'bg-orange-500/30', iconBg: 'bg-orange-500/20', iconText: 'text-orange-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]' },
    indigo: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)', shadow: 'rgba(99,102,241,0.3)', blur: 'bg-indigo-500/30', iconBg: 'bg-indigo-500/20', iconText: 'text-indigo-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]' },
    red: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', shadow: 'rgba(239,68,68,0.3)', blur: 'bg-red-500/30', iconBg: 'bg-red-500/20', iconText: 'text-red-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' },
    slate: { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.3)', shadow: 'rgba(100,116,139,0.3)', blur: 'bg-slate-500/30', iconBg: 'bg-slate-500/20', iconText: 'text-slate-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(100,116,139,0.6)]' }
};

const layers = [
    { 
        id: 'board', label: 'Board of Directors', path: '../board', icon: Briefcase, theme: 'slate',
        subLayers: [
            { id: 'board-governance', label: 'Protocol Governance', path: '../board/governance', icon: Gavel, theme: 'slate' },
            { id: 'board-treasury', label: 'MultiSig Treasury', path: '../board/treasury', icon: Landmark, theme: 'slate' }
        ]
    },
    { 
        id: 'cdo', label: 'Chief Data Officer', path: '../cdo', icon: Database, theme: 'indigo',
        subLayers: [
            { id: 'cdo-ai-engine', label: 'AI Engine', path: '../cdo/ai-engine', icon: Brain, theme: 'indigo' },
            { id: 'cdo-lake', label: 'Data Lake', path: '../cdo/lake', icon: Database, theme: 'indigo' }
        ]
    },
    { 
        id: 'ceo', label: 'Chief Executive Officer', path: '../ceo', icon: Crown, theme: 'amber',
        subLayers: [
            { id: 'ceo-kpis', label: 'Global KPIs', path: '../ceo/kpis', icon: BarChart, theme: 'amber' },
            { id: 'ceo-strategy', label: 'Vision & Strategy', path: '../ceo/strategy', icon: Target, theme: 'amber' }
        ]
    },
    { 
        id: 'cfo', label: 'Chief Financial Officer', path: '../cfo', icon: DollarSign, theme: 'emerald',
        subLayers: [
            { id: 'cfo-revenue', label: 'Revenue & Treasury', path: '../cfo/revenue', icon: DollarSign, theme: 'emerald' },
            { id: 'cfo-billing', label: 'Invoices & Billing', path: '../cfo/billing', icon: FileText, theme: 'emerald' }
        ]
    },
    { 
        id: 'chro', label: 'Chief HR Officer', path: '../chro', icon: Users, theme: 'orange',
        subLayers: [
            { id: 'chro-recruitment', label: 'Recruitment', path: '../chro/recruitment', icon: UserPlus, theme: 'orange' },
            { id: 'chro-onboarding', label: 'Onboarding', path: '../chro/onboarding', icon: GraduationCap, theme: 'orange' }
        ]
    },
    { 
        id: 'clo', label: 'Chief Legal Officer', path: '../clo', icon: Scale, theme: 'slate',
        subLayers: [
            { id: 'clo-contracts', label: 'Legal Contracts', path: '../clo/contracts', icon: FileText, theme: 'slate' },
            { id: 'clo-compliance', label: 'Compliance & Risk', path: '../clo/compliance', icon: Shield, theme: 'slate' }
        ]
    },
    { 
        id: 'cmo', label: 'Chief Marketing Officer', path: '../cmo', icon: Megaphone, theme: 'rose',
        subLayers: [
            { id: 'cmo-analytics', label: 'Sales Analytics', path: '../cmo/analytics', icon: BarChart, theme: 'rose' },
            { id: 'cmo-crm', label: 'Contacts (CRM)', path: '../cmo/crm', icon: Contact, theme: 'rose' }
        ]
    },
    { 
        id: 'coo', label: 'Chief Operations Officer', path: '../coo', icon: Settings, theme: 'blue',
        subLayers: [
            { id: 'coo-omnichannel', label: 'Omnichannel Inbox', path: '../coo/omnichannel', icon: MessageSquare, theme: 'blue' },
            { id: 'coo-kamban', label: 'Kamban Leads', path: '../coo/kamban', icon: Contact, theme: 'blue' }
        ]
    },
    { 
        id: 'cpo', label: 'Chief Product Officer', path: '../cpo', icon: Package, theme: 'purple',
        subLayers: [
            { id: 'cpo-roadmap', label: 'Product Roadmap', path: '../cpo/roadmap', icon: Target, theme: 'purple' },
            { id: 'cpo-requests', label: 'Feature Requests', path: '../cpo/requests', icon: MessageSquare, theme: 'purple' }
        ]
    },
    { 
        id: 'cso', label: 'Chief Strategy Officer', path: '../cso', icon: Target, theme: 'indigo',
        subLayers: [
            { id: 'cso-growth', label: 'Growth Initiatives', path: '../cso/growth', icon: TrendingUp, theme: 'indigo' },
            { id: 'cso-intelligence', label: 'Market Intelligence', path: '../cso/intelligence', icon: Target, theme: 'indigo' }
        ]
    },
    { 
        id: 'cto', label: 'Chief Technology Officer', path: '../cto', icon: Bot, theme: 'cyan',
        subLayers: [
            { id: 'cto-orchestrator', label: 'Orchestrator', path: '../cto/orchestrator', icon: Activity, theme: 'cyan' },
            { id: 'cto-data', label: 'Data Center', path: '../cto/data', icon: Database, theme: 'cyan' }
        ]
    },

    // --- CISO DEPARTMENT (Expanded) ---,
    { id: 'map', label: 'Cyber Threat Map', path: 'map', icon: Shield, theme: 'red', group: 'ciso' },
    { id: 'identity', label: 'Identity & Access', path: 'identity', icon: Lock, theme: 'red', group: 'ciso' },
    { id: 'audit', label: 'Risk Audit', path: 'audit', icon: Shield, theme: 'red', group: 'ciso' },
    { id: 'incident', label: 'Incident Response', path: 'incident', icon: Activity, theme: 'red', group: 'ciso' },
    { id: 'awareness', label: 'Security Awareness', path: 'awareness', icon: BookOpen, theme: 'red', group: 'ciso' },
    { id: 'forensics', label: 'Digital Forensics', path: 'forensics', icon: Search, theme: 'red', group: 'ciso' },
    { id: 'compliance', label: 'Security Compliance', path: 'compliance', icon: FileCheck, theme: 'red', group: 'ciso' },
    { id: 'endpoint', label: 'Endpoint Protection', path: 'endpoint', icon: Server, theme: 'red', group: 'ciso' }
];

const StackNode = ({ data }: NodeProps) => {
    const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
    const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});

    const displayLayers = useMemo(() => {
        const result = [];
        let currentZ = 0;
        let lastGroup = null;

        for (const layer of data.layers) {
            const group = layer.group || layer.id;
            
            if (lastGroup !== null && lastGroup !== group) {
                currentZ += 100; // Large gap between different officers
            } else if (lastGroup !== null) {
                currentZ += 15; // Tight gap for same officer main layers
            }
            
            result.push({ ...layer, isSubLayer: false, calculatedZ: currentZ, xOffset: 0, labelXOffset: 0 });
            lastGroup = group;

            if (expandedDepts[layer.id] && layer.subLayers) {
                let subIndex = 1;
                for (const sub of layer.subLayers) {
                    currentZ += 0; // Literally ZERO gap for sub-layers
                    result.push({ 
                        ...sub, 
                        isSubLayer: true, 
                        calculatedZ: currentZ, 
                        xOffset: subIndex * -180, 
                        labelXOffset: subIndex * -140 
                    });
                    subIndex++;
                    lastGroup = group;
                }
            }
        }
        return result;
    }, [data.layers, expandedDepts]);

    const hoveredIndex = displayLayers.findIndex((l: any) => l.id === hoveredLayer);

    // Track pointer to distinguish between click and drag
    const pointerDownPos = useRef<{ x: number, y: number } | null>(null);

    const onPointerDown = (e: React.PointerEvent) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: React.PointerEvent, layer: any) => {
        if (!pointerDownPos.current) return;

        const dx = e.clientX - pointerDownPos.current.x;
        const dy = e.clientY - pointerDownPos.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // If distance is small, it's a click. Otherwise it was a drag, so we do nothing here (onDrop will handle it).
        if (dist < 5) {
            if (layer.subLayers) {
                setExpandedDepts(prev => ({ ...prev, [layer.id]: !prev[layer.id] }));
            } else {
                data.onLayerClick(layer);
            }
        }
        pointerDownPos.current = null;
    };

    const onDragStart = (event: any, layerId: string) => {
        event.dataTransfer.setData('application/reactflow/layerId', layerId);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div style={{ perspective: '99999px', width: '700px', height: '1100px' }} className="relative pointer-events-auto">
            {/* FLAT TITLE AT TOP */}
            <div className="absolute top-0 left-1/2 -ml-12 -translate-x-1/2 z-50 pointer-events-none w-[120%] flex flex-col items-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="flex flex-col items-center text-center"
                >
                    <h1 className="text-4xl md:text-5xl font-light bg-gradient-to-r from-white via-white to-white/30 bg-clip-text text-transparent tracking-wide mb-6 drop-shadow-xl whitespace-nowrap">
                        Chief Info Security Officer
                    </h1>
                    <div className="flex items-center gap-3 text-white/50 bg-[#1A1D24]/80 px-5 py-3 rounded-full backdrop-blur-md border border-white/10 w-max shadow-2xl">
                        <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        <p className="text-xs font-medium">
                            Drag any glass module to spawn its spatial window
                        </p>
                    </div>
                    
                    <button 
                        onClick={(e) => { e.stopPropagation(); data.onGoToNucleo && data.onGoToNucleo(); }}
                        className="nodrag mt-6 pointer-events-auto px-6 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-medium tracking-wide rounded-full border border-cyan-500/30 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer"
                    >
                        <Network className="w-4 h-4" />
                        Ir al núcleo
                    </button>
                </motion.div>
            </div>

            {/* 3D TOWER ANCHORED AT BOTTOM */}
            <div
                className="absolute bottom-[50px] left-1/2 -translate-x-1/2 w-[380px] h-[380px]"
                style={{
                    transform: 'rotateX(55deg) rotateZ(-45deg)',
                    transformStyle: 'preserve-3d'
                }}
            >
                {displayLayers.map((layer: any, index: number) => {
                    const isHovered = hoveredLayer === layer.id;
                    const isAboveHovered = hoveredIndex !== -1 && index > hoveredIndex;

                    const baseZ = layer.calculatedZ;
                    let hoverOffset = 0;
                    if (isHovered) hoverOffset = 40;
                    if (isAboveHovered) hoverOffset = 140;

                    const zPosition = baseZ + hoverOffset;
                    const layerTheme = themes[layer.theme || 'cyan'];

                    return (
                        <motion.div
                            key={layer.id}
                            draggable
                            onDragStart={(e: any) => onDragStart(e, layer.id)}
                            onPointerDown={onPointerDown}
                            onPointerUp={(e: any) => onPointerUp(e, layer)}
                            className={`absolute inset-0 rounded-[2.5rem] cursor-grab active:cursor-grabbing backdrop-blur-xl transition-colors duration-500`}
                            style={{
                                transformStyle: 'preserve-3d',
                                backgroundColor: isHovered ? layerTheme.bg : 'rgba(255, 255, 255, 0.04)',
                                borderTop: isHovered ? '2px solid rgba(255,255,255,0.7)' : '1px solid rgba(255, 255, 255, 0.2)',
                                borderLeft: isHovered ? '2px solid rgba(255,255,255,0.7)' : '1px solid rgba(255, 255, 255, 0.2)',
                                borderBottom: isHovered ? `1px solid ${layerTheme.border}` : '1px solid rgba(255, 255, 255, 0.01)',
                                borderRight: isHovered ? `1px solid ${layerTheme.border}` : '1px solid rgba(255, 255, 255, 0.01)',
                                boxShadow: isHovered
                                    ? `inset 0 0 50px ${layerTheme.shadow}, 0 40px 60px rgba(0,0,0,0.6)`
                                    : `inset 0 0 10px rgba(255,255,255,0.05), 0 15px 30px rgba(0,0,0,0.5)`
                            }}
                            animate={{ z: zPosition, x: layer.xOffset }}
                            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                            onMouseEnter={() => setHoveredLayer(layer.id)}
                            onMouseLeave={() => setHoveredLayer(null)}
                        >
                            <Handle type="source" position={Position.Right} id={layer.id} className="opacity-0" />
                            <Handle type="target" position={Position.Left} id={layer.id} className="opacity-0" />

                            <AnimatePresence>
                                {isHovered && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className={`absolute inset-0 m-auto w-[60%] h-[60%] ${layerTheme.blur} blur-[50px] rounded-full pointer-events-none`}
                                    />
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            <div className="absolute top-0 right-10 w-[300px] h-full pointer-events-none flex flex-col justify-end">
                {displayLayers.map((layer: any, index: number) => {
                    const isHovered = hoveredLayer === layer.id;
                    const bottomPos = layer.calculatedZ * 0.573 + 240;
                    const layerTheme = themes[layer.theme || 'cyan'];

                    return (
                        <AnimatePresence key={`label-${layer.id}`}>
                            {isHovered && (
                                <motion.div
                                    initial={{ opacity: 0, x: layer.labelXOffset - 30, filter: 'blur(10px)' }}
                                    animate={{ opacity: 1, x: layer.labelXOffset, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, x: layer.labelXOffset + 20, filter: 'blur(10px)' }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                    className="absolute right-0 pointer-events-auto cursor-grab active:cursor-grabbing"
                                    style={{ bottom: `${bottomPos}px` }}
                                    draggable
                                    onDragStart={(e: any) => onDragStart(e, layer.id)}
                                    onPointerDown={onPointerDown}
                                    onPointerUp={(e: any) => onPointerUp(e, layer)}
                                >
                                    <div className="relative flex items-center gap-4 bg-[#1A1D24]/80 backdrop-blur-2xl px-6 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.6)] rounded-full border border-white/10">
                                        <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-0 h-0 border-y-[8px] border-y-transparent border-r-[12px] border-r-white/10" />
                                        <div className="absolute top-1/2 -left-[10px] -translate-y-1/2 w-0 h-0 border-y-[7px] border-y-transparent border-r-[11px] border-r-[#1A1D24]/80" />
                                        <div className={`p-2 ${layerTheme.iconBg} rounded-full`}>
                                            <layer.icon className={`w-5 h-5 ${layerTheme.iconText} ${layerTheme.iconShadow}`} />
                                        </div>
                                        <span className="text-white font-medium tracking-wide text-lg whitespace-nowrap pointer-events-none">
                                            {layer.label}
                                        </span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    );
                })}
            </div>
        </div>
    );
};



const nodeTypes = {
    stackNode: StackNode,
    windowNode: WindowNode
};

export default function CISODashboard() {
    const router = useRouter();
    const params = useParams();
    const entityId = params.entityId as string;

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState([
        {
            id: 'modules-stack',
            type: 'stackNode',
            position: { x: 50, y: 50 },
            data: {
                layers,
                onGoToNucleo: () => router.push(`/nucleo/${entityId}`),
                onLayerClick: (layer: any) => spawnWindow(layer, { x: 800, y: Math.max(0, 100 + (Math.random() * 50 - 25)) })
            },
        }
    ]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const spawnWindow = useCallback((layer: any, position: { x: number, y: number }) => {
        const windowId = `window-${layer.id}`;

        // Prevent opening duplicates
        setNodes((nds) => {
            if (nds.some(n => n.id === windowId)) return nds;

            const newNode: Node = {
                id: windowId,
                type: 'windowNode',
                position,
                dragHandle: '.custom-drag-handle',
                data: {
                    label: layer.label,
                    url: `/nucleo/${entityId}/ciso/${layer.path}`,
                    icon: layer.icon,
                    onClose: () => {
                        setNodes(currentNds => currentNds.filter(n => n.id !== windowId));
                    }
                }
            };
            return [...nds, newNode];
        });
        // We intentionally do NOT create any edges here. The windows are entirely independent.
    }, [entityId, setNodes]);

    // Also support dropping from HTML5 drag
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            const layerId = event.dataTransfer.getData('application/reactflow/layerId');
            if (!layerId || !reactFlowInstance || !reactFlowWrapper.current) return;

            const layer = layers.find(l => l.id === layerId);
            if (!layer) return;

            const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();

            const position = reactFlowInstance.project({
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            });

            spawnWindow(layer, position);
        },
        [reactFlowInstance, spawnWindow]
    );

    return (
        <div className="w-full h-screen bg-[#050505] flex flex-col relative overflow-hidden" ref={reactFlowWrapper}>

            {/* React Flow Diagram - Only for the Stack */}
            <div className="flex-1 w-full h-full relative z-0">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    className="bg-[#050505]"
                    minZoom={0.2}
                    maxZoom={2}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color="#ffffff" gap={24} size={1} className="opacity-5" />
                    <Controls className="!bg-[#111] !border-white/10 !fill-white/60 hover:!fill-white shadow-2xl" />
                </ReactFlow>
            </div>
        </div>
    );
}

