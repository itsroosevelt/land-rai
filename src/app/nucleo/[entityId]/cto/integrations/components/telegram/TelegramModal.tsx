'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle2, X, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, onSnapshot, collectionGroup, query, where, getDocs } from 'firebase/firestore';

interface TelegramModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeEntity: string;
    currentUser: any;
}

export default function TelegramModal({ isOpen, onClose, activeEntity, currentUser }: TelegramModalProps) {
    const [step, setStep] = useState(1);
    const [botToken, setBotToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !currentUser || !activeEntity) return;
        setInitialLoading(true);

        const configRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/telegram`);
        
        const unsub = onSnapshot(configRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.status === 'Connected') {
                    setStep(3);
                    setBotToken(data.botToken || '');
                }
            } else {
                setStep(1);
            }
            setTimeout(() => setInitialLoading(false), 500);
        });

        return () => unsub();
    }, [isOpen, currentUser, activeEntity]);

    const handleConnect = async () => {
        if (!botToken.includes(':')) {
            toast.error("El Bot Token no tiene un formato válido.");
            return;
        }

        setIsLoading(true);
        const toastId = toast.loading("Verificando Telegram Bot...");

        try {
            const queryRef = query(collectionGroup(db, 'integrations'), where('botToken', '==', botToken));
            const snap = await getDocs(queryRef);
            
            const isUsedByAnotherTenant = !snap.empty && !snap.docs.every((d: any) => d.ref.path.includes(activeEntity));
                                    
            if (isUsedByAnotherTenant) {
                toast.error("Este Bot de Telegram ya está siendo utilizado por otro nodo en Roosevelt.", { id: toastId });
                setIsLoading(false);
                return;
            }

            const configRef = doc(db, `users/${currentUser?.uid}/entities/${activeEntity}/integrations/telegram`);
            await setDoc(configRef, {
                botToken,
                status: 'Connected',
                provider: 'telegram',
                updatedAt: new Date(),
            }, { merge: true });

            toast.success("¡Telegram vinculado correctamente!", { id: toastId });
            setStep(3);
        } catch (error) {
            console.error(error);
            toast.error("Fallo al conectar con Telegram localmente.", { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("¿Desconectar Telegram de forma permanente?")) return;
        const toastId = toast.loading("Eliminando nodo...");
        try {
            await deleteDoc(doc(db, `users/${currentUser?.uid}/entities/${activeEntity}/integrations/telegram`));
            setStep(1);
            setBotToken('');
            toast.success("Telegram desconectado al 100%.", { id: toastId });
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
                    className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/5 rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[550px]"
                >
                    {/* Left Side: Branding (The Teal/Green Sidebar) */}
                    <div className="hidden md:flex w-[38%] bg-[#0d1d1d] p-12 flex-col relative overflow-hidden shrink-0 text-left border-r border-white/5">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#26A5E4]/10 to-transparent pointer-events-none" />
                        
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-white/[0.05] border border-white/10 rounded-2xl flex items-center justify-center mb-10 backdrop-blur-md shadow-xl">
                                <Send className="w-10 h-10 text-[#26A5E4]" />
                            </div>
                            
                            <h1 className="text-[32px] font-normal text-white tracking-tight leading-tight mb-4">
                                Telegram
                            </h1>
                            
                            <p className="text-[14px] text-white/40 font-light leading-relaxed max-w-[280px]">
                                Vincula tu bot de Telegram para gestión masiva y automatizada de audiencias a través de Roosevelt.
                            </p>
                        </div>
                    </div>

                    {/* Right Side: Deployment Content */}
                    <div className="flex-1 p-12 flex flex-col bg-[#0a0a0a] relative">
                        <button onClick={onClose} className="absolute top-8 right-8 p-2 text-neutral-500 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-2 mb-12 text-neutral-500">
                            <Lock className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Configuración de Nodo</span>
                        </div>

                        <div className="flex-1 flex flex-col justify-center">
                            <AnimatePresence mode="wait">
                                {step === 1 ? (
                                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-12">
                                        <div className="space-y-8">
                                            {[
                                                { id: 1, text: <>Obtén tu <span className="text-white font-medium">Bot Token</span> oficial desde el @BotFather de Telegram.</> },
                                                { id: 2, text: <>Pega el token para <span className="text-white font-medium">vincular la IA de Roosevelt</span> con tu canal.</> },
                                                { id: 3, text: <>Activa el <span className="text-[#3b82f6] underline underline-offset-4">protocolo de escucha</span> para recibir mensajes en tiempo real.</> }
                                            ].map((step) => (
                                                <div key={step.id} className="flex items-start gap-5 group">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-all duration-500 ${
                                                        step.id === 3 
                                                        ? 'bg-[#1e293b] border border-[#3b82f6]/50 text-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                                                        : 'bg-black border border-white/10 text-white/40'
                                                    }`}>
                                                        {step.id}
                                                    </div>
                                                    <p className={`text-[13px] leading-relaxed transition-colors duration-500 ${step.id === 3 ? 'text-white' : 'text-neutral-400'}`}>
                                                        {step.text}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={() => setStep(2)}
                                            className="w-full h-16 bg-[#26A5E4] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] tracking-widest hover:brightness-110 transition-all"
                                        >
                                            CONTINUAR VINCULACIÓN
                                        </button>
                                    </motion.div>
                                ) : step === 2 ? (
                                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                        <div className="space-y-4">
                                            <h3 className="text-2xl font-light text-white tracking-tight">Credenciales del Nodo</h3>
                                            <div className="space-y-2">
                                                <label className="text-[9px] text-white/30 tracking-[0.2em] uppercase font-black block pl-1">Bot API Token</label>
                                                <input 
                                                    type="text"
                                                    placeholder="0000000000:AAeb..."
                                                    value={botToken}
                                                    onChange={(e) => setBotToken(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white font-mono text-sm focus:outline-none focus:border-[#26A5E4]/50 transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <button onClick={() => setStep(1)} className="flex-1 h-14 bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest rounded-xl hover:text-white transition-all">Regresar</button>
                                            <button 
                                                onClick={handleConnect}
                                                disabled={isLoading}
                                                className="flex-[2] h-14 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-xl hover:bg-gray-200 transition-all"
                                            >
                                                {isLoading ? 'VERIFICANDO...' : 'ACTIVAR PROTOCOLO'}
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center space-y-8">
                                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
                                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-light text-white tracking-tight">Vínculo Establecido</h3>
                                            <p className="text-white/40 text-[13px] font-light max-w-xs mx-auto">El nodo de Telegram ha sido sincronizado bajo el control central de Roosevelt.</p>
                                        </div>
                                        <div className="w-full max-w-sm mt-8 border border-white/5 rounded-2xl bg-black/50 p-6 relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#26A5E4]/30 to-transparent"></div>
                                            <div className="flex flex-col gap-1 items-start mb-6">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-[#26A5E4]">Bot Token Activo</span>
                                                <code className="text-white font-mono text-[13px] tracking-tight">{botToken.substring(0, 15)}...</code>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={onClose} className="flex-1 h-12 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">TERMINAR</button>
                                                <button onClick={handleDelete} className="flex-1 h-12 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">DESCONECTAR</button>
                                            </div>
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
