import React from "react";
import { Menu, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
    name: string;
    dotColor: string;
}

interface SidebarFiltersProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    selectedFilter: string;
    setSelectedFilter: (filter: string) => void;
    categories: Category[];
}

export default function SidebarFilters({
    isSidebarOpen,
    setIsSidebarOpen,
    selectedFilter,
    setSelectedFilter,
    categories
}: SidebarFiltersProps) {
    return (
        <aside className={cn(
            "absolute left-3 top-3 bottom-3 z-40 w-56 bg-[#0b0c10]/95 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
            isSidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-64 opacity-0 pointer-events-none"
        )}>
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                        title="Collapse sidebar"
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                    <span className="font-normal text-xs tracking-wide text-white/90">Broadcasts</span>
                </div>
                <Megaphone className="w-3.5 h-3.5 text-white/30" />
            </div>
            <nav className="flex-1 p-2 space-y-0.5">
                {categories.map((cat) => (
                    <button
                        key={cat.name}
                        onClick={() => setSelectedFilter(cat.name)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-normal transition-all ${
                            selectedFilter === cat.name
                                ? "bg-white/5 text-white"
                                : "text-neutral-400 hover:bg-white/[0.02] hover:text-white/80"
                        }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${cat.dotColor}`} />
                        <span>{cat.name}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
}
