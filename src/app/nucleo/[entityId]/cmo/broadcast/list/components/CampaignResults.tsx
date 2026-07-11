"use client";

import React, { useMemo, useState } from "react";
import {
    X,
    Send,
    Loader2,
    CheckCheck,
    Check,
    Clock,
    AlertTriangle,
    MessageSquareReply,
    Search,
    Users,
    TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Broadcast, BroadcastRecipient, RecipientStatus } from "../lib/types";

interface CampaignResultsProps {
    broadcast: Broadcast;
    recipients: BroadcastRecipient[];
    userId: string | undefined;
    entityId: string;
    onClose: () => void;
}

const statusMeta: Record<
    RecipientStatus,
    { label: string; className: string; icon: React.ReactNode }
> = {
    pending: {
        label: "Pendiente",
        className: "bg-neutral-800 text-neutral-300 border-neutral-700",
        icon: <Clock className="w-3 h-3" />,
    },
    sent: {
        label: "Enviado",
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        icon: <Check className="w-3 h-3" />,
    },
    delivered: {
        label: "Entregado",
        className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        icon: <CheckCheck className="w-3 h-3" />,
    },
    read: {
        label: "Leído",
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        icon: <CheckCheck className="w-3 h-3" />,
    },
    replied: {
        label: "Respondió",
        className: "bg-green-500/15 text-green-400 border-green-500/30",
        icon: <MessageSquareReply className="w-3 h-3" />,
    },
    failed: {
        label: "Falló",
        className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        icon: <AlertTriangle className="w-3 h-3" />,
    },
};

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="flex flex-col items-center justify-center py-3 px-2 bg-[#13151a]/60 border border-white/5 rounded-xl">
        <span className={cn("text-xl font-semibold", color)}>{value}</span>
        <span className="text-[9px] text-neutral-500 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
);

