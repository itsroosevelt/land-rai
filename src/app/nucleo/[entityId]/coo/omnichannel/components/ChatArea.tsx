import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Info, Send, Paperclip, Smile, Image as ImageIcon, FileText, Loader2, Zap, User, XCircle, Ban, Mic, X, Plus, MapPin, Contact2, AlertCircle, RefreshCw, List, MousePointer2, ExternalLink, Search, Filter, MessageCircle, Check, CheckCheck, Clock, Mail, Instagram, Facebook, Twitter } from 'lucide-react';
import { useConversationLogic } from '../../whatsapp/components/ConversationModal/hooks/useConversationLogic';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

interface ChatAreaProps {
    card: any;
    groups: any[];
    groupName: string;
    allConversations: any[];
}

const QUICK_REPLIES = [
    { id: 'greet', label: 'Saludo Inicial', text: '¡Hola! ¿En qué podemos ayudarte hoy?' },
    { id: 'wait', label: 'Esperar un Momento', text: 'Un momento por favor, estoy revisando tu solicitud...' },
    { id: 'pricing', label: 'Info Precios', text: 'Nuestros planes comienzan desde $50/mes. ¿Te gustaría ver el catálogo completo?' },
    { id: 'bye', label: 'Despedida', text: '¡Gracias por contactarnos! Que tengas un excelente día.' },
];

