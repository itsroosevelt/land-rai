'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    ChevronUp,
    ChevronDown,
    Paperclip,
    FolderGit2,
    MoreHorizontal,
    ChevronRight,
    Image as ImageIcon,
    Smile,
    Code2,
    BookOpen,
    Video,
    Music,
    Palette,
    X,
    Loader2,
    Sparkles,
    Send,
    Bot,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export function AskRooseveltBar() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showMoreUploads, setShowMoreUploads] = useState(false);
    const [selectedModel, setSelectedModel] = useState<'Flash' | 'Pro' | 'Orchestrator'>('Flash');
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showChatWindow, setShowChatWindow] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Focus input on expand
    useEffect(() => {
        if (isExpanded) {
            setTimeout(() => inputRef.current?.focus(), 250);
        }
    }, [isExpanded]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
                setShowMoreUploads(false);
                setIsModelMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSendPrompt = async () => {
        const trimmed = prompt.trim();
        if (!trimmed || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: trimmed,
        };

        setMessages((prev) => [...prev, userMsg]);
        setPrompt('');
        setIsLoading(true);
        setShowChatWindow(true);

        try {
            const res = await fetch('/api/roosevelt/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmed,
                    model: selectedModel.toLowerCase(),
                    history: messages.slice(-4),
                }),
            });

            const data = await res.json();
            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.reply || 'Disculpa, no pude procesar la respuesta en este momento.',
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch (error) {
            console.error('Error in Roosevelt AI request:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Ocurrió un error al contactar a Roosevelt AI. Intenta de nuevo.',
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendPrompt();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            toast.success(`Archivo seleccionado: ${file.name}`);
            setPrompt((prev) => (prev ? `${prev} [Archivo: ${file.name}]` : `Analiza el archivo ${file.name}: `));
            setIsMenuOpen(false);
            inputRef.current?.focus();
        }
    };

    return (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center select-none" ref={menuRef}>
            {/* 1. Chat Response Card (Floats above the bar) */}
            <AnimatePresence>
                {showChatWindow && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.96 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="mb-3 w-[92vw] max-w-2xl bg-[#131415]/95 backdrop-blur-3xl border border-white/15 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-5 text-white overflow-hidden flex flex-col max-h-[480px]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-[linear-gradient(90deg,#387BFF_0%,#0038FF_50%,#1E3EAF_100%)] shadow-[0_0_12px_rgba(56,123,255,0.7)] flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <span className="text-xs font-semibold tracking-wide block">Roosevelt AI Copilot</span>
                                    <span className="text-[10px] text-white/50 block font-normal leading-tight">
                                        Modo: {selectedModel} · Plataforma Roosevelt
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setMessages([])}
                                    className="text-[10px] text-white/50 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    Limpiar
                                </button>
                                <button
                                    onClick={() => setShowChatWindow(false)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                            {messages.map((m) => (
                                <div
                                    key={m.id}
                                    className={cn(
                                        'flex flex-col',
                                        m.role === 'user' ? 'items-end' : 'items-start'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'px-4 py-2.5 rounded-2xl text-xs sm:text-sm max-w-[85%] leading-relaxed',
                                            m.role === 'user'
                                                ? 'bg-blue-600/30 border border-blue-500/30 text-white rounded-tr-none'
                                                : 'bg-white/[0.06] border border-white/10 text-white/90 rounded-tl-none whitespace-pre-wrap'
                                        )}
                                    >
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex items-center gap-2 text-xs text-cyan-400 bg-white/[0.04] border border-white/10 px-3.5 py-2.5 rounded-2xl w-fit">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Roosevelt está pensando...</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 2. Collapsed State: Chevron Up Trigger Button */}
            {!isExpanded && (
                <motion.button
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsExpanded(true)}
                    className="flex items-center gap-2.5 px-4.5 py-2.5 rounded-full bg-[#1A1B1C]/90 hover:bg-[#242527]/95 text-white/80 hover:text-white border border-white/15 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-xs font-medium transition-all group cursor-pointer"
                    title="Abrir Roosevelt AI"
                >
                    <ChevronUp className="w-4 h-4 text-cyan-400 group-hover:-translate-y-0.5 transition-transform" />
                    <span className="font-semibold tracking-wide text-white/90">Ask Roosevelt</span>
                    <span className="w-2 h-2 rounded-full bg-[linear-gradient(90deg,#387BFF_0%,#0038FF_50%,#1E3EAF_100%)] shadow-[0_0_10px_rgba(56,123,255,0.8)] animate-pulse" />
                </motion.button>
            )}

            {/* 3. Expanded State: Gemini-Style Floating Pill Bar */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ y: 50, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 50, opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className="relative w-[92vw] max-w-2xl h-14 bg-[#1E1F20]/95 hover:bg-[#232426]/95 border border-white/15 backdrop-blur-3xl rounded-full shadow-[0_15px_50px_rgba(0,0,0,0.9)] flex items-center px-3.5 gap-2 transition-all"
                    >
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {/* Left Action Button (+) */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMenuOpen(!isMenuOpen);
                                    setShowMoreUploads(false);
                                    setIsModelMenuOpen(false);
                                }}
                                className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-90',
                                    isMenuOpen && 'bg-white/15 text-white rotate-45'
                                )}
                                title="Añadir o crear"
                            >
                                <Plus className="w-5 h-5 transition-transform duration-200" />
                            </button>

                            {/* Gemini Style Popover Menu (Image 2 Replica) */}
                            <AnimatePresence>
                                {isMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.16 }}
                                        className="absolute bottom-12 left-0 w-60 bg-[#1E1F20]/98 border border-white/15 backdrop-blur-3xl rounded-2xl shadow-2xl p-1.5 z-[60] overflow-visible"
                                    >
                                        <div className="space-y-0.5">
                                            {/* Upload files */}
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-normal text-white/90 hover:text-white hover:bg-white/10 transition-colors text-left"
                                            >
                                                <Paperclip className="w-4 h-4 text-white/70" />
                                                <span>Upload files</span>
                                            </button>

                                            {/* Add from Drive */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    toast.info('Google Drive: Conexión lista en Roosevelt Integraciones.');
                                                    setIsMenuOpen(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-normal text-white/90 hover:text-white hover:bg-white/10 transition-colors text-left"
                                            >
                                                <FolderGit2 className="w-4 h-4 text-white/70" />
                                                <span>Add from Drive</span>
                                            </button>

                                            {/* More uploads > */}
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMoreUploads(!showMoreUploads)}
                                                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-normal text-white/90 hover:text-white hover:bg-white/10 transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <MoreHorizontal className="w-4 h-4 text-white/70" />
                                                        <span>More uploads</span>
                                                    </div>
                                                    <ChevronRight className={cn("w-3.5 h-3.5 text-white/40 transition-transform", showMoreUploads && "rotate-90 sm:rotate-0")} />
                                                </button>

                                                {/* Nested submenu */}
                                                <AnimatePresence>
                                                    {showMoreUploads && (
                                                        <motion.div
                                                            initial={{ opacity: 0, x: 8 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: 8 }}
                                                            className="sm:absolute sm:left-full sm:bottom-0 sm:ml-2 mt-1 sm:mt-0 w-48 bg-[#1E1F20]/98 border border-white/15 backdrop-blur-3xl rounded-2xl shadow-2xl p-1.5 z-[70] space-y-0.5"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => { fileInputRef.current?.click(); }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors text-left"
                                                            >
                                                                <ImageIcon className="w-4 h-4 text-white/70" />
                                                                <span>Photos</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPrompt('Generar o actualizar Avatar de la entidad: ');
                                                                    setIsMenuOpen(false);
                                                                    inputRef.current?.focus();
                                                                }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors text-left"
                                                            >
                                                                <Smile className="w-4 h-4 text-white/70" />
                                                                <span>Avatar</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPrompt('Revisa e importa este código: ');
                                                                    setIsMenuOpen(false);
                                                                    inputRef.current?.focus();
                                                                }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors text-left"
                                                            >
                                                                <Code2 className="w-4 h-4 text-white/70" />
                                                                <span>Import code</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPrompt('Crear nota en Notebook: ');
                                                                    setIsMenuOpen(false);
                                                                    inputRef.current?.focus();
                                                                }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors text-left"
                                                            >
                                                                <BookOpen className="w-4 h-4 text-white/70" />
                                                                <span>Notebooks</span>
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Divider */}
                                            <div className="h-px bg-white/10 my-1" />

                                            {/* Create image (with blue dot indicator) */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPrompt('Crea una imagen de: ');
                                                    setIsMenuOpen(false);
                                                    inputRef.current?.focus();
                                                }}
                                                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-normal text-white/90 hover:text-white hover:bg-white/10 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Palette className="w-4 h-4 text-white/70" />
                                                    <span>Create image</span>
                                                </div>
                                                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                            </button>

                                            {/* Create video */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPrompt('Generar video conceptual para: ');
                                                    setIsMenuOpen(false);
                                                    inputRef.current?.focus();
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-normal text-white/90 hover:text-white hover:bg-white/10 transition-colors text-left"
                                            >
                                                <Video className="w-4 h-4 text-white/70" />
                                                <span>Create video</span>
                                            </button>

                                            {/* Create music */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPrompt('Componer música de fondo para: ');
                                                    setIsMenuOpen(false);
                                                    inputRef.current?.focus();
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-normal text-white/90 hover:text-white hover:bg-white/10 transition-colors text-left"
                                            >
                                                <Music className="w-4 h-4 text-white/70" />
                                                <span>Create music</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Central Text Input ("Ask Roosevelt") */}
                        <input
                            ref={inputRef}
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask Roosevelt"
                            className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm text-white placeholder:text-white/45 font-normal px-2 selection:bg-blue-600/30"
                        />

                        {/* Right Section: Model Selector Dropdown ("Flash ⌵") */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10 text-xs font-medium text-white/80 hover:text-white transition-all"
                            >
                                <span>{selectedModel}</span>
                                <ChevronDown className="w-3.5 h-3.5 text-white/50" />
                            </button>

                            <AnimatePresence>
                                {isModelMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute bottom-11 right-0 w-36 bg-[#1E1F20]/98 border border-white/15 backdrop-blur-2xl rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5"
                                    >
                                        {(['Flash', 'Pro', 'Orchestrator'] as const).map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedModel(m);
                                                    setIsModelMenuOpen(false);
                                                }}
                                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                                            >
                                                <span>{m}</span>
                                                {selectedModel === m && <Check className="w-3 h-3 text-cyan-400" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* The Circle Button (Identical to workspace/page.tsx:840) */}
                        <button
                            type="button"
                            onClick={handleSendPrompt}
                            disabled={isLoading}
                            className={cn(
                                "w-9 h-9 rounded-full shadow-[0_0_20px_rgba(29,78,216,0.7)] transition-all duration-300 bg-[linear-gradient(90deg,#387BFF_0%,#0038FF_50%,#1E3EAF_100%)] hover:scale-110 hover:brightness-110 active:scale-95 shrink-0 border-0 outline-none cursor-pointer flex items-center justify-center relative group",
                                isLoading && "animate-pulse ring-2 ring-blue-400"
                            )}
                            title={isLoading ? "Pensando..." : "Enviar a Roosevelt AI"}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                            ) : (
                                <span className="w-2.5 h-2.5 rounded-full bg-white/90 shadow-[0_0_6px_white] group-hover:scale-125 transition-transform" />
                            )}
                        </button>

                        {/* Minimize Button (Chevron Down) */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsExpanded(false);
                                setIsMenuOpen(false);
                                setIsModelMenuOpen(false);
                            }}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors ml-0.5"
                            title="Ocultar barra"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
