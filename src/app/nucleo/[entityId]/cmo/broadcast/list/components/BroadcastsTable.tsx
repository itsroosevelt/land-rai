import React from "react";
import {
    ChevronUp,
    ChevronDown,
    MoreVertical,
    Play,
    BarChart3,
    Loader2,
} from "lucide-react";
import { Broadcast } from "../page";

type SortColumn = "status" | "broadcastTime" | "name";
type SortOrder = "asc" | "desc" | null;

interface BroadcastsTableProps {
    processedBroadcasts: Broadcast[];
    sortColumn: SortColumn | null;
    sortOrder: SortOrder;
    handleSort: (column: SortColumn) => void;
    getStatusBadge: (status: Broadcast["status"]) => React.ReactNode;
    handleViewBroadcast: (broadcast: Broadcast) => void;
    activeRowMenuId: string | null;
    setActiveRowMenuId: (id: string | null) => void;
    rowMenuRef: React.RefObject<HTMLDivElement>;
    handleClone: (broadcast: Broadcast) => void;
    handleDeleteClick: (broadcast: Broadcast) => void;
    onLaunch: (broadcast: Broadcast) => void;
    onViewResults: (broadcast: Broadcast) => void;
    handleRename: (broadcast: Broadcast, name: string) => void;
}

const LAUNCHABLE = ["Draft", "Scheduled", "Failed", "Paused"];
const HAS_RESULTS = ["Sending", "Completed", "Failed", "Paused"];

export default function BroadcastsTable({
    processedBroadcasts,
    sortColumn,
    sortOrder,
    handleSort,
    getStatusBadge,
    handleViewBroadcast,
    activeRowMenuId,
    setActiveRowMenuId,
    rowMenuRef,
    handleClone,
    handleDeleteClick,
    onLaunch,
    onViewResults,
    handleRename,
}: BroadcastsTableProps) {
    const sortIcon = (col: SortColumn) =>
        sortColumn === col ? (
            sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
            <ChevronDown className="w-3 h-3 text-neutral-500" />
        );

    return (
        <div className="border border-white/5 rounded-xl bg-[#0b0c10]/40">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-white/5 bg-[#13151a]/30 text-[11px] font-normal uppercase tracking-wider text-neutral-400 select-none">
                        <th onClick={() => handleSort("status")} className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors">
                            <div className="flex items-center gap-1">Status {sortIcon("status")}</div>
                        </th>
                        <th onClick={() => handleSort("broadcastTime")} className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors">
                            <div className="flex items-center gap-1">Broadcast Time {sortIcon("broadcastTime")}</div>
                        </th>
                        <th onClick={() => handleSort("name")} className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors">
                            <div className="flex items-center gap-1">Name {sortIcon("name")}</div>
                        </th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Labels</th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Channel</th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Segment</th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Recipients</th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Progreso</th>
                        <th className="px-4 py-3 font-medium text-right text-neutral-400">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-neutral-300">
                    {processedBroadcasts.length > 0 ? (
                        processedBroadcasts.map((broadcast) => {
                            const stats = broadcast.stats;
                            const total = stats?.total ?? broadcast.recipients ?? 0;
                            const done = stats ? stats.sent + stats.failed : 0;
                            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                            const canLaunch = LAUNCHABLE.includes(broadcast.status);
                            const canViewResults = HAS_RESULTS.includes(broadcast.status);
                            const isSending = broadcast.status === "Sending";

                            return (
                                <tr key={broadcast.id} className="hover:bg-white/[0.01] transition-all relative">
                                    <td className="px-4 py-3.5">{getStatusBadge(broadcast.status)}</td>
                                    <td className="px-4 py-3.5 text-neutral-500">{broadcast.broadcastTime}</td>
                                    <td
                                        onClick={() => (canViewResults ? onViewResults(broadcast) : handleViewBroadcast(broadcast))}
                                        className="px-4 py-3.5 font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
                                    >
                                        {broadcast.name}
                                    </td>
                                    <td className="px-4 py-3.5 text-neutral-500">{broadcast.labels}</td>
                                    <td className="px-4 py-3.5 text-neutral-500">{broadcast.channel}</td>
                                    <td className="px-4 py-3.5 text-neutral-500 max-w-[160px] truncate">{broadcast.segment}</td>
                                    <td className="px-4 py-3.5 text-neutral-400">{total}</td>
                                    <td className="px-4 py-3.5 text-neutral-400 min-w-[130px]">
                                        {stats && (isSending || done > 0) ? (
                                            <div className="space-y-1">
                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${isSending ? "bg-emerald-500" : "bg-blue-500"}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 text-[9px] text-neutral-500">
                                                    <span className="text-blue-400">{stats.sent} env.</span>
                                                    {stats.replied > 0 && <span className="text-green-400">{stats.replied} resp.</span>}
                                                    {stats.failed > 0 && <span className="text-rose-400">{stats.failed} fall.</span>}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-neutral-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3.5 text-right relative">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {canLaunch && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onLaunch(broadcast);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium shadow active:scale-95 transition-all"
                                                >
                                                    <Play className="w-3 h-3" /> Iniciar
                                                </button>
                                            )}
                                            {isSending && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-emerald-400">
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Enviando
                                                </span>
                                            )}
                                            {canViewResults && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onViewResults(broadcast);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#13151a] border border-white/5 text-neutral-300 hover:text-white hover:border-blue-500/40 text-[10px] transition-all"
                                                >
                                                    <BarChart3 className="w-3 h-3" /> Resultados
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveRowMenuId(activeRowMenuId === broadcast.id ? null : broadcast.id);
                                                }}
                                                className="p-1 text-neutral-500 hover:text-white rounded transition-colors actions-toggle-btn"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Custom Row Actions Dropdown */}
                                        {activeRowMenuId === broadcast.id && (
                                            <div
                                                ref={rowMenuRef}
                                                className="absolute right-4 top-10 z-50 bg-[#13151a] border border-white/10 rounded-lg py-1.5 w-44 shadow-[0_10px_30px_rgba(0,0,0,0.5)] text-left"
                                            >
                                                {canLaunch && (
                                                    <button
                                                        onClick={() => onLaunch(broadcast)}
                                                        className="w-full px-3 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
                                                    >
                                                        <Play className="w-3 h-3" /> Iniciar campaña
                                                    </button>
                                                )}
                                                {canViewResults && (
                                                    <button
                                                        onClick={() => onViewResults(broadcast)}
                                                        className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                                                    >
                                                        <BarChart3 className="w-3 h-3" /> Ver resultados
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        const newName = prompt("Editar nombre:", broadcast.name);
                                                        if (newName) handleRename(broadcast, newName);
                                                        setActiveRowMenuId(null);
                                                    }}
                                                    className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                                                >
                                                    Editar nombre
                                                </button>
                                                <button
                                                    onClick={() => handleViewBroadcast(broadcast)}
                                                    className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                                                >
                                                    Ver configuración
                                                </button>
                                                <button
                                                    onClick={() => handleClone(broadcast)}
                                                    className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                                                >
                                                    Clonar
                                                </button>
                                                <div className="h-px bg-white/5 my-1" />
                                                <button
                                                    onClick={() => handleDeleteClick(broadcast)}
                                                    className="w-full px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan={9} className="px-4 py-12 text-center text-neutral-500 text-xs">
                                No hay campañas. Crea una nueva para empezar.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
