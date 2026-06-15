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
                stiffness: isClosing ? 200 : 350,
                damping: isClosing ? 25 : 28,
                restDelta: 0.001,
                opacity: { duration: 0.15 }
            }}
            className={cn(
                "bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/10 flex flex-col overflow-hidden pointer-events-auto transition-all duration-300 relative group",
                isMinimized 
                    ? "w-[240px] sm:w-[300px] h-[48px] rounded-t-2xl rounded-b-none shadow-lg" 
                    : isMaximized 
                        ? "fixed inset-0 w-screen h-screen z-[9999] rounded-none shadow-none" 
                        : "w-[95vw] sm:w-[1000px] h-[80vh] sm:h-[700px] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.8)] border-white/10"
            )}
            style={isMaximized ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh' } : {}}
        >
            {/* Top Bar - Oculta en Maximizado hasta hacer Hover */}
            <div className={cn(
                "w-full h-12 border-b border-white/5 bg-[#0D0F14]/90 backdrop-blur-md flex items-center px-4 justify-between cursor-grab active:cursor-grabbing shrink-0 z-50 transition-all duration-500",
                isMaximized ? "absolute top-0 left-0 opacity-0 hover:opacity-100 -translate-y-2 hover:translate-y-0" : "relative",
                "custom-drag-handle"
            )}>
                {/* Spacer for centering */}
                <div className="w-[140px] flex shrink-0" />

                {/* Center title - Capital letter, rest lowercase, no container */}
                <div className="flex items-center justify-center flex-1">
                    <span className="text-white/95 font-medium tracking-wide text-xs whitespace-nowrap uppercase tracking-[0.15em]">
                        {data.label ? data.label.charAt(0).toUpperCase() + data.label.slice(1).toLowerCase() : ''}
                    </span>
                </div>

                {/* Right Actions - All window controls in one place */}
                <div className="flex items-center gap-1 w-[140px] justify-end shrink-0">
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsMinimized(!isMinimized); 
                            if (isMaximized) setIsMaximized(false); 
                        }}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                        title="Minimizar"
                    >
                        <Minus className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsMaximized(!isMaximized);
                            if (isMinimized) setIsMinimized(false);
                        }}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                        title={isMaximized ? "Restaurar" : "Maximizar"}
                    >
                        <Maximize2 className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(data.url, '_blank');
                        }}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                        title="Abrir en pestaña nueva"
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
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
