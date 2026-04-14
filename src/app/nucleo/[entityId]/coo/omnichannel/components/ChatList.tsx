import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Clock, MessageCircle, ChevronDown, Check, Mic, Loader2 } from 'lucide-react';

interface ChatListProps {
    selectedFolder: string;
    activeConversationId: string | null;
    setActiveConversationId: (id: string) => void;
    cards?: any[];
    loading?: boolean;
}

type SortOption = 'newest' | 'oldest';
type FilterOption = 'all' | 'unread';

export default function ChatList({ selectedFolder, activeConversationId, setActiveConversationId, cards = [], loading = false }: ChatListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');
    const filterMenuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setShowFilterMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Process and filter real cards from Firebase
    const conversations = useMemo(() => {
        let filtered = [...cards];

        // 1. Folder Filtering
        if (selectedFolder === 'mine') {
            filtered = filtered.filter(c => c.assignedTo === 'Mío');
        } else if (selectedFolder === 'unassigned') {
            filtered = filtered.filter(c => !c.assignedTo || c.assignedTo === 'Unassigned');
        } else if (selectedFolder === 'whatsapp1') {
            filtered = filtered.filter(c => (c.channel || c.source || '').toLowerCase().includes('whatsapp'));
        } else if (selectedFolder === 'ig1') {
            filtered = filtered.filter(c => (c.channel || c.source || '').toLowerCase().includes('instagram'));
        } else if (selectedFolder === 'messenger') {
            filtered = filtered.filter(c => (c.channel || c.source || '').toLowerCase().includes('messenger'));
        } else if (selectedFolder === 'telegram') {
            filtered = filtered.filter(c => (c.channel || c.source || '').toLowerCase().includes('telegram'));
        } else if (selectedFolder === 'twitter') {
            filtered = filtered.filter(c => (c.channel || c.source || '').toLowerCase().includes('x') || (c.channel || c.source || '').toLowerCase().includes('twitter'));
        } else if (selectedFolder === 'gmail') {
            filtered = filtered.filter(c => (c.channel || c.source || '').toLowerCase().includes('gmail'));
        } else if (selectedFolder.startsWith('label:')) {
            const labelFilter = selectedFolder.replace('label:', '');
            filtered = filtered.filter(c => c.labels?.includes(labelFilter));
        }

        // 2. Unread Filter
        if (filterBy === 'unread') {
            filtered = filtered.filter(c => (c.unreadCount || 0) > 0);
        }

        // 3. Search filtering
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(c => 
                (c.contactName || '').toLowerCase().includes(query) || 
                (c.contactNumber || '').toLowerCase().includes(query)
            );
        }

        // 4. Deduplication logic
        // If multiple cards exist for the same contact, we only show the one with the latest update
        const uniqueMap = new Map<string, any>();
        filtered.forEach(c => {
            // Robust key: Use normalized phone for WhatsApp, or external_id/id for others
            const phone = c.contactNumber || c.contactNumberClean;
            const key = phone ? phone.replace(/\D/g, '') : (c.platform_ids?.[c.source] || c.external_id || c.id);
            
            const existing = uniqueMap.get(key);
            
            const getTimestamp = (card: any) => {
                const ts = card.updatedAt;
                if (!ts) return 0;
                if (typeof ts.toDate === 'function') return ts.toDate().getTime();
                if (ts.seconds) return ts.seconds * 1000;
                if (ts instanceof Date) return ts.getTime();
                if (typeof ts === 'number') return ts;
                return 0;
            };

            if (!existing || getTimestamp(c) > getTimestamp(existing)) {
                uniqueMap.set(key, c);
            }
        });
        filtered = Array.from(uniqueMap.values());

        // 5. Sorting
        filtered.sort((a, b) => {
            const getTimestamp = (card: any) => {
                const ts = card.updatedAt;
                if (!ts) return 0;
                if (typeof ts.toDate === 'function') return ts.toDate().getTime();
                if (ts.seconds) return ts.seconds * 1000;
                if (ts instanceof Date) return ts.getTime();
                if (typeof ts === 'number') return ts;
                return 0;
            };
            const timeA = getTimestamp(a);
            const timeB = getTimestamp(b);
            return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
        });

        return filtered.map(c => ({
            id: c.id,
            name: c.contactName || c.contactNumber || 'Desconocido',
            channel: c.channel || c.source || c.primary_channel || 'WhatsApp',
            snippet: c.lastMessage || c.description || 'Nueva conversación',
            time: c.updatedAt ? (typeof c.updatedAt.toDate === 'function' ? c.updatedAt.toDate() : (c.updatedAt.seconds ? new Date(c.updatedAt.seconds * 1000) : new Date(c.updatedAt))).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) : 'Reciente',
            unread: c.unreadCount || 0,
            status: 'open',
            presence: c.presence || null
        }));
    }, [cards, selectedFolder, searchQuery, sortBy, filterBy]);

    return (
        <div className="w-[280px] bg-[#0d0d0d] border-r border-neutral-900 flex flex-col h-full flex-shrink-0 text-white">
            {/* Header & Search */}
            <div className="p-2 border-b border-neutral-900 space-y-2">
                <div className="flex items-center justify-between relative px-1 pt-1">
                    <h2 className="font-bold text-[10px] uppercase tracking-widest text-neutral-500 opacity-80">
                        {selectedFolder.startsWith('label:') ? selectedFolder.replace('label:', 'LABEL: ') : selectedFolder}
                    </h2>
                    <div className="relative" ref={filterMenuRef}>
                        <button 
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={`p-1 rounded transition-colors ${showFilterMenu || filterBy !== 'all' || sortBy !== 'newest' ? 'text-blue-500 bg-blue-500/10' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
                        >
                            <Filter size={13} />
                        </button>

                        {showFilterMenu && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-neutral-900 border border-neutral-800 rounded shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="p-2 border-b border-neutral-800 bg-neutral-950/50">
                                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Sort by</span>
                                </div>
                                <div className="p-0.5">
                                    <button onClick={() => { setSortBy('newest'); setShowFilterMenu(false); }} className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] rounded hover:bg-neutral-800 transition-colors text-neutral-400">
                                        Newest First {sortBy === 'newest' && <Check size={12} className="text-blue-500" />}
                                    </button>
                                    <button onClick={() => { setSortBy('oldest'); setShowFilterMenu(false); }} className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] rounded hover:bg-neutral-800 transition-colors text-neutral-400">
                                        Oldest First {sortBy === 'oldest' && <Check size={12} className="text-blue-500" />}
                                    </button>
                                </div>
                                <div className="p-2 border-b border-t border-neutral-800 bg-neutral-950/50">
                                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Filter by</span>
                                </div>
                                <div className="p-0.5">
                                    <button onClick={() => { setFilterBy('all'); setShowFilterMenu(false); }} className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] rounded hover:bg-neutral-800 transition-colors text-neutral-400">
                                        All Messages {filterBy === 'all' && <Check size={12} className="text-blue-500" />}
                                    </button>
                                    <button onClick={() => { setFilterBy('unread'); setShowFilterMenu(false); }} className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] rounded hover:bg-neutral-800 transition-colors text-neutral-400">
                                        Unread Only {filterBy === 'unread' && <Check size={12} className="text-blue-500" />}
                                    </button>
                                </div>
                                {(sortBy !== 'newest' || filterBy !== 'all') && (
                                    <button onClick={() => {setSortBy('newest'); setFilterBy('all'); setShowFilterMenu(false);}} className="w-full py-2 text-[9px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest text-center border-t border-neutral-800">
                                        Reset
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative px-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700" size={12} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded py-1 pl-7 pr-2 text-[11px] focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-neutral-700"
                    />
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-700">
                <div className="divide-y divide-neutral-900/40">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-8 gap-3 opacity-40 animate-pulse">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Cargando...</span>
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="p-10 text-center">
                            <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-3 opacity-30">
                                <MessageCircle size={20} />
                            </div>
                            <p className="text-neutral-500 text-[11px] font-medium leading-relaxed">
                                {filterBy === 'unread' ? 'Sin mensajes no leídos' : 'Tu bandeja está vacía.'}
                            </p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {conversations.map((chat) => (
                                <button
                                    key={chat.id}
                                    onClick={() => setActiveConversationId(chat.id)}
                                    className={`w-full group flex items-start gap-3 p-3 text-left transition-all duration-300 rounded-2xl relative border ${
                                        activeConversationId === chat.id 
                                            ? 'bg-blue-600/10 border-blue-500/20 shadow-lg shadow-blue-500/5' 
                                            : 'bg-transparent border-transparent hover:bg-neutral-900/50 hover:border-neutral-800/50'
                                    }`}
                                >
                                    {/* Unread dot indicator */}
                                    {chat.unread > 0 && activeConversationId !== chat.id && (
                                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                    )}

                                    <div className="relative flex-shrink-0">
                                        <div className="w-10 h-10 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-full flex items-center justify-center font-bold text-xs text-white border border-neutral-700/50 shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
                                            {chat.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-[#0d0d0d] flex items-center justify-center p-0.5 shadow-md
                                            ${chat.channel.toLowerCase().includes('whatsapp') ? 'bg-green-500' :
                                                chat.channel.toLowerCase().includes('instagram') ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]' :
                                                    chat.channel.toLowerCase().includes('messenger') ? 'bg-blue-500' :
                                                        chat.channel.toLowerCase().includes('telegram') ? 'bg-sky-500' :
                                                            chat.channel.toLowerCase().includes('gmail') ? 'bg-red-500' :
                                                                chat.channel.toLowerCase().includes('twitter') || chat.channel.toLowerCase().includes('x') ? 'bg-black' : 'bg-neutral-500'}
                                        `}>
                                            {chat.channel.toLowerCase().includes('whatsapp') ? (
                                                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white fill-current">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 0 5.414 0 12.05c0 2.123.551 4.197 1.597 6.03l-1.602 5.8 5.883-1.543a11.86 11.86 0 005.815 1.526h.005c6.634 0 12.048-5.414 12.048-12.05 0-3.213-1.252-6.234-3.525-8.508z" />
                                                </svg>
                                            ) : (
                                                <MessageCircle className="w-2.5 h-2.5 text-white" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <h3 className={`font-semibold truncate pr-1 text-[13px] tracking-tight ${chat.unread > 0 || activeConversationId === chat.id ? 'text-white' : 'text-neutral-400'}`}>
                                                {chat.name}
                                            </h3>
                                            <span className="text-[9px] text-neutral-500 flex-shrink-0 font-medium whitespace-nowrap opacity-80 uppercase tracking-tighter">
                                                {chat.time}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`truncate text-[11px] leading-snug ${chat.unread > 0 ? 'text-neutral-200 font-medium' : 'text-neutral-500'}`}>
                                                {chat.presence === 'typing' ? (
                                                    <span className="text-blue-400 italic">Escribiendo...</span>
                                                ) : chat.presence === 'recording' ? (
                                                    <span className="text-blue-400 italic flex items-center gap-1">
                                                        <Mic size={10} /> Grabando...
                                                    </span>
                                                ) : (
                                                    chat.snippet
                                                )}
                                            </div>
                                            {chat.unread > 0 && (
                                                <span className="ml-auto bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg shadow-blue-600/20">
                                                    {chat.unread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
