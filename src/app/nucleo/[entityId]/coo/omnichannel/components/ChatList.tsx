import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Clock, MessageCircle, ChevronDown, Check, Mic, Mail, Globe2 } from 'lucide-react';
import WhatsappIcon from '@/components/icons/WhatsappIcon';
import { isInstagramCard, resolveCardChannel, resolveOmnichannelBadge } from '@/lib/omnichannel/resolveCardChannel';
import { getCountryStatsSummary } from '@/lib/omnichannel/countryStats';
import { CountryFlag } from '@/components/CountryFlag';
import { ConversationContactMeta, getContactAvatarInitial } from './ConversationContactMeta';

interface ChatListProps {
    selectedFolder: string;
    activeConversationId: string | null;
    setActiveConversationId: (id: string) => void;
    cards?: any[];
    loading?: boolean;
}

type SortOption = 'newest' | 'oldest';
type FilterOption = 'all' | 'unread';

function filterCardsByFolder(cards: any[], selectedFolder: string): any[] {
    if (selectedFolder === 'mine') {
        return cards.filter(c => c.assignedTo === 'Mío');
    }
    if (selectedFolder === 'unassigned') {
        return cards.filter(c => !c.assignedTo || c.assignedTo === 'Unassigned');
    }
    if (selectedFolder === 'whatsapp') {
        return cards.filter(c => {
            const src = (c.channel || c.source || c.primary_channel || '').toLowerCase();
            return src.includes('whatsapp');
        });
    }
    if (selectedFolder === 'instagram') {
        return cards.filter((c) => isInstagramCard(c));
    }
    if (selectedFolder === 'messenger') {
        return cards.filter(c => {
            const src = (c.channel || c.source || c.primary_channel || '').toLowerCase();
            return src.includes('messenger') || src.includes('facebook') || src.includes('meta');
        });
    }
    if (selectedFolder === 'telegram') {
        return cards.filter(c => {
            const src = (c.channel || c.source || c.primary_channel || '').toLowerCase();
            return src.includes('telegram');
        });
    }
    if (selectedFolder === 'twitter' || selectedFolder === 'x') {
        return cards.filter(c => {
            const src = (c.channel || c.source || c.primary_channel || '').toLowerCase();
            return src.includes('x') || src.includes('twitter');
        });
    }
    if (selectedFolder === 'gmail') {
        return cards.filter(c => {
            const src = (c.channel || c.source || c.primary_channel || '').toLowerCase();
            return src.includes('gmail') || src.includes('email');
        });
    }
    if (selectedFolder.startsWith('label:')) {
        const labelFilter = selectedFolder.replace('label:', '');
        return cards.filter(c => c.labels?.includes(labelFilter));
    }
    return cards;
}

