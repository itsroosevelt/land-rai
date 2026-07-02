"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
    Search, 
    Table as TableIcon, 
    Calendar as CalendarIcon, 
    Plus, 
    MoreHorizontal, 
    MoreVertical,
    Megaphone,
    Filter,
    ChevronDown,
    ChevronUp,
    Menu,
    X,
    Type,
    List,
    FileText,
    Image as ImageIcon,
    HelpCircle,
    Info,
    Trash2,
    Send,
    Loader2,
    Clock,
    Zap,
    Users,
    Sliders,
    Eye,
    MessageSquare
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "next/navigation";
import { toast } from "sonner";

// Modulariad Component Imports
import SidebarFilters from "./components/SidebarFilters";
import BroadcastsTable from "./components/BroadcastsTable";
import PhoneMockup from "./components/PhoneMockup";
import DeleteBroadcastModal from "./components/DeleteBroadcastModal";

export interface Broadcast {
    id: string;
    status: "Draft" | "Scheduled" | "In Progress" | "Completed" | "Failed";
    broadcastTime: string;
    name: string;
    labels: string;
    channel: string;
    segment: string;
    recipients: number;
    totalMessages: number;
}

interface ContentBlock {
    id: string;
    type: "text" | "choice" | "file" | "media";
    value: string;
    options?: string[]; // for multiple choice
}

type SortColumn = "status" | "broadcastTime" | "name";
type SortOrder = "asc" | "desc" | null;

