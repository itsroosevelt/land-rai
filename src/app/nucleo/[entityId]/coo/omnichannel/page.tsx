'use client';

import React, { useState, useEffect } from 'react';
import InboxSidebar from './components/InboxSidebar';
import ChatList from './components/ChatList';
import ChatArea from './components/ChatArea';
import { useKanbanBoard } from '../whatsapp/hooks/useKanbanBoard';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { AlertTriangle } from 'lucide-react';

export default function OmnichannelInboxPage() {
    // State to manage which conversation is active
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string>('all');

    const { cards, groups, loading } = useKanbanBoard();

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
        <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden text-sm">
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

            <div className="flex flex-1 overflow-hidden">
            {/* 1. Left Sidebar: Folders, Channels, Tags */}
            <InboxSidebar
                selectedFolder={selectedFolder}
                setSelectedFolder={setSelectedFolder}
                cards={cards}
            />

            {/* 2. Middle Column: List of conversations */}
            <ChatList
                selectedFolder={selectedFolder}
                activeConversationId={activeConversationId}
                setActiveConversationId={setActiveConversationId}
                cards={cards}
                loading={loading}
            />

            {/* 3. Right Area: Chat history (Contact panel removed) */}
            <div className="flex flex-1 overflow-hidden bg-[#111111]">
                {activeCard ? (
                    <ChatArea
                        card={activeCard}
                        groups={groups}
                        groupName={activeGroupName}
                        allConversations={cards}
                    />
                ) : (
                    <div className="flex flex-1 items-center justify-center flex-col text-neutral-500">
                        <div className="w-16 h-16 rounded-full bg-neutral-800/50 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="text-lg">Select a conversation to start messaging</p>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}
