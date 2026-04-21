'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Instagram, 
    X, 
    CheckCircle2, 
    AlertCircle, 
    ShieldCheck, 
    ArrowRight,
    Circle,
    Info
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface InstagramModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeEntity: string;
    currentUser: any;
    activeIntegration?: any;
}

export default function InstagramModal({ isOpen, onClose, activeEntity, currentUser }: InstagramModalProps) {
    const userId = currentUser?.uid;
    const entityId = activeEntity;
    const [isConnected, setIsConnected] = useState(false);
    const [isSelectingPage, setIsSelectingPage] = useState(false);
    const [availablePages, setAvailablePages] = useState<any[]>([]);
    const [userAccessToken, setUserAccessToken] = useState('');
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            checkConnection();
        }
    }, [isOpen, entityId]);

    const checkConnection = async () => {
        try {
            const docRef = doc(db, `users/${userId}/entities/${entityId}/integrations/instagram`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setConfig(docSnap.data());
                setIsConnected(true);
            }
        } catch (error) {
            console.error("Error checking Instagram connection:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectInstagram = () => {
        if (!(window as any).FB) {
            toast.error("Meta SDK no cargado.");
            return;
        }

        const toastId = toast.loading("Abriendo Meta Auth...");

        (window as any).FB.login((response: any) => {
            if (response.authResponse) {
                const shortLivedToken = response.authResponse.accessToken;
                setUserAccessToken(shortLivedToken);
                
                toast.loading("Buscando cuentas de Instagram...", { id: toastId });

                (window as any).FB.api('/me/accounts', { fields: 'name,access_token,instagram_business_account' }, (pagesRes: any) => {
                    if (pagesRes && pagesRes.data) {
                        const igPages = pagesRes.data.filter((p: any) => p.instagram_business_account);
                        if (igPages.length > 0) {
                            setAvailablePages(igPages);
                            setIsSelectingPage(true);
                            toast.dismiss(toastId);
                        } else {
                            toast.error("No se encontraron cuentas de Instagram Business vinculadas.", { id: toastId });
                        }
                    } else {
                        toast.error("Error al obtener páginas.", { id: toastId });
                    }
                });
            } else {
                toast.error("Conexión cancelada.", { id: toastId });
            }
        }, { scope: 'pages_messaging,pages_show_list,instagram_basic,instagram_manage_messages,pages_read_engagement' });
    };

    const handleSelectPage = async (page: any) => {
        const toastId = toast.loading(`Sincronizando ${page.instagram_business_account.username}...`);

        try {
            let finalToken = page.access_token;
            let tokenType = 'temporal';

            // --- INTENTO DE INTERCAMBIO POR TOKEN PERMANENTE ---
            try {
                const exchangeRes = await fetch('/api/meta/exchange-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        shortLivedToken: userAccessToken,
                        pageId: page.id // Usamos el Page ID para el intercambio
                    })
                });

                if (exchangeRes.ok) {
                    const data = await exchangeRes.json();
                    finalToken = data.accessToken;
                    tokenType = data.tokenType;
                }
            } catch (err) {
                console.warn("[Instagram] Server exchange failed, falling back to client token.", err);
            }

            const instagramConfig = {
                instagramId: page.instagram_business_account.id,
                username: page.instagram_business_account.username,
                pageId: page.id,
                accessToken: finalToken,
                tokenType: tokenType,
                status: 'Connected',
                updatedAt: serverTimestamp()
            };

            // Save for the specific entity
            await setDoc(doc(db, `users/${userId}/entities/${entityId}/integrations/instagram`), instagramConfig);
            
            // Save in public collection for webhook ingestion
            await setDoc(doc(db, `integrations/instagram/accounts/${page.instagram_business_account.id}`), {
                entityId,
                userId,
                username: page.instagram_business_account.username,
                accessToken: finalToken,
                updatedAt: serverTimestamp()
            });

            setConfig(instagramConfig);
            setIsConnected(true);
            setIsSelectingPage(false);
            toast.success("Instagram conectado con éxito.", { id: toastId });
        } catch (error) {
            console.error("Error saving Instagram config:", error);
            toast.error("Fallo al guardar la configuración.", { id: toastId });
        }
    };

    const handleDelete = async () => {
        if (!confirm("¿Desconectar Instagram?")) return;
        
        const toastId = toast.loading("Desconectando...");
        try {
            await deleteDoc(doc(db, `users/${userId}/entities/${entityId}/integrations/instagram`));
            if (config?.instagramId) {
                await deleteDoc(doc(db, `integrations/instagram/accounts/${config.instagramId}`));
            }
            setIsConnected(false);
            setConfig(null);
            toast.success("Desconectado correctamente.", { id: toastId });
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
                        <div className="w-[35%] bg-[#E1306C]/5 border-r border-white/5 p-12 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                                <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#E1306C] rounded-full blur-[100px]" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-tr from-[#FFDC80] via-[#E1306C] to-[#405DE6] rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(225,48,108,0.3)]">
                                    <Instagram className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-5xl font-extralight text-white tracking-tighter mb-4 italic uppercase leading-none">Instagram</h2>
                                <p className="text-[10px] text-white/40 uppercase tracking-[0.4em] font-bold leading-relaxed">Conexión de Negocios Visual</p>
                            </div>

                            <div className="relative z-10 p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Estado del Nodo</span>
                                </div>
                                <p className="text-[10px] text-white/30 leading-relaxed font-light">Sincronización de DMs y comentarios para cuentas Business.</p>
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
                                        {isSelectingPage ? (
                                            <>
                                                <h3 className="text-4xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Vincular Cuenta</h3>
                                                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-10 text-left">Cuentas Business detectadas</p>
                                                
                                                <div className="grid gap-3 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
                                                    {availablePages.map((page) => (
                                                        <button key={page.id} onClick={() => handleSelectPage(page)} className="group h-24 bg-white/5 border border-white/10 hover:border-pink-500/50 rounded-[32px] flex items-center px-8 transition-all hover:bg-white/[0.07] relative overflow-hidden">
                                                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-pink-500/20 transition-colors">
                                                                <span className="text-lg font-bold text-white/40 group-hover:text-pink-500">IG</span>
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-lg font-light text-white leading-none mb-1">@{page.instagram_business_account.username}</p>
                                                                <span className="text-[9px] text-white/20 uppercase tracking-widest font-mono">Linked to: {page.name}</span>
                                                            </div>
                                                            <ArrowRight className="w-5 h-5 text-white/10 ml-auto group-hover:text-pink-500 group-hover:translate-x-1 transition-all" />
                                                        </button>
                                                    ))}
                                                </div>
                                                <button onClick={() => setIsSelectingPage(false)} className="mt-8 text-[10px] text-white/40 hover:text-white uppercase tracking-widest font-bold transition-colors underline underline-offset-8">Volver Atrás</button>
                                            </>
                                        ) : (
                                            <>
                                                <h3 className="text-6xl font-extralight text-white tracking-tighter mb-6 italic uppercase leading-tight">Canal <br /><span className="text-pink-500">Instagram</span></h3>
                                                
                                                <div className="space-y-6 mb-12">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-8 h-8 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/40 shrink-0">01</div>
                                                        <p className="text-xs text-white/50 font-light mt-1.5 leading-relaxed">Conecta tu cuenta Business de Instagram para recibir mensajes en el CRM.</p>
                                                    </div>
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-8 h-8 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/40 shrink-0">02</div>
                                                        <p className="text-xs text-white/50 font-light mt-1.5 leading-relaxed">Asegúrate de que tu cuenta esté vinculada a una Fanpage de Facebook.</p>
                                                    </div>
                                                </div>
        
                                                <button onClick={handleConnectInstagram} className="w-full h-16 bg-gradient-to-r from-[#FFDC80] via-[#E1306C] to-[#405DE6] text-white text-[11px] font-bold uppercase tracking-[0.3em] rounded-full transition-all shadow-[0_0_40px_rgba(225,48,108,0.2)]">
                                                    CONECTAR INSTAGRAM
                                                </button>
                                            </>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div key="active" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
                                        <div className="w-20 h-20 bg-pink-500/10 rounded-full flex items-center justify-center mb-8 relative">
                                            <div className="absolute inset-0 rounded-full border border-pink-500/20 animate-pulse" />
                                            <CheckCircle2 className="w-10 h-10 text-pink-500" />
                                        </div>
                                        <h3 className="text-4xl font-extralight text-white tracking-tighter mb-1 italic uppercase leading-none">Perfil Activo</h3>
                                        <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-10">Instagram Business API</p>
                                        
                                        <div className="w-full space-y-4 px-2">
                                            <div className="h-28 bg-white/5 border border-white/10 rounded-[32px] flex items-center px-8 justify-between backdrop-blur-sm relative overflow-hidden group/card">
                                                <div className="absolute inset-0 bg-pink-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                <div className="text-left relative z-10">
                                                    <span className="text-[8px] uppercase tracking-[0.2em] text-pink-500 block mb-2 font-black opacity-70">USUARIO</span>
                                                    <p className="text-xl font-extralight text-white tracking-tight leading-none truncate max-w-[250px]">@{config.username || 'Cuenta Activa'}</p>
                                                    <span className="text-[8px] text-white/20 mt-2 block font-mono uppercase tracking-widest text-left">IG ID: {config.instagramId}</span>
                                                </div>
                                                <div className="p-4 bg-pink-500/5 border border-pink-500/10 rounded-2xl relative z-10"><Instagram className="w-6 h-6 text-pink-500/40" /></div>
                                            </div>

                                            {/* External Status Indicators */}
                                            <div className="w-full px-6 flex items-center justify-between mt-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-pink-500 animate-pulse" />
                                                    <span className="text-[9px] text-white/40 font-medium italic uppercase tracking-tighter">Monitoreando DMs en tiempo real</span>
                                                </div>
                                                
                                                {/* Token Type Badge */}
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                                                    <div className={`w-1 h-1 rounded-full ${config.tokenType === 'permanent' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">
                                                        {config.tokenType === 'permanent' ? 'Token Permanente' : 'Token Temporal (2h)'}
                                                    </span>
                                                </div>
                                            </div>

                                            {config.tokenType !== 'permanent' && (
                                                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-3">
                                                    <Info className="w-4 h-4 text-yellow-500/50 mt-0.5" />
                                                    <p className="text-[9px] text-yellow-500/70 leading-relaxed text-left">
                                                        <b>Aviso:</b> Conexión de corta duración. 
                                                        Para activar el modo <b>Permanente</b>, verifica la configuración de Vercel.
                                                    </p>
                                                </div>
                                            )}

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
