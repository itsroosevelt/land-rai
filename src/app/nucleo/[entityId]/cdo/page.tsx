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
    ArrowRight, Brain, Database, Cpu, Shield, PieChart, Search, BarChart, Lock, X
} from 'lucide-react';

const layers = [
    { id: 'ai-engine', label: 'AI Engine', path: 'ai-engine', icon: Brain },
    { id: 'lake', label: 'Data Lake', path: 'lake', icon: Database },
    { id: 'neural', label: 'Neural Pipeline', path: 'neural', icon: Cpu },
    { id: 'governance', label: 'Data Governance', path: 'governance', icon: Shield },
    { id: 'viz', label: 'Data Visualization', path: 'viz', icon: PieChart },
    { id: 'mining', label: 'Data Mining', path: 'mining', icon: Search },
    { id: 'bi', label: 'Business Intelligence', path: 'bi', icon: BarChart },
    { id: 'privacy', label: 'Data Privacy', path: 'privacy', icon: Lock },
];

const StackNode = ({ data }: NodeProps) => {
    const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
    const hoveredIndex = data.layers.findIndex((l: any) => l.id === hoveredLayer);
    
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
            data.onLayerClick(layer);
        }
        pointerDownPos.current = null;
    };

    const onDragStart = (event: any, layerId: string) => {
        event.dataTransfer.setData('application/reactflow/layerId', layerId);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div style={{ perspective: '2000px', width: '700px', height: '800px' }} className="flex items-center justify-center relative pointer-events-auto">
            <div 
                className="relative w-[380px] h-[380px]"
                style={{ 
                    transform: 'rotateX(55deg) rotateZ(-45deg)', 
                    transformStyle: 'preserve-3d' 
                }}
            >
                {data.layers.map((layer: any, index: number) => {
                    const isHovered = hoveredLayer === layer.id;
                    const isAboveHovered = hoveredIndex !== -1 && index > hoveredIndex;

                    const baseZ = index * 45; 
                    let hoverOffset = 0;
                    if (isHovered) hoverOffset = 40;
                    if (isAboveHovered) hoverOffset = 140; 
                    
                    const zPosition = baseZ + hoverOffset;
                    
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
                                backgroundColor: isHovered ? 'rgba(0, 200, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                borderTop: isHovered ? '2px solid rgba(255,255,255,0.7)' : '1px solid rgba(255, 255, 255, 0.2)',
                                borderLeft: isHovered ? '2px solid rgba(255,255,255,0.7)' : '1px solid rgba(255, 255, 255, 0.2)',
                                borderBottom: isHovered ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.01)',
                                borderRight: isHovered ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.01)',
                                boxShadow: isHovered 
                                    ? `inset 0 0 50px rgba(0,255,255,0.3), 0 40px 60px rgba(0,0,0,0.6)` 
                                    : `inset 0 0 10px rgba(255,255,255,0.05), 0 15px 30px rgba(0,0,0,0.5)`
                            }}
                            animate={{ z: zPosition }}
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
                                        className="absolute inset-0 m-auto w-[60%] h-[60%] bg-cyan-400/30 blur-[50px] rounded-full pointer-events-none" 
                                    />
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            <div className="absolute top-0 right-10 w-[300px] h-full pointer-events-none flex flex-col justify-end pb-[165px]">
                {data.layers.map((layer: any, index: number) => {
                    const isHovered = hoveredLayer === layer.id;
                    const bottomPos = index * 30 + 200; 

                    return (
                        <AnimatePresence key={`label-${layer.id}`}>
                            {isHovered && (
                                <motion.div
                                    initial={{ opacity: 0, x: -30, filter: 'blur(10px)' }}
                                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
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
                                        <div className="p-2 bg-cyan-500/20 rounded-full">
                                            <layer.icon className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
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

const WindowNode = ({ data }: NodeProps) => {
    return (
        <div className="w-[1000px] h-[700px] bg-[#0A0A0A]/90 backdrop-blur-3xl border border-cyan-500/30 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden pointer-events-auto">
            {/* Window Drag Handle / Titlebar */}
            <div className="custom-drag-handle h-12 border-b border-cyan-500/20 bg-black/40 flex items-center px-4 justify-between cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                        <data.icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-cyan-50 font-bold tracking-[0.2em] uppercase text-xs pointer-events-none">{data.label}</span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); data.onClose(); }} 
                    className="p-1.5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            {/* Interactive Frame Content */}
            <div className="flex-1 w-full bg-black/50 relative z-0 nodrag cursor-auto">
                <iframe src={data.url} className="w-full h-full border-none pointer-events-auto" />
            </div>

            <Handle type="target" position={Position.Left} className="opacity-0" />
        </div>
    );
};

const nodeTypes = {
    stackNode: StackNode,
    windowNode: WindowNode
};

export default function CDODashboard() {
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
                    url: `/nucleo/${entityId}/cdo/${layer.path}`,
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
            {/* Header Overlay */}
            <div className="absolute top-24 left-10 z-10 pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <h6 className="text-cyan-500 uppercase tracking-[0.3em] text-[10px] font-bold mb-3">Data Department</h6>
                    <h1 className="text-4xl md:text-5xl font-light bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent tracking-wide mb-4">
                        CDO Architecture
                    </h1>
                    <p className="text-white/40 max-w-sm text-xs font-medium leading-relaxed">
                        Drag any glass plate or its label into the workspace to open an independent window.
                    </p>
                </motion.div>
            </div>
            
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

