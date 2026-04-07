import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, ChevronLeft, Settings, Copy, ShieldCheck, QrCode, Lock, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { Integration } from '../../config';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    activeIntegration: Integration | null;
}

export function WhatsAppCloudAPIModal({ isOpen, onClose, activeIntegration }: Props) {
    const { currentUser } = useAuth();
    const params = useParams();
    const activeEntity = params?.entityId as string;
    
    const [step, setStep] = useState<number>(1);
    const [isEditing, setIsEditing] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState<any>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [tempConfig, setTempConfig] = useState<any>(null);

    // Meta Wizard States
    const [wizardPath, setWizardPath] = useState<'new' | 'existing' | null>(null);
    const [connectionMode, setConnectionMode] = useState<'meta' | 'manual'>('meta');
    const [accountAction, setAccountAction] = useState<'new' | 'existing'>('new');
    const [phoneStatus, setPhoneStatus] = useState<'new' | 'personal' | 'none' | null>(null);
    const [bspChoice, setBspChoice] = useState<'internal' | 'other' | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    const [clickCount, setClickCount] = useState(0);
    const [devMode, setDevMode] = useState(false);


    const [waConfig, setWaConfig] = useState({
        phoneNumberId: '',
        wabaId: '',
        accessToken: '',
        displayPhoneNumber: '',
        verifyToken: Math.random().toString(36).substring(7),
        appId: process.env.NEXT_PUBLIC_META_APP_ID || '',
    });

    // Validations
    const validateField = (name: string, value: string) => {
        let error = '';
        const bareValue = value.replace(/\s/g, ''); 

        switch (name) {
            case 'phoneNumberId':
            case 'wabaId':
                if (value.includes(' ')) error = 'No se permiten espacios';
                break;
            case 'displayPhoneNumber':
                if (!value.startsWith('+') && value.length > 0) error = 'Debe empezar con +';
                else if (value.replace(/\D/g, '').length < 10 && value.length > 0) error = 'Mínimo 10 dígitos';
                break;
            case 'accessToken':
                if (value.length > 0 && !value.startsWith('EAA')) error = 'Debe empezar con EAA';
                else if (value.length > 0 && value.includes(' ')) error = 'No se permiten espacios';
                break;
        }
        setFormErrors(prev => ({ ...prev, [name]: error }));
        return error === '';
    };

    // Facebook SDK Initialization
    useEffect(() => {
        const appId = process.env.NEXT_PUBLIC_META_APP_ID;
        if (!appId) return;

        (window as any).fbAsyncInit = function() {
            (window as any).FB.init({
                appId: appId,
                cookie: true,
                xfbml: true,
                version: 'v21.0'
            });
        };

        (function(d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) return;
            js = d.createElement(s) as HTMLScriptElement;
            js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            fjs.parentNode?.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    }, []);

    // Firestore Sync
    useEffect(() => {
        if (!isOpen || !currentUser || !activeEntity) return;
        setInitialLoading(true);

        const configRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/whatsapp`);
        const internalConfigRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/whatsapp_internal`);
        
        let unsubInternal: any = null;

        const unsub = onSnapshot(configRef, (snap) => {
            if (snap.exists()) {
                if (unsubInternal) { unsubInternal(); unsubInternal = null; }
                const data = snap.data();
                if ((data.status === 'Connected' || data.status === 'Internal') && data.phoneNumberId) {
                    setStep(4);
                    setUpdatedAt(data.updatedAt);
                    setWaConfig(prev => ({ ...prev, ...data, displayPhoneNumber: data.displayPhoneNumber || '' }));
                }
                setTimeout(() => setInitialLoading(false), 500);
            } else {
                // Fallback to internal if standard doesn't exist
                if (!unsubInternal) {
                    unsubInternal = onSnapshot(internalConfigRef, (internalSnap) => {
                        if (internalSnap.exists()) {
                            const data = internalSnap.data();
                            if ((data.status === 'Connected' || data.status === 'Internal') && data.phoneNumberId) {
                                setStep(4);
                                setUpdatedAt(data.updatedAt);
                                setWaConfig(prev => ({ ...prev, ...data, displayPhoneNumber: data.displayPhoneNumber || '' }));
                            }
                        } else {
                            setStep(1);
                        }
                        setTimeout(() => setInitialLoading(false), 500);
                    });
                } else {
                    setStep(1);
                    setTimeout(() => setInitialLoading(false), 500);
                }
            }
        });

        return () => {
            unsub();
            if (unsubInternal) unsubInternal();
        };
    }, [isOpen, currentUser, activeEntity]);

    if (!activeIntegration || activeIntegration.id !== 'whatsapp') return null;

    const saveWhatsAppConfig = async () => {
        if (!currentUser || !activeEntity) return;

        // Final validation before save
        const errors = {
            phoneNumberId: validateField('phoneNumberId', waConfig.phoneNumberId) ? '' : formErrors.phoneNumberId,
            wabaId: validateField('wabaId', waConfig.wabaId) ? '' : formErrors.wabaId,
            displayPhoneNumber: validateField('displayPhoneNumber', waConfig.displayPhoneNumber) ? '' : formErrors.displayPhoneNumber,
            accessToken: validateField('accessToken', waConfig.accessToken) ? '' : formErrors.accessToken,
        };

        if (Object.values(errors).some(e => e !== '') || !waConfig.phoneNumberId || !waConfig.accessToken) {
            toast.error("Revisa los campos marcados en rojo.");
            return;
        }

        const _unused_toastId = toast.loading("Verificando credenciales...");

        try {
            const validationRes = await fetch('/api/whatsapp/validate-phone-id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumberId: waConfig.phoneNumberId,
                    userId: currentUser.uid,
                    entityId: activeEntity
                })
            });
            const validationData = await validationRes.json();

            if (!validationData.valid) {
                toast.error(validationData.message || "El número ya está vinculado a otra cuenta.", { id: "meta-auth" });
                return;
            }
        } catch (error) {
            console.error("Validation error:", error);
            toast.error("Hubo un problema verificando el número.", { id: "meta-auth" });
            return;
        }

        toast.loading("Guardando configuración...", { id: "meta-auth" });
        try {
            const configRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/whatsapp`);
            await setDoc(configRef, {
                ...waConfig,
                status: 'Connected',
                provider: 'whatsapp',
                updatedAt: new Date(),
            }, { merge: true });

            toast.success("¡WhatsApp conectado!", { id: "meta-auth" });
            setIsEditing(false);
            setStep(4);
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar.", { id: "meta-auth" });
        }
    };

    const handleConnectFacebook = async () => {
        const facebookAppId = process.env.NEXT_PUBLIC_META_APP_ID;
        if (!facebookAppId) {
            toast.error("Error: NEXT_PUBLIC_META_APP_ID no está configurado en las variables de entorno.");
            toast.error("Error: NEXT_PUBLIC_META_APP_ID no configurado en Vercel.");
            return;
        }

        if (devMode) {
            setStep(4);
            return;
        }

        const FB = (window as any).FB;
        if (!FB) {
            toast.error("El SDK de Meta no está listo. Verifica tu AdBlocker o recarga la página.");
            return;
        }

        toast.loading("Abriendo Meta Auth Portal...", { id: "meta-auth" });

        FB.login((response: any) => {
            const processAuth = async () => {
                if (response.authResponse) {
                    const accessToken = response.authResponse.accessToken;
                    const userId = response.authResponse.userID;

                    toast.loading("Obteniendo detalles de la cuenta...", { id: "meta-auth" });

                    // 1. Fetch WABA and Phone Number details from Meta
                    FB.api('/me/whatsapp_business_accounts', (wabaRes: any) => {
                        console.log("[Meta API] /me/whatsapp_business_accounts response:", wabaRes);
                        if (wabaRes && wabaRes.data && wabaRes.data.length > 0) {
                            const wabaId = wabaRes.data[0].id; // We take the first one for simplicity or let user choose (future)
                            
                            FB.api(`/${wabaId}/phone_numbers`, async (phoneRes: any) => {
                                console.log(`[Meta API] /${wabaId}/phone_numbers response:`, phoneRes);
                                if (phoneRes && phoneRes.data && phoneRes.data.length > 0) {
                                    const phone = phoneRes.data[0];
                                    const phoneNumberId = phone.id;
                                    const displayPhoneNumber = phone.display_phone_number;

                                    toast.loading("Validando exclusividad en Roosevelt...", { id: "meta-auth" });

                                    // 2. Validate uniqueness across all Roosevelt tenants
                                    try {
                                        const validationRes = await fetch('/api/whatsapp/validate-phone-id', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                phoneNumberId: phoneNumberId,
                                                userId: currentUser?.uid,
                                                entityId: activeEntity
                                            })
                                        });

                                        const validationData = await validationRes.json();

                                        if (!validationData.valid) {
                                            toast.error(validationData.message || "Este número ya está siendo usado por otro usuario de Roosevelt.", { id: "meta-auth" });
                                            return;
                                        }

                                        // 3. Save full configuration if valid
                                        const configRef = doc(db, `users/${currentUser?.uid}/entities/${activeEntity}/integrations/whatsapp`);
                                        const configDoc = {
                                            status: 'Connected',
                                            provider: 'whatsapp',
                                            accessToken: accessToken,
                                            metaUserId: userId,
                                            phoneNumberId: phoneNumberId,
                                            wabaId: wabaId,
                                            displayPhoneNumber: displayPhoneNumber,
                                            updatedAt: new Date(),
                                        };

                                        await setDoc(configRef, configDoc, { merge: true });
                                        toast.success("¡Vinculación oficial completada!", { id: "meta-auth" });
                                        setStep(4);
                                    } catch (err) {
                                        console.error("Duplicate check error:", err);
                                        toast.error("Error validando el número. Intenta de nuevo.", { id: "meta-auth" });
                                    }
                                } else {
                                    toast.error("No se encontraron números de teléfono vinculados a esta cuenta de Meta.", { id: "meta-auth" });
                                }
                            });
                        } else {
                            toast.error("No se encontraron Cuentas de WhatsApp Business (WABA) en este perfil.", { id: "meta-auth" });
                        }
                    });
                } else {
                    console.warn("FB Login cancelled or failed:", response);
                    toast.error("La conexión con Meta falló o fue cancelada.", { id: "meta-auth" });
                }
            };
            
            processAuth();
        }, {
            scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
            return_scopes: true
        });
    };

    const handleDeleteConfig = async () => {

        if (!currentUser || !activeEntity) return;
        if (!confirm("¿Seguro que quieres desconectar WhatsApp?")) return;

        const _unused_toastId = toast.loading("Desconectando...");
        try {
            const configRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/whatsapp`);
            const internalConfigRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/whatsapp_internal`);
            
            await Promise.all([
                deleteDoc(configRef),
                deleteDoc(internalConfigRef)
            ]);

            // Turn off any active chatbots
            const botsRef = collection(db, `users/${currentUser.uid}/entities/${activeEntity}/chatbots`);
            
            // Handle both true and 'true' just in case
            const qReal = query(botsRef, where('isActive', '==', true));
            const qStr = query(botsRef, where('isActive', '==', 'true'));
            
            const [snapsReal, snapsStr] = await Promise.all([getDocs(qReal), getDocs(qStr)]);
            
            const updatePromises: Promise<void>[] = [];
            snapsReal.forEach(bot => updatePromises.push(updateDoc(bot.ref, { isActive: false })));
            snapsStr.forEach(bot => updatePromises.push(updateDoc(bot.ref, { isActive: false })));
            
            await Promise.all(updatePromises);

            setWaConfig({
                phoneNumberId: '', wabaId: '', accessToken: '', displayPhoneNumber: '',
                verifyToken: Math.random().toString(36).substring(7),
                appId: process.env.NEXT_PUBLIC_META_APP_ID || '',
            });
            setStep(1);
            setIsEditing(false);
            toast.success("Desconectado.", { id: "meta-auth" });
        } catch (error) {
            console.error(error);
            toast.error("Error al desconectar.", { id: "meta-auth" });
        }
    };

    const renderManualForm = () => (
        <div className="flex-1 flex flex-col pt-2 overflow-y-auto pr-2 no-scrollbar">
            <div className="space-y-5 mb-8 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <div className="flex justify-between px-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500">PHONE ID (15 DÍGITOS)</label>
                            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-[8px] text-blue-500 font-bold uppercase italic tracking-tighter">¿DÓNDE ENCONTRARLO?</a>
                        </div>
                        <input
                            type="text" placeholder="Ej: 676837795516836"
                            value={waConfig.phoneNumberId}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setWaConfig({ ...waConfig, phoneNumberId: val });
                                validateField('phoneNumberId', val);
                            }}
                            className={`w-full h-11 bg-white/[0.02] border ${formErrors.phoneNumberId ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'} rounded-xl px-4 text-xs text-white focus:border-blue-500/50 transition-all outline-none font-light`}
                        />
                        {formErrors.phoneNumberId && <p className="text-[8px] text-red-500 mt-1 font-bold italic pl-1">{formErrors.phoneNumberId}</p>}
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between px-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500">TU NÚMERO DE TELÉFONO</label>
                             <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-[8px] text-blue-500 font-bold uppercase italic tracking-tighter">EXPLORADOR API</a>
                        </div>
                        <input
                            type="text" placeholder="Ej: +1 385 888 2799"
                            value={waConfig.displayPhoneNumber}
                            onChange={(e) => {
                                setWaConfig({ ...waConfig, displayPhoneNumber: e.target.value });
                                validateField('displayPhoneNumber', e.target.value);
                            }}
                            className={`w-full h-11 bg-white/[0.02] border ${formErrors.displayPhoneNumber ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'} rounded-xl px-4 text-xs text-white focus:border-blue-500/50 transition-all outline-none`}
                        />
                        {formErrors.displayPhoneNumber && <p className="text-[8px] text-red-500 mt-1 font-bold italic pl-1">{formErrors.displayPhoneNumber}</p>}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between px-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500">WABA ID (WHATSAPP BUSINESS ACCOUNT)</label>
                        <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-[8px] text-blue-500 font-bold uppercase italic tracking-tighter">¿DÓNDE ENCONTRARLO?</a>
                    </div>
                    <input
                        type="text" placeholder="Ej: 25304791939521"
                        value={waConfig.wabaId}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setWaConfig({ ...waConfig, wabaId: val });
                            validateField('wabaId', val);
                        }}
                        className={`w-full h-11 bg-white/[0.02] border ${formErrors.wabaId ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'} rounded-xl px-4 text-xs text-white focus:border-blue-500/50 transition-all outline-none font-light`}
                    />
                    {formErrors.wabaId && <p className="text-[8px] text-red-500 mt-1 font-bold italic pl-1">{formErrors.wabaId}</p>}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between px-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500">TOKEN DE ACCESO (PERMANENTE)</label>
                        <a href="https://business.facebook.com/latest/settings/system_users" target="_blank" rel="noreferrer" className="text-[8px] text-blue-500 font-bold uppercase italic tracking-tighter">¿CÓMO CREARLO?</a>
                    </div>
                    <div className="relative">
                        <input
                            type="password" placeholder="••••••••••••••••••••••••••••••••••••"
                            value={waConfig.accessToken}
                            onChange={(e) => {
                                setWaConfig({ ...waConfig, accessToken: e.target.value });
                                validateField('accessToken', e.target.value);
                            }}
                            className={`w-full h-11 bg-white/[0.02] border ${formErrors.accessToken ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'} rounded-xl px-4 pr-12 text-xs text-white focus:border-blue-500/50 transition-all outline-none font-mono`}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Lock className="w-3.5 h-3.5 text-neutral-600" />
                        </div>
                    </div>
                    {formErrors.accessToken && <p className="text-[8px] text-red-500 mt-1 font-bold italic pl-1">{formErrors.accessToken}</p>}
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[28px] p-6 mb-8 relative overflow-hidden group text-left">
                <div className="absolute top-0 right-0 w-[200px] h-full bg-blue-500/5 blur-[50px] pointer-events-none" />
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg"><QrCode className="w-4 h-4 text-blue-400" /></div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Para configurar el Webhook en Meta:</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[8px] font-black uppercase text-neutral-500">URL DE CALLBACK</span>
                            <button onClick={() => { navigator.clipboard.writeText(`https://us-central1-roosevelt-491004.cloudfunctions.net/metaWebhook?u=${currentUser?.uid}&e=${activeEntity}`); toast.success("URL copiada"); }} className="p-1 hover:bg-white/5 rounded-md"><Copy className="w-3 h-3 text-blue-500" /></button>
                        </div>
                        <p className="text-[9px] font-mono text-blue-300 truncate tracking-tighter">https://us-central1-roosevelt-491004.cloudfunctions.net/metaWebhook?u={currentUser?.uid}&e={activeEntity}</p>
                    </div>
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[8px] font-black uppercase text-neutral-500">VERIFY TOKEN</span>
                            <button onClick={() => { navigator.clipboard.writeText(waConfig.verifyToken); toast.success("Token copiado"); }} className="p-1 hover:bg-white/5 rounded-md"><Copy className="w-3 h-3 text-blue-500" /></button>
                        </div>
                        <p className="text-[9px] font-mono text-blue-300">{waConfig.verifyToken}</p>
                    </div>
                </div>
            </div>

            {isEditing ? (
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => {
                            setWaConfig(tempConfig);
                            setIsEditing(false);
                            setFormErrors({});
                        }}
                        className="h-14 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={saveWhatsAppConfig}
                        className="h-14 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-600/20"
                    >
                        GUARDAR CAMBIOS
                    </button>
                </div>
            ) : (
                <button
                    onClick={saveWhatsAppConfig}
                    className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                >
                    GUARDAR Y CONECTAR
                </button>
            )}
        </div>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]"
                    >
                        {/* Left Branding */}
                        <div className="hidden md:flex w-[35%] bg-black p-10 flex-col border-r border-white/5 relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-full h-[500px] bg-primary/20 blur-[120px] pointer-events-none rounded-full -translate-y-1/2 translate-x-1/4" />
                            <div className="relative z-10 h-full flex flex-col">
                                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl w-fit mb-8 backdrop-blur-md shadow-2xl">
                                    {activeIntegration.icon}
                                </div>
                                <h1 className="text-3xl font-extralight text-white tracking-tighter mb-4 leading-none">
                                    {activeIntegration.name === 'WhatsApp Business (Cloud API)' ? 'WhatsApp' : activeIntegration.name}
                                    <span className="block text-primary font-bold text-xs mt-2 tracking-[0.4em] uppercase opacity-50">Cloud API</span>
                                </h1>
                                <p className="text-[11px] text-white/40 font-light leading-relaxed mb-10 tracking-wide max-w-[200px]">
                                    Conecta la infraestructura de Meta directamente a Roosevelt para una comunicación autónoma y escalable.
                                </p>
                                
                                <div className="mt-auto">
                                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-sm group hover:border-primary/30 transition-all duration-500">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
                                            <span className="text-[9px] text-white/80 font-bold uppercase tracking-[0.2em]">Conexión Cifrada</span>
                                        </div>
                                        <p className="text-[10px] text-white/30 leading-relaxed font-light">
                                            La sincronización de llaves se realiza bajo estándares militares en los nodos oficiales de Meta.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Content */}
                        <div className="flex-1 p-8 overflow-y-auto no-scrollbar relative flex flex-col h-full bg-[#0a0a0a]">
                            <div className="flex justify-between items-center mb-8 h-10 shrink-0 relative z-50">
                                <div className="w-20">
                                    {(step > 1 && step < 4) ? (
                                        <button
                                            onClick={() => {
                                                if (step === 2) setWizardPath(null);
                                                setStep(step - 1);
                                            }}
                                            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                                        >
                                            <ChevronLeft className="w-4 h-4" /> Atrás
                                        </button>
                                    ) : isEditing ? (
                                        <button
                                            onClick={() => {
                                                setWaConfig(tempConfig);
                                                setIsEditing(false);
                                                setFormErrors({});
                                            }}
                                            className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest"
                                        >
                                            <ChevronLeft className="w-3 h-3" /> Cancelar
                                        </button>
                                    ) : <div />}
                                </div>

                                {step === 1 && !isEditing && (
                                    <div className="flex bg-white/5 p-1 rounded-full border border-white/10 backdrop-blur-md">
                                        <button
                                            onClick={() => setConnectionMode('meta')}
                                            className={`px-6 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all ${connectionMode === 'meta' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/60'}`}
                                        >
                                            Wizard
                                        </button>
                                        <button
                                            onClick={() => setConnectionMode('manual')}
                                            className={`px-6 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all ${connectionMode === 'manual' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/60'}`}
                                        >
                                            Manual
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5">
                                    {step === 4 && !isEditing && (
                                        <button
                                            onClick={() => {
                                                setTempConfig({...waConfig});
                                                setIsEditing(true);
                                            }}
                                            className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-blue-500"
                                        ><Settings className="w-4 h-4" /></button>
                                    )}
                                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X className="w-5 h-5 text-neutral-500 hover:text-white" /></button>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                {initialLoading ? (
                                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                                        <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest">Verificando conexión...</p>
                                    </motion.div>
                                ) : (step === 1 || isEditing) ? (
                                    <motion.div key={isEditing ? "edit" : "step1"} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col font-sans">
                                        
                                        {isEditing || connectionMode === 'manual' ? (
                                            <>
                                                <div className="mb-6">
                                                    <h3 className="text-2xl font-extralight text-white tracking-tighter mb-1">{isEditing ? 'Configuración de Nodo' : 'Mapeo Manual de WhatsApp'}</h3>
                                                    <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">Inyección Directa de Credenciales</p>
                                                </div>
                                                {renderManualForm()}
                                            </>
                                        ) : (
                                            <>
                                                <div className="mb-10">
                                                    <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2">Conectar Canal</h3>
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-[1px] w-12 bg-primary/50" />
                                                        <p className="text-[10px] text-white/20 uppercase tracking-[0.4em] font-bold">Autonomous Protocol 01</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-4 flex-1">
                                                    <button
                                                        onClick={() => setAccountAction('new')}
                                                        className={`w-full text-left p-6 rounded-[24px] border transition-all duration-500 flex items-center gap-6 ${accountAction === 'new' ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-[0_0_30px_rgba(37,99,235,0.05)]' : 'border-white/5 hover:border-white/10 bg-white/[0.02]'}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${accountAction === 'new' ? 'bg-primary text-white' : 'bg-white/5 text-white/20'}`}>
                                                            {accountAction === 'new' ? <CheckCircle2 className="w-5 h-5 shadow-glow" /> : <Circle className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white text-[11px] mb-1 uppercase tracking-[0.2em]">Crea y conecta cuenta</p>
                                                            <p className="text-[10px] text-white/30 font-light leading-relaxed">Nuevo despliegue en la infraestructura de Meta Business.</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => setAccountAction('existing')}
                                                        className={`w-full text-left p-6 rounded-[24px] border transition-all duration-500 flex items-center gap-6 ${accountAction === 'existing' ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-[0_0_30px_rgba(37,99,235,0.05)]' : 'border-white/5 hover:border-white/10 bg-white/[0.02]'}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${accountAction === 'existing' ? 'bg-primary text-white' : 'bg-white/5 text-white/20'}`}>
                                                            {accountAction === 'existing' ? <CheckCircle2 className="w-5 h-5 shadow-glow" /> : <Circle className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white text-[11px] mb-1 uppercase tracking-[0.2em]">Vincular cuenta activa</p>
                                                            <p className="text-[10px] text-white/30 font-light leading-relaxed">Migración o vinculación de WABA existente (Cualquier BSP).</p>
                                                        </div>
                                                    </button>
                                                </div>
                                                
                                                <div className="flex flex-col gap-6 mt-12">
                                                    <button 
                                                        onClick={() => {
                                                            setWizardPath(accountAction === 'new' ? 'new' : 'existing');
                                                            setStep(2);
                                                        }} 
                                                        className="bg-white/5 hover:bg-white/10 text-white px-10 h-12 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] transition-all border border-white/10 backdrop-blur-md shadow-xl w-fit group"
                                                    >
                                                        <span className="flex items-center gap-3">
                                                            Sincronizar <CheckCircle2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                                        </span>
                                                    </button>
                                                    
                                                    <div className="flex items-center gap-4">
                                                        <button onClick={handleConnectFacebook} className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] hover:text-primary transition-colors">Direct OAuth Link</button>
                                                        <span className="w-1 h-1 rounded-full bg-white/10" />
                                                        <button className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] hover:text-white transition-colors">Meta Dev Portal</button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </motion.div>
                                ) : (step === 2 && wizardPath === 'new') ? (
                                    <motion.div key="new-eligibility" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col text-left font-sans">
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-glow" />
                                                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white">Elegibilidad</span>
                                            </div>
                                            <div className="h-[1px] w-8 bg-white/10" />
                                            <div className="flex items-center gap-3 opacity-30">
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/50">Privilegios</span>
                                            </div>
                                        </div>
                                        
                                        <h3 className="text-3xl font-extralight text-white tracking-tighter mb-4">Verificación de Nodo</h3>
                                        <p className="text-[11px] text-white/30 font-light mb-10 leading-relaxed max-w-md uppercase tracking-wider">Confirma la naturaleza del número de teléfono para asignar el protocolo de enrutamiento adecuado.</p>
                                        
                                        <div className="space-y-3 mb-10">
                                            {['new', 'personal', 'none'].map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => setPhoneStatus(status as any)}
                                                    className={`w-full text-left py-4 px-6 rounded-2xl border transition-all duration-300 flex items-center justify-between ${phoneStatus === status ? 'border-primary/50 bg-primary/10' : 'border-white/5 hover:border-white/10 bg-white/[0.02]'}`}
                                                >
                                                    <span className={`text-[11px] uppercase tracking-widest transition-all ${phoneStatus === status ? 'text-white font-bold' : 'text-white/40 font-light'}`}>
                                                        {status === 'new' && 'NÚMERO VIRGEN (SIN REGISTRO)'}
                                                        {status === 'personal' && 'CUENTA PERSONAL ACTIVA'}
                                                        {status === 'none' && 'SOLICITAR NÚMERO VIRTUAL'}
                                                    </span>
                                                    {phoneStatus === status && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-glow" />}
                                                </button>
                                            ))}
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-auto">
                                            <button 
                                                onClick={() => setStep(3)} 
                                                disabled={!phoneStatus}
                                                className="px-10 h-12 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white shadow-xl disabled:opacity-20"
                                            >
                                                Protocolo 02
                                            </button>
                                            <button className="text-[9px] text-white/20 font-bold uppercase tracking-[0.3em] hover:text-white transition-colors">Omitir Verificación</button>
                                        </div>
                                    </motion.div>
                                ) : (step === 3 && wizardPath === 'new') ? (
                                    <motion.div key="new-meta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col text-left font-sans">
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="flex items-center gap-3">
                                                <CheckCircle2 className="w-4 h-4 text-primary" />
                                                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Elegibilidad</span>
                                            </div>
                                            <div className="h-[1px] w-8 bg-primary/30" />
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-glow" />
                                                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white">Privilegios</span>
                                            </div>
                                        </div>

                                        <h3 className="text-3xl font-extralight text-white tracking-tighter mb-4">Meta Auth Portal</h3>
                                        <p className="text-[11px] text-white/30 font-light mb-10 leading-relaxed uppercase tracking-wider">Sincronización de privilegios con Meta Business Manager.</p>

                                        <div className="bg-white/[0.03] border border-white/5 rounded-[24px] p-8 mb-10 backdrop-blur-sm">
                                            <div className="flex items-start gap-4">
                                                <div className="p-2 bg-primary/10 rounded-lg"><ShieldCheck className="w-5 h-5 text-primary" /></div>
                                                <div>
                                                    <p className="text-[10px] text-white/80 font-bold mb-4 uppercase tracking-[0.2em] italic">Pre-requisitos de despliegue:</p>
                                                    <ul className="text-[11px] text-white/40 space-y-3 font-light">
                                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-white/20" /> Identidad Legal de Empresa</li>
                                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-white/20" /> Dirección Fiscal Verificable</li>
                                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-white/20" /> Perímetro de Negocio en Meta</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <button onClick={handleConnectFacebook} className="px-8 h-12 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] bg-primary hover:bg-primary/80 transition-all text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]">Acceder a Meta</button>
                                            <button onClick={() => { setConnectionMode('manual'); setStep(1); }} className="text-[9px] text-white/40 font-bold uppercase tracking-[0.3em] hover:text-white transition-colors">Conectar Manualmente</button>
                                        </div>
                                    </motion.div>
                                ) : (step === 2 && wizardPath === 'existing') ? (
                                    <motion.div key="existing-choice" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col text-left font-sans">
                                        <h3 className="text-3xl font-extralight text-white tracking-tighter mb-4 italic">Protocolo de Migración</h3>
                                        <p className="text-[11px] text-white/30 font-light mb-10 uppercase tracking-widest">Identifica el núcleo de origen para la transferencia de datos.</p>
                                        
                                        <div className="space-y-4 mb-10">
                                            {['internal', 'other'].map((opt) => (
                                                <button
                                                    key={opt}
                                                    onClick={() => setBspChoice(opt as any)}
                                                    className={`w-full text-left p-6 rounded-[24px] border transition-all flex items-start gap-5 ${bspChoice === opt ? 'border-primary/50 bg-primary/5' : 'border-white/5 hover:border-white/10 bg-white/[0.02]'}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bspChoice === opt ? 'bg-primary text-white' : 'bg-white/5 text-white/20'}`}>
                                                        {bspChoice === opt ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-[11px] mb-1 uppercase tracking-[0.2em]">{opt === 'internal' ? 'Cuenta Nativa Roosevelt' : 'BSP Externo (Cloud API)'}</p>
                                                        {opt === 'other' && (
                                                            <p className="text-[10px] text-white/30 font-light leading-relaxed">Transferencia de WABA desde proveedores como Vonage, Twilio o Messagebird.</p>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        
                                        <button 
                                            onClick={() => setStep(3)} 
                                            disabled={!bspChoice}
                                            className="px-10 h-14 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white shadow-xl disabled:opacity-10 w-fit"
                                        >
                                            Iniciar Traspaso
                                        </button>
                                    </motion.div>
                                ) : (step === 3 && wizardPath === 'existing') ? (
                                    <motion.div key="existing-migrate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col text-left font-sans">
                                        <h3 className="text-3xl font-extralight text-white tracking-tighter mb-4">Migración de Infraestructura</h3>
                                        <p className="text-[11px] text-white/30 font-light mb-10 uppercase tracking-widest italic">Sincronización de plantillas y calificación de calidad.</p>
                                        
                                        <div className="bg-white/5 border border-white/10 rounded-[28px] p-8 mb-10">
                                            <div className="flex items-start gap-4">
                                                <div className="p-2 bg-primary/20 rounded-lg"><AlertCircle className="w-5 h-5 text-primary" /></div>
                                                <p className="text-[11px] text-white/40 leading-relaxed font-light">
                                                    Este proceso moverá de forma íntegra tu identidad comercial, límites de mensajería y plantillas aprobadas hacia el control autónomo de Roosevelt.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-6 mb-12">
                                            <div className="group transition-all">
                                                <p className="text-[10px] text-white font-bold mb-1 uppercase tracking-[0.2em]">01. Reset Security Flow</p>
                                                <p className="text-[10px] text-white/20 font-light leading-relaxed uppercase">Desactivar 2FA en el Business Manager de Meta antes de iniciar.</p>
                                            </div>
                                            <div className="group transition-all">
                                                <p className="text-[10px] text-white font-bold mb-1 uppercase tracking-[0.2em]">02. Approval Status</p>
                                                <p className="text-[10px] text-white/20 font-light leading-relaxed uppercase">Verificar que el nombre y estado de WABA estén aprobados por Meta.</p>
                                            </div>
                                            <div className="group transition-all border-b border-white/5 pb-6">
                                                <p className="text-[10px] text-white font-bold mb-1 uppercase tracking-[0.2em]">03. Popup Permissions</p>
                                                <p className="text-[10px] text-white/20 font-light leading-relaxed uppercase">Permitir ventanas emergentes para el handshake oficial de Meta.</p>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={handleConnectFacebook}
                                            className="bg-primary hover:bg-primary/80 text-white w-fit px-12 h-14 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] transition-all flex items-center gap-4 shadow-[0_0_30px_rgba(37,99,235,0.2)]"
                                        >
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
                                            Authorize Meta Migration
                                        </button>
                                    </motion.div>
                                ) : (

                                    <motion.div key="connected" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center text-center pt-0 pb-6 font-sans">
                                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-8 relative">
                                            <div className="absolute inset-0 rounded-full border border-green-500/20 animate-pulse" />
                                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                                        </div>
                                        <h3 className="text-3xl font-extralight text-white tracking-tighter mb-2 italic uppercase">Canal Sincronizado</h3>
                                        <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold mb-10">Nodo Activo en la Red Roosevelt</p>
                                        
                                        <div className="w-full space-y-4 px-2">
                                            <div className="h-24 bg-white/5 border border-white/10 rounded-[32px] flex items-center px-8 justify-between relative overflow-hidden backdrop-blur-sm">
                                                <div className="text-left relative z-10">
                                                    <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 block mb-2 font-bold opacity-60">PUNTO DE ACCESO</span>
                                                    <p className="text-2xl font-light text-white tracking-widest">{waConfig.displayPhoneNumber || "S/N"}</p>
                                                </div>
                                                <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl"><ShieldCheck className="w-6 h-6 text-green-500/40" /></div>
                                            </div>

                                            <div className="flex items-center gap-4 pt-10">
                                                <button onClick={onClose} className="flex-1 h-14 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-[0.3em] rounded-full transition-all">TERMINAR</button>
                                                <button onClick={handleDeleteConfig} className="flex-1 h-14 bg-red-500/5 hover:bg-red-500/10 text-red-500/50 border border-red-500/10 text-[10px] font-bold uppercase tracking-[0.3em] rounded-full transition-all">DESCONECTAR</button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
