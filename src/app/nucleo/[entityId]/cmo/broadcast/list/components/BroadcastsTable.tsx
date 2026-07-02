import React from "react";
import { 
    ChevronUp, 
    ChevronDown, 
    MoreVertical 
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
    setBroadcasts: React.Dispatch<React.SetStateAction<Broadcast[]>>;
    handleClone: (broadcast: Broadcast) => void;
    handleDeleteClick: (broadcast: Broadcast) => void;
}

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
    setBroadcasts,
    handleClone,
    handleDeleteClick
}: BroadcastsTableProps) {
    return (
        <div className="border border-white/5 rounded-xl bg-[#0b0c10]/40">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-white/5 bg-[#13151a]/30 text-[11px] font-normal uppercase tracking-wider text-neutral-400 select-none">
                        <th onClick={() => handleSort("status")} className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors">
                            <div className="flex items-center gap-1">
                                Status 
                                {sortColumn === "status" ? (
                                    sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                ) : <ChevronDown className="w-3 h-3 text-neutral-500" />}
                            </div>
                        </th>
                        <th onClick={() => handleSort("broadcastTime")} className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors">
                            <div className="flex items-center gap-1">
                                Broadcast Time 
                                {sortColumn === "broadcastTime" ? (
                                    sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                ) : <ChevronDown className="w-3 h-3 text-neutral-500" />}
                            </div>
                        </th>
                        <th onClick={() => handleSort("name")} className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors">
                            <div className="flex items-center gap-1">
                                Name 
                                {sortColumn === "name" ? (
                                    sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                ) : <ChevronDown className="w-3 h-3 text-neutral-500" />}
                            </div>
                        </th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Labels</th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Channel</th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Segment</th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Recipients</th>
                        <th className="px-4 py-3 font-medium text-neutral-400">Total Messages</th>
                        <th className="px-4 py-3 font-medium text-right text-neutral-400">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-neutral-300">
                    {processedBroadcasts.length > 0 ? (
                        processedBroadcasts.map((broadcast) => (
                            <tr key={broadcast.id} className="hover:bg-white/[0.01] transition-all relative">
                                <td className="px-4 py-3.5">{getStatusBadge(broadcast.status)}</td>
                                <td className="px-4 py-3.5 text-neutral-500">{broadcast.broadcastTime}</td>
                                <td 
                                    onClick={() => handleViewBroadcast(broadcast)}
                                    className="px-4 py-3.5 font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
                                >
                                    {broadcast.name}
                                </td>
                                <td className="px-4 py-3.5 text-neutral-500">{broadcast.labels}</td>
                                <td className="px-4 py-3.5 text-neutral-500">{broadcast.channel}</td>
                                <td className="px-4 py-3.5 text-neutral-500">{broadcast.segment}</td>
                                <td className="px-4 py-3.5 text-neutral-400">{broadcast.recipients}</td>
                                <td className="px-4 py-3.5 text-neutral-400">{broadcast.totalMessages}</td>
                                <td className="px-4 py-3.5 text-right relative">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveRowMenuId(activeRowMenuId === broadcast.id ? null : broadcast.id);
                                        }}
                                        className="p-1 text-neutral-500 hover:text-white rounded transition-colors actions-toggle-btn"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>

                                    {/* Custom Row Actions Dropdown */}
                                    {activeRowMenuId === broadcast.id && (
                                        <div 
                                            ref={rowMenuRef}
                                            className="absolute right-4 top-10 z-50 bg-[#13151a] border border-white/10 rounded-lg py-1.5 w-40 shadow-[0_10px_30px_rgba(0,0,0,0.5)] text-left"
                                        >
                                            <button 
                                                onClick={() => setActiveRowMenuId(null)}
                                                className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                Open Builder
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    const newName = prompt("Edit Name:", broadcast.name);
                                                    if (newName) {
                                                        setBroadcasts(prev => prev.map(b => b.id === broadcast.id ? { ...b, name: newName } : b));
                                                    }
                                                    setActiveRowMenuId(null);
                                                }}
                                                className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                Edit Name/Label
                                            </button>
                                            <button 
                                                onClick={() => handleViewBroadcast(broadcast)}
                                                className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                View
                                            </button>
                                            <button 
                                                onClick={() => handleClone(broadcast)}
                                                className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                Clone
                                            </button>
                                            <div className="h-px bg-white/5 my-1" />
                                            <button 
                                                onClick={() => handleDeleteClick(broadcast)}
                                                className="w-full px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={9} className="px-4 py-12 text-center text-neutral-500 text-xs">
                                No broadcasts found matching selection.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
