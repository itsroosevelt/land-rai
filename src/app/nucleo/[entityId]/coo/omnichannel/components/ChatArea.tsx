import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MoreVertical, Info, Send, Paperclip, Mail, Smile, Image as ImageIcon, FileText, Loader2, Zap, User, XCircle, Ban, Mic, X, Plus, MapPin, Contact2, AlertCircle, RefreshCw, List, MousePointer2, ExternalLink, ChevronLeft } from 'lucide-react';
import { useConversationLogic } from '../../whatsapp/components/ConversationModal/hooks/useConversationLogic';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp, collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { getContactHeaderNames, getContactPhoneDisplay } from '@/lib/omnichannel/contactHeaderInfo';
import { CountryFlag } from '@/components/CountryFlag';

interface ChatAreaProps {
    card: any;
    groups: any[];
    groupName: string;
    allConversations: any[];
    onBack?: () => void;
}

const QUICK_REPLIES = [
    { id: 'greet', label: 'Saludo Inicial', text: '¡Hola! ¿En qué podemos ayudarte hoy?' },
    { id: 'wait', label: 'Esperar un Momento', text: 'Un momento por favor, estoy revisando tu solicitud...' },
    { id: 'pricing', label: 'Info Precios', text: 'Nuestros planes comienzan desde $50/mes. ¿Te gustaría ver el catálogo completo?' },
    { id: 'bye', label: 'Despedida', text: '¡Gracias por contactarnos! Que tengas un excelente día.' },
];

