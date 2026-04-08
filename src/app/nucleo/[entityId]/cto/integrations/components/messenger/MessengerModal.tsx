import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ChevronLeft, ShieldCheck, Facebook, Circle } from 'lucide-react';
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

export function MessengerModal({ isOpen, onClose, activeIntegration }: Props) {
    const { currentUser } = useAuth();
    const params = useParams();
    const activeEntity = params?.entityId as string;
    
    const [step, setStep] = useState<number>(1);
    const [initialLoading, setInitialLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState<any>(null);
    const [config, setConfig] = useState<any>({
        pageId: '',
        pageName: '',
        accessToken: '',
        status: 'Offline'
    });


    // Firestore Sync
    useEffect(() => {
        if (!isOpen || !currentUser || !activeEntity) return;
        setInitialLoading(true);

        const configRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/messenger`);
        
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

    const handleConnectMessenger = async () => {
        const FB = (window as any).FB;
        if (!FB) {
            toast.error("El SDK de Meta no está listo. Recarga la página.");
            return;
        }

        toast.loading("Conectando con Meta Auth Portal...", { id: "meta-auth" });

        FB.login((response: any) => {
            const processAuth = async () => {
                if (response.authResponse) {
                    toast.loading("Obteniendo tus Fanpages...", { id: "meta-auth" });

                    // 1. Fetch Pages (me/accounts)
                    FB.api('/me/accounts', async (pagesRes: any) => {
                        if (pagesRes && pagesRes.data && pagesRes.data.length > 0) {
                            // Automatically pick the first one (MVP) or we could add a selector
                            const page = pagesRes.data[0];
                            const pageId = page.id;
                            const pageName = page.name;
                            const pageAccessToken = page.access_token;

                            toast.loading(`Verificando disponibilidad de ${pageName}...`, { id: "meta-auth" });

                            try {
                                const pagesQuery = query(collectionGroup(db, 'integrations'), where('pageId', '==', pageId));
                                const pagesSnap = await getDocs(pagesQuery);
                                
                                const isUsedByAnotherTenant = !pagesSnap.empty && !pagesSnap.docs.every((d: any) => d.ref.path.includes(activeEntity));
                                
                                if (isUsedByAnotherTenant) {
                                    toast.error("Esta Fanpage ya está vinculada a otro negocio en Roosevelt.", { id: "meta-auth" });
                                    // Make sure Facebook SDK logs out to clear invalid session state if desired, but blocking the save is enough:
                                    return;
                                }

                                toast.loading(`Vinculando ${pageName}...`, { id: "meta-auth" });
                                
                                // 2. SUBSCRIBE PAGE TO APP (CRITICAL FOR WEBHOOKS)
                                FB.api(`/${pageId}/subscribed_apps`, 'post', {
                                    subscribed_fields: ['messages', 'messaging_postbacks', 'message_deliveries', 'message_reads'],
                                    access_token: pageAccessToken
                                }, (subRes: any) => {
                                    console.log('[Meta] Subscription result:', subRes);
                                });

                                const configRef = doc(db, `users/${currentUser?.uid}/entities/${activeEntity}/integrations/messenger`);
                                await setDoc(configRef, {
                                    pageId,
                                    pageName,
                                    accessToken: pageAccessToken,
                                    status: 'Connected',
                                    provider: 'messenger',
                                    updatedAt: new Date(),
                                }, { merge: true });

                                toast.success(`¡Messenger conectado con ${pageName}!`, { id: "meta-auth" });
                                setStep(2);
                            } catch (err) {
                                console.error(err);
                                toast.error("Error al procesar la vinculación.", { id: "meta-auth" });
                            }
                        } else {
                            toast.error("No se encontraron Fanpages vinculadas a tu cuenta.", { id: "meta-auth" });
                        }
                    });
                } else {
                    toast.error("Conexión cancelada por el usuario.", { id: "meta-auth" });
                }
            };
            processAuth();
        }, {
            scope: 'pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement',
            return_scopes: true
        });
    };

    const handleDelete = async () => {
        if (!confirm("¿Desconectar Messenger?")) return;
        const toastId = toast.loading("Eliminando nodo...");
        try {
            await deleteDoc(doc(db, `users/${currentUser?.uid}/entities/${activeEntity}/integrations/messenger`));
            setStep(1);
            toast.success("Messenger desconectado.", { id: toastId });
        } catch (e) {
            toast.error("Error al desconectar.", { id: toastId });
        }
    };

    if (!activeIntegration || activeIntegration.id !== 'messenger') return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-4xl h-[600px] bg-[#050505] border border-white/10 rounded-[40px] overflow-hidden flex shadow-2xl font-sans">
                        
                        {/* Sidebar */}
                        <div className="w-1/3 border-r border-white/5 bg-[#080808] p-10 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-blue-600/5 blur-[100px] pointer-events-none" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-white/[0.03] border border-white/10 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                                    <Facebook className="w-8 h-8 text-[#0084FF]" />
                                </div>
                                <h2 className="text-4xl font-extralight text-white tracking-tighter mb-4 italic uppercase">Messenger</h2>
                                <p className="text-[10px] text-white/30 leading-relaxed uppercase tracking-[0.2em] font-medium">Protocolo de Mensajería Social</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-[24px] backdrop-blur-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Estado del Nodo</span>
                                </div>
                                <p className="text-[10px] text-white/30 leading-relaxed italic">Sincronización autónoma de conversaciones desde páginas de Facebook.</p>
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
                                        <div className="w-12 h-12 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/20">Sincronizando...</p>
                                    </div>
                                ) : step === 1 ? (
                                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                        <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Vincular Fanpage</h3>
                                        <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-12">Portal de Acceso Meta</p>
                                        
                                        <div className="space-y-6 mb-12">
                                            <div className="flex items-start gap-4">
                                                <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0">1</div>
                                                <p className="text-xs text-white/60 font-light mt-1">Otorga permisos de Roosevelt para leer tus páginas.</p>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0">2</div>
                                                <p className="text-xs text-white/60 font-light mt-1">Detectaremos automáticamente la Fanpage activa.</p>
                                            </div>
                                        </div>

                                        <button onClick={handleConnectMessenger} className="w-full h-16 bg-[#0084FF] hover:bg-[#0073e6] text-white text-[11px] font-bold uppercase tracking-[0.3em] rounded-full transition-all shadow-[0_0_20px_rgba(0,132,255,0.2)]">
                                            CONECTAR CON META
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.div key="step2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
                                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-8 relative">
                                            <div className="absolute inset-0 rounded-full border border-green-500/20 animate-pulse" />
                                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                                        </div>
                                        <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Canal Sincronizado</h3>
                                        <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-10">{config.pageName}</p>
                                        
                                        <div className="w-full space-y-4 px-2">
                                            <div className="h-24 bg-white/5 border border-white/10 rounded-[32px] flex items-center px-8 justify-between backdrop-blur-sm">
                                                <div className="text-left">
                                                    <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 block mb-2 font-bold opacity-60">IDENTIFICADOR DE PÁGINA</span>
                                                    <p className="text-2xl font-light text-white tracking-widest">{config.pageId}</p>
                                                </div>
                                                <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl"><ShieldCheck className="w-6 h-6 text-green-500/40" /></div>
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