function dedupeCards(filtered: any[]): any[] {
    const uniqueMap = new Map<string, any>();

    filtered.forEach(c => {
        const phone = c.contactNumber || c.contactNumberClean;
        const resolved = resolveCardChannel(c);
        const sourceKey = resolved === 'others' ? 'unknown' : resolved;
        const idKey = phone
            ? phone.replace(/\D/g, '')
            : (c.platform_ids?.instagram ||
                  c.platform_ids?.messenger ||
                  c.platform_ids?.whatsapp ||
                  c.metaSenderId ||
                  c.external_id ||
                  c.id);

        const key = `${sourceKey}_${idKey}`;
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

    return Array.from(uniqueMap.values());
}

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

    // Country stats from contacts in the current folder (unique phones per country)
    const countryStats = useMemo(() => {
        const folderCards = dedupeCards(filterCardsByFolder(cards, selectedFolder));
        return getCountryStatsSummary(folderCards);
    }, [cards, selectedFolder]);

    // Process and filter real cards from Firebase
    const conversations = useMemo(() => {
        let filtered = filterCardsByFolder(cards, selectedFolder);

        console.log(`[ChatList] Filtered ${filtered.length} cards for folder: ${selectedFolder}`);

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

        // 4. Deduplication
        filtered = dedupeCards(filtered);

        // 5. Sorting
        filtered.sort((a, b) => {
            const getTimestamp = (card: any) => {
                const ts = card.updatedAt || card.createdAt; // Use createdAt as fallback for new cards
                if (!ts) return Date.now(); // If brand new, put at top
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
            card: c,
            channel: resolveOmnichannelBadge(c),
            snippet: c.lastMessage || c.description || 'Nueva conversación',
            time: c.updatedAt ? (typeof c.updatedAt.toDate === 'function' ? c.updatedAt.toDate() : (c.updatedAt.seconds ? new Date(c.updatedAt.seconds * 1000) : new Date(c.updatedAt))).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) : 'Reciente',
            unread: c.unreadCount || 0,
            presence: c.presence || null,
        }));
    }, [cards, selectedFolder, searchQuery, sortBy, filterBy]);

    return (
        <div className="w-full bg-[#0d0d0d] border-r border-neutral-900 flex flex-col h-full flex-shrink-0 text-white">
            {/* Header & Search */}
            <div className="p-2.5 border-b border-neutral-900 space-y-2 overflow-visible">
                <div className="flex items-center justify-between relative px-0.5 pt-0.5">
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

                <div className="relative px-0.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700" size={12} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded py-1.5 pl-7 pr-2 text-[11px] focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-neutral-700"
                    />
                </div>

                {countryStats.total > 0 && (
                    <div className="px-0.5 pt-1 overflow-visible w-full">
                        <div className="flex flex-wrap items-center content-start gap-x-2 gap-y-2 w-full">
                            <div className="group relative inline-flex items-center gap-1.5 cursor-default pr-1 border-r border-neutral-800 mr-0.5">
                                <span
                                    role="tooltip"
                                    className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-50 rounded-md bg-neutral-800 px-2 py-1 text-[10px] font-medium text-white whitespace-nowrap opacity-0 shadow-md border border-neutral-700 transition-opacity duration-150 group-hover:opacity-100"
                                >
                                    Total de contactos
                                    <span
                                        aria-hidden
                                        className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-neutral-800"
                                    />
                                </span>
                                <Globe2 size={15} className="text-sky-400/90 flex-shrink-0" strokeWidth={2} />
                                <span className="text-[12px] font-bold text-white tabular-nums leading-none">
                                    {countryStats.total}
                                </span>
                            </div>

                            {countryStats.byCountry.map((stat) => (
                                <div
                                    key={stat.iso}
                                    className="group relative inline-flex items-center gap-1 cursor-default"
                                >
                                    <span
                                        role="tooltip"
                                        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-50 rounded-md bg-neutral-800 px-2 py-1 text-[10px] font-medium text-white whitespace-nowrap opacity-0 shadow-md border border-neutral-700 transition-opacity duration-150 group-hover:opacity-100"
                                    >
                                        {stat.country}
                                        <span
                                            aria-hidden
                                            className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-neutral-800"
                                        />
                                    </span>
                                    <CountryFlag iso={stat.iso} country={stat.country} size="sm" />
                                    <span className="text-[11px] font-semibold text-neutral-200 tabular-nums leading-none">
                                        {stat.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-700">
                <div className="divide-y divide-neutral-900/40">
                    {loading ? (
                        <div className="p-4 text-center text-neutral-700 text-[10px] animate-pulse">Cargando...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-4 text-center text-neutral-700 text-[10px]">
                            {filterBy === 'unread' ? 'Sin mensajes no leídos' : 'Sin conversaciones'}
                        </div>
                    ) : (
                        conversations.map((chat) => (
                            <button
                                key={chat.id}
                                onClick={() => setActiveConversationId(chat.id)}
                                className={`w-full flex items-start p-2.5 text-left transition-colors hover:bg-neutral-900/50 relative ${activeConversationId === chat.id ? 'bg-neutral-900/80 shadow-inner' : ''}`}
                            >
                                {activeConversationId === chat.id && (
                                    <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-blue-500 rounded-r" />
                                )}

                                <div className="relative mr-2.5 flex-shrink-0 pt-0.5">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-[11px] text-white">
                                        {getContactAvatarInitial(chat.card)}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-[#0d0d0d] flex items-center justify-center overflow-hidden
                                        ${chat.channel.toLowerCase().includes('whatsapp') ? 'bg-[#25D366]' :
                                            chat.channel.toLowerCase().includes('instagram') ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]' :
                                                chat.channel.toLowerCase().includes('messenger') || chat.channel.toLowerCase().includes('facebook') ? 'bg-[#00B2FF]' :
                                                    chat.channel.toLowerCase().includes('telegram') ? 'bg-[#229ED9]' :
                                                        chat.channel.toLowerCase().includes('gmail') || chat.channel.toLowerCase().includes('email') ? 'bg-[#EA4335]' :
                                                            chat.channel.toLowerCase().includes('twitter') || chat.channel.toLowerCase().includes('x') ? 'bg-black' : 'bg-neutral-500'}
                                    `}>
                                        {chat.channel.toLowerCase().includes('whatsapp') ? (
                                            <WhatsappIcon className="w-2.5 h-2.5 text-white fill-current" />
                                        ) : chat.channel.toLowerCase().includes('instagram') ? (
                                            <svg viewBox="0 0 24 24" className="w-2 h-2 text-white fill-current"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.27.057-1.649.07-4.859.07s-3.585-.015-4.85-.074c-1.17-.061-1.805-.256-2.227-.421-.562-.224-.96-.479-1.382-.899-.419-.419-.679-.824-.896-1.38-.164-.42-.36-1.065-.413-2.235-.057-1.27-.07-1.649-.07-4.859s.015-3.585.074-4.85c.061-1.17.256-1.805.421-2.227.224-.562.479-.96.899-1.382.419-.419.824-.679 1.38-.896.42-.164 1.065-.36 2.235-.413 1.27-.057 1.649-.07 4.859-.07zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                                        ) : chat.channel.toLowerCase().includes('messenger') || chat.channel.toLowerCase().includes('facebook') ? (
                                            <svg viewBox="0 0 24 24" className="w-2 h-2 text-white fill-current"><path d="M12 0C5.31 0 0 4.92 0 11.13c0 3.53 1.71 6.67 4.38 8.65.23.17.38.45.39.73l.03 2.18c.01.62.66 1.02 1.2.73l2.42-1.3c.21-.11.45-.14.67-.09 1 .25 2 .39 3.1.39 6.69 0 12-4.92 12-11.31C24 4.92 18.69 0 12 0zm1.34 14.88l-3.07-3.28-6 3.28 6.59-7 3.12 3.28 5.83-3.28-6.47 7z" /></svg>
                                        ) : chat.channel.toLowerCase().includes('telegram') ? (
                                            <svg viewBox="0 0 24 24" className="w-2 h-2 text-white fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.62 4.498-.8 5.448-.073.398-.198.533-.341.547-.311.028-.546-.205-.845-.401-.469-.307-1.332-.851-1.688-1.085-.89-.586-.251-.908.196-1.372.117-.121 2.146-1.97 2.185-2.14.005-.021.01-.098-.035-.14a.159.159 0 0 0-.146-.03c-.063.014-1.077.683-3.03 2.001-.285.196-.544.292-.776.286-.255-.006-.746-.145-1.112-.262-.449-.143-.804-.22-1.066-.144-.047.014-.15.044-.221.111l2.42-1.3c.094-.031.18-.046.25-.046.126-.002.45-.034.7.127.24.156.452.378.36.726-.09.348-1.143 4.195-1.143 4.195s-.027.054-.035.1l-.013.1c-.01.127-.04.256-.1.353-.1.171-.24.32-.47.41-.28.1-.56.12-.83.12-.26 0-.58-.02-.85-.1-.28-.08-.6-.24-.8-.4-.22-.17-.4-.38-.5-.62-.12-.24-.2-.54-.2-.84 0-.3.08-.64.2-.95.12-.31.3-.58.53-.8l1.32-.98z" /></svg>
                                        ) : chat.channel.toLowerCase().includes('gmail') || chat.channel.toLowerCase().includes('email') ? (
                                            <Mail size={10} className="text-white fill-current" />
                                        ) : (
                                            <MessageCircle size={7} className="text-white fill-current" />
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                        <ConversationContactMeta
                                            card={chat.card}
                                            compact
                                            highlight={chat.unread > 0}
                                        />
                                        <div className="flex flex-col items-end flex-shrink-0 gap-1">
                                            <span className="text-[9px] text-neutral-600 font-medium leading-none">
                                                {chat.time}
                                            </span>
                                            {chat.unread > 0 && (
                                                <span className="bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full inline-block min-w-[1rem] text-center leading-none">
                                                    {chat.unread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 min-w-0">
                                        {chat.unread > 0 && <div className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0" />}
                                        <div className={`truncate text-[10px] ${chat.unread > 0 ? 'text-neutral-300 font-medium' : 'text-neutral-600'}`}>
                                            {chat.presence === 'typing' ? (
                                                <span className="text-blue-500 italic animate-pulse">Escribiendo...</span>
                                            ) : chat.presence === 'recording' ? (
                                                <span className="text-blue-500 italic animate-pulse flex items-center gap-1">
                                                    <Mic size={10} /> Grabando audio...
                                                </span>
                                            ) : (
                                                chat.snippet
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

