import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { X, Minus, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export const WindowNode = ({ data }: NodeProps) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    return (
        <div 
            className={cn(
                "bg-[#0A0A0A]/95 backdrop-blur-3xl border border-cyan-500/30 flex flex-col overflow-hidden pointer-events-auto transition-all duration-300",
                isMinimized 
                    ? "w-[300px] h-[48px] rounded-t-2xl rounded-b-none shadow-lg" 
                    : isMaximized 
                        ? "w-[95vw] h-[95vh] rounded-xl shadow-[0_40px_100px_rgba(0,0,0,0.9)]" 
                        : "w-[1000px] h-[700px] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.8)]"
            )}
        >
            {/* Top Bar Activa - Mac/Windows Style */}
            <div className="custom-drag-handle h-12 border-b border-cyan-500/20 bg-gradient-to-b from-white/10 to-transparent flex items-center px-4 justify-between cursor-grab active:cursor-grabbing shrink-0">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); data.onClose?.(); }}
                        className="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 border border-red-600 transition-colors shadow-inner flex items-center justify-center group"
                        title="Cerrar"
                    >
                        <X className="w-2.5 h-2.5 text-red-900 opacity-0 group-hover:opacity-100" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsMinimized(!isMinimized); 
                            if (isMaximized) setIsMaximized(false); 
                        }}
                        className="w-3.5 h-3.5 rounded-full bg-yellow-500 hover:bg-yellow-400 border border-yellow-600 transition-colors shadow-inner flex items-center justify-center group"
                        title="Minimizar"
                    >
                        <Minus className="w-2.5 h-2.5 text-yellow-900 opacity-0 group-hover:opacity-100" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsMaximized(!isMaximized); 
                            if (isMinimized) setIsMinimized(false); 
                        }}
                        className="w-3.5 h-3.5 rounded-full bg-green-500 hover:bg-green-400 border border-green-600 transition-colors shadow-inner flex items-center justify-center group"
                        title="Pantalla Completa"
                    >
                        <Square className="w-2 h-2 text-green-900 opacity-0 group-hover:opacity-100 p-[1px]" />
                    </button>
                </div>

                <div className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                        {data.icon && <data.icon className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <span className="text-cyan-50 font-bold tracking-[0.2em] uppercase text-[10px]">{data.label}</span>
                </div>

                <div className="w-[52px]"></div> {/* Spacer para balancear los botones */}
            </div>
            
            {/* Contenido (Iframe u otro) */}
            <div className={cn("w-full relative z-0 nodrag cursor-auto", isMinimized ? "h-0 hidden" : "flex-1 bg-black/50")}>
                {!isMinimized && (
                    <iframe src={data.url} className="w-full h-full border-none pointer-events-auto" />
                )}
            </div>

            <Handle type="target" position={Position.Left} className="opacity-0" />
        </div>
    );
};
