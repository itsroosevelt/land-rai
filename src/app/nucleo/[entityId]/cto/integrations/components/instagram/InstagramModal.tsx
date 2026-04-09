import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ShieldCheck, Instagram, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { Integration } from '../../config';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, onSnapshot, collectionGroup, query, where, getDocs } from 'firebase/firestore';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    activeIntegration: Integration | null;
}

export function InstagramModal({ isOpen, onClose, activeIntegration }: Props) {
    const { currentUser } = useAuth();
    const params = useParams();
    const activeEntity = params?.entityId as string;
    
    const [step, setStep] = useState<number>(1);
    const [initialLoading, setInitialLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState<any>(null);
    const [availablePages, setAvailablePages] = useState<any[]>([]);
    const [isSelectingPage, setIsSelectingPage] = useState(false);
    const [showNoIgError, setShowNoIgError] = useState(false);
    const [config, setConfig] = useState<any>({
        instagramId: '',
        pageName: '',
        accessToken: '',
        status: 'Offline'
    });


    // Firestore Sync
    useEffect(() => {
        if (!isOpen || !currentUser || !activeEntity) return;
        setInitialLoading(true);

        const configRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/instagram`);
        
        const unsub = onSnapshot(configRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.status === 'Connected') {
                    setStep(2);
                    setUpdatedAt(data.updatedAt);
                    setConfig(data);
                }
            } else {
                setStep(1);
            }
            setTimeout(() => setInitialLoading(false), 500);
        });

        return () => unsub();
    }, [isOpen, currentUser, activeEntity]);

    const handleConnectInstagram = async () => {
        let retries = 0;
        const maxRetries = 6;

        const startLogin = () => {
            const FB = (window as any).FB;
            if (!FB || !(window as any).FB_READY) {
                if (retries < maxRetries) {
                    retries++;
                    setTimeout(startLogin, 500);
                } else {
                    toast.error("El SDK de Meta no responde.");
                }
                return;
            }

            toast.loading("Accediendo a Meta...", { id: "meta-auth" });

            (window as any).FB.login((response: any) => {
                if (response.authResponse) {
                    (window as any).FB.api('/me/accounts?fields=instagram_business_account{id,username,name},name,access_token', async (pagesRes: any) => {
                        if (pagesRes && pagesRes.data) {
                            const pagesWithIg = pagesRes.data.filter((p: any) => p.instagram_business_account);
                            if (pagesWithIg.length === 0) {
                                setShowNoIgError(true);
                                toast.dismiss("meta-auth");
                                return;
                            }
                            if (pagesWithIg.length > 1) {
                                setAvailablePages(pagesWithIg);
                                setIsSelectingPage(true);
                                toast.dismiss("meta-auth");
                            } else {
                                await connectPage(pagesWithIg[0]);
                            }
                        }
                    });
                } else {
                    toast.error("Conexión cancelada.", { id: "meta-auth" });
                }
            }, {
                scope: 'public_profile,instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement,pages_manage_metadata',
                return_scopes: true
            });
        };

        startLogin();
    };

    const connectPage = async (pageWithIg: any) => {
        const instagramId = pageWithIg.instagram_business_account.id;
        const pageAccessToken = pageWithIg.access_token;
        toast.loading(`Vinculando @${pageWithIg.instagram_business_account.username}...`, { id: "meta-auth" });

        try {
            const igQuery = query(collectionGroup(db, 'integrations'), where('instagramId', '==', instagramId));
            const igSnap = await getDocs(igQuery);
            const isUsedByAnotherTenant = !igSnap.empty && !igSnap.docs.every((d: any) => d.ref.path.includes(activeEntity));
            
            if (isUsedByAnotherTenant) {
                toast.error("Cuenta ya vinculada a otro negocio.", { id: "meta-auth" });
                return;
            }

            (window as any).FB.api(`/${pageWithIg.id}/subscribed_apps`, 'post', {
                subscribed_fields: ['messages', 'messaging_postbacks', 'message_deliveries', 'message_reads'],
                access_token: pageAccessToken
            });

            const configRef = doc(db, `users/${currentUser?.uid}/entities/${activeEntity}/integrations/instagram`);
            await setDoc(configRef, {
                instagramId, 
                pageName: pageWithIg.instagram_business_account.username ? `@${pageWithIg.instagram_business_account.username}` : (pageWithIg.instagram_business_account.name || pageWithIg.name), 
                accessToken: pageAccessToken,
                status: 'Connected', provider: 'instagram', updatedAt: new Date(),
            }, { merge: true });

            toast.success(`¡Instagram vinculado!`, { id: "meta-auth" });
            setStep(2);
            setIsSelectingPage(false);
        } catch (err) {
            toast.error("Error al procesar la vinculación.", { id: "meta-auth" });
        }
    };

    const handleDelete = async () => {
        if (!confirm("¿Desconectar Instagram?")) return;
        const toastId = toast.loading("Eliminando nodo...");
        try {
            await deleteDoc(doc(db, `users/${currentUser?.uid}/entities/${activeEntity}/integrations/instagram`));
            setStep(1);
            toast.success("Instagram desconectado.", { id: toastId });
        } catch (e) {
            toast.error("Error al desconectar.", { id: toastId });
        }
    };

    if (!activeIntegration || activeIntegration.id !== 'instagram') return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-4xl h-[600px] bg-[#050505] border border-white/10 rounded-[40px] overflow-hidden flex shadow-2xl font-sans text-left">
                        
                        {/* Sidebar */}
                        <div className="w-1/3 border-r border-white/5 bg-[#080808] p-10 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-[#E4405F]/5 blur-[100px] pointer-events-none" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-white/[0.03] border border-white/10 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                                    <Instagram className="w-8 h-8 text-[#E4405F]" />
                                </div>
                                <h2 className="text-4xl font-extralight text-white tracking-tighter mb-4 italic uppercase">Instagram</h2>
                                <p className="text-[10px] text-white/30 leading-relaxed uppercase tracking-[0.2em] font-medium">Professional Protocol</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-[24px] backdrop-blur-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#E4405F] shadow-[0_0_8px_rgba(228,64,95,0.8)]" />
                                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Estado del Nodo</span>
                                </div>
                                <p className="text-[10px] text-white/30 leading-relaxed italic">Sincronización autónoma de DMs y comentarios para cuentas profesionales.</p>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 flex flex-col relative bg-black/40">
                            <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-white/5 rounded-full transition-all z-50 group">
                                <X className="w-5 h-5 text-neutral-600 group-hover:text-white" />
                            </button>

                            <div className="flex-1 p-12 flex flex-col justify-center">
                                {initialLoading ? (
                                    <div className="flex flex-col items-center gap-4 animate-pulse">
                                        <div className="w-12 h-12 border-2 border-white/10 border-t-[#E4405F] rounded-full animate-spin" />
                                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/20">Accediendo a la red...</p>
                                    </div>
                                ) : step === 1 ? (
                                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                        {isSelectingPage ? (
                                            <>
                                                <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Seleccionar Cuenta</h3>
                                                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-8">Varias cuentas detectadas</p>
                                                <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pr-2 mb-8">
                                                    {availablePages.map((p) => (
                                                        <button 
                                                            key={p.id} 
                                                            onClick={() => connectPage(p)}
                                                            className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all group"
                                                        >
                                                            <div className="flex items-center gap-4 text-left">
                                                                <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 font-bold text-[#E4405F]">
                                                                   IG
                                                                </div>
                                                                <div>
                                                                    <p className="text-white text-sm font-medium">@{p.instagram_business_account.username || p.name}</p>
                                                                    <p className="text-[10px] text-white/30 uppercase tracking-tighter">Página: {p.name}</p>
                                                                </div>
                                                            </div>
                                                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:border-[#E4405F]/50 group-hover:text-[#E4405F]">
                                                                →
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                                <button onClick={() => setIsSelectingPage(false)} className="text-[9px] text-white/30 hover:text-white uppercase tracking-widest font-bold underline underline-offset-4">Volver atrás</button>
                                            </>
                                        ) : showNoIgError ? (
                                            <motion.div key="noIgError" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
                                                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-8 relative">
                                                    <div className="absolute inset-0 rounded-full border border-red-500/20 animate-pulse" />
                                                    <Instagram className="w-10 h-10 text-red-500" />
                                                </div>
                                                <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Perfil No Detectado</h3>
                                                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-8 italic">Configuración Requerida en Meta</p>
                                                
                                                <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 mb-10 backdrop-blur-sm text-left w-full">
                                                    <p className="text-xs text-white/60 font-light leading-relaxed mb-6">
                                                        Tu cuenta de Facebook no tiene un <span className="text-white font-medium">Perfil de Instagram Professional</span> vinculado. 
                                                        Para usar la automatización de Roosevelt, debes realizar esta conexión primero en el Business Suite.
                                                    </p>
                                                    <div className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                                                        <Circle className="w-2 h-2 text-red-500 fill-red-500" />
                                                        <span className="text-[9px] uppercase tracking-widest text-red-400 font-bold">Acción Requerida: Vincular Instagram a Fanpage</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-4 w-full">
                                                    <a 
                                                        href="https://business.facebook.com/latest/inbox/instagram_direct?asset_id=520950477768651&business_id=1785184582003764&ir_qe_exposed=1"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-full h-16 bg-white text-black text-[11px] font-bold uppercase tracking-[0.3em] rounded-full flex items-center justify-center transition-all hover:bg-neutral-200"
                                                    >
                                                        Crea tu perfil aquí
                                                    </a>
                                                    <button 
                                                        onClick={() => setShowNoIgError(false)}
                                                        className="text-[9px] text-white/30 hover:text-white uppercase tracking-widest font-bold underline underline-offset-8 transition-colors"
                                                    >
                                                        Intentar de nuevo
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <>
                                                <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Vincular Professional Account</h3>
                                                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-12">Portal de Acceso Meta</p>
                                                
                                                <div className="space-y-6 mb-12 text-left">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0">1</div>
                                                        <p className="text-xs text-white/60 font-light mt-1 text-left leading-relaxed">Asegúrate de que tu Instagram sea una <span className="text-white">Cuenta Profesional</span> y esté vinculada a una Fanpage.</p>
                                                    </div>
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0">2</div>
                                                        <p className="text-xs text-white/60 font-light mt-1 text-left leading-relaxed">Roosevelt te permitirá elegir entre tus perfiles de Udreamms para la automatización.</p>
                                                    </div>
                                                </div>

                                                <button onClick={handleConnectInstagram} className="w-full h-16 bg-gradient-to-r from-[#E4405F] to-[#F58529] hover:opacity-90 text-white text-[11px] font-bold uppercase tracking-[0.3em] rounded-full transition-all shadow-[0_0_20px_rgba(228,64,95,0.2)]">
                                                    CONECTAR CON INSTAGRAM
                                                </button>
                                            </>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div key="step2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
                                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-8 relative">
                                            <div className="absolute inset-0 rounded-full border border-green-500/20 animate-pulse" />
                                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                                        </div>
                                        <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Canal Sincronizado</h3>
                                        <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-10">Instagram Node Online</p>
                                        
                                        <div className="w-full space-y-4 px-2">
                                            <div className="h-28 bg-white/5 border border-white/10 rounded-[32px] flex items-center px-8 justify-between backdrop-blur-sm relative overflow-hidden group/card">
                                                <div className="absolute inset-0 bg-[#E4405F]/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                <div className="text-left relative z-10">
                                                    <span className="text-[9px] uppercase tracking-[0.2em] text-[#E4405F] block mb-2 font-black">CANAL ACTIVO</span>
                                                    <p className="text-2xl font-light text-white tracking-tight leading-none truncate max-w-[200px]">{config.pageName || 'Perfil Conectado'}</p>
                                                    <span className="text-[9px] text-white/40 mt-3 block font-medium italic">Listo para recibir mensajes</span>
                                                </div>
                                                <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl relative z-10"><ShieldCheck className="w-6 h-6 text-green-500/40" /></div>
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
