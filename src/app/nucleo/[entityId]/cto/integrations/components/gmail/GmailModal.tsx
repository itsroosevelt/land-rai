'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, CheckCircle2, X, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, onSnapshot, collectionGroup, query, where, getDocs } from 'firebase/firestore';

interface GmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeEntity: string;
    currentUser: any;
}

export default function GmailModal({ isOpen, onClose, activeEntity, currentUser }: GmailModalProps) {
    const [step, setStep] = useState(1);
    const [gmailAddress, setGmailAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !currentUser || !activeEntity) return;
        setInitialLoading(true);

        const configRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/gmail`);
        
        const unsub = onSnapshot(configRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.status === 'Connected') {
                    setStep(3);
                    setGmailAddress(data.gmailAddress || '');
                }
            } else {
                setStep(1);
            }
            setTimeout(() => setInitialLoading(false), 500);
        });

        return () => unsub();
    }, [isOpen, currentUser, activeEntity]);

    const handleConnect = async () => {
        setIsLoading(true);
        const toastId = toast.loading("Abriendo portal de seguridad de Google...");

        try {
            const res = await fetch(`/api/gmail/auth-url?u=${currentUser.uid}&e=${activeEntity}`);
            const { url } = await res.json();
            
            if (url) {
                // Lógica de Ventana Emergente (Popup)
                const width = 600;
                const height = 700;
                const left = window.screenX + (window.outerWidth - width) / 2;
                const top = window.screenY + (window.outerHeight - height) / 2;
                
                const popup = window.open(
                    url, 
                    'google-auth', 
                    `width=${width},height=${height},left=${left},top=${top}`
                );

                if (popup) {
                    toast.info("Completa el acceso en la ventana emergente.", { id: toastId });
                    
                    // Monitorear cierre de ventana
                    const checkPopup = setInterval(() => {
                        if (popup.closed) {
                            clearInterval(checkPopup);
                            setIsLoading(false);
                            // Nota: El onSnapshot del useEffect detectará el cambio en Firestore 
                            // y pasará al Step 3 automáticamente.
                        }
                    }, 1000);
                } else {
                    // Fallback si el navegador bloquea el popup
                    window.location.href = url;
                }
            } else {
                throw new Error("No se pudo generar el enlace de acceso.");
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Fallo al conectar con Google.", { id: toastId });
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("¿Desconectar la sincronización de correos permanentemente?")) return;
        const toastId = toast.loading("Revocando accesos IAM...");
        try {
            await deleteDoc(doc(db, `users/${currentUser?.uid}/entities/${activeEntity}/integrations/gmail`));
            setStep(1);
            setGmailAddress('');
            toast.success("Bandeja de entrada desconectada.", { id: toastId });
        } catch (e) {
            toast.error("Error al desconectar.", { id: toastId });
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-4xl h-[600px] bg-[#0a0a0a] border border-white/5 rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
                >
                    {/* Left Side: Branding (Sidebar) */}
                    <div className="hidden md:flex w-1/3 bg-[#0d1d1d] p-10 flex-col justify-between relative overflow-hidden shrink-0 text-left border-r border-white/5">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#EA4335]/10 to-transparent pointer-events-none" />
                        
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-white/[0.05] border border-white/10 rounded-2xl flex items-center justify-center mb-10 backdrop-blur-md shadow-xl">
                                <Mail className="w-10 h-10 text-[#EA4335]" />
                            </div>
                            
                            <h1 className="text-4xl font-extralight text-white tracking-tighter mb-4 italic uppercase">
                                Gmail
                            </h1>
                            
                            <p className="text-[10px] text-white/30 leading-relaxed uppercase tracking-[0.2em] font-medium">
                                Professional Protocol
                            </p>
                        </div>

                        <div className="p-6 bg-white/5 border border-white/10 rounded-[24px] backdrop-blur-sm relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#EA4335] shadow-[0_0_8px_rgba(234,67,53,0.8)]" />
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Estado del Nodo</span>
                            </div>
                            <p className="text-[10px] text-white/30 leading-relaxed italic">Sincronización autónoma de hilos y respuestas para Roosevelt.</p>
                        </div>
                    </div>

                    {/* Right Side: Content Area */}
                    <div className="flex-1 flex flex-col bg-[#0a0a0a] relative">
                        <button onClick={onClose} className="absolute top-8 right-8 p-2 text-neutral-600 hover:text-white transition-colors z-50">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex-1 p-12 flex flex-col justify-center relative">
                            <div className="absolute top-12 left-12 flex items-center gap-2 text-neutral-500">
                                <Lock className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Google Enterprise Sync</span>
                            </div>

                            <AnimatePresence mode="wait">
                                {step === 1 ? (
                                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-12">
                                        <div>
                                            <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Vincular Workspace</h3>
                                            <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-12">Portal de Acceso Seguro</p>

                                            <div className="space-y-6 text-left">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0">1</div>
                                                    <p className="text-xs text-white/60 font-light mt-1 text-left leading-relaxed">Inicia sesión con tu cuenta de <span className="text-white">Google Cloud Portal</span>.</p>
                                                </div>
                                                <div className="flex items-start gap-4">
                                                    <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0">2</div>
                                                    <p className="text-xs text-white/60 font-light mt-1 text-left leading-relaxed">Vincula tu bandeja de entrada con la <span className="text-white">IA de Roosevelt</span>.</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={handleConnect}
                                            disabled={isLoading}
                                            className="w-full h-16 bg-[#EA4335] text-white text-[11px] font-bold uppercase tracking-[0.3em] rounded-full transition-all shadow-[0_0_20px_rgba(234,67,53,0.2)] hover:brightness-110 active:scale-[0.98]"
                                        >
                                            {isLoading ? 'SINCRONIZANDO...' : 'CONECTAR GMAIL'}
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.div 
                                        key="step3" 
                                        initial={{ opacity: 0, scale: 0.95 }} 
                                        animate={{ opacity: 1, scale: 1 }} 
                                        className="flex flex-col items-center text-center space-y-10"
                                    >
                                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center relative">
                                            <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-pulse" />
                                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                        </div>

                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Canal Sincronizado</h3>
                                            <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">Gmail Node <span className="text-emerald-500">Online</span></p>
                                        </div>

                                        <div className="w-full max-w-sm h-32 bg-white/[0.03] border border-white/10 rounded-[32px] p-8 flex items-center justify-between backdrop-blur-sm relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="text-left relative z-10">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-[#EA4335] block mb-2">Canal Activo</span>
                                                <h4 className="text-white font-light text-xl tracking-tight leading-none truncate max-w-[250px]">
                                                    {gmailAddress}
                                                </h4>
                                                <span className="text-[9px] text-white/40 mt-3 block font-medium italic">Listo para recibir hilos</span>
                                            </div>

                                            <div className="w-14 h-14 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-center relative z-10">
                                                <ShieldCheck className="w-7 h-7 text-emerald-500/40" />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 w-full max-w-sm pt-6">
                                            <button 
                                                onClick={onClose} 
                                                className="flex-1 h-14 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-[0.3em] rounded-full transition-all"
                                            >
                                                TERMINAR
                                            </button>
                                            <button 
                                                onClick={handleDelete} 
                                                className="flex-1 h-14 bg-red-500/5 hover:bg-red-500/10 text-red-500/50 border border-red-500/10 text-[10px] font-bold uppercase tracking-[0.3em] rounded-full transition-all"
                                            >
                                                DESCONECTAR
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
