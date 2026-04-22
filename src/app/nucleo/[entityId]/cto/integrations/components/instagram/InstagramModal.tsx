import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Instagram,
    X,
    CheckCircle2,
    ShieldCheck,
    ArrowRight,
    Lock
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface InstagramModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeEntity: any;
    currentUser: any;
}

const InstagramModal: React.FC<InstagramModalProps> = ({ isOpen, onClose, activeEntity, currentUser }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const [isSelectingPage, setIsSelectingPage] = useState(false);
    const [availablePages, setAvailablePages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userToken, setUserToken] = useState<string | null>(null);

    const userId = currentUser?.uid;
    const entityId = activeEntity?.id || activeEntity;

    useEffect(() => {
        if (!userId || !entityId) return;

        const q = doc(db, `users/${userId}/entities/${entityId}/integrations/instagram`);
        const unsubscribe = onSnapshot(q, (doc) => {
            if (doc.exists()) {
                setConfig(doc.data());
                setIsConnected(true);
            } else {
                setConfig(null);
                setIsConnected(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, entityId]);

    const handleConnectInstagram = async () => {
        const toastId = toast.loading("Conectando con Facebook...");
        try {
            // @ts-ignore
            if (!window.FB) {
                toast.error("Facebook SDK no cargado.", { id: toastId });
                return;
            }

            // @ts-ignore
            window.FB.login((response: any) => {
                if (response.authResponse) {
                    setUserToken(response.authResponse.accessToken);
                    fetchInstagramPages(response.authResponse.accessToken, toastId);
                } else {
                    toast.error("Conexión cancelada.", { id: toastId });
                }
            }, { scope: 'instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement' });

        } catch (error) {
            console.error("Instagram Login Error:", error);
            toast.error("Error al conectar.", { id: toastId });
        }
    };

    const fetchInstagramPages = async (userToken: string, toastId: any) => {
        try {
            const res = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=name,access_token,instagram_business_account{id,username,name}&access_token=${userToken}`);
            const data = await res.json();

            const pagesWithIg = data.data?.filter((p: any) => p.instagram_business_account) || [];

            if (pagesWithIg.length > 0) {
                setAvailablePages(pagesWithIg);
                setIsSelectingPage(true);
                toast.success("Selecciona tu cuenta de Instagram.", { id: toastId });
            } else {
                toast.error("No se detectaron cuentas de Instagram Business vinculadas.", { id: toastId });
            }
        } catch (error) {
            toast.error("Error al obtener cuentas.", { id: toastId });
        }
    };

    const handleSelectPage = async (page: any) => {
        const toastId = toast.loading(`Vinculando @${page.instagram_business_account.username}...`);
        try {
            if (!userToken) {
                toast.error("Sesión expirada. Vuelve a iniciar sesión con Facebook.", { id: toastId });
                return;
            }

            const exchangeRes = await fetch('/api/meta/exchange-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shortLivedToken: userToken, pageId: page.id })
            });

            const exchangeData = await exchangeRes.json();

            if (!exchangeRes.ok || !exchangeData.accessToken) {
                const detail = exchangeData.details || exchangeData.error || 'Error desconocido';
                toast.error(`No se pudo obtener el token permanente: ${detail}. Verifica que META_APP_SECRET esté configurado en Vercel.`, { id: toastId });
                return;
            }

            const permanentToken = exchangeData.accessToken;

            const instagramConfig = {
                instagramId: page.instagram_business_account.id,
                username: page.instagram_business_account.username,
                name: page.name,
                pageId: page.id,
                accessToken: permanentToken,
                tokenType: 'Permanente',
                status: 'Connected',
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(db, `users/${userId}/entities/${entityId}/integrations/instagram`), instagramConfig);
            await setDoc(doc(db, `integrations/instagram/accounts/${page.instagram_business_account.id}`), {
                entityId,
                userId,
                username: page.instagram_business_account.username,
                accessToken: permanentToken,
                updatedAt: serverTimestamp()
            });

            setConfig(instagramConfig);
            setIsConnected(true);
            setIsSelectingPage(false);
            toast.success("Instagram conectado con token permanente.", { id: toastId });
        } catch (error) {
            toast.error("Error al guardar configuración.", { id: toastId });
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
            toast.success("Desconectado correctamente.", { id: toastId });
        } catch (error) {
            toast.error("Error al desconectar.");
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    
                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl min-h-[550px] bg-[#0A0A0A] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex">
                        
                        {/* Left Branding Side */}
                        <div className="w-[38%] bg-[#E1306C]/5 border-r border-white/5 p-12 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                                <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#E1306C] rounded-full blur-[100px]" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-tr from-[#FFDC80] via-[#E1306C] to-[#405DE6] rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(225,48,108,0.3)]">
                                    <Instagram className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-3xl font-extralight text-white/90 tracking-tight mb-3">Instagram</h2>
                                <p className="text-sm text-white/40 leading-relaxed">Gestiona tus mensajes y comentarios de Instagram Business de forma automatizada con IA.</p>
                            </div>

                            <div className="relative z-10 p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Estado del Nodo</span>
                                </div>
                                <p className="text-[12px] text-white/60 leading-relaxed">Sincronización autónoma de DMs para cuentas profesionales.</p>
                            </div>
                        </div>

                        {/* Right Content Side */}
                        <div className="flex-1 p-12 flex flex-col relative overflow-y-auto custom-scrollbar">
                            <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-white/5 rounded-full transition-colors group z-20">
                                <X className="w-5 h-5 text-white/20 group-hover:text-white" />
                            </button>

                            <div className="flex-1 flex flex-col justify-center py-4">
                                {!isConnected ? (
                                    <motion.div key="connect" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                        <div className="flex items-center gap-2 mb-12">
                                            <Lock className="w-3 h-3 text-white/20" />
                                            <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Configuración de Nodo</span>
                                        </div>

                                        {isSelectingPage ? (
                                            <>
                                                <div className="grid gap-3 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
                                                    {availablePages.map((page) => (
                                                        <button key={page.id} onClick={() => handleSelectPage(page)} className="group h-24 bg-white/5 border border-white/10 hover:border-pink-500/50 rounded-[32px] flex items-center px-8 transition-all hover:bg-white/[0.07] relative overflow-hidden">
                                                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-pink-500/20 transition-colors">
                                                                <Instagram className="w-6 h-6 text-white/40 group-hover:text-pink-500" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-lg font-light text-white leading-none mb-1">@{page.instagram_business_account.username}</p>
                                                                <span className="text-[9px] text-white/20 uppercase tracking-widest font-mono">{page.name}</span>
                                                            </div>
                                                            <ArrowRight className="w-5 h-5 text-white/10 ml-auto group-hover:text-pink-500 group-hover:translate-x-1 transition-all" />
                                                        </button>
                                                    ))}
                                                </div>
                                                <button onClick={() => setIsSelectingPage(false)} className="mt-8 text-[10px] text-white/40 hover:text-white uppercase tracking-widest font-bold transition-colors underline underline-offset-8">Volver Atrás</button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="space-y-8 mb-16">
                                                    <div className="flex items-start gap-6">
                                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-white/40 shrink-0">1</div>
                                                        <p className="text-[15px] text-white/70 font-normal mt-2 leading-relaxed">Conecta tu cuenta Business de Instagram para recibir mensajes en el CRM.</p>
                                                    </div>
                                                    <div className="flex items-start gap-6">
                                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-white/40 shrink-0">2</div>
                                                        <p className="text-[15px] text-white/70 font-normal mt-2 leading-relaxed">Asegúrate de que tu cuenta esté vinculada a una Fanpage de Facebook.</p>
                                                    </div>
                                                </div>
        
                                                <button onClick={handleConnectInstagram} className="w-full h-16 bg-gradient-to-r from-[#FFDC80] via-[#E1306C] to-[#405DE6] text-white text-xs font-bold uppercase tracking-[0.3em] rounded-full transition-all shadow-[0_0_40px_rgba(225,48,108,0.2)]">
                                                    CONTINUAR VINCULACIÓN
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
                                        <h3 className="text-3xl font-extralight text-white tracking-tighter mb-1 italic uppercase leading-none">Perfil Activo</h3>
                                        <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-6">Instagram Business API</p>
                                        
                                        <div className="w-full space-y-3 px-2">
                                            <div className="h-24 bg-white/5 border border-white/10 rounded-[32px] flex items-center px-8 justify-between backdrop-blur-sm relative overflow-hidden group/card">
                                                <div className="absolute inset-0 bg-pink-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                <div className="text-left relative z-10">
                                                    <span className="text-[8px] uppercase tracking-[0.2em] text-pink-500 block mb-2 font-black opacity-70">USUARIO</span>
                                                    <p className="text-xl font-extralight text-white tracking-tight leading-none truncate max-w-[250px]">@{config?.username || config?.name || config?.instagramId || 'Cuenta vinculada'}</p>
                                                    <span className="text-[8px] text-white/20 mt-2 block font-mono uppercase tracking-widest text-left">IG ID: {config?.instagramId}</span>
                                                </div>
                                                <div className="p-4 bg-pink-500/5 border border-pink-500/10 rounded-2xl relative z-10"><Instagram className="w-6 h-6 text-pink-500/40" /></div>
                                            </div>

                                            <div className="flex items-center justify-between px-6 py-4 bg-white/5 rounded-2xl border border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                                    <span className="text-[8px] text-white/40 uppercase tracking-widest font-bold">Monitoreando DMs en tiempo real</span>
                                                </div>
                                                <div className="px-3 py-1 bg-pink-500/10 border border-pink-500/20 rounded-full">
                                                    <span className="text-[8px] text-pink-500 font-black uppercase tracking-widest">TOKEN PERMANENTE</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 pt-6">
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
};

export default InstagramModal;