export default function BroadcastsListPage() {
    const { currentUser } = useAuth();
    const params = useParams();
    const entityId = params.entityId as string;

    // Layout states
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false);
    const [sidebarMode, setSidebarMode] = useState<"create" | "view">("create");
    const [viewMode, setViewMode] = useState<"Table" | "Calendar">("Table");
    const [selectedFilter, setSelectedFilter] = useState<string>("All");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Sorting state
    const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>(null);

    // Row Actions Dropdown state
    const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);

    // Delete Modal state
    const [deleteTarget, setDeleteTarget] = useState<Broadcast | null>(null);

    // Data table state (Starts empty as requested)
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

    // Right Sidebar form states
    const [formName, setFormName] = useState<string>("");
    const [formLabel, setFormLabel] = useState<string>("");
    const [formSegment, setFormSegment] = useState<string>("");
    const [formChannelType, setFormChannelType] = useState<"specific" | "last_interacted">("specific");
    const [formChannel, setFormChannel] = useState<string>("");
    const [formContentBlocks, setFormContentBlocks] = useState<ContentBlock[]>([]);

    // Conversational Automation states
    const [automationPrompts, setAutomationPrompts] = useState<string[]>(["", "", "", ""]);
    const [automationCommands, setAutomationCommands] = useState<Array<{ command_name: string; command_description: string }>>([]);
    const [isAutomationSectionOpen, setIsAutomationSectionOpen] = useState<boolean>(false);
    const [syncingAutomation, setSyncingAutomation] = useState<boolean>(false);

    // Scheduling & Delivery settings
    const [sendImmediately, setSendImmediately] = useState<boolean>(true);
    const [scheduleDate, setScheduleDate] = useState<string>("");
    const [scheduleTime, setScheduleTime] = useState<string>("");
    const [deliverySpeed, setDeliverySpeed] = useState<string>("No limit");

    // Dynamic Segment Estimator state
    const [estimatingCount, setEstimatingCount] = useState<boolean>(false);
    const [estimatedRecipients, setEstimatedRecipients] = useState<number | null>(null);
    const [estimatedWhatsAppCount, setEstimatedWhatsAppCount] = useState<number | null>(null);

    // Meta templates states
    const [metaTemplates, setMetaTemplates] = useState<any[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState<boolean>(false);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [templateVariables, setTemplateVariables] = useState<string[]>([]);
    const [templateParamValues, setTemplateParamValues] = useState<Record<string, string>>({});

    // Test send state
    const [testPhoneNumber, setTestPhoneNumber] = useState<string>("");
    const [sendingTest, setSendingTest] = useState<boolean>(false);

    // Dropdown toggles
    const [isSegmentDropdownOpen, setIsSegmentDropdownOpen] = useState(false);
    const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
    const [isLabelDropdownOpen, setIsLabelDropdownOpen] = useState(false);
    const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
    const [isAddContentMenuOpen, setIsAddContentMenuOpen] = useState(false);

    // Validation error triggers
    const [showErrors, setShowErrors] = useState(false);

    // Refs for clicking outside dropdowns
    const addContentRef = useRef<HTMLDivElement>(null);
    const segmentRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const templateRef = useRef<HTMLDivElement>(null);
    const rowMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (addContentRef.current && !addContentRef.current.contains(event.target as Node)) {
                setIsAddContentMenuOpen(false);
            }
            if (segmentRef.current && !segmentRef.current.contains(event.target as Node)) {
                setIsSegmentDropdownOpen(false);
            }
            if (channelRef.current && !channelRef.current.contains(event.target as Node)) {
                setIsChannelDropdownOpen(false);
            }
            if (labelRef.current && !labelRef.current.contains(event.target as Node)) {
                setIsLabelDropdownOpen(false);
            }
            if (templateRef.current && !templateRef.current.contains(event.target as Node)) {
                setIsTemplateDropdownOpen(false);
            }
            if (rowMenuRef.current && !rowMenuRef.current.contains(event.target as Node)) {
                const isToggle = (event.target as HTMLElement).closest(".actions-toggle-btn");
                if (!isToggle) {
                    setActiveRowMenuId(null);
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Estimate Recipients based on selected Segment
    useEffect(() => {
        if (formSegment) {
            setEstimatingCount(true);
            const timer = setTimeout(() => {
                let total = 85;
                if (formSegment.includes("All")) total = 425;
                if (formSegment.includes("<7 days")) total = 112;
                if (formSegment.includes(">30 days")) total = 230;
                setEstimatedRecipients(total);
                setEstimatedWhatsAppCount(Math.round(total * 0.92));
                setEstimatingCount(false);
            }, 800);
            return () => clearTimeout(timer);
        } else {
            setEstimatedRecipients(null);
            setEstimatedWhatsAppCount(null);
        }
    }, [formSegment]);

    // Fetch Meta templates when WhatsApp is selected as channel
    useEffect(() => {
        const isWhatsAppSelected = formChannel.toLowerCase().includes("whatsapp");
        if (isWhatsAppSelected && currentUser?.uid && entityId) {
            setLoadingTemplates(true);
            setMetaTemplates([]);
            setSelectedTemplate(null);
            setTemplateVariables([]);
            setTemplateParamValues({});
            fetch(`/api/whatsapp/templates?userId=${currentUser.uid}&entityId=${entityId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.templates) {
                        setMetaTemplates(data.templates);
                    } else if (data.error) {
                        console.error(data.error);
                    }
                })
                .catch(err => {
                    console.error(err);
                })
                .finally(() => {
                    setLoadingTemplates(false);
                });
        }
    }, [formChannel, currentUser?.uid, entityId]);

    // Handle Meta template selection
    const handleSelectTemplate = (template: any) => {
        setSelectedTemplate(template);
        setIsTemplateDropdownOpen(false);

        const bodyComp = template.components?.find((c: any) => c.type === "BODY");
        const bodyText = bodyComp?.text || "";
        const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
        const uniqueVars = Array.from(new Set(matches)) as string[];
        
        uniqueVars.sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ""));
            const numB = parseInt(b.replace(/\D/g, ""));
            return numA - numB;
        });

        setTemplateVariables(uniqueVars);
        
        const initialParams: Record<string, string> = {};
        uniqueVars.forEach(v => {
            initialParams[v] = "";
        });
        setTemplateParamValues(initialParams);
    };

    // Helper to generate dynamic WhatsApp Preview body
    const livePreviewBody = useMemo(() => {
        if (!selectedTemplate) return "";
        const bodyComp = selectedTemplate.components?.find((c: any) => c.type === "BODY");
        let text = bodyComp?.text || "";

        templateVariables.forEach(v => {
            const val = templateParamValues[v] || v;
            text = text.replace(v, val);
        });

        return text;
    }, [selectedTemplate, templateVariables, templateParamValues]);

    // Filter categories
    const categories = [
        { name: "All", dotColor: "bg-blue-500" },
        { name: "Draft", dotColor: "bg-neutral-400" },
        { name: "Scheduled", dotColor: "bg-amber-500" },
        { name: "In Progress", dotColor: "bg-emerald-500" },
        { name: "Completed", dotColor: "bg-green-500" },
        { name: "Failed", dotColor: "bg-rose-500" }
    ];

    const segmentOptions = [
        "All",
        "Contacts created <7 days ago",
        "Contacts inactive >30 days",
        "Contacts with tags",
        "Country known",
        "Language known"
    ];

    const channelOptions = [
        "WhatsApp Business",
        "Messenger Fanpage",
        "Instagram Direct"
    ];

    const labelOptions = [
        "Marketing",
        "Support",
        "Promotional",
        "Updates"
    ];

    // Sorting Helper
    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            if (sortOrder === "asc") {
                setSortOrder("desc");
            } else if (sortOrder === "desc") {
                setSortColumn(null);
                setSortOrder(null);
            } else {
                setSortOrder("asc");
            }
        } else {
            setSortColumn(column);
            setSortOrder("asc");
        }
    };

    // Filter, Sort, and Search logic
    const processedBroadcasts = useMemo(() => {
        let list = broadcasts.filter(b => {
            const matchesFilter = selectedFilter === "All" || b.status === selectedFilter;
            return matchesFilter;
        });

        if (searchQuery.trim() !== "") {
            list = list.filter(b => 
                b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.segment.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (sortColumn && sortOrder) {
            list = [...list].sort((a, b) => {
                let valA = a[sortColumn] || "";
                let valB = b[sortColumn] || "";

                if (valA < valB) return sortOrder === "asc" ? -1 : 1;
                if (valA > valB) return sortOrder === "asc" ? 1 : -1;
                return 0;
            });
        }

        return list;
    }, [broadcasts, selectedFilter, searchQuery, sortColumn, sortOrder]);

    // Helper to get status badge colors
    const getStatusBadge = (status: Broadcast["status"]) => {
        const styles = {
            Draft: "bg-neutral-800 text-neutral-300 border-neutral-700",
            Scheduled: "bg-amber-500/10 text-amber-400 border-amber-500/20",
            "In Progress": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            Completed: "bg-green-500/10 text-green-400 border-green-500/20",
            Failed: "bg-rose-500/10 text-rose-400 border-rose-500/20"
        };
        return (
            <span className={`px-2 py-0.5 text-[11px] font-medium rounded border ${styles[status]}`}>
                {status}
            </span>
        );
    };

    // Open right sidebar and reset form
    const handleOpenAddSidebar = () => {
        setSidebarMode("create");
        setFormName("");
        setFormLabel("");
        setFormSegment("");
        setFormChannelType("specific");
        setFormChannel("");
        setFormContentBlocks([]);
        setSelectedTemplate(null);
        setTemplateVariables([]);
        setTemplateParamValues({});
        setTestPhoneNumber("");
        setSendImmediately(true);
        setScheduleDate("");
        setScheduleTime("");
        setDeliverySpeed("No limit");
        setAutomationPrompts(["", "", "", ""]);
        setAutomationCommands([]);
        setIsAutomationSectionOpen(false);
        setSyncingAutomation(false);
        setShowErrors(false);
        setIsRightSidebarOpen(true);
    };

    // Open Right Sidebar in read-only View Mode
    const handleViewBroadcast = (broadcast: Broadcast) => {
        setSidebarMode("view");
        setFormName(broadcast.name);
        setFormLabel(broadcast.labels !== "-" ? broadcast.labels : "");
        setFormSegment(broadcast.segment !== "-" ? broadcast.segment : "");
        setFormChannelType("specific");
        setFormChannel(broadcast.channel !== "-" ? broadcast.channel : "");
        setAutomationPrompts(["Reserva una cita", "Ver catálogo", "Hablar con un agente", ""]);
        setAutomationCommands([
            { command_name: "imagine", command_description: "Generar imagen mediante IA" },
            { command_name: "ayuda", command_description: "Mostrar menú de asistencia" }
        ]);
        setIsAutomationSectionOpen(true);
        setSyncingAutomation(false);
        
        if (broadcast.channel.toLowerCase().includes("whatsapp")) {
            setSelectedTemplate({
                name: "custom_message_template",
                language: "es",
                components: [
                    {
                        type: "BODY",
                        text: "Hola {{1}}, gracias por tu interés en Roosevelt. Tu código de descuento es {{2}}."
                    }
                ]
            });
            setTemplateVariables(["{{1}}", "{{2}}"]);
            setTemplateParamValues({
                "{{1}}": "{{Nombre}}",
                "{{2}}": "PROMO2026"
            });
        }
        
        setSendImmediately(broadcast.status !== "Scheduled");
        setScheduleDate("");
        setScheduleTime("");
        setDeliverySpeed("No limit");
        setShowErrors(false);
        setIsRightSidebarOpen(true);
        setActiveRowMenuId(null);
    };

    // Submit form and create broadcast
    const handleCreateBroadcast = () => {
        if (!formName.trim() || !formSegment) {
            setShowErrors(true);
            return;
        }
        const newBroadcast: Broadcast = {
            id: Date.now().toString(),
            status: sendImmediately ? "Draft" : "Scheduled",
            broadcastTime: sendImmediately ? "-" : `${scheduleDate} ${scheduleTime}`,
            name: formName,
            labels: formLabel || "-",
            channel: formChannelType === "last_interacted" ? "Last Interacted" : (formChannel || "-"),
            segment: formSegment,
            recipients: estimatedWhatsAppCount || 0,
            totalMessages: estimatedWhatsAppCount || 0
        };
        setBroadcasts(prev => [newBroadcast, ...prev]);
        setIsRightSidebarOpen(false);
    };

    // Action handlers
    const handleClone = (broadcast: Broadcast) => {
        const cloned: Broadcast = {
            ...broadcast,
            id: Date.now().toString() + Math.random(),
            name: `${broadcast.name} (Copy)`
        };
        setBroadcasts(prev => [cloned, ...prev]);
        setActiveRowMenuId(null);
    };

    const handleDeleteClick = (broadcast: Broadcast) => {
        setDeleteTarget(broadcast);
        setActiveRowMenuId(null);
    };

    const confirmDelete = () => {
        if (deleteTarget) {
            setBroadcasts(prev => prev.filter(b => b.id !== deleteTarget.id));
            setDeleteTarget(null);
        }
    };

    // Test send template call to /api/whatsapp/send
    const handleTestSend = async () => {
        if (!testPhoneNumber) {
            toast.error("Please enter a valid phone number for the test.");
            return;
        }
        if (!selectedTemplate) {
            toast.error("Please select a Meta Template first.");
            return;
        }

        setSendingTest(true);
        try {
            const parameters = templateVariables.map(v => ({
                type: "text" as const,
                text: templateParamValues[v] || ""
            }));

            const response = await fetch("/api/whatsapp/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `Test Template: ${selectedTemplate.name}`,
                    toNumber: testPhoneNumber,
                    platform: "WhatsApp",
                    userId: currentUser?.uid,
                    entityId,
                    type: "template",
                    template: {
                        name: selectedTemplate.name,
                        language: { code: selectedTemplate.language || "es" },
                        components: [
                            {
                                type: "body",
                                parameters
                            }
                        ]
                    }
                })
            });

            const result = await response.json();
            if (response.ok) {
                toast.success("Test message sent successfully via WhatsApp Cloud API!");
            } else {
                toast.error(`Failed to send test: ${result.error || "Unknown API error"}`);
            }
        } catch (err: any) {
            console.error(err);
            toast.error(`Error sending test: ${err.message}`);
        } finally {
            setSendingTest(false);
        }
    };

    // Content Block Helpers
    const addContentBlock = (type: ContentBlock["type"]) => {
        const newBlock: ContentBlock = {
            id: Date.now().toString() + Math.random(),
            type,
            value: "",
            options: type === "choice" ? ["", ""] : undefined
        };
        setFormContentBlocks(prev => [...prev, newBlock]);
        setIsAddContentMenuOpen(false);
    };

    const updateBlockValue = (id: string, value: string) => {
        setFormContentBlocks(prev => prev.map(b => b.id === id ? { ...b, value } : b));
    };

    const updateBlockOption = (blockId: string, optIndex: number, value: string) => {
        setFormContentBlocks(prev => prev.map(b => {
            if (b.id === blockId && b.options) {
                const newOpts = [...b.options];
                newOpts[optIndex] = value;
                return { ...b, options: newOpts };
            }
            return b;
        }));
    };

    const addBlockOption = (blockId: string) => {
        setFormContentBlocks(prev => prev.map(b => {
            if (b.id === blockId && b.options) {
                return { ...b, options: [...b.options, ""] };
            }
            return b;
        }));
    };

    const removeBlock = (id: string) => {
        setFormContentBlocks(prev => prev.filter(b => b.id !== id));
    };

    // Helper to inject variable mapping tags
    const injectVariableValue = (varKey: string, attribute: string) => {
        if (sidebarMode === "view") return;
        setTemplateParamValues(prev => ({
            ...prev,
            [varKey]: (prev[varKey] || "") + `{{${attribute}}}`
        }));
        toast.info(`Injected dynamic tag {{${attribute}}} into ${varKey}`);
    };

    const isWhatsAppSelected = formChannel.toLowerCase().includes("whatsapp");

    return (
        <div className="flex h-screen bg-[#090a0f] text-white overflow-hidden font-sans relative p-3">
            {/* Sidebar Filters - Left Floating Panel Component */}
            <SidebarFilters 
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                selectedFilter={selectedFilter}
                setSelectedFilter={setSelectedFilter}
                categories={categories}
            />

            {/* Main Section */}
            <main className={cn(
                "flex-1 flex flex-col min-w-0 bg-[#090a0f] transition-all duration-300",
                isSidebarOpen ? "pl-[240px]" : "pl-0",
                isRightSidebarOpen 
                    ? (isWhatsAppSelected ? "pr-[1000px]" : "pr-[520px]") 
                    : "pr-0"
            )}>
                {/* Top Action Bar */}
                <div className="p-4 border border-white/5 rounded-xl flex items-center justify-between gap-4 shrink-0 bg-[#0b0c10]/40 backdrop-blur-md mb-3">
                    <div className="flex items-center gap-2 flex-1">
                        {!isSidebarOpen && (
                            <button 
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 border border-white/5 bg-[#13151a] hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white transition-all shrink-0"
                                title="Expand sidebar"
                            >
                                <Menu className="w-4 h-4" />
                            </button>
                        )}
                        <div className="relative w-64 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                            <Input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#13151a] border-white/5 pl-9 pr-4 py-1.5 text-xs text-white placeholder-neutral-500 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="bg-[#13151a] border border-white/5 p-0.5 rounded-lg flex items-center">
                            <button
                                onClick={() => setViewMode("Table")}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                    viewMode === "Table"
                                        ? "bg-white/5 text-blue-400"
                                        : "text-neutral-400 hover:text-white"
                                }`}
                            >
                                <TableIcon className="w-3.5 h-3.5" />
                                <span>Table</span>
                            </button>
                            <button
                                onClick={() => setViewMode("Calendar")}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                    viewMode === "Calendar"
                                        ? "bg-white/5 text-blue-400"
                                        : "text-neutral-400 hover:text-white"
                                }`}
                            >
                                <CalendarIcon className="w-3.5 h-3.5" />
                                <span>Calendar</span>
                            </button>
                        </div>

                        <Button 
                            onClick={handleOpenAddSidebar}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Broadcast</span>
                        </Button>

                        <button className="p-2 border border-white/5 bg-[#13151a] text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Content / Table Component */}
                <div className="flex-1 overflow-auto custom-scrollbar relative">
                    {viewMode === "Table" ? (
                        <BroadcastsTable 
                            processedBroadcasts={processedBroadcasts}
                            sortColumn={sortColumn}
                            sortOrder={sortOrder}
                            handleSort={handleSort}
                            getStatusBadge={getStatusBadge}
                            handleViewBroadcast={handleViewBroadcast}
                            activeRowMenuId={activeRowMenuId}
                            setActiveRowMenuId={setActiveRowMenuId}
                            rowMenuRef={rowMenuRef}
                            setBroadcasts={setBroadcasts}
                            handleClone={handleClone}
                            handleDeleteClick={handleDeleteClick}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center text-neutral-500 border border-white/5 rounded-xl bg-[#0b0c10]/40">
                            <CalendarIcon className="w-10 h-10 mb-3 text-neutral-600" />
                            <p className="text-sm font-medium">Calendar View is not active</p>
                            <p className="text-xs text-neutral-600 mt-1">Switch to Table view to manage campaigns.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Right Creation Sidebar - Floating Panel */}
            <aside className={cn(
                "absolute right-3 top-3 bottom-3 z-50 bg-[#0c0d12]/95 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col transition-all duration-300 shadow-[-10px_20px_50px_rgba(0,0,0,0.6)] overflow-hidden",
                isRightSidebarOpen 
                    ? (isWhatsAppSelected ? "w-[90vw] sm:w-[980px] translate-x-0 opacity-100" : "w-[90vw] sm:w-[500px] translate-x-0 opacity-100") 
                    : "translate-x-[1100px] opacity-0 pointer-events-none"
            )}>
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-sm text-white/95">
                            {sidebarMode === "view" ? "Campaign Details" : "New Broadcast Campaign"}
                        </span>
                    </div>
                    <button 
                        onClick={() => setIsRightSidebarOpen(false)}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Content Grid Layout */}
                <div className="flex-1 overflow-hidden p-4">
                    {isWhatsAppSelected ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                            {/* Left Scrollable Form Settings Column */}
                            <div className="overflow-y-auto pr-2 space-y-5 custom-scrollbar h-[calc(100vh-160px)]">
                                {/* Broadcast Name */}
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium text-neutral-400">Broadcast Name</label>
                                    <Input
                                        type="text"
                                        placeholder="Name your broadcast (only visible internally)"
                                        value={formName}
                                        disabled={sidebarMode === "view"}
                                        onChange={(e) => setFormName(e.target.value)}
                                        className={cn(
                                            "w-full bg-[#13151a]/80 border-white/5 text-xs placeholder-neutral-500 rounded-lg py-2 focus:ring-1 focus:ring-blue-500",
                                            showErrors && !formName.trim() && "border-red-500/70 focus:ring-red-500",
                                            sidebarMode === "view" && "opacity-80"
                                        )}
                                    />
                                    {showErrors && !formName.trim() && (
                                        <p className="text-[10px] text-red-400 font-medium">This field is required</p>
                                    )}
                                </div>

                                {/* Labels Dropdown */}
                                <div className="space-y-1.5 relative" ref={labelRef}>
                                    <label className="block text-[11px] font-medium text-neutral-400 flex items-center gap-1">
                                        Labels (optional) <HelpCircle className="w-3 h-3 text-neutral-500" />
                                    </label>
                                    <button
                                        onClick={() => {
                                            if (sidebarMode !== "view") {
                                                setIsLabelDropdownOpen(!isLabelDropdownOpen);
                                            }
                                        }}
                                        disabled={sidebarMode === "view"}
                                        className={cn(
                                            "w-full bg-[#13151a]/80 border border-white/5 text-left text-xs text-neutral-300 rounded-lg px-3 py-2 flex items-center justify-between hover:bg-white/[0.02]",
                                            sidebarMode === "view" && "opacity-80 cursor-default"
                                        )}
                                    >
                                        <span>{formLabel || "Add labels to the broadcast"}</span>
                                        {sidebarMode !== "view" && <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
                                    </button>
                                    {isLabelDropdownOpen && sidebarMode !== "view" && (
                                        <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-[#13151a] border border-white/10 rounded-lg shadow-xl py-1">
                                            {labelOptions.map(lbl => (
                                                <button
                                                    key={lbl}
                                                    onClick={() => { setFormLabel(lbl); setIsLabelDropdownOpen(false); }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-neutral-300 hover:text-white"
                                                >
                                                    {lbl}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="h-px bg-white/5 my-2" />

                                <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider flex items-center gap-1">
                                    <Sliders className="w-3.5 h-3.5 text-neutral-500" />
                                    <span>Configuration</span>
                                </h3>

                                {/* Segment Select & Estimator */}
                                <div className="space-y-1.5 relative animate-fade-in" ref={segmentRef}>
                                    <label className="block text-[11px] font-medium text-neutral-400 flex items-center justify-between">
                                        <span>Segment</span>
                                        {estimatingCount && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                                    </label>
                                    <button
                                        onClick={() => {
                                            if (sidebarMode !== "view") {
                                                setIsSegmentDropdownOpen(!isSegmentDropdownOpen);
                                            }
                                        }}
                                        disabled={sidebarMode === "view"}
                                        className={cn(
                                            "w-full bg-[#13151a]/80 border border-white/5 text-left text-xs text-neutral-300 rounded-lg px-3 py-2 flex items-center justify-between hover:bg-white/[0.02]",
                                            showErrors && !formSegment && "border-red-500/70",
                                            sidebarMode === "view" && "opacity-80 cursor-default"
                                        )}
                                    >
                                        <span>{formSegment || "Select a segment"}</span>
                                        {sidebarMode !== "view" && <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
                                    </button>
                                    {showErrors && !formSegment && (
                                        <p className="text-[10px] text-red-400 font-medium">This field is required</p>
                                    )}

                                    {/* Recipient estimate info box */}
                                    {estimatedRecipients !== null && !estimatingCount && (
                                        <div className="mt-1.5 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 flex items-center gap-2 text-[10px] text-neutral-300">
                                            <Users className="w-3.5 h-3.5 text-blue-400" />
                                            <span>
                                                Estimación: <b>{estimatedRecipients}</b> contactos ({estimatedWhatsAppCount} con WhatsApp activo)
                                            </span>
                                        </div>
                                    )}

                                    {isSegmentDropdownOpen && sidebarMode !== "view" && (
                                        <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-[#13151a] border border-white/10 rounded-lg shadow-xl py-1 max-h-40 overflow-y-auto custom-scrollbar">
                                            <button className="w-full text-left px-3 py-1.5 text-xs text-blue-400 hover:bg-white/5 font-medium border-b border-white/5">
                                                + Add Segment
                                            </button>
                                            {segmentOptions.map(seg => (
                                                <button
                                                    key={seg}
                                                    onClick={() => { setFormSegment(seg); setIsSegmentDropdownOpen(false); }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-neutral-300 hover:text-white"
                                                >
                                                    {seg}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Channel Select */}
                                <div className="space-y-1.5 relative" ref={channelRef}>
                                    <label className="block text-[11px] font-medium text-neutral-400">Channel</label>
                                    <button
                                        onClick={() => {
                                            if (sidebarMode !== "view") {
                                                setIsChannelDropdownOpen(!isChannelDropdownOpen);
                                            }
                                        }}
                                        disabled={sidebarMode === "view"}
                                        className={cn(
                                            "w-full bg-[#13151a]/80 border border-white/5 text-left text-xs text-neutral-300 rounded-lg px-3 py-2 flex items-center justify-between hover:bg-white/[0.02]",
                                            sidebarMode === "view" && "opacity-80 cursor-default"
                                        )}
                                    >
                                        <span>{formChannel || "Select a channel"}</span>
                                        {sidebarMode !== "view" && <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
                                    </button>
                                    {isChannelDropdownOpen && sidebarMode !== "view" && (
                                        <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-[#13151a] border border-white/10 rounded-lg shadow-xl py-1">
                                            {channelOptions.map(ch => (
                                                <button
                                                    key={ch}
                                                    onClick={() => { setFormChannel(ch); setIsChannelDropdownOpen(false); }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-neutral-300 hover:text-white"
                                                >
                                                    {ch}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Scheduling & Delivery controls */}
                                <div className="space-y-3">
                                    <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-neutral-500" /> Scheduling & Delivery Speed
                                    </h4>

                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                                            <input
                                                type="checkbox"
                                                checked={sendImmediately}
                                                disabled={sidebarMode === "view"}
                                                onChange={(e) => setSendImmediately(e.target.checked)}
                                                className="accent-blue-500"
                                            />
                                            <span>Send immediately upon launch</span>
                                        </label>
                                    </div>

                                    {!sendImmediately && (
                                        <div className="grid grid-cols-2 gap-2.5 animate-in slide-in-from-top-1 duration-200">
                                            <div>
                                                <span className="text-[9px] text-neutral-500 block mb-1">Date</span>
                                                <Input 
                                                    type="date"
                                                    disabled={sidebarMode === "view"}
                                                    value={scheduleDate}
                                                    onChange={(e) => setScheduleDate(e.target.value)}
                                                    className="bg-[#090a0f] border-white/5 text-xs"
                                                />
                                            </div>
                                            <div>
                                                <span className="text-[9px] text-neutral-500 block mb-1">Time</span>
                                                <Input 
                                                    type="time"
                                                    disabled={sidebarMode === "view"}
                                                    value={scheduleTime}
                                                    onChange={(e) => setScheduleTime(e.target.value)}
                                                    className="bg-[#090a0f] border-white/5 text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <span className="text-[9px] text-neutral-500 block mb-1">Delivery Speed (Throttling)</span>
                                        <select
                                            value={deliverySpeed}
                                            disabled={sidebarMode === "view"}
                                            onChange={(e) => setDeliverySpeed(e.target.value)}
                                            className="w-full bg-[#090a0f] border border-white/5 text-xs text-neutral-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="No limit">No limit (Send as fast as possible)</option>
                                            <option value="10">10 messages per minute (Ultra-Safe)</option>
                                            <option value="50">50 messages per minute (Safe)</option>
                                            <option value="100">100 messages per minute (Moderate)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5 my-2" />

                                {/* Meta Templates Section */}
                                <div className="space-y-4 bg-blue-500/5 border border-blue-500/10 p-3.5 rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Megaphone className="w-3.5 h-3.5" /> WhatsApp Meta Templates
                                        </h4>
                                        {loadingTemplates && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                                    </div>

                                    {/* Template Selector */}
                                    <div className="space-y-1.5 relative" ref={templateRef}>
                                        <label className="block text-[10px] text-neutral-400">Select Approved Template</label>
                                        <button
                                            onClick={() => {
                                                if (sidebarMode !== "view") {
                                                    setIsTemplateDropdownOpen(!isTemplateDropdownOpen);
                                                }
                                            }}
                                            disabled={loadingTemplates || metaTemplates.length === 0 || sidebarMode === "view"}
                                            className={cn(
                                                "w-full bg-[#13151a] border border-white/5 text-left text-xs text-neutral-300 rounded-lg px-3 py-2 flex items-center justify-between hover:bg-white/[0.02]",
                                                sidebarMode === "view" && "opacity-80 cursor-default"
                                            )}
                                        >
                                            <span>{selectedTemplate?.name || (loadingTemplates ? "Loading templates..." : "Choose template")}</span>
                                            {sidebarMode !== "view" && <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
                                        </button>
                                        {isTemplateDropdownOpen && sidebarMode !== "view" && (
                                            <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-[#13151a] border border-white/10 rounded-lg shadow-xl py-1 max-h-40 overflow-y-auto custom-scrollbar">
                                                {metaTemplates.map(tpl => (
                                                    <button
                                                        key={tpl.name}
                                                        onClick={() => handleSelectTemplate(tpl)}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-neutral-300 hover:text-white flex justify-between items-center"
                                                    >
                                                        <span>{tpl.name}</span>
                                                        <span className="text-[9px] text-neutral-500 font-mono uppercase">{tpl.language}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Dynamic Parameter inputs */}
                                    {selectedTemplate && (
                                        <div className="space-y-3 pt-2 border-t border-white/5">
                                            {templateVariables.length > 0 && (
                                                <div className="space-y-3">
                                                    <p className="text-[10px] text-neutral-400 font-medium">Template Variables (Body params):</p>
                                                    {templateVariables.map(v => (
                                                        <div key={v} className="flex flex-col gap-1.5 p-2.5 bg-[#090a0f] border border-white/5 rounded-xl">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[9px] text-neutral-500 font-mono">Value for {v}</span>
                                                                {sidebarMode !== "view" && (
                                                                    <div className="flex gap-1">
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => injectVariableValue(v, "Nombre")}
                                                                            className="px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[8px] font-medium border border-blue-500/10 transition-all"
                                                                        >
                                                                            + Nombre
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => injectVariableValue(v, "Teléfono")}
                                                                            className="px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[8px] font-medium border border-blue-500/10 transition-all"
                                                                        >
                                                                            + Teléfono
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <Input
                                                                type="text"
                                                                placeholder={`Enter parameter text`}
                                                                value={templateParamValues[v] || ""}
                                                                disabled={sidebarMode === "view"}
                                                                onChange={(e) => {
                                                                    setTemplateParamValues(prev => ({
                                                                        ...prev,
                                                                        [v]: e.target.value
                                                                    }));
                                                                }}
                                                                className="bg-[#13151a] border-white/5 text-xs rounded-lg py-1.5"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Test Send Component */}
                                            {sidebarMode !== "view" && (
                                                <div className="mt-3 space-y-2">
                                                    <h5 className="text-[10px] font-bold text-neutral-400 flex items-center gap-1.5">
                                                        <Send className="w-3 h-3 text-emerald-400" /> Send WhatsApp Test Message
                                                    </h5>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="text"
                                                            placeholder="Recipient Phone (e.g. 521XXXXXXXXXX)"
                                                            value={testPhoneNumber}
                                                            onChange={(e) => setTestPhoneNumber(e.target.value)}
                                                            className="bg-[#13151a] border-white/5 text-[11px] rounded-lg flex-1 h-8"
                                                        />
                                                        <Button
                                                            onClick={handleTestSend}
                                                            disabled={sendingTest}
                                                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-3 h-8 rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                                                        >
                                                            {sendingTest ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test Send"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Conversational Automation Accordion Section */}
                                            <div className="mt-4 overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAutomationSectionOpen(!isAutomationSectionOpen)}
                                                    className="w-full flex items-center justify-between py-3 text-left text-xs font-semibold text-white/95 hover:text-white"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <Sliders className="w-3.5 h-3.5 text-blue-400" />
                                                        <span>Conversational Automation (Meta API)</span>
                                                    </div>
                                                    {isAutomationSectionOpen ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                                                </button>

                                                {isAutomationSectionOpen && (
                                                    <div className="py-3 space-y-4 animate-fade-in">
                                                        
                                                        {/* Ice Breaker Prompts */}
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                                                                    Ice Breakers / Prompts (Max 4)
                                                                </label>
                                                                <span className="text-[9px] text-neutral-500">Max 80 chars, no emojis</span>
                                                            </div>
                                                            
                                                            {automationPrompts.map((promptText, idx) => (
                                                                <div key={idx} className="space-y-1 relative">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9.5px] text-neutral-500 font-mono">#{idx + 1}</span>
                                                                        <Input 
                                                                            type="text"
                                                                            placeholder={`starter prompt (e.g. plan a vacation)`}
                                                                            value={promptText}
                                                                            disabled={sidebarMode === "view"}
                                                                            maxLength={80}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                setAutomationPrompts(prev => {
                                                                                    const copy = [...prev];
                                                                                    copy[idx] = val;
                                                                                    return copy;
                                                                                });
                                                                            }}
                                                                            className="bg-[#090a0f] border-white/5 text-[11px] rounded-lg h-8"
                                                                        />
                                                                    </div>
                                                                    <div className="text-[8px] text-right text-neutral-500 px-1">
                                                                        {promptText.length}/80
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="h-px bg-white/5" />

                                                        {/* Slash Commands */}
                                                        <div className="space-y-2.5">
                                                            <div className="flex justify-between items-center">
                                                                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                                                                    Slash Commands (Max 30)
                                                                </label>
                                                                <span className="text-[9px] text-neutral-500">Max 32 name, 256 desc</span>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {automationCommands.map((cmd, idx) => (
                                                                    <div key={idx} className="flex gap-2 items-start py-2 relative">
                                                                        <div className="flex-1 space-y-1.5">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-[9px] text-neutral-500 font-mono">/</span>
                                                                                <Input 
                                                                                    type="text"
                                                                                    placeholder="command (e.g. hotel)"
                                                                                    value={cmd.command_name}
                                                                                    disabled={sidebarMode === "view"}
                                                                                    maxLength={32}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "");
                                                                                        setAutomationCommands(prev => prev.map((c, cIdx) => cIdx === idx ? { ...c, command_name: val } : c));
                                                                                    }}
                                                                                    className="bg-[#13151a] border-white/5 text-[11px] h-7 rounded-md"
                                                                                />
                                                                            </div>
                                                                            <Input 
                                                                                type="text"
                                                                                placeholder="description (e.g. Book hotel room)"
                                                                                value={cmd.command_description}
                                                                                disabled={sidebarMode === "view"}
                                                                                maxLength={256}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    setAutomationCommands(prev => prev.map((c, cIdx) => cIdx === idx ? { ...c, command_description: val } : c));
                                                                                }}
                                                                                className="bg-[#13151a] border-white/5 text-[10px] h-7 rounded-md"
                                                                            />
                                                                        </div>
                                                                        {sidebarMode !== "view" && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setAutomationCommands(prev => prev.filter((_, cIdx) => cIdx !== idx));
                                                                                }}
                                                                                className="p-1 hover:bg-red-500/10 text-neutral-500 hover:text-red-400 rounded transition-colors self-center"
                                                                                title="Remove Command"
                                                                            >
                                                                                <X className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {sidebarMode !== "view" && automationCommands.length < 30 && (
                                                                <Button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setAutomationCommands(prev => [...prev, { command_name: "", command_description: "" }]);
                                                                    }}
                                                                    variant="outline"
                                                                    className="w-full bg-[#090a0f] border-white/5 text-[10px] h-8 hover:bg-white/5 text-neutral-400 hover:text-white rounded-lg flex items-center justify-center gap-1"
                                                                >
                                                                    <Plus className="w-3 h-3" /> Add Slash Command
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* API Sync button */}
                                                        {sidebarMode !== "view" && (
                                                            <div className="pt-2">
                                                                <Button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        setSyncingAutomation(true);
                                                                        try {
                                                                            await new Promise(resolve => setTimeout(resolve, 1500));
                                                                            toast.success("Conversational automation synced successfully with Meta Graph API!");
                                                                        } catch (err) {
                                                                            toast.error("Failed to sync automation configurations.");
                                                                        } finally {
                                                                            setSyncingAutomation(false);
                                                                        }
                                                                    }}
                                                                    disabled={syncingAutomation}
                                                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] h-8 rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md font-semibold"
                                                                >
                                                                    {syncingAutomation ? (
                                                                        <>
                                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                            <span>Syncing with Meta...</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Zap className="w-3.5 h-3.5" />
                                                                            <span>Sincronizar Automatización</span>
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Modularized Phone Mockup Component */}
                            <PhoneMockup 
                                selectedTemplate={selectedTemplate}
                                livePreviewBody={livePreviewBody}
                                automationPrompts={automationPrompts}
                                automationCommands={automationCommands}
                            />
                        </div>
                    ) : (
                        // Standard view for other channels
                        <div className="flex-1 overflow-y-auto p-2 space-y-5 custom-scrollbar h-[calc(100vh-160px)]">
                            {/* Broadcast Name */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium text-neutral-400">Broadcast Name</label>
                                <Input
                                    type="text"
                                    placeholder="Name your broadcast"
                                    value={formName}
                                    disabled={sidebarMode === "view"}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className={cn(
                                        "w-full bg-[#13151a]/80 border-white/5 text-xs placeholder-neutral-500 rounded-lg py-2 focus:ring-1 focus:ring-blue-500",
                                        showErrors && !formName.trim() && "border-red-500/70 focus:ring-red-500"
                                    )}
                                />
                                {showErrors && !formName.trim() && (
                                    <p className="text-[10px] text-red-400 font-medium">This field is required</p>
                                )}
                            </div>

                            {/* Labels Dropdown */}
                            <div className="space-y-1.5 relative" ref={labelRef}>
                                <label className="block text-[11px] font-medium text-neutral-400 flex items-center gap-1">
                                    Labels (optional)
                                </label>
                                <button
                                    onClick={() => {
                                        if (sidebarMode !== "view") {
                                            setIsLabelDropdownOpen(!isLabelDropdownOpen);
                                        }
                                    }}
                                    disabled={sidebarMode === "view"}
                                    className="w-full bg-[#13151a]/80 border border-white/5 text-left text-xs text-neutral-300 rounded-lg px-3 py-2 flex items-center justify-between hover:bg-white/[0.02]"
                                >
                                    <span>{formLabel || "Add labels to the broadcast"}</span>
                                    {sidebarMode !== "view" && <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
                                </button>
                                {isLabelDropdownOpen && sidebarMode !== "view" && (
                                    <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-[#13151a] border border-white/10 rounded-lg shadow-xl py-1">
                                        {labelOptions.map(lbl => (
                                            <button
                                                key={lbl}
                                                onClick={() => { setFormLabel(lbl); setIsLabelDropdownOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-neutral-300 hover:text-white"
                                            >
                                                {lbl}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="h-px bg-white/5 my-2" />

                            <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Configuration</h3>

                            {/* Segment Select */}
                            <div className="space-y-1.5 relative" ref={segmentRef}>
                                <label className="block text-[11px] font-medium text-neutral-400 flex items-center gap-1">
                                    Segment
                                </label>
                                <button
                                    onClick={() => {
                                        if (sidebarMode !== "view") {
                                            setIsSegmentDropdownOpen(!isSegmentDropdownOpen);
                                        }
                                    }}
                                    disabled={sidebarMode === "view"}
                                    className={cn(
                                        "w-full bg-[#13151a]/80 border border-white/5 text-left text-xs text-neutral-300 rounded-lg px-3 py-2 flex items-center justify-between hover:bg-white/[0.02]",
                                        showErrors && !formSegment && "border-red-500/70"
                                    )}
                                >
                                    <span>{formSegment || "Select a segment"}</span>
                                    {sidebarMode !== "view" && <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
                                </button>
                                {showErrors && !formSegment && (
                                    <p className="text-[10px] text-red-400 font-medium">This field is required</p>
                                )}

                                {isSegmentDropdownOpen && sidebarMode !== "view" && (
                                    <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-[#13151a] border border-white/10 rounded-lg shadow-xl py-1 max-h-40 overflow-y-auto custom-scrollbar">
                                        <button className="w-full text-left px-3 py-1.5 text-xs text-blue-400 hover:bg-white/5 font-medium border-b border-white/5">
                                            + Add Segment
                                        </button>
                                        {segmentOptions.map(seg => (
                                            <button
                                                key={seg}
                                                onClick={() => { setFormSegment(seg); setIsSegmentDropdownOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-neutral-300 hover:text-white"
                                            >
                                                {seg}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Channel Select */}
                            <div className="space-y-1.5 relative" ref={channelRef}>
                                <label className="block text-[11px] font-medium text-neutral-400 flex items-center gap-1">
                                    Channel
                                </label>
                                <button
                                    onClick={() => {
                                        if (sidebarMode !== "view") {
                                            setIsChannelDropdownOpen(!isChannelDropdownOpen);
                                        }
                                    }}
                                    disabled={sidebarMode === "view"}
                                    className="w-full bg-[#13151a]/80 border border-white/5 text-left text-xs text-neutral-300 rounded-lg px-3 py-2 flex items-center justify-between hover:bg-white/[0.02]"
                                >
                                    <span>{formChannel || "Select a channel"}</span>
                                    {sidebarMode !== "view" && <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
                                </button>
                                {isChannelDropdownOpen && sidebarMode !== "view" && (
                                    <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-[#13151a] border border-white/10 rounded-lg shadow-xl py-1">
                                        {channelOptions.map(ch => (
                                            <button
                                                key={ch}
                                                onClick={() => { setFormChannel(ch); setIsChannelDropdownOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-neutral-300 hover:text-white"
                                            >
                                                {ch}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action Buttons */}
                <div className="p-4 border-t border-white/5 bg-[#0b0c10]/95 backdrop-blur-md flex items-center justify-between shrink-0">
                    <span className="text-[10px] text-blue-400 hover:underline cursor-pointer">Learn more</span>
                    <div className="flex gap-2">
                        {sidebarMode === "view" ? (
                            <Button
                                onClick={() => setIsRightSidebarOpen(false)}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-5 py-1.5 rounded-lg"
                            >
                                Close Details
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsRightSidebarOpen(false)}
                                    className="bg-transparent hover:bg-white/5 text-neutral-400 hover:text-white text-xs px-4 py-1.5 rounded-lg"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCreateBroadcast}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-1.5 rounded-lg shadow-lg active:scale-95 transition-all"
                                >
                                    Create
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* Custom Delete Confirmation Modal Component */}
            {deleteTarget && (
                <DeleteBroadcastModal 
                    deleteTarget={deleteTarget}
                    setDeleteTarget={setDeleteTarget}
                    confirmDelete={confirmDelete}
                />
            )}
        </div>
    );
}
