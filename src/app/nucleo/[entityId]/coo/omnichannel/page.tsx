'use client';

import React, { useState, useEffect } from 'react';
import InboxSidebar from './components/InboxSidebar';
import ChatList from './components/ChatList';
import ChatArea from './components/ChatArea';
import { useKanbanBoard } from '../whatsapp/hooks/useKanbanBoard';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { AlertTriangle, ChevronLeft, Menu, X as CloseIcon } from 'lucide-react';

export default function OmnichannelInboxPage() {
    // State to manage which conversation is active
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string>('all');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const { cards, groups, loading } = useKanbanBoard();

    // Close sidebar when a folder is selected on mobile
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [selectedFolder]);

    // Auto-Recovery: If activeConversationId is not in cards, we reset or switch
    // This solves the 'Ghost Card' problem where the UI is stuck on a deleted/stale ID
    React.useEffect(() => {
        if (!activeConversationId || loading || cards.length === 0) return;

        const exists = cards.some(c => c.id === activeConversationId);
        if (!exists) {
            console.warn(`[Omnichannel] Active ID ${activeConversationId} not found in board. Attempting recovery...`);
            // Try to find ANY card that might be a better match for the contact we were looking at
            // For now, simply resetting to null is safer to unblock the UI
            setActiveConversationId(null);
        }
    }, [activeConversationId, cards, loading]);

    // Global Integration Status Watchdog
    const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, string>>({});
    const { currentUser, activeEntity } = useAuth();
    
    React.useEffect(() => {
        if (!currentUser || !activeEntity) return;
        const integrationsRef = collection(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations`);
        const unsubscribe = onSnapshot(integrationsRef, (snapshot) => {
            const statuses: Record<string, string> = {};
            snapshot.docs.forEach(doc => {
                if (doc.id === '_init') return;
                statuses[doc.id] = doc.data().status;
            });
            setIntegrationStatuses(statuses);
        });
        return () => unsubscribe();
    }, [currentUser, activeEntity]);

    const offlineChannels = Object.entries(integrationStatuses)
        .filter(([_, status]) => status === 'Error')
        .map(([id]) => id.charAt(0).toUpperCase() + id.slice(1));

    // Find active card data
    const activeCard = cards.find(c => c.id === activeConversationId) || null;
    const activeGroupName = groups.find(g => activeCard && g.id === activeCard.groupId)?.name || '';

    return (
        <div className="flex flex-col min-h-screen overflow-y-auto md:h-screen md:overflow-hidden bg-[#0a0a0a] text-white text-sm font-sans tracking-tight">
            {/* 0. Global Connectivity Alert Banner */}
            {offlineChannels.length > 0 && (
                <div className="bg-amber-600 px-4 py-1.5 flex items-center justify-between animate-in slide-in-from-top duration-500 z-[100]">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-white animate-pulse" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-white">
                            Atención: {offlineChannels.join(', ')} se ha desconectado. Reconéctalo en Configuración.
                        </span>
                    </div>
                    <button 
                        onClick={() => window.open(`/nucleo/${activeEntity}/cto/integrations`, '_blank')}
                        className="bg-white/20 hover:bg-white/30 text-white text-[9px] font-black px-3 py-1 rounded transition-colors uppercase"
                    >
                        Reconectar Ahora
                    </button>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden relative">
                {/* 1. Left Sidebar: Folders, Channels, Tags (Drawer on Mobile) */}
                <div 
                    className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={() => setIsSidebarOpen(false)}
                />
                
                <div className={`fixed inset-y-0 left-0 z-[70] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex`}>
                    <div className="relative">
                        <InboxSidebar
                            selectedFolder={selectedFolder}
                            setSelectedFolder={setSelectedFolder}
                            cards={cards}
                        />
                    </div>
                </div>

                {/* 2. Middle Column: List of conversations */}
                <div className={`${activeConversationId ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-[600px] h-full bg-[#0d0d0d] flex-shrink-0`}>
                    {/* Mobile Header for List View */}
                    {!activeConversationId && (
                        <div className="md:hidden h-14 border-b border-neutral-900 flex items-center px-4 justify-between bg-[#0a0a0a]">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-neutral-400 hover:text-white">
                                    <Menu size={20} />
                                </button>
                                <span className="font-bold uppercase tracking-widest text-xs text-white/90">Inbox</span>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 font-bold text-xs border border-blue-500/20">
                                {cards.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
                            </div>
                        </div>
                    )}

                    <ChatList
                        selectedFolder={selectedFolder}
                        activeConversationId={activeConversationId}
                        setActiveConversationId={setActiveConversationId}
                        cards={cards}
                        loading={loading}
                    />
                </div>

                {/* 3. Right Area: Chat history */}
                <div className={`${activeConversationId ? 'flex' : 'hidden'} md:flex flex-1 flex-col overflow-hidden bg-[#111111]`}>
                    {activeCard ? (
                        <div className="flex flex-1 flex-col overflow-hidden">
                            <ChatArea
                                card={activeCard}
                                groups={groups}
                                groupName={activeGroupName}
                                allConversations={cards}
                                onBack={() => setActiveConversationId(null)}
                            />
                        </div>
                    ) : (
                        <div className="hidden md:flex flex-1 items-center justify-center flex-col text-neutral-500">
                            <div className="w-16 h-16 rounded-full bg-neutral-800/50 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p className="text-lg font-light tracking-wide">Select a conversation to start messaging</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
