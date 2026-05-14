import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeProps } from 'reactflow';
import { X, Minus, Square, Maximize2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export const WindowNode = ({ data, xPos, yPos }: NodeProps) => {
    const [isMaximized, setIsMaximized] = useState(data.initialMaximized || false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (data.initialMaximized) {
            setIsMaximized(true);
        }
    }, [data.initialMaximized]);

    useEffect(() => {
        if (isMaximized && data.url) {
            window.history.replaceState(null, '', data.url);
        } else if (!isMaximized && mounted) {
            const pathParts = window.location.pathname.split('/');
            const entityId = pathParts[2];
            const role = new URLSearchParams(window.location.search).get('role') || 'ceo';
            const workspaceUrl = `/nucleo/${entityId}/workspace?role=${role}`;
            window.history.replaceState(null, '', workspaceUrl);
        }
    }, [isMaximized, data.url, mounted]);

    const handleClose = () => {
        setIsClosing(true);
        if (isMaximized) {
            const pathParts = window.location.pathname.split('/');
            const entityId = pathParts[2];
            const role = new URLSearchParams(window.location.search).get('role') || 'ceo';
            const workspaceUrl = `/nucleo/${entityId}/workspace?role=${role}`;
            window.history.replaceState(null, '', workspaceUrl);
        }
        setTimeout(() => {
            data.onClose?.();
        }, 500);
    };

    // Calcular desplazamiento desde el origen
    const originX = data.origin?.x ?? 0;
    const originY = data.origin?.y ?? 0;
    const deltaX = originX - xPos;
    const deltaY = originY - yPos;

    const content = (
        <motion.div 
            initial={{ 
                opacity: 0, 
                scale: 0.2, 
                x: deltaX, 
                y: deltaY,
                filter: 'blur(20px)'
            }}
            animate={isClosing ? { 
                opacity: 0, 
                scale: 0, 
                x: deltaX, 
                y: deltaY,
                filter: 'blur(30px)'
            } : { 
                opacity: 1, 
                scale: isMinimized ? 0.3 : 1, 
                x: 0, 
                y: 0,
                filter: 'blur(0px)'
            }}
            transition={{
                type: 'spring',
                stiffness: isClosing ? 150 : 100,
                damping: isClosing ? 25 : 22,
                restDelta: 0.001,
                opacity: { duration: 0.3 }
            }}
            className={cn(
                "bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/10 flex flex-col overflow-hidden pointer-events-auto transition-all duration-300 relative group",
                isMinimized 
                    ? "w-[240px] sm:w-[300px] h-[48px] rounded-t-2xl rounded-b-none shadow-lg" 
                    : isMaximized 
                        ? "fixed inset-0 w-screen h-screen z-[9999] rounded-none shadow-none" 
                        : "w-[95vw] sm:w-[1000px] h-[80vh] sm:h-[700px] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.8)] border-cyan-500/20"
            )}
            style={isMaximized ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh' } : {}}
        >
            {/* Top Bar - Oculta en Maximizado hasta hacer Hover */}
            <div className={cn(
                "w-full h-12 border-b border-white/5 bg-[#0D0F14]/90 backdrop-blur-md flex items-center px-4 justify-between cursor-grab active:cursor-grabbing shrink-0 z-50 transition-all duration-500",
                isMaximized ? "absolute top-0 left-0 opacity-0 hover:opacity-100 -translate-y-2 hover:translate-y-0" : "relative",
                "custom-drag-handle"
            )}>
                {/* Traffic Lights - Mac Style Refined */}
                <div className="flex items-center gap-2 w-[70px]">
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleClose(); }}
                        className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 border border-black/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-all flex items-center justify-center group"
                    >
                        <X className="w-2 h-2 text-black opacity-0 group-hover:opacity-60" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsMinimized(!isMinimized); 
                            if (isMaximized) setIsMaximized(false); 
                        }}
                        className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:bg-[#FEBC2E]/80 border border-black/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-all flex items-center justify-center group"
                    >
                        <Minus className="w-2 h-2 text-black opacity-0 group-hover:opacity-60" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsMaximized(!isMaximized); 
                            if (isMinimized) setIsMinimized(false); 
                        }}
                        className="w-3 h-3 rounded-full bg-[#28C840] hover:bg-[#28C840]/80 border border-black/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-all flex items-center justify-center group"
                    >
                        <Square className="w-1.5 h-1.5 text-black opacity-0 group-hover:opacity-60" />
                    </button>
                </div>

                {/* Center Badge - Muestra la ruta técnica */}
                <div className="flex items-center gap-2 px-4 py-1.5 bg-white/[0.03] rounded-full border border-white/10 shadow-[inset_0_1px_10px_rgba(255,255,255,0.02)]">
                    <span className="text-white/20 font-mono text-[9px] tracking-widest uppercase">
                        {data.url.split('/').slice(3, -1).join(' / ') || 'nucleo'} /
                    </span>
                    <span className="text-white/90 font-bold tracking-[0.1em] uppercase text-[10px] whitespace-nowrap">
                        {data.label}
                    </span>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-1 w-[120px] justify-end">
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsMaximized(!isMaximized);
                            if (isMinimized) setIsMinimized(false);
                        }}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                        title={isMaximized ? "Restaurar" : "Pantalla completa"}
                    >
                        <Maximize2 className={cn("w-3.5 h-3.5 transition-colors", isMaximized ? "text-cyan-400" : "text-white/40 group-hover:text-cyan-400")} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const pathParts = data.url.split('/');
                            const entityId = pathParts[2];
                            const role = pathParts[3] || 'ceo';
                            // Pasamos el ID del layer para que se abra maximizado en la nueva pestaña
                            const fullWorkspaceUrl = `/nucleo/${entityId}/workspace?role=${role}&maximize=${data.id}`;
                            window.open(fullWorkspaceUrl, '_blank');
                        }}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                        title="Duplicar instancia Roosevelt"
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-cyan-400 transition-colors" />
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleClose(); }}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors group"
                        title="Cerrar"
                    >
                        <X className="w-3.5 h-3.5 text-white/40 group-hover:text-red-500 transition-colors" />
                    </button>
                </div>
            </div>
            
            {/* Contenido con Scroll Independiente */}
            <div className={cn("w-full relative z-0 nodrag cursor-auto", isMinimized ? "h-0 hidden" : "flex-1 bg-black/50 overflow-hidden")}>
                {!isMinimized && (
                    <iframe src={data.url} className="w-full h-full border-none pointer-events-auto" />
                )}
            </div>

            <Handle type="target" position={Position.Left} className="opacity-0" />
        </motion.div>
    );

    if (!mounted) return null;

    return isMaximized 
        ? createPortal(content, document.body)
        : (
            <>
                {content}
                <Handle type="target" position={Position.Left} className="opacity-0" />
            </>
        );
};