export default function ChatArea({ card, groups, groupName, allConversations }: ChatAreaProps) {
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showAttachments, setShowAttachments] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);
    const attachmentsRef = useRef<HTMLDivElement>(null);

    // --- Audio Recording State --- //
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const formatRecordingTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `Audio-${Date.now()}.webm`, { type: 'audio/webm' });


                logic.setSelectedFile(audioFile);
                logic.setFilePreviewUrl(URL.createObjectURL(audioFile));

                // stream.getTracks().forEach(track => track.stop());
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (error) {
            console.error('Error al acceder al micrófono:', error);
            toast.error('No se pudo acceder al micrófono para grabar.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            audioChunksRef.current = []; // Discard
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const { currentUser, activeEntity } = useAuth();

    // Close menus when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
                setShowMoreMenu(false);
            }
            if (attachmentsRef.current && !attachmentsRef.current.contains(event.target as Node)) {
                setShowAttachments(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const logic = useConversationLogic({
        isOpen: true,
        onClose: () => { },
        card: card,
        groupName: groupName,
        groups: groups,
        allConversations: allConversations
    });

    // Clear unread count when conversation is opened/focused
    useEffect(() => {
        const resetUnread = async () => {
            // Priority: use liveCardData information (subscription) vs card props (can be stale)
            const currentGid = logic.liveCardData?.groupId || card?.groupId;
            const currentCid = logic.liveCardData?.id || card?.id;
            // Robust check: use unreadCount from both live sub and props
            const hasUnread = (logic.liveCardData?.unreadCount || 0) > 0 || (card?.unreadCount || 0) > 0;

            if (currentCid && currentGid && hasUnread && currentUser?.uid && activeEntity) {
                const tenantPath = `users/${currentUser.uid}/entities/${activeEntity}`;
                console.log(`[ChatArea] Resetting unreadCount for ${currentCid} in group ${currentGid}`);
                try {
                    const cardRef = doc(db, `${tenantPath}/kanban-groups/${currentGid}/cards/${currentCid}`);
                    await updateDoc(cardRef, {
                        unreadCount: 0,
                        lastReadAt: Timestamp.now()
                    });
                } catch (err: any) {
                    // Fail silently if document moved or already deleted - state will sync on next render
                    if (err.code === 'not-found' || err.message?.includes('No document to update')) {
                        console.warn("[ChatArea] Card moved or not found at path during unread reset. Ignoring.");
                    } else {
                        console.error("[ChatArea] Error clearing unread count:", err);
                    }
                }
            }
        };

        resetUnread();

        // Also reset when window gains focus
        window.addEventListener('focus', resetUnread);
        return () => window.removeEventListener('focus', resetUnread);
    }, [card?.id, card?.unreadCount, card?.groupId, logic.liveCardData?.groupId, logic.liveCardData?.unreadCount, currentUser?.uid, activeEntity]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (logic.messagesEndRef.current) {
            logic.messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [card?.id, logic.liveCardData?.messages?.length]);

    const contactName = card?.contactName || card?.contactNumber || 'Desconocido';
    const isOnline = card?.isOnline ?? true;

    const handleSelectQuickReply = (text: string) => {
        logic.setNewMessage(text);
        setShowQuickReplies(false);
    };

    const handleCloseConversation = async () => {
        if (!card?.id || !currentUser?.uid || !activeEntity) return;

        const isConfirmed = window.confirm("¿Estás seguro de que deseas eliminar permanentemente esta conversación? Esta acción no se puede deshacer.");
        if (!isConfirmed) return;

        const loadingToast = toast.loading("Eliminando conversación...");

        try {
            const tenantPath = `users/${currentUser.uid}/entities/${activeEntity}`;

            // 1. Direct Deletion (using prop groupId)
            const directCardRef = doc(db, `${tenantPath}/kanban-groups/${card.groupId}/cards/${card.id}`);
            const { deleteDoc, getDocs, collection } = await import('firebase/firestore');
            await deleteDoc(directCardRef);

            // 2. Brute Force Search (Safety Net)
            const groupsSnap = await getDocs(collection(db, `${tenantPath}/kanban-groups`));
            const deletePromises: Promise<any>[] = [];

            const cleanPhone = card.contactNumberClean || card.contactNumber?.replace(/\D/g, '');

            for (const groupDoc of groupsSnap.docs) {
                const cardsRef = collection(db, `${tenantPath}/kanban-groups/${groupDoc.id}/cards`);
                const cardsSnap = await getDocs(cardsRef);

                cardsSnap.docs.forEach(cDoc => {
                    const data = cDoc.data();
                    const cPhone = data.contactNumberClean || data.contactNumber?.replace(/\D/g, '');

                    if (cDoc.id === card.id || (cleanPhone && cPhone === cleanPhone)) {
                        deletePromises.push(deleteDoc(cDoc.ref));
                    }
                });
            }

            await Promise.all(deletePromises);

            toast.success('Conversación eliminada de todas las carpetas.', { id: loadingToast });
            setShowMoreMenu(false);
        } catch (error) {
            console.error("Error deleting conversation: ", error);
            toast.error('Hubo un error al intentar eliminar la conversación.', { id: loadingToast });
        }
    };

    const handleBlockContact = () => {
        logic.handleToggleBlock();
        setShowMoreMenu(false);
    };

    return (
        <div className="flex-1 flex flex-col h-full relative bg-[#0a0a0a]">

            {/* Header - Glassmorphism */}
            <div className="h-16 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-10 sticky top-0 shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center font-bold text-white text-[14px] shadow-lg shadow-indigo-500/20">
                            {contactName.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-[#0d0d0d] flex items-center justify-center p-0.5 shadow-md
                            ${(card?.channel || card?.source || '').toLowerCase().includes('whatsapp') ? 'bg-[#25D366]' :
                              (card?.channel || card?.source || '').toLowerCase().includes('instagram') ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]' :
                              (card?.channel || card?.source || '').toLowerCase().includes('messenger') ? 'bg-[#0084FF]' :
                              (card?.channel || card?.source || '').toLowerCase().includes('telegram') ? 'bg-[#0088cc]' :
                              (card?.channel || card?.source || '').toLowerCase().includes('gmail') ? 'bg-[#EA4335]' : 
                              (card?.channel || card?.source || '').toLowerCase().includes('twitter') || (card?.channel || card?.source || '').toLowerCase().includes('x_twitter') ? 'bg-black' : 'bg-neutral-600'}
                        `}>
                            {(card?.channel || card?.source || '').toLowerCase().includes('whatsapp') ? (
                                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white fill-current">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 0 5.414 0 12.05c0 2.123.551 4.197 1.597 6.03l-1.602 5.8 5.883-1.543a11.86 11.86 0 005.815 1.526h.005c6.634 0 12.048-5.414 12.048-12.05 0-3.213-1.252-6.234-3.525-8.508z" />
                                </svg>
                            ) : (card?.channel || card?.source || '').toLowerCase().includes('instagram') ? (
                                <Instagram size={10} className="text-white" />
                            ) : (card?.channel || card?.source || '').toLowerCase().includes('messenger') ? (
                                <Facebook size={10} className="text-white" />
                            ) : (card?.channel || card?.source || '').toLowerCase().includes('telegram') ? (
                                <Send size={10} className="text-white" />
                            ) : (card?.channel || card?.source || '').toLowerCase().includes('gmail') ? (
                                <Mail size={10} className="text-white" />
                            ) : (card?.channel || card?.source || '').toLowerCase().includes('twitter') || (card?.channel || card?.source || '').toLowerCase().includes('x_twitter') ? (
                                <Twitter size={10} className="text-white" />
                            ) : (
                                <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-neutral-500'}`} />
                            )}
                        </div>
                    </div>
                    <div>
                        <h2 className="font-bold text-white tracking-tight text-sm flex items-center gap-2">
                            {contactName}
                            {logic.liveCardData?.isBlocked && <Ban size={12} className="text-red-500" />}
                        </h2>
                        <div className="flex items-center text-[10px] text-neutral-500 font-medium">
                            {card?.presence === 'typing' ? (
                                <span className="text-blue-400 italic animate-pulse">Escribiendo...</span>
                            ) : card?.presence === 'recording' ? (
                                <span className="text-blue-400 italic animate-pulse flex items-center gap-1">
                                    <Mic size={10} /> Grabando audio...
                                </span>
                            ) : (
                                <span className="opacity-60">{isOnline ? 'En línea' : 'Desconectado'}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <button className="p-2.5 hover:bg-white/5 rounded-xl transition-all text-neutral-400 hover:text-white" title="Mark as Unread">
                        <Mail className="w-4 h-4" />
                    </button>
                    <div className="relative" ref={moreMenuRef}>
                        <button
                            onClick={() => setShowMoreMenu(!showMoreMenu)}
                            className={`p-2.5 transition-all rounded-xl ${showMoreMenu ? 'text-white bg-white/10' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
                            title="More Actions"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {/* More Menu Popover */}
                        {showMoreMenu && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-neutral-900/95 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-1.5 space-y-1">
                                    <button
                                        className="w-full flex items-center px-3 py-2.5 text-xs text-neutral-300 hover:bg-white/5 transition-all rounded-xl group text-left"
                                        onClick={handleCloseConversation}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center mr-3 group-hover:bg-yellow-500/20 transition-colors">
                                            <XCircle size={14} className="text-yellow-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold">Finalizar Chat</p>
                                            <p className="text-[9px] text-neutral-500">Mover a completados</p>
                                        </div>
                                    </button>
                                    <button
                                        className={`w-full flex items-center px-3 py-2.5 text-xs transition-all rounded-xl group text-left ${logic.liveCardData?.isBlocked ? 'text-green-400 hover:bg-green-500/10' : 'text-red-400 hover:bg-red-500/10'}`}
                                        onClick={handleBlockContact}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors ${logic.liveCardData?.isBlocked ? 'bg-green-500/10 group-hover:bg-green-500/20' : 'bg-red-500/10 group-hover:bg-red-500/20'}`}>
                                            <Ban size={14} className={logic.liveCardData?.isBlocked ? 'text-green-500' : 'text-red-500'} />
                                        </div>
                                        <div>
                                            <p className="font-bold">{logic.liveCardData?.isBlocked ? 'Desbloquear' : 'Bloquear'}</p>
                                            <p className="text-[9px] text-neutral-500">{logic.liveCardData?.isBlocked ? 'Permitir mensajes' : 'Ignorar mensajes'}</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-32">
                {Object.entries(logic.groupedMessages).map(([date, msgs], dateIdx) => (
                    <React.Fragment key={date}>
                        <div className="flex justify-center my-8 sticky top-4 z-[5]">
                            <div className="bg-neutral-900/40 backdrop-blur-sm border border-white/5 text-[10px] text-neutral-400 px-4 py-1 rounded-full uppercase tracking-widest font-black shadow-sm">
                                {date}
                            </div>
                        </div>

                        {(msgs as any[]).map((msg: any, msgIdx: number) => {
                            const isAgent = msg.sender === 'agent';
                            const prevMsg = (msgs as any[])[msgIdx - 1];
                            const EXPIRE_THRESHOLD = 48 * 60 * 60 * 1000;

                            const showGapMarker = prevMsg && msg.timestamp?.toDate && prevMsg.timestamp?.toDate &&
                                (msg.timestamp.toDate().getTime() - prevMsg.timestamp.toDate().getTime() > EXPIRE_THRESHOLD);

                            return (
                                <React.Fragment key={msgIdx}>
                                    {showGapMarker && (
                                        <div className="flex justify-center my-10">
                                            <div className="bg-red-500/5 border border-red-500/20 text-red-500/80 text-[10px] px-6 py-2 rounded-2xl font-black uppercase tracking-[0.2em] shadow-sm backdrop-blur-sm max-w-sm text-center leading-relaxed">
                                                VENTANA COMERCIAL CERRADA POR INACTIVIDAD
                                            </div>
                                        </div>
                                    )}
                                    <div className={`flex items-end gap-2 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                        {!isAgent && (
                                            <div className="w-8 h-8 rounded-2xl bg-neutral-900 border border-white/5 flex-shrink-0 mb-1 flex items-center justify-center text-[10px] font-bold text-neutral-500 shadow-sm overflow-hidden">
                                                {contactName.charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        <div className={`max-w-[80%] group flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
                                            <div className={`p-4 rounded-3xl relative transition-all duration-300 ${isAgent
                                                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-none shadow-xl shadow-blue-500/10 border border-blue-400/20'
                                                : 'bg-neutral-800/80 backdrop-blur-sm text-neutral-100 rounded-bl-none shadow-lg border border-white/5'
                                                }`}>

                                                {/* File Support */}
                                                {msg.fileUrl && (
                                                    <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 shadow-inner">
                                                        {msg.fileType?.startsWith('image/') ? (
                                                            <img src={msg.fileUrl} alt={msg.fileName} className="max-w-full rounded-xl hover:scale-[1.02] transition-transform duration-500" />
                                                        ) : (
                                                            <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-black/20 hover:bg-black/30 transition-colors">
                                                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                                                    <FileText size={18} className={isAgent ? 'text-white' : 'text-blue-400'} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[11px] font-bold truncate">{msg.fileName || 'Documento'}</p>
                                                                    <p className="text-[9px] opacity-60 uppercase tracking-widest">Descargar</p>
                                                                </div>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Interactive Content Rendering */}
                                                {msg.sender === 'agent' && msg.type === 'buttons' && (
                                                    <div className="space-y-3">
                                                        {msg.metadata?.header && msg.metadata.header.type !== 'none' && (
                                                            <div className="mb-3 rounded-xl overflow-hidden border border-white/10">
                                                                {msg.metadata.header.type === 'text' && (
                                                                    <div className="font-black text-[10px] uppercase tracking-[0.1em] bg-white/5 p-3">{msg.metadata.header.text}</div>
                                                                )}
                                                                {msg.metadata.header.type === 'image' && msg.metadata.header.url && (
                                                                    <img src={msg.metadata.header.url} alt="header" className="w-full max-h-48 object-cover" />
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                        <div className="flex flex-wrap gap-2 pt-2">
                                                            {msg.metadata?.buttons?.map((btn: any, idx: number) => (
                                                                <div key={idx} className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2 text-[11px] font-bold shadow-sm transition-colors cursor-default">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse"></div>
                                                                    {btn.text}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {msg.sender === 'agent' && msg.type === 'list' && (
                                                    <div className="space-y-4">
                                                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                        <div className="bg-black/20 border border-white/10 rounded-2xl overflow-hidden shadow-inner">
                                                            <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-white/5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                                                        <List size={14} className="text-blue-300" />
                                                                    </div>
                                                                    <span className="text-[11px] font-black uppercase tracking-widest">{msg.metadata?.buttonText || 'Menú'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-gradient-to-b from-transparent to-black/20 px-4 py-2 border-t border-white/5">
                                                                <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-[0.2em] mb-1">Opciones disponibles</p>
                                                                <p className="text-[10px] opacity-60">Selecciona en tu dispositivo</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Status markers & Time for agent */}
                                                {(!msg.type || msg.type === 'text' || (msg.sender !== 'agent')) && (
                                                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                )}

                                                {msg.sender === 'agent' && msg.type === 'media' && (
                                                    <div className="space-y-3">
                                                        {msg.metadata?.url && (
                                                            <div className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-black/20">
                                                                <img src={msg.metadata.url} alt="media" className="w-full max-h-80 object-cover transition-transform duration-700 group-hover:scale-110" />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                                                                    <p className="text-[10px] font-bold uppercase tracking-widest truncate">{msg.metadata.filename || 'Archivo de Medios'}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center mt-1.5 px-2 text-[9px] font-black uppercase tracking-widest text-neutral-600 gap-2">
                                                <span>{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                {isAgent && (
                                                    msg.status === 'sending' ? (
                                                        <Loader2 size={10} className="animate-spin" />
                                                    ) : msg.status === 'failed' ? (
                                                        <div
                                                            className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-all hover:scale-105"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                logic.retryMessage?.(msg);
                                                            }}
                                                        >
                                                            <AlertCircle size={10} />
                                                            <span>ERROR</span>
                                                            <RefreshCw size={10} className="ml-1" />
                                                        </div>
                                                    ) : (
                                                        <div className={`flex items-center gap-0.5 ${msg.status === 'read' ? 'text-blue-400' : 'text-neutral-600'}`}>
                                                            {msg.status === 'sent' && <span>✓</span>}
                                                            {msg.status === 'delivered' && <span>✓✓</span>}
                                                            {msg.status === 'read' && <span className="drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]">✓✓</span>}
                                                            {!msg.status && <span>✓</span>}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {isAgent && (
                                            <div className="w-8 h-8 rounded-2xl bg-neutral-900 border border-white/5 flex-shrink-0 mb-1 flex items-center justify-center text-neutral-500 shadow-sm overflow-hidden ring-1 ring-white/5">
                                                <User size={16} />
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </React.Fragment>
                ))}

                {/* Expiration warning at end */}
                {(() => {
                    const lastMsgArray = logic.liveCardData?.messages || [];
                    if (lastMsgArray.length === 0) return null;
                    const lastMsg = lastMsgArray[lastMsgArray.length - 1];
                    const EXPIRE_THRESHOLD = 48 * 60 * 60 * 1000;
                    const now = new Date().getTime();
                    const lastTs = lastMsg.timestamp?.toDate ? lastMsg.timestamp.toDate().getTime() :
                        (lastMsg.timestamp?.seconds ? lastMsg.timestamp.seconds * 1000 : 0);

                    if (lastTs > 0 && (now - lastTs > EXPIRE_THRESHOLD)) {
                        return (
                            <div className="flex justify-center my-10 animate-in fade-in zoom-in duration-500">
                                <div className="bg-red-500/5 border border-red-500/20 text-red-500/80 text-[10px] px-8 py-3 rounded-3xl font-black uppercase tracking-[0.2em] shadow-lg backdrop-blur-md max-w-sm text-center leading-relaxed border-dashed">
                                    ESTA CONVERSACIÓN HA EXPIRADO
                                    <div className="text-[8px] opacity-40 mt-1 font-medium">Han pasado más de 48 horas desde el último mensaje</div>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}

                <div ref={logic.messagesEndRef} className="h-4" />
            </div>

            {/* Input Area - Floating Experience */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 z-20">
                <div className="max-w-4xl mx-auto bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl p-2 relative">
                    
                    {/* File Preview Overlay - Refined */}
                    {logic.filePreviewUrl && (
                        <div className="absolute bottom-full left-0 right-0 mb-4 mx-4 bg-[#111] border border-white/10 rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-bottom-8 duration-500">
                            <div className="flex items-start gap-4">
                                <div className="relative group w-32 h-32 flex-shrink-0">
                                    {logic.selectedFile?.type.startsWith('image/') ? (
                                        <img src={logic.filePreviewUrl} alt="Preview" className="w-full h-full object-cover rounded-2xl ring-1 ring-white/10" />
                                    ) : (
                                        <div className="w-full h-full bg-neutral-800 rounded-2xl flex items-center justify-center">
                                            <FileText className="text-blue-500" size={32} />
                                        </div>
                                    )}
                                    <button
                                        onClick={logic.handleCancelPreview}
                                        className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-2 border-4 border-[#111] hover:scale-110 transition-transform shadow-xl"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex-1 pt-2">
                                    <h4 className="text-white font-bold text-sm truncate uppercase tracking-widest">{logic.selectedFile?.name}</h4>
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                                        {(logic.selectedFile?.size || 0) / 1024 > 1024 
                                            ? `${((logic.selectedFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB` 
                                            : `${((logic.selectedFile?.size || 0) / 1024).toFixed(1)} KB`}
                                    </p>
                                    
                                    {logic.uploading && (
                                        <div className="mt-4 space-y-2">
                                            <div className="flex justify-between text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                                <span className="animate-pulse">Subiendo...</span>
                                                <span>{logic.progress}%</span>
                                            </div>
                                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                                <div className="bg-blue-600 h-full transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{ width: `${logic.progress}%` }} />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {!logic.uploading && (
                                        <Button
                                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl px-6 h-10 shadow-lg shadow-blue-500/20 w-full md:w-auto"
                                            onClick={logic.handleDisplayFileSend}
                                        >
                                            Confirmar y Enviar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Replies - New Grid Design */}
                    {showQuickReplies && (
                        <div className="absolute bottom-full left-0 right-0 mb-4 mx-4 bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-white/5 px-6 py-4 flex justify-between items-center border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <Zap size={14} className="text-yellow-500 fill-yellow-500" />
                                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Respuestas Rápidas</span>
                                </div>
                                <button onClick={() => setShowQuickReplies(false)} className="text-neutral-500 hover:text-white transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 p-2 max-h-72 overflow-y-auto no-scrollbar">
                                {QUICK_REPLIES.map(reply => (
                                    <button
                                        key={reply.id}
                                        onClick={() => handleSelectQuickReply(reply.text)}
                                        className="flex flex-col text-left px-5 py-4 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 group"
                                    >
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 group-hover:translate-x-1 transition-transform">{reply.label}</span>
                                        <span className="text-xs text-neutral-400 truncate group-hover:text-neutral-200">{reply.text}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-end relative">
                        {/* Status Lock Overlay */}
                        {logic.liveCardData?.isBlocked && (
                            <div className="absolute inset-0 bg-[#111]/90 backdrop-blur-md z-30 flex items-center justify-center gap-6 rounded-[2rem] animate-in fade-in duration-500 overflow-hidden">
                                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                                    <Ban size={20} className="text-red-500" />
                                </div>
                                <div>
                                    <p className="text-[12px] font-black text-white uppercase tracking-[0.1em]">Contacto Bloqueado</p>
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">No puedes enviar mensajes</p>
                                </div>
                                <button
                                    onClick={logic.handleToggleBlock}
                                    className="px-6 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-blue-500/20"
                                >
                                    Desbloquear
                                </button>
                            </div>
                        )}

                        <button
                            disabled={logic.liveCardData?.isBlocked}
                            onClick={() => setShowQuickReplies(!showQuickReplies)}
                            className={`p-4 transition-all duration-300 rounded-full ${showQuickReplies ? 'text-yellow-500 bg-yellow-500/10 scale-110' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                        >
                            <Zap size={22} fill={showQuickReplies ? 'currentColor' : 'none'} className={showQuickReplies ? 'animate-pulse' : ''} />
                        </button>

                        <div className="relative flex-1 px-1">
                            {isRecording ? (
                                <div className="h-[54px] flex items-center gap-4 px-6 animate-in fade-in slide-in-from-left-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse"></div>
                                        <span className="text-red-500 font-black text-[14px] font-mono tracking-widest">{formatRecordingTime(recordingTime)}</span>
                                    </div>
                                    <div className="h-1 bg-white/5 flex-1 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500/40 w-full animate-wave"></div>
                                    </div>
                                    <span className="text-neutral-500 text-[9px] font-black uppercase tracking-[0.2em] hidden sm:block">Grabando Audio PTT</span>
                                </div>
                            ) : (
                                <textarea
                                    disabled={logic.liveCardData?.isBlocked}
                                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-white py-4 px-2 resize-none max-h-48 min-h-[54px] text-sm leading-relaxed placeholder:text-neutral-600 no-scrollbar"
                                    placeholder={logic.liveCardData?.isBlocked ? "Bloqueado" : "Escribe tu mensaje aquí..."}
                                    rows={1}
                                    value={logic.newMessage}
                                    onChange={(e) => {
                                        logic.setNewMessage(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            logic.handleSendMessage();
                                        }
                                    }}
                                />
                            )}
                        </div>

                        <div className="flex items-center p-1.5 gap-1.5 self-center">
                            {/* Attachments Menu - Circular design */}
                            <div className="relative" ref={attachmentsRef}>
                                <button
                                    disabled={logic.liveCardData?.isBlocked}
                                    onClick={() => setShowAttachments(!showAttachments)}
                                    className={`w-11 h-11 flex items-center justify-center transition-all duration-300 rounded-full ${showAttachments ? 'bg-indigo-500 text-white rotate-45 shadow-lg shadow-indigo-500/30' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                                >
                                    <Plus size={24} />
                                </button>

                                {showAttachments && (
                                    <div className="absolute bottom-full right-0 mb-4 w-52 bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 py-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <button onClick={() => { logic.open(); setShowAttachments(false); }} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 text-neutral-300 hover:text-white transition-all group">
                                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <ImageIcon size={16} className="text-blue-400" />
                                            </div>
                                            <span className="text-[11px] font-bold uppercase tracking-widest">Multimedia</span>
                                        </button>
                                        <button onClick={() => { logic.open(); setShowAttachments(false); }} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 text-neutral-300 hover:text-white transition-all group">
                                            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <FileText size={16} className="text-purple-400" />
                                            </div>
                                            <span className="text-[11px] font-bold uppercase tracking-widest">Documento</span>
                                        </button>
                                        <button onClick={() => setShowAttachments(false)} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 text-neutral-300 hover:text-white transition-all group border-t border-white/5 mt-1">
                                            <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <MapPin size={16} className="text-green-400" />
                                            </div>
                                            <span className="text-[11px] font-bold uppercase tracking-widest">Ubicación</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Main Action Button - Circular Gradient */}
                            {isRecording ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={cancelRecording}
                                        className="w-11 h-11 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center justify-center shadow-lg"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        onClick={stopRecording}
                                        className="w-11 h-11 rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-500/40 transition-all duration-300 flex items-center justify-center scale-110"
                                    >
                                        <Send size={18} className="translate-x-[1px] -translate-y-[1px]" />
                                    </button>
                                </div>
                            ) : (
                                logic.newMessage.trim().length > 0 || logic.selectedFile ? (
                                    <button
                                        onClick={logic.handleSendMessage}
                                        disabled={logic.isSending || (!logic.newMessage.trim() && !logic.selectedFile)}
                                        className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] shadow-xl shadow-blue-500/20 transition-all duration-300 flex items-center justify-center scale-110 group"
                                    >
                                        {logic.isSending || logic.uploading 
                                            ? <Loader2 size={18} className="animate-spin" /> 
                                            : <Send size={18} className="translate-x-[1px] -translate-y-[1px] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                        }
                                    </button>
                                ) : (
                                    <button
                                        onClick={startRecording}
                                        disabled={logic.liveCardData?.isBlocked}
                                        className="w-11 h-11 rounded-full bg-neutral-900 border border-white/10 text-neutral-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all duration-300 flex items-center justify-center group"
                                    >
                                        <Mic size={18} className="group-hover:scale-110 transition-transform" />
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