export default function CampaignResults({
    broadcast,
    recipients,
    userId,
    entityId,
    onClose,
}: CampaignResultsProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<RecipientStatus | "all">("all");
    const [replyTo, setReplyTo] = useState<BroadcastRecipient | null>(null);
    const [replyText, setReplyText] = useState("");
    const [sendingReply, setSendingReply] = useState(false);

    const stats = useMemo(() => {
        const s = {
            total: recipients.length,
            sent: 0,
            delivered: 0,
            read: 0,
            replied: 0,
            failed: 0,
            pending: 0,
        };
        recipients.forEach((r) => {
            if (r.status === "sent") s.sent++;
            else if (r.status === "delivered") s.delivered++;
            else if (r.status === "read") s.read++;
            else if (r.status === "replied") s.replied++;
            else if (r.status === "failed") s.failed++;
            else s.pending++;
        });
        return s;
    }, [recipients]);

    // Anything that left our server counts as "reached" (sent/delivered/read/replied).
    const reached = stats.sent + stats.delivered + stats.read + stats.replied;
    const responseRate = reached > 0 ? Math.round((stats.replied / reached) * 100) : 0;

    const filtered = useMemo(() => {
        return recipients.filter((r) => {
            const matchesStatus = statusFilter === "all" || r.status === statusFilter;
            const q = search.toLowerCase();
            const matchesSearch =
                !q ||
                (r.name || "").toLowerCase().includes(q) ||
                (r.phone || "").includes(q) ||
                (r.country || "").toLowerCase().includes(q);
            return matchesStatus && matchesSearch;
        });
    }, [recipients, search, statusFilter]);

    const handleSendReply = async () => {
        if (!replyTo || !replyText.trim()) return;
        setSendingReply(true);
        try {
            const res = await fetch("/api/whatsapp/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: replyText.trim(),
                    toNumber: replyTo.phone,
                    platform: "WhatsApp",
                    userId,
                    entityId,
                    type: "text",
                }),
            });
            const data = await res.json();
            if (res.ok && !data.error) {
                toast.success(`Mensaje enviado a ${replyTo.name}`);
                setReplyText("");
                setReplyTo(null);
            } else {
                toast.error(data.error || "No se pudo enviar el mensaje");
            }
        } catch (e: any) {
            toast.error(e.message || "Error al enviar");
        } finally {
            setSendingReply(false);
        }
    };

    const filterChips: (RecipientStatus | "all")[] = [
        "all",
        "replied",
        "read",
        "delivered",
        "sent",
        "failed",
        "pending",
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-5xl max-h-[90vh] bg-[#0c0d12] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <div>
                            <h2 className="text-sm font-semibold text-white">{broadcast.name}</h2>
                            <p className="text-[10px] text-neutral-500">
                                Resultados de la campaña · {broadcast.channel}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Stats */}
                <div className="p-4 grid grid-cols-3 sm:grid-cols-7 gap-2 shrink-0 border-b border-white/5">
                    <StatCard label="Total" value={stats.total} color="text-white" />
                    <StatCard label="Enviados" value={stats.sent} color="text-blue-400" />
                    <StatCard label="Entregados" value={stats.delivered} color="text-cyan-400" />
                    <StatCard label="Leídos" value={stats.read} color="text-emerald-400" />
                    <StatCard label="Respondieron" value={stats.replied} color="text-green-400" />
                    <StatCard label="Fallaron" value={stats.failed} color="text-rose-400" />
                    <StatCard label="% Respuesta" value={responseRate} color="text-amber-400" />
                </div>

                {/* Filters */}
                <div className="p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center shrink-0 border-b border-white/5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                        <Input
                            placeholder="Buscar por nombre, teléfono o país"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-[#13151a] border-white/5 pl-9 text-xs h-9 rounded-lg"
                        />
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                        {filterChips.map((chip) => (
                            <button
                                key={chip}
                                onClick={() => setStatusFilter(chip)}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-[10px] font-medium capitalize transition-all border",
                                    statusFilter === chip
                                        ? "bg-blue-600 text-white border-blue-500"
                                        : "bg-[#13151a] text-neutral-400 border-white/5 hover:text-white"
                                )}
                            >
                                {chip === "all" ? "Todos" : statusMeta[chip as RecipientStatus].label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recipient list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
                            <Users className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-xs">Sin destinatarios que coincidan.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-[#0c0d12] z-10">
                                <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-neutral-500">
                                    <th className="px-4 py-2 font-medium">Contacto</th>
                                    <th className="px-4 py-2 font-medium">País</th>
                                    <th className="px-4 py-2 font-medium">Teléfono</th>
                                    <th className="px-4 py-2 font-medium">Estado</th>
                                    <th className="px-4 py-2 font-medium text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs text-neutral-300">
                                {filtered.map((r) => {
                                    const meta = statusMeta[r.status] || statusMeta.pending;
                                    return (
                                        <tr key={r.id} className="hover:bg-white/[0.01]">
                                            <td className="px-4 py-2.5 font-medium text-neutral-200">{r.name}</td>
                                            <td className="px-4 py-2.5 text-neutral-400">
                                                <span className="mr-1">{r.countryFlag || "🌍"}</span>
                                                {r.country || "—"}
                                            </td>
                                            <td className="px-4 py-2.5 font-mono text-neutral-400 text-[11px]">
                                                {r.phone}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border",
                                                        meta.className
                                                    )}
                                                    title={r.error || ""}
                                                >
                                                    {meta.icon}
                                                    {meta.label}
                                                </span>
                                                {r.status === "failed" && r.error && (
                                                    <span className="block text-[9px] text-rose-400/70 mt-0.5 max-w-[200px] truncate">
                                                        {r.error}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                {r.status !== "pending" && r.status !== "failed" && (
                                                    <button
                                                        onClick={() => {
                                                            setReplyTo(r);
                                                            setReplyText("");
                                                        }}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#13151a] border border-white/5 text-[10px] text-neutral-300 hover:text-white hover:border-blue-500/50 transition-all"
                                                    >
                                                        <MessageSquareReply className="w-3 h-3" /> Responder
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Inline reply composer */}
                {replyTo && (
                    <div className="p-3 border-t border-white/5 bg-[#0b0c10] shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] text-neutral-400">
                                Responder a <b className="text-white">{replyTo.name}</b> ({replyTo.phone})
                            </span>
                            <button
                                onClick={() => setReplyTo(null)}
                                className="text-neutral-500 hover:text-white"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                autoFocus
                                placeholder="Escribe un mensaje..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                                className="flex-1 bg-[#13151a] border-white/5 text-xs h-9 rounded-lg"
                            />
                            <Button
                                onClick={handleSendReply}
                                disabled={sendingReply || !replyText.trim()}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 px-4 rounded-lg flex items-center gap-1.5"
                            >
                                {sendingReply ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Send className="w-3.5 h-3.5" />
                                )}
                                Enviar
                            </Button>
                        </div>
                        <p className="text-[9px] text-neutral-600 mt-1.5">
                            Nota: WhatsApp solo permite mensajes de texto libres dentro de las 24h
                            posteriores al último mensaje del contacto. Fuera de esa ventana usa una plantilla.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
