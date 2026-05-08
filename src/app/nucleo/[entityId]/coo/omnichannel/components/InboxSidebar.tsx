import React, { useState, useEffect } from 'react';
import { Mail, Users, CheckCircle, Tag, Hash, Settings, ChevronDown, ChevronRight, MessageSquare, AlertTriangle, Instagram, Facebook, Twitter, Music, Send } from 'lucide-react';
import WhatsappIcon from '@/components/icons/WhatsappIcon';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
    selectedFolder: string;
    setSelectedFolder: (folder: string) => void;
    cards?: any[];
}

export default function InboxSidebar({ selectedFolder, setSelectedFolder, cards = [] }: SidebarProps) {
    const { currentUser } = useAuth();
    const params = useParams();
    const activeEntity = params?.entityId as string;
    const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, string>>({});

    useEffect(() => {
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
    const [expandedSections, setExpandedSections] = useState({
        inboxes: true,
        labels: true
    });

    const toggleSection = (section: 'inboxes' | 'labels') => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const counts = {
        all: cards.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
        mine: cards.filter(c => c.assignedTo === 'Mío').reduce((acc, c) => acc + (c.unreadCount || 0), 0),
        unassigned: cards.filter(c => !c.assignedTo || c.assignedTo === 'Unassigned').reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    };

    const folders = [
        { id: 'mine', label: 'Mine', icon: <Users size={16} />, count: counts.mine },
        { id: 'unassigned', label: 'Unassigned', icon: <CheckCircle size={16} />, count: counts.unassigned },
        { id: 'all', label: 'All', icon: <Mail size={16} />, count: counts.all },
    ];

    const channels = [
        { id: 'whatsapp', label: 'WhatsApp', type: 'whatsapp' },
        { id: 'instagram', label: 'Instagram', type: 'instagram' },
        { id: 'messenger', label: 'Messenger', type: 'messenger' },
        { id: 'twitter', label: 'X (Twitter)', type: 'twitter' },
        { id: 'gmail', label: 'Gmail', type: 'gmail' },
        { id: 'telegram', label: 'Telegram', type: 'telegram' },
    ];

    return (
        <div className="w-52 bg-[#0a0a0a] border-r border-neutral-900 flex flex-col h-full flex-shrink-0 select-none">
            {/* Header / Brand */}
            <div className="h-12 flex items-center px-3 border-b border-neutral-900">
                <div className="w-5 h-5 bg-blue-600 rounded mr-2 flex items-center justify-center">
                    <MessageSquare size={12} className="text-white" />
                </div>
                <span className="font-semibold text-white tracking-wide text-sm">Inbox</span>
            </div>

            <div className="flex-1 overflow-y-auto pt-2 space-y-4">

                {/* Standard Folders */}
                <div className="px-2 space-y-0.5">
                    {folders.map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => setSelectedFolder(folder.id)}
                            className={`w-full flex items-center px-2 py-1.5 rounded text-[12px] transition-colors group ${selectedFolder === folder.id
                                    ? 'bg-blue-600/10 text-blue-500 font-medium'
                                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                                }`}
                        >
                            <span className="mr-2.5 opacity-80">{React.cloneElement(folder.icon as React.ReactElement, { size: 14 })}</span>
                            {folder.label}
                            {folder.count > 0 && (
                                <span className={`ml-auto text-[9px] px-1.5 py-0 rounded-full transition-colors ${
                                    selectedFolder === folder.id 
                                    ? 'bg-blue-600/20 text-blue-500' 
                                    : 'bg-neutral-800 text-neutral-400 group-hover:text-white'
                                }`}>
                                    {folder.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Channels (Inboxes) */}
                <div className="px-2">
                    <button 
                        onClick={() => toggleSection('inboxes')}
                        className="w-full flex items-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1 px-2 hover:text-neutral-400 transition-colors"
                    >
                        <span className="flex-1 text-left">Inboxes</span>
                        {expandedSections.inboxes ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    
                    {expandedSections.inboxes && (
                        <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                            {channels.map(channel => (
                                <button
                                    key={channel.id}
                                    onClick={() => setSelectedFolder(channel.id)}
                                    className={`w-full flex items-center px-2 py-1.5 rounded text-[12px] transition-colors ${selectedFolder === channel.id
                                            ? 'bg-blue-600/10 text-blue-500 font-medium'
                                            : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                                        }`}
                                >
                                    <div className="relative mr-2.5">
                                        {(() => {
                                            const type = channel.type?.toLowerCase();
                                            if (type === 'whatsapp') return <WhatsappIcon className="w-3.5 h-3.5 text-neutral-400" />;
                                            if (type === 'instagram') return <Instagram size={14} className="text-neutral-400" />;
                                            if (type === 'messenger' || type === 'facebook') return <Facebook size={14} className="text-neutral-400" />;
                                            if (type === 'gmail') return <Mail size={14} className="text-neutral-400" />;
                                            if (type === 'twitter' || type === 'x') return <Twitter size={14} className="text-neutral-400" />;
                                            if (type === 'tiktok') return <Music size={14} className="text-neutral-400" />;
                                            if (type === 'telegram') return <Send size={14} className="text-neutral-400" />;
                                            return <Hash size={14} className="opacity-40" />;
                                        })()}
                                        {(() => {
                                            const status = integrationStatuses[channel.id] || integrationStatuses[`${channel.id}_internal`];
                                            if (status === 'Connected') return <div className="absolute -right-0.5 -bottom-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-[#0a0a0a]" />;
                                            if (status === 'Error') return <div className="absolute -right-0.5 -bottom-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full border border-[#0a0a0a] animate-pulse" />;
                                            return <div className="absolute -right-0.5 -bottom-0.5 w-1.5 h-1.5 bg-neutral-800 rounded-full border border-[#0a0a0a]" />;
                                        })()}
                                    </div>
                                    <span className={`truncate flex-1 ${integrationStatuses[channel.id] === 'Error' ? 'text-amber-500 font-bold' : ''}`}>
                                        {channel.label}
                                    </span>
                                    {integrationStatuses[channel.id] === 'Error' && (
                                        <div 
                                            className="ml-auto flex items-center gap-1 bg-amber-500/20 px-1 rounded animate-pulse"
                                            title="Click para reconectar en Configuración"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(`/nucleo/${activeEntity}/cto/integrations`, '_blank');
                                            }}
                                        >
                                            <AlertTriangle size={10} className="text-amber-500" />
                                            <span className="text-[8px] font-black text-amber-500 uppercase">OFFLINE</span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Labels */}
                <div className="px-2">
                    <button 
                        onClick={() => toggleSection('labels')}
                        className="w-full flex items-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1 px-2 hover:text-neutral-400 transition-colors"
                    >
                        <span className="flex-1 text-left">Labels</span>
                        {expandedSections.labels ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>

                    {expandedSections.labels && (
                        <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                            {['Sales', 'Support', 'Urgent'].map(label => (
                                <button
                                    key={label}
                                    onClick={() => setSelectedFolder(`label:${label}`)}
                                    className={`w-full flex items-center px-2 py-1.5 rounded text-[12px] transition-colors ${
                                        selectedFolder === `label:${label}`
                                        ? 'bg-blue-600/10 text-white font-medium'
                                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                                    }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full mr-2.5 ${
                                        label === 'Urgent' ? 'bg-red-500' :
                                        label === 'Sales' ? 'bg-green-500' : 'bg-blue-500'
                                    }`} />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* Footer Settings */}
            <div className="p-2 border-t border-neutral-900">
                <button className="w-full flex items-center px-2 py-1.5 rounded text-[12px] text-neutral-400 hover:bg-neutral-900 transition-colors">
                    <Settings size={14} className="mr-2.5" />
                    Settings
                </button>
            </div>
        </div>
    );
}

