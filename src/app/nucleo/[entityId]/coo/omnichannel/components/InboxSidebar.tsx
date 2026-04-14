import React, { useState } from 'react';
import { Mail, Users, CheckCircle, Tag, Hash, Settings, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';

interface SidebarProps {
    selectedFolder: string;
    setSelectedFolder: (folder: string) => void;
    cards?: any[];
}

export default function InboxSidebar({ selectedFolder, setSelectedFolder, cards = [] }: SidebarProps) {
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
        all: cards.length,
        mine: cards.filter(c => c.assignedTo === 'Mío' || c.assignedTo === 'Me').length,
        unassigned: cards.filter(c => !c.assignedTo || c.assignedTo === 'Unassigned').length,
    };

    const folders = [
        { id: 'mine', label: 'Mis Chats', icon: <Users size={16} />, count: counts.mine, color: 'text-blue-400' },
        { id: 'unassigned', label: 'Sin Asignar', icon: <CheckCircle size={16} />, count: counts.unassigned, color: 'text-yellow-400' },
        { id: 'all', label: 'Todos', icon: <Mail size={16} />, count: counts.all, color: 'text-neutral-400' },
    ];

    const channels = [
        { id: 'whatsapp1', label: 'WhatsApp Principal', type: 'whatsapp' },
        { id: 'messenger', label: 'Facebook Messenger', type: 'messenger' },
        { id: 'instagram', label: 'Instagram Direct', type: 'instagram' },
    ];

    return (
        <div className="w-60 bg-[#0d0d0d] border-r border-white/5 flex flex-col h-full flex-shrink-0 select-none z-20">
            {/* Header / Brand */}
            <div className="h-16 flex items-center px-6 border-b border-white/5">
                <div className="w-8 h-8 bg-blue-600 rounded-xl mr-3 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <MessageSquare size={16} className="text-white" />
                </div>
                <span className="font-black text-white tracking-widest text-[10px] uppercase">Omnicanal</span>
            </div>

            <div className="flex-1 overflow-y-auto pt-6 space-y-8 no-scrollbar">

                {/* Main Navigation */}
                <div className="px-3 space-y-1">
                    <p className="px-3 text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3">Navegación</p>
                    {folders.map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => setSelectedFolder(folder.id)}
                            className={`w-full group flex items-center px-3 py-2.5 rounded-xl text-[12px] transition-all duration-300 relative ${selectedFolder === folder.id
                                    ? 'bg-blue-600/10 text-white font-bold'
                                    : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-200'
                                }`}
                        >
                            {selectedFolder === folder.id && (
                                <div className="absolute left-0 w-1 h-4 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                            )}
                            <span className={`mr-3 transition-colors ${selectedFolder === folder.id ? folder.color : 'opacity-40 group-hover:opacity-100'}`}>
                                {React.cloneElement(folder.icon as React.ReactElement, { size: 16 })}
                            </span>
                            {folder.label}
                            {folder.count > 0 && (
                                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-black transition-all ${
                                    selectedFolder === folder.id 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                    : 'bg-neutral-800 text-neutral-500 group-hover:bg-neutral-700 group-hover:text-neutral-300'
                                }`}>
                                    {folder.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Inboxes / Channels */}
                <div className="px-3">
                    <button 
                        onClick={() => toggleSection('inboxes')}
                        className="w-full flex items-center text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 px-3 hover:text-neutral-400 transition-colors group"
                    >
                        <span className="flex-1 text-left">Bandejas</span>
                        <ChevronDown size={14} className={`transition-transform duration-300 ${expandedSections.inboxes ? '' : '-rotate-90'}`} />
                    </button>
                    
                    {expandedSections.inboxes && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-300">
                            {channels.map(channel => (
                                <button
                                    key={channel.id}
                                    onClick={() => setSelectedFolder(channel.id)}
                                    className={`w-full flex items-center px-3 py-2.5 rounded-xl text-[12px] transition-all duration-300 border border-transparent ${selectedFolder === channel.id
                                            ? 'bg-white/5 text-white font-bold border-white/5'
                                            : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-200'
                                        }`}
                                >
                                    <div className={`w-2 h-2 rounded-full mr-4 transition-all ${
                                        channel.type === 'whatsapp' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                                        channel.type === 'messenger' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' :
                                        'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)]'
                                    } ${selectedFolder === channel.id ? 'scale-125' : 'opacity-40'}`} />
                                    <span className="truncate">{channel.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Labels Section */}
                <div className="px-3">
                    <button 
                        onClick={() => toggleSection('labels')}
                        className="w-full flex items-center text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 px-3 hover:text-neutral-400 transition-colors group"
                    >
                        <span className="flex-1 text-left">Etiquetas</span>
                        <ChevronDown size={14} className={`transition-transform duration-300 ${expandedSections.labels ? '' : '-rotate-90'}`} />
                    </button>

                    {expandedSections.labels && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-300">
                            {[
                                { name: 'Ventas', color: 'bg-green-500' },
                                { name: 'Soporte', color: 'bg-blue-500' },
                                { name: 'Urgente', color: 'bg-red-500' }
                            ].map(label => (
                                <button
                                    key={label.name}
                                    onClick={() => setSelectedFolder(`label:${label.name.toLowerCase()}`)}
                                    className={`w-full flex items-center px-3 py-2 rounded-xl text-[12px] transition-all duration-300 ${
                                        selectedFolder === `label:${label.name.toLowerCase()}`
                                        ? 'bg-white/5 text-white font-bold'
                                        : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-200'
                                    }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full mr-4 ${label.color} ${selectedFolder === `label:${label.name.toLowerCase()}` ? 'ring-4 ring-white/5' : ''}`} />
                                    <span>{label.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* Footer Settings */}
            <div className="p-4 border-t border-white/5">
                <button className="w-full flex items-center px-4 py-3 rounded-2xl text-[12px] text-neutral-500 hover:bg-white/5 hover:text-white transition-all group">
                    <Settings size={16} className="mr-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                    Ajustes de Bandeja
                </button>
            </div>
        </div>
    );
}
