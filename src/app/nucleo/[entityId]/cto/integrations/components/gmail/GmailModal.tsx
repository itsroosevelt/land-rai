'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Mail, 
    X, 
    CheckCircle2, 
    AlertCircle, 
    ShieldCheck, 
    ArrowRight,
    Circle,
    RotateCw
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

interface GmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeEntity: string;
    currentUser: any;
}

export default function GmailModal({ isOpen, onClose, activeEntity, currentUser }: GmailModalProps) {
    const userId = currentUser?.uid;
    const entityId = activeEntity;
    const [isConnected, setIsConnected] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            const unsubscribe = onSnapshot(
                doc(db, `users/${userId}/entities/${entityId}/integrations/gmail`),
                (doc) => {
                    if (doc.exists()) {
                        setConfig(doc.data());
                        setIsConnected(true);
                    } else {
                        setIsConnected(false);
                        setConfig(null);
                    }
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        }
    }, [isOpen, entityId]);

    const handleConnectGmail = async () => {
        try {
            const res = await fetch(`/api/gmail/auth-url?e=${entityId}&u=${userId}`);
            if (!res.ok) throw new Error(`Auth URL error: ${res.status}`);
            const data = await res.json();

            if (!data.url) {
                toast.error("Error al generar la URL de conexión con Google.");
                return;
            }

            const width = 600;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            const popup = window.open(
                data.url,
                'Google Login',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            if (!popup || popup.closed) {
                // Popup was blocked — redirect in main window as fallback
                toast.info("El navegador bloqueó el popup. Redirigiendo en esta ventana...");
                window.location.href = data.url;
                return;
            }

            const handleMessage = (event: MessageEvent) => {
                if (event.data === 'gmail-auth-success') {
                    toast.success("Gmail vinculado correctamente.");
                    window.removeEventListener('message', handleMessage);
                } else if (event.data === 'gmail-auth-error') {
                    toast.error("No se pudo conectar Gmail. Verifica la configuración e inténtalo de nuevo.");
                    window.removeEventListener('message', handleMessage);
                }
            };
            window.addEventListener('message', handleMessage);

        } catch (error) {
            console.error('Gmail connect error:', error);
            toast.error("Fallo de conexión con el servidor.");
        }
    };

    const handleDelete = async () => {
        if (!confirm("¿Desvincular Gmail? Se detendrá la sincronización de correos.")) return;
        
        const toastId = toast.loading("Eliminando conexión...");
        try {
            // 1. Delete from public/integrations (internal routing)
            await deleteDoc(doc(db, `integrations/gmail/users/${userId}_${entityId}`));
            
            // 2. Delete from entity (UI state)
            await deleteDoc(doc(db, `users/${userId}/entities/${entityId}/integrations/gmail`));
            
            toast.success("Gmail desconectado.", { id: toastId });
        } catch (error) {
            toast.error("Error al desconectar.", { id: toastId });
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    
                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-[900px] aspect-[16/10] bg-[#0A0A0A] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex">
                        
                        {/* Left Branding Side */}
                        <div className="w-[35%] bg-red-500/5 border-r border-white/5 p-12 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                                <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-red-600 rounded-full blur-[100px]" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-[#EA4335] rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(234,67,53,0.3)]">
                                    <Mail className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-4xl font-light text-white mb-2">Gmail</h2>
                                <p className="text-[10px] text-[#EA4335] uppercase tracking-[0.4em] font-black">Cloud Email</p>
                            </div>

                            <div className="relative z-10 p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Protocolo Activo</span>
                                </div>
                                <p className="text-[10px] text-white/30 leading-relaxed font-light">Escucha de eventos en tiempo real vía Google Cloud Pub/Sub.</p>
                            </div>
                        </div>

                        {/* Right Content Side */}
                        <div className="flex-1 p-12 flex flex-col relative">
                            <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-white/5 rounded-full transition-colors group">
                                <X className="w-5 h-5 text-white/20 group-hover:text-white" />
                            </button>

                            <div className="flex-1 flex flex-col justify-center">
                                {!isConnected ? (
                                    <motion.div key="connect" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                        <h3 className="text-6xl font-extralight text-white tracking-tighter mb-6 italic uppercase leading-tight">Vincular <br /><span className="text-[#EA4335]">Google Cloud</span></h3>
                                        
                                        <div className="space-y-6 mb-12">
                                            <div className="flex items-start gap-4">
                                                <div className="w-8 h-8 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/40 shrink-0">01</div>
                                                <p className="text-xs text-white/50 font-light mt-1.5 leading-relaxed">Conecta tu bandeja de entrada para centralizar tus correos.</p>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-8 h-8 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/40 shrink-0">02</div>
                                                <p className="text-xs text-white/50 font-light mt-1.5 leading-relaxed">Roosevelt responderá automáticamente correos usando IA.</p>
                                            </div>
                                        </div>

                                        <button onClick={handleConnectGmail} className="w-full h-16 bg-[#EA4335] hover:bg-[#d93025] text-white text-[11px] font-bold uppercase tracking-[0.3em] rounded-full transition-all shadow-[0_0_40px_rgba(234,67,53,0.2)]">
                                            CONECTAR GMAIL
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.div key="active" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
                                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-8 relative">
                                            <div className="absolute inset-0 rounded-full border border-green-500/20 animate-pulse" />
                                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                                        </div>
                                        <h3 className="text-4xl font-extralight text-white tracking-tighter mb-1 italic uppercase leading-none">Bandeja Vinculada</h3>
                                        <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-10">Google API Status: Operational</p>
                                        
                                        <div className="w-full space-y-4 px-2">
                                            <div className="h-28 bg-white/5 border border-white/10 rounded-[32px] flex items-center px-8 justify-between backdrop-blur-sm relative overflow-hidden group/card">
                                                <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                <div className="text-left relative z-10">
                                                    <span className="text-[8px] uppercase tracking-[0.2em] text-red-500 block mb-2 font-black opacity-70">CORREO ELECTRÓNICO</span>
                                                    <p className="text-xl font-extralight text-white tracking-tight leading-none truncate max-w-[250px]">{config.email || 'Cuenta Activa'}</p>
                                                    <span className="text-[8px] text-white/20 mt-2 block font-mono uppercase tracking-widest text-left">SYNC MODE: REAL-TIME (PUB/SUB)</span>
                                                </div>
                                                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl relative z-10"><ShieldCheck className="w-6 h-6 text-red-500/40" /></div>
                                            </div>

                                            <div className="flex items-center gap-4 pt-10">
                                                <button onClick={onClose} className="flex-1 h-14 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-[0.3em] rounded-full transition-all">TERMINAR</button>
                                                <button onClick={handleDelete} className="flex-1 h-14 bg-red-500/5 hover:bg-red-500/10 text-red-500/50 border border-red-500/10 text-[10px] font-bold uppercase tracking-[0.3em] rounded-full transition-all">DESCONECTAR</button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
