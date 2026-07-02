'use client';

import { useState, useEffect } from 'react';
import { Search, Zap, ArrowRight, Settings2, MessageSquare, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { getWhatsAppIntegrationHealth } from '@/lib/omnichannel/whatsappIntegrationStatus';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { Category, Integration, INTEGRATIONS, CATEGORIES } from './config';
import { WhatsAppCloudAPIModal } from './components/whatsapp_cloud_api/WhatsAppCloudAPIModal';
import MessengerModal from './components/messenger/MessengerModal';
import InstagramModal from './components/instagram/InstagramModal';
import TelegramModal from './components/telegram/TelegramModal';
import TwitterModal from './components/twitter/TwitterModal';
import GmailModal from './components/gmail/GmailModal';

export default function IntegrationsPage() {
    const { currentUser } = useAuth();
    const params = useParams();
    const activeEntity = params?.entityId as string;
    const getTenantPath = () => {
        if (!currentUser?.uid || !activeEntity) return '';
        return `users/${currentUser.uid}/entities/${activeEntity}`;
    };

    const [selectedCategory, setSelectedCategory] = useState<Category>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [connectedIntegrations, setConnectedIntegrations] = useState<Record<string, any>>({});
    const [rawIntegrationDocs, setRawIntegrationDocs] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    // Modal Control
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null);

    useEffect(() => {
        if (!currentUser || !activeEntity) return;
        
        const integrationsRef = collection(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations`);
        const q = query(integrationsRef);
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Record<string, any> = {};
            const raw: Record<string, any> = {};
            snapshot.docs.forEach(d => {
                const docData = d.data();
                if (d.id === '_init') return;
                raw[d.id] = docData;

                // Mapeo lógico: Si es la versión interna de whatsapp, cuenta como la integración principal 'whatsapp'
                if (d.id === 'whatsapp_internal' && (docData.status === 'Internal' || docData.status === 'Connected' || docData.status === 'Error')) {
                    data['whatsapp'] = { ...(data['whatsapp'] || {}), ...docData };
                } else if (docData.status === 'Connected' || docData.status === 'Error' || docData.status === 'Disconnected') {
                    if (d.id === 'whatsapp') {
                        const phone = docData.phoneNumberId || docData.phone_number_id;
                        const token = docData.accessToken || docData.token || docData.access_token;
                        if (!phone && !token) return;
                        data['whatsapp'] = { ...(data['whatsapp'] || {}), ...docData };
                    } else {
                        data[d.id] = docData;
                    }
                }
            });
            setConnectedIntegrations(data);
            setRawIntegrationDocs(raw);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [currentUser, activeEntity]);

    const handleConnect = async (integration: Integration) => {
        if (!['whatsapp', 'messenger', 'instagram', 'telegram', 'x_twitter', 'gmail'].includes(integration.id)) {
            toast.info(`${integration.name}: Esta integración estará disponible próximamente en Roosevelt.`);
            return;
        }
        setActiveIntegration(integration);
        setIsModalOpen(true);
    };

    const filteredIntegrations = INTEGRATIONS.filter(item => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const whatsappHealth = getWhatsAppIntegrationHealth(
        rawIntegrationDocs.whatsapp,
        rawIntegrationDocs.whatsapp_internal
    );

    return (
        <div className="min-h-screen bg-black text-white relative flex flex-col overflow-y-auto">
            {/* Background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 flex-1 p-6 md:p-12">
                {/* Header Section */}
                <div className="max-w-7xl mx-auto mb-12">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                        <div>
                            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold tracking-[0.2em] uppercase mb-4">
                                <Zap className="w-3 h-3 fill-current" />
                                <span>Master Connect</span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-extralight tracking-tighter mb-4">
                                Integraciones del <span className="font-medium text-white">CTO</span>
                            </h1>
                            <p className="text-neutral-500 text-sm md:text-base max-w-2xl leading-relaxed">
                                Orquestación centralizada de canales externos. Conecta tus activos digitales para que la inteligencia autónoma de <span className="text-white font-medium">Roosevelt</span> pueda operar por ti.
                            </p>
                        </div>
                        
                        <div className="flex bg-neutral-900/40 backdrop-blur-md border border-white/5 p-1 rounded-full overflow-x-auto no-scrollbar max-w-full">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-6 py-2 rounded-full text-xs font-medium transition-all duration-300 whitespace-nowrap ${
                                        selectedCategory === cat ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 w-4 h-4" />
                        <input 
                            type="text"
                            placeholder="Buscar integración..."
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500/50 backdrop-blur-xl transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* WhatsApp readiness banner */}
                {!loading && (rawIntegrationDocs.whatsapp || rawIntegrationDocs.whatsapp_internal) && (
                    <div className="max-w-7xl mx-auto mb-8">
                        <div className={`rounded-[24px] border p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${whatsappHealth.canSend ? 'bg-emerald-500/[0.06] border-emerald-500/25' : 'bg-amber-500/[0.06] border-amber-500/25'}`}>
                            <div className="min-w-0">
                                <p className={`text-[10px] font-black uppercase tracking-[0.25em] mb-2 ${whatsappHealth.canSend ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    WhatsApp · {activeEntity}
                                </p>
                                <h2 className="text-lg font-medium text-white mb-1">{whatsappHealth.label}</h2>
                                <p className="text-[12px] text-white/45 max-w-xl">
                                    {whatsappHealth.canSend
                                        ? 'Bot y omnicanal operativos. Abre una conversación, toma el chat y escribe al cliente.'
                                        : 'Revisa Phone Number ID y Access Token en Ajustes de WhatsApp para poder enviar desde omnicanal.'}
                                </p>
                                {whatsappHealth.phoneNumberId && (
                                    <p className="text-[11px] text-white/35 font-mono mt-2">
                                        Phone ID: {whatsappHealth.phoneNumberId}
                                        {whatsappHealth.wabaId ? ` · WABA: ${whatsappHealth.wabaId}` : ''}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                                {whatsappHealth.canSend && (
                                    <>
                                        <Link
                                            href={`/nucleo/${activeEntity}/coo/omnichannel`}
                                            className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            Abrir Omnicanal
                                        </Link>
                                        <Link
                                            href={`/nucleo/${activeEntity}/cmo/broadcast/list`}
                                            className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                                        >
                                            <Megaphone className="w-4 h-4" />
                                            Abrir Difusiones
                                        </Link>
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const wa = INTEGRATIONS.find(i => i.id === 'whatsapp');
                                        if (wa) handleConnect(wa);
                                    }}
                                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/15 text-white/70 hover:bg-white/5 text-[10px] font-bold uppercase tracking-wider transition-colors"
                                >
                                    <Settings2 className="w-4 h-4" />
                                    Ajustes WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Grid Section - Reduced Width (4 Columns) */}
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filteredIntegrations.map((integration, idx) => (
                            <IntegrationCard 
                                key={integration.id}
                                integration={integration}
                                isConnected={isIntegrationConnected(integration.id, connectedIntegrations[integration.id])}
                                integrationData={connectedIntegrations[integration.id]}
                                whatsappHealth={integration.id === 'whatsapp' ? whatsappHealth : undefined}
                                onConnect={() => handleConnect(integration)}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </main>

            {/* Modals Dispatcher */}
            {activeIntegration?.id === 'whatsapp' && (
                <WhatsAppCloudAPIModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    activeIntegration={activeIntegration} 
                />
            )}
            {activeIntegration?.id === 'messenger' && (
                <MessengerModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    activeEntity={activeEntity}
                    currentUser={currentUser}
                />
            )}
            {activeIntegration?.id === 'instagram' && (
                <InstagramModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    activeEntity={activeEntity}
                    currentUser={currentUser}
                />
            )}
            {activeIntegration?.id === 'telegram' && (
                <TelegramModal 
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setActiveIntegration(null); }}
                    activeEntity={activeEntity}
                    currentUser={currentUser}
                />
            )}
            {activeIntegration?.id === 'x_twitter' && (
                <TwitterModal 
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setActiveIntegration(null); }}
                    activeEntity={activeEntity}
                    currentUser={currentUser}
                />
            )}
            {activeIntegration?.id === 'gmail' && (
                <GmailModal 
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setActiveIntegration(null); }}
                    activeEntity={activeEntity}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
}

function isIntegrationConnected(integrationId: string, integrationData?: any) {
    if (!integrationData) return false;
    if (integrationId === 'whatsapp') {
        const health = getWhatsAppIntegrationHealth(integrationData);
        return health.level === 'ready' || health.level === 'partial';
    }
    return integrationData.status === 'Connected';
}

function getIntegrationStatusLabel(integrationId: string, integrationData?: any, whatsappHealth?: ReturnType<typeof getWhatsAppIntegrationHealth>) {
    if (integrationId === 'whatsapp' && whatsappHealth) {
        if (whatsappHealth.level === 'ready') return 'Listo';
        if (whatsappHealth.level === 'partial') return 'Incompleto';
        return 'Offline';
    }
    return isIntegrationConnected(integrationId, integrationData) ? 'Activo' : 'Offline';
}

function IntegrationCard({ 
    integration, 
    isConnected, 
    integrationData,
    whatsappHealth,
    onConnect 
}: { 
    integration: Integration, 
    isConnected: boolean, 
    integrationData?: any,
    whatsappHealth?: ReturnType<typeof getWhatsAppIntegrationHealth>,
    onConnect: () => void 
}) {
    const statusLabel = getIntegrationStatusLabel(integration.id, integrationData, whatsappHealth);
    const statusReady = integration.id === 'whatsapp' && whatsappHealth?.canSend;
    const statusPartial = integration.id === 'whatsapp' && whatsappHealth?.level === 'partial';
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative group px-6 py-4 rounded-[32px] border transition-all duration-500 flex flex-col h-full bg-[#0a0a0a] ${
                statusReady ? 'border-emerald-500/30 ring-1 ring-emerald-500/20' : statusPartial ? 'border-amber-500/30 ring-1 ring-amber-500/15' : isConnected ? 'border-blue-500/30 ring-1 ring-blue-500/20' : 'border-white/5 hover:border-white/20'
            }`}
        >
            {/* Status Badge */}
            <div className="flex justify-between items-start mb-4">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] uppercase font-black border transition-all ${
                    statusReady ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : statusPartial ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : isConnected ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-neutral-600'
                }`}>
                    <div className={`w-1 h-1 rounded-full ${
                        statusReady ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,1)]' : statusPartial ? 'bg-amber-400' : isConnected ? 'bg-blue-400 shadow-[0_0_5px_rgba(59,130,246,1)]' : 'bg-neutral-600'
                    }`} />
                    {statusLabel}
                </div>
                {integration.popular && !isConnected && (
                    <div className="px-3 py-1 bg-white text-black rounded-full text-[9px] font-black uppercase tracking-tighter shadow-xl">
                        Popular
                    </div>
                )}
            </div>

            {/* Icon */}
            <div className="mb-4 relative">
                 <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 group-hover:border-white/10 overflow-hidden relative">
                    {integration.icon}
                    {/* Glossy reflection overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-none" />
                 </div>
            </div>

            {/* Content */}
            <h3 className="text-xl font-medium text-white mb-2">{integration.name}</h3>
            <p className="text-neutral-500 text-[11px] leading-relaxed mb-4 flex-grow">
                {integration.description}
            </p>
            {integration.id === 'whatsapp' && whatsappHealth?.phoneNumberId && (
                <p className="text-[10px] text-white/30 font-mono mb-4 truncate">
                    ID {whatsappHealth.phoneNumberId}
                </p>
            )}

            {/* Action */}
            <button
                onClick={onConnect}
                className={`w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${
                    isConnected 
                        ? 'border border-blue-500/30 text-blue-400 hover:bg-blue-500/10' 
                        : 'bg-white text-black hover:scale-[1.02] hover:shadow-xl active:scale-95'
                }`}
            >
                {isConnected ? (
                    <>
                        <Settings2 className="w-3 h-3" />
                        Ajustes
                    </>
                ) : (
                    <>
                        Conectar
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </button>
        </motion.div>
    );
}