export default function ChatArea({ card, groups, groupName, allConversations, onBack }: ChatAreaProps) {
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

    // Reset unread ONLY when the user actively opens a different conversation (card?.id changes).
    // card?.unreadCount and liveCardData?.unreadCount are intentionally excluded from deps:
    // if the user already has the chat open, new messages should still show the unread badge
    // until they scroll down or re-open the conversation.
    // The window-focus listener is removed for the same reason — focusing the browser window
    // should not silently clear unread counts.
    useEffect(() => {
        const groupId = logic.liveCardData?.groupId || card?.groupId;
        const cardId = card?.id;
        const uid = currentUser?.uid;
        const entity = activeEntity;
        const unreadCount = logic.liveCardData?.unreadCount || card?.unreadCount || 0;

        if (!cardId || !groupId || !uid || !entity || unreadCount === 0) return;

        const cardRef = doc(db, `users/${uid}/entities/${entity}/kanban-groups/${groupId}/cards/${cardId}`);
        updateDoc(cardRef, { unreadCount: 0, lastReadAt: Timestamp.now() }).catch((err: any) => {
            if (err.code !== 'not-found' && !err.message?.includes('No document')) {
                console.error("[ChatArea] Error clearing unread count:", err);
            }
        });
    }, [card?.id, card?.groupId, logic.liveCardData?.groupId, logic.liveCardData?.unreadCount, currentUser?.uid, activeEntity]);

    const [integrationStatus, setIntegrationStatus] = useState<string | null>(null);

    // Fetch current integration status
    useEffect(() => {
        if (!currentUser || !activeEntity || !card) return;
        const source = (card.channel || card.source || card.primary_channel || '').toLowerCase();
        let provider = source.includes('messenger') ? 'messenger' : 
                       source.includes('instagram') ? 'instagram' :
                       source.includes('whatsapp') ? 'whatsapp' : source;
        
        if (provider === 'whatsapp' && !integrationStatus) {
            // Check both possible WhatsApp IDs
            const integrationsRef = collection(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations`);
            const unsubscribe = onSnapshot(integrationsRef, (snapshot) => {
                const wa = snapshot.docs.find(d => d.id === 'whatsapp' || d.id === 'whatsapp_internal');
                if (wa) setIntegrationStatus(wa.data().status);
            });
            return () => unsubscribe();
        } else if (provider) {
            const integrationRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/integrations/${provider}`);
            const unsubscribe = onSnapshot(integrationRef, (docSnap) => {
                if (docSnap.exists()) {
                    setIntegrationStatus(docSnap.data().status);
                }
            });
            return () => unsubscribe();
        }
    }, [card?.id, currentUser?.uid, activeEntity]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (logic.messagesEndRef.current) {
            logic.messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [card?.id, logic.liveCardData?.messages?.length]);

    const liveCard = logic.liveCardData || card;
    const { whatsappName, botName } = getContactHeaderNames(liveCard);
    const contactName = whatsappName;
    const displayInitial = (botName || whatsappName).charAt(0).toUpperCase();

    const phoneDisplay = useMemo(
        () => getContactPhoneDisplay(liveCard),
        [
            liveCard?.contactNumber,
            liveCard?.contactNumberClean,
            liveCard?.phone,
            liveCard?.channel,
            liveCard?.source,
            liveCard?.primary_channel,
        ]
    );

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

    const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith('image/'));

        if (!imageItem) return;

        const file = imageItem.getAsFile();
        if (!file) return;

        event.preventDefault();

        if (logic.filePreviewUrl) {
            URL.revokeObjectURL(logic.filePreviewUrl);
        }

        logic.setSelectedFile(file);
        logic.setFilePreviewUrl(URL.createObjectURL(file));
    };

    const getMessageAttachment = (msg: any) => {
        const metadata = msg?.metadata || {};
        const attachments = Array.isArray(metadata.attachments) ? metadata.attachments : [];
        const firstAttachment = attachments[0] || null;

        const fileUrl =
            msg?.fileUrl ||
            msg?.attachmentUrl ||
            msg?.mediaUrl ||
            msg?.url ||
            metadata?.url ||
            metadata?.fileUrl ||
            firstAttachment?.url ||
            firstAttachment?.payload?.url ||
            null;

        const rawType =
            msg?.fileType ||
            msg?.type ||
            metadata?.mimeType ||
            metadata?.fileType ||
            firstAttachment?.mimeType ||
            firstAttachment?.type ||
            '';

        const normalizedType =
            rawType?.startsWith?.('image/') ? rawType :
            rawType === 'image' ? 'image/*' :
            rawType === 'video' ? 'video/*' :
            rawType === 'audio' ? 'audio/*' :
            rawType === 'file' || rawType === 'document' ? 'application/octet-stream' :
            rawType || '';

        const fileName =
            msg?.fileName ||
            metadata?.filename ||
            metadata?.fileName ||
            firstAttachment?.name ||
            (normalizedType.startsWith('image/') ? 'Imagen' : 'Archivo');

        return {
            fileUrl,
            fileType: normalizedType,
            fileName
        };
    };

    const source = (card.channel || card.source || card.primary_channel || '').toLowerCase();

    return (
        <div className="flex-1 flex flex-col h-full relative">

            {/* Header */}
            <div className="min-h-14 py-2.5 border-b border-neutral-800 bg-[#111] flex items-center justify-between px-3 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="md:hidden p-2 -ml-1 text-blue-500 hover:bg-blue-500/10 rounded-full transition-all active:scale-90 flex-shrink-0"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-white text-[13px] shadow-sm flex-shrink-0">
                        {displayInitial}
                    </div>
                    <div className="min-w-0 flex flex-col gap-1">
                        <div className="flex items-baseline gap-x-2 gap-y-0.5 min-w-0 flex-wrap">
                            <h2 className="font-semibold text-white tracking-tight text-[15px] leading-tight truncate">
                                {whatsappName}
                            </h2>
                            <span className="text-neutral-600 text-[12px] leading-none flex-shrink-0">|</span>
                            {botName ? (
                                <span
                                    className="text-[14px] text-sky-300/95 font-medium leading-tight truncate"
                                    title="Nombre indicado en la conversación"
                                >
                                    {botName}
                                </span>
                            ) : (
                                <span className="text-[13px] text-neutral-500 italic leading-tight truncate">
                                    En espera del nombre
                                </span>
                            )}
                        </div>

                        {phoneDisplay ? (
                            <div className="flex items-center gap-1.5 min-w-0 text-[11px] leading-none">
                                <CountryFlag iso={phoneDisplay.iso} country={phoneDisplay.country} size="sm" />
                                <span className="text-neutral-300 truncate">{phoneDisplay.country}</span>
                                <span className="text-neutral-600 flex-shrink-0">·</span>
                                <span className="text-neutral-500 font-mono truncate">{phoneDisplay.formatted}</span>
                            </div>
                        ) : null}

                        {(liveCard?.presence === 'typing' || liveCard?.presence === 'recording') && (
                            <div className="flex items-center text-[10px] text-blue-400 min-h-[14px]">
                                {liveCard?.presence === 'typing' ? (
                                    <span className="italic animate-pulse font-medium">Escribiendo...</span>
                                ) : (
                                    <span className="italic animate-pulse font-medium flex items-center gap-1">
                                        <Mic size={10} /> Grabando audio...
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-1 text-neutral-500">
                    <button className="p-1.5 hover:bg-neutral-800 rounded transition-colors" title="Mark as Unread">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </button>
                    <div className="relative" ref={moreMenuRef}>
                        <button
                            onClick={() => setShowMoreMenu(!showMoreMenu)}
                            className={`p-2 transition-colors rounded-md ${showMoreMenu ? 'text-white bg-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                            title="More Actions"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {/* More Menu Popover */}
                        {showMoreMenu && (
                            <div className="absolute top-full right-0 mt-2 w-52 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-1">
                                    <button
                                        className="w-full flex items-center px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors rounded-md group text-left"
                                        onClick={handleCloseConversation}
                                    >
                                        <XCircle size={14} className="mr-3 text-neutral-500 group-hover:text-yellow-500" />
                                        Finalizar Conversación
                                    </button>
                                    <button
                                        className={`w-full flex items-center px-3 py-2.5 text-xs transition-colors rounded-md group text-left ${logic.liveCardData?.isBlocked ? 'text-green-400 hover:bg-green-500/10' : 'text-red-400 hover:bg-red-500/10'}`}
                                        onClick={handleBlockContact}
                                    >
                                        <Ban size={14} className={`mr-3 group-hover:text-current ${logic.liveCardData?.isBlocked ? 'text-green-500' : 'text-red-500'}`} />
                                        {logic.liveCardData?.isBlocked ? 'Desbloquear Contacto' : 'Bloquear Contacto'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Connectivity Status Banner */}
            {integrationStatus && integrationStatus !== 'Connected' && integrationStatus !== 'Internal' && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between group animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={14} className="text-amber-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">
                            Conexión Recalibrándose — El canal podría estar offline
                        </span>
                    </div>
                    <button 
                        onClick={() => window.open(`/nucleo/${activeEntity}/cto/integrations`, '_blank')}
                        className="text-[9px] font-black underline uppercase text-amber-500 hover:text-amber-400 transition-colors"
                    >
                        Ver Integraciones <ExternalLink size={10} className="inline ml-1" />
                    </button>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a] space-y-3 no-scrollbar">
                {Object.entries(logic.groupedMessages).map(([date, msgs], dateIdx) => (
                    <React.Fragment key={date}>
                        <div className="text-center text-[10px] text-neutral-600 my-4 uppercase tracking-widest font-bold opacity-60">{date}</div>

                        {(msgs as any[]).map((msg: any, msgIdx: number) => {
                            const prevMsg = (msgs as any[])[msgIdx - 1];
                            const EXPIRE_THRESHOLD = 48 * 60 * 60 * 1000; // 48 hours
                            const attachment = getMessageAttachment(msg);
                            const isAgentButtons = msg.sender === 'agent' && (msg.type === 'buttons' || msg.type === 'quick_reply');
                            const isAgentList = msg.sender === 'agent' && msg.type === 'list';
                            const isAgentMedia = msg.sender === 'agent' && (
                                msg.type === 'media' ||
                                msg.type === 'image' ||
                                msg.type === 'video' ||
                                msg.type === 'audio' ||
                                msg.type === 'document'
                            );
                            const shouldRenderPlainText = !!msg.text && !isAgentButtons && !isAgentList && !isAgentMedia;

                            const showGapMarker = prevMsg && msg.timestamp?.toDate && prevMsg.timestamp?.toDate &&
                                (msg.timestamp.toDate().getTime() - prevMsg.timestamp.toDate().getTime() > EXPIRE_THRESHOLD);

                            const isEmail = source.includes('gmail');

                            return (
                                <React.Fragment key={msgIdx}>
                                    {showGapMarker && (
                                        <div className="flex justify-center my-6">
                                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest shadow-lg backdrop-blur-sm">
                                                No hubo respuesta y terminó la conversación
                                            </div>
                                        </div>
                                    )}
                                    <div className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'} mb-1`}>
                                        {msg.sender !== 'agent' && (
                                            <div className="w-8 h-8 rounded-full bg-neutral-800 mr-2 flex-shrink-0 self-end mb-1 flex items-center justify-center text-[11px] font-bold text-neutral-400 border border-white/5 shadow-inner">
                                                {contactName.charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        <div className={`${isEmail ? 'max-w-[90%]' : 'max-w-[75%]'} group ${msg.sender === 'agent' ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
                                            
                                            {/* Specialized Email Card Design (Incoming & Outgoing) */}
                                            {isEmail || (msg.platform === 'gmail' || msg.metadata?.platform === 'gmail') ? (
                                                <div className={`${msg.sender === 'agent' ? 'bg-[#121212] border-blue-500/20 shadow-blue-900/10' : 'bg-[#181818] border-white/10 shadow-2xl'} border rounded-2xl overflow-hidden w-full transition-all hover:border-white/20`}>
                                                    {/* Email Header */}
                                                    <div className={`${msg.sender === 'agent' ? 'bg-blue-600/10 border-blue-500/10' : 'bg-white/[0.03] border-white/5'} border-b px-4 py-2.5 flex items-center justify-between`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${msg.sender === 'agent' ? 'bg-blue-500/20 border-blue-400/30' : 'bg-red-500/10 border-red-500/20'}`}>
                                                                <Mail size={12} className={msg.sender === 'agent' ? 'text-blue-400' : 'text-red-500'} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${msg.sender === 'agent' ? 'text-blue-400' : 'text-neutral-500'}`}>
                                                                    {msg.sender === 'agent' ? 'Outgoing Email' : 'Incoming Email'}
                                                                </span>
                                                                <span className="text-white text-[12px] font-bold truncate max-w-[200px] sm:max-w-[400px]">
                                                                    {msg.subject || msg.metadata?.subject || msg.text?.split(' -- ')[0] || 'Sin Asunto'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] text-neutral-500 font-medium">
                                                            #{msg.metadata?.threadId?.slice(-6) || msg.whatsappMessageId?.slice(-6) || 'N/A'}
                                                        </div>
                                                    </div>

                                                    {/* Email Content */}
                                                    <div className="p-5">
                                                        {attachment.fileUrl && (
                                                            <div className="mb-4">
                                                                {attachment.fileType?.startsWith('image/') ? (
                                                                    <img src={attachment.fileUrl} alt={attachment.fileName} className="max-w-full rounded-xl border border-white/10 shadow-lg" />
                                                                ) : (
                                                                    <a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                                                                        <FileText size={16} className="text-blue-400" />
                                                                        <span className="text-xs text-white/80 font-medium">{attachment.fileName || 'Descargar Adjunto'}</span>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-[14px] text-neutral-300 leading-relaxed whitespace-pre-wrap font-light">
                                                            {msg.text?.includes(' -- ') && msg.sender !== 'agent' ? msg.text.split(' -- ').slice(1).join(' -- ') : msg.text}
                                                        </p>
                                                    </div>

                                                    {/* Footer / Meta */}
                                                    <div className="bg-black/20 px-4 py-2 flex items-center gap-4 text-[9px] font-bold text-neutral-600 border-t border-white/5">
                                                        <span className="flex items-center gap-1 font-medium">
                                                            {msg.sender === 'agent' ? <Zap size={10} className="text-blue-500" /> : <User size={10} className="text-neutral-500" />} 
                                                            {msg.sender === 'agent' ? 'Tú (Agente)' : (msg.metadata?.from || contactName)}
                                                        </span>
                                                        <span className="opacity-40">|</span>
                                                        <span>{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Ahora'}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Standard Chat Bubble for other platforms or agent replies (e.g. WhatsApp, etc.) */
                                                <div className={`px-3.5 py-2 rounded-2xl relative ${msg.sender === 'agent'
                                                    ? 'bg-blue-600 text-white rounded-br-none shadow-lg'
                                                    : 'bg-[#1e1e1e] text-neutral-200 rounded-bl-none shadow-sm shadow-black/50'
                                                    }`}>

                                                    {/* File Support */}
                                                    {attachment.fileUrl && !isAgentMedia && (
                                                        <div className="mb-2">
                                                            {attachment.fileType?.startsWith('image/') ? (
                                                                <img src={attachment.fileUrl} alt={attachment.fileName} className="max-w-full rounded-xl max-h-52 border border-white/10" />
                                                            ) : (
                                                                <a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline text-[11px] opacity-80 hover:opacity-100 bg-black/20 p-2 rounded-lg">
                                                                    <FileText size={14} className="text-blue-400" /> {attachment.fileName || 'Archivo'}
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Interactive Content */}
                                                    {isAgentButtons && (
                                                        <div className="mb-2 space-y-2 min-w-[200px]">
                                                            {msg.metadata?.header && msg.metadata.header.type !== 'none' && (
                                                                <div className="mb-2 pb-2 border-b border-white/10">
                                                                    {msg.metadata.header.type === 'text' && <div className="font-bold text-[11px] uppercase tracking-wide opacity-80">{msg.metadata.header.text}</div>}
                                                                    {msg.metadata.header.type === 'image' && msg.metadata.header.url && <img src={msg.metadata.header.url} alt="header" className="rounded-lg w-full max-h-32 object-cover" />}
                                                                </div>
                                                            )}
                                                            {msg.text && <p className="text-[13px] leading-snug whitespace-pre-wrap mb-2 font-medium">{msg.text}</p>}
                                                            <div className="flex flex-col gap-1.5 pt-1">
                                                                {(msg.metadata?.buttons || msg.buttons || []).map((btn: any, idx: number) => (
                                                                    <div key={idx} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 flex items-center justify-between text-[11px] font-bold shadow-sm hover:bg-white/20 transition-colors cursor-default group/btn">
                                                                        {btn.text || btn.reply?.title || btn.title || btn}
                                                                        <MousePointer2 size={10} className="text-blue-200 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isAgentList && (
                                                        <div className="mb-1 min-w-[200px]">
                                                            {msg.text && <p className="text-[13px] leading-snug whitespace-pre-wrap mb-3 font-medium">{msg.text}</p>}
                                                            <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
                                                                <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 transition-colors cursor-pointer group/list">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                                                                            <List size={14} className="text-blue-400" />
                                                                        </div>
                                                                        <span className="text-[12px] font-bold tracking-tight text-white/90">{msg.metadata?.buttonText || 'Ver opciones'}</span>
                                                                    </div>
                                                                    <ExternalLink size={12} className="text-neutral-500 group-hover/list:text-blue-400 transition-colors" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {shouldRenderPlainText && <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap font-normal selection:bg-blue-400/30">{msg.text}</p>}

                                                    {isAgentMedia && (
                                                        <div className="mb-1 min-w-[200px]">
                                                            {attachment.fileUrl && (
                                                                attachment.fileType?.startsWith('image/') ? (
                                                                    <div className="mb-2 relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 shadow-lg">
                                                                        <img src={attachment.fileUrl} alt={attachment.fileName || 'media'} className="w-full max-h-64 object-cover transition-transform duration-500 group-hover:scale-110" />
                                                                    </div>
                                                                ) : (
                                                                    <a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline text-[11px] opacity-80 hover:opacity-100 bg-black/20 p-2 rounded-lg mb-2">
                                                                        <FileText size={14} className="text-blue-400" /> {attachment.fileName || 'Archivo'}
                                                                    </a>
                                                                )
                                                            )}
                                                            {msg.text && <p className="text-[13px] leading-snug whitespace-pre-wrap font-medium">{msg.text}</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Status and Time Under the bubble/card */}
                                            <div className="flex items-center mt-1 text-[9px] text-neutral-600 px-1 font-bold">
                                                <span>{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                {msg.sender === 'agent' && (
                                                    msg.status === 'sending' ? (
                                                        <Loader2 size={10} className="ml-1 animate-spin text-neutral-500" />
                                                    ) : msg.status === 'failed' ? (
                                                        <div
                                                            className="ml-2 flex items-center gap-1 bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded cursor-pointer hover:bg-red-500/20 transition-colors border border-red-500/20"
                                                            onClick={(e) => { e.stopPropagation(); logic.retryMessage?.(msg); }}
                                                        >
                                                            <AlertCircle size={10} />
                                                            <span className="text-[8px] font-black uppercase tracking-tighter">Error</span>
                                                            <RefreshCw size={10} className="ml-0.5" />
                                                        </div>
                                                    ) : (
                                                        <span className={`ml-1 flex items-center ${msg.status === 'read' ? 'text-blue-400' : 'text-neutral-600'}`}>
                                                            {msg.status === 'sent' && <span>✓</span>}
                                                            {(msg.status === 'delivered' || msg.status === 'read' || !msg.status) && <span>✓✓</span>}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {msg.sender === 'agent' && (
                                            <div className="w-6 h-6 rounded-full bg-neutral-800 ml-2 flex-shrink-0 self-end mb-1 ring-1 ring-neutral-700/50 flex items-center justify-center text-neutral-500">
                                                <User size={14} />
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </React.Fragment>
                ))}
                
                <div ref={logic.messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#111] border-t border-neutral-800 flex-shrink-0 relative">
                {/* File Preview Overlay */}
                {logic.filePreviewUrl && (
                    <div className="absolute bottom-full left-4 mb-4 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-3 z-50 w-72 animate-in fade-in slide-in-from-bottom-4">
                        <div className="relative">
                            {logic.selectedFile?.type.startsWith('image/') ? (
                                <img src={logic.filePreviewUrl} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                            ) : (
                                <div className="w-full h-20 bg-neutral-800 rounded-xl flex items-center justify-center gap-3 px-4">
                                    <FileText className="text-blue-500" size={24} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{logic.selectedFile?.name}</div>
                                        <div className="text-[10px] text-neutral-500">{(logic.selectedFile?.size || 0) / 1024 > 1024 ? `${((logic.selectedFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB` : `${((logic.selectedFile?.size || 0) / 1024).toFixed(1)} KB`}</div>
                                    </div>
                                </div>
                            )}
                            <button onClick={logic.handleCancelPreview} className="absolute -top-2 -right-2 bg-neutral-950 text-white rounded-full p-1 border border-neutral-800 hover:bg-red-500 transition-colors"><X className="w-3 h-3" /></button>
                        </div>
                        {logic.uploading && (
                            <div className="mt-3 space-y-1.5">
                                <div className="flex justify-between text-[8px] font-black text-neutral-500 uppercase tracking-widest px-1"><span>Subiendo...</span><span>{logic.progress}%</span></div>
                                <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-600 h-full transition-all" style={{ width: `${logic.progress}%` }} /></div>
                            </div>
                        )}
                        {!logic.uploading && <Button size="sm" className="w-full mt-3 h-8 bg-blue-600 hover:bg-blue-700 text-[10px] font-black uppercase tracking-widest rounded-lg" onClick={logic.handleDisplayFileSend}>Enviar Archivo</Button>}
                    </div>
                )}

                {/* Quick Replies */}
                {showQuickReplies && (
                    <div className="absolute bottom-full left-4 mb-2 w-64 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 py-1">
                        {QUICK_REPLIES.map(reply => (
                            <button key={reply.id} onClick={() => handleSelectQuickReply(reply.text)} className="w-full text-left px-4 py-2.5 hover:bg-neutral-800 transition-colors group">
                                <div className="text-[11px] font-bold text-blue-400 mb-0.5">{reply.label}</div>
                                <div className="text-[11px] text-neutral-400 group-hover:text-neutral-200 truncate">{reply.text}</div>
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-end bg-neutral-900 border border-neutral-800 rounded-xl flex-shrink-0 relative focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
                    {logic.liveCardData?.isBlocked && (
                        <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-[2px] z-20 flex items-center justify-center gap-3 rounded-lg animate-in fade-in">
                            <Ban size={14} className="text-red-500" />
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Contacto Bloqueado</span>
                            <button onClick={logic.handleToggleBlock} className="text-blue-500 hover:text-blue-400 text-[10px] font-black uppercase tracking-widest border-b border-blue-500/30">Desbloquear</button>
                        </div>
                    )}

                    <button disabled={logic.liveCardData?.isBlocked} onClick={() => setShowQuickReplies(!showQuickReplies)} className={`p-3 ${showQuickReplies ? 'text-blue-500' : 'text-neutral-400 hover:text-white'}`}><Zap size={18} fill={showQuickReplies ? 'currentColor' : 'none'} /></button>
                    
                    <div className="relative" ref={attachmentsRef}>
                        <button disabled={logic.liveCardData?.isBlocked} onClick={() => setShowAttachments(!showAttachments)} className={`p-3 ${showAttachments ? 'text-blue-500' : 'text-neutral-400 hover:text-white'}`}><Plus size={20} className={showAttachments ? 'rotate-45 transition-transform' : 'transition-transform'} /></button>
                        {showAttachments && (
                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                <button onClick={() => { logic.open(); setShowAttachments(false); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-neutral-800 text-neutral-300 hover:text-white text-[11px] font-bold transition-colors">
                                    <ImageIcon size={14} className="text-blue-400" /> <span>Fotos y Videos</span>
                                </button>
                                <button onClick={() => { logic.open(); setShowAttachments(false); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-neutral-800 text-neutral-300 hover:text-white text-[11px] font-bold transition-colors">
                                    <FileText size={14} className="text-purple-400" /> <span>Documento</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col min-w-0">
                        {logic.activePlatform === 'Gmail' && (
                            <div className="mx-2 mt-1 mb-1 px-3 py-2 bg-white/5 rounded-xl border border-white/5 animate-in slide-in-from-bottom-2 fade-in duration-500">
                                <div className="flex items-center gap-3 border-b border-white/5 pb-2 mb-2">
                                    <div className="flex items-center gap-1.5 min-w-[60px]">
                                        <Mail size={12} className="text-blue-400/70" />
                                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Asunto</span>
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Escribe el título del correo..."
                                        className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-white text-[12px] font-bold placeholder:text-neutral-700"
                                        value={logic.gmailSubject || ''}
                                        onChange={(e) => logic.setGmailSubject?.(e.target.value)}
                                    />
                                </div>
                                <textarea
                                    disabled={logic.liveCardData?.isBlocked}
                                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-white py-1 resize-none max-h-48 min-h-[80px] text-[13px] placeholder:text-neutral-600 leading-relaxed"
                                    placeholder="Redacta el contenido del correo aquí..."
                                    value={logic.newMessage}
                                    onChange={(e) => logic.setNewMessage(e.target.value)}
                                    onPaste={handlePaste}
                                />
                            </div>
                        )}
                        
                        {logic.activePlatform !== 'Gmail' && (
                            <textarea
                                disabled={logic.liveCardData?.isBlocked}
                                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-white py-3 px-3 resize-none max-h-32 min-h-[44px] text-[13.5px] placeholder:text-neutral-600"
                                placeholder={logic.liveCardData?.isBlocked ? "Bloqueado" : "Escribe un mensaje..."}
                                rows={1}
                                value={logic.newMessage}
                                onChange={(e) => logic.setNewMessage(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); logic.handleSendMessage(); } }}
                                onPaste={handlePaste}
                            />
                        )}
                    </div>

                    <div className="flex items-center px-3 pb-2.5 h-[44px]">
                        <input {...logic.getInputProps()} />
                        {isRecording ? (
                            <div className="flex items-center gap-2">
                                <button onClick={cancelRecording} className="p-1.5 text-neutral-500 hover:text-red-400"><X size={16} /></button>
                                <button onClick={stopRecording} className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all scale-110"><Send size={14} className="translate-x-[1px]" /></button>
                            </div>
                        ) : (
                            <button
                                onClick={logic.newMessage.trim() ? logic.handleSendMessage : startRecording}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${logic.newMessage.trim() ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 scale-105' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                            >
                                {logic.isSending ? <Loader2 size={14} className="animate-spin" /> : logic.newMessage.trim() ? <Send size={14} className="translate-x-[1px]" /> : <Mic size={16} />}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center mt-2.5 px-1.5 text-[10px] font-black text-neutral-600 uppercase tracking-[0.1em]">
                    <span>Shift + Enter para nueva línea</span>
                    <div className="flex gap-4">
                        <span className="hover:text-neutral-400 cursor-pointer transition-colors">Nota Privada</span>
                        <span className="text-blue-600 hover:text-blue-400 cursor-pointer transition-colors">Responder</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
