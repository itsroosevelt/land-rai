'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReactFlow, {
    Background,
    Node,
    Edge,
    Position,
    NodeProps,
    useNodesState,
    useEdgesState,
    ReactFlowInstance,
    MiniMap,
    Controls,
    Handle,
    BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    FileCheck, Scale, MessageSquare, TrendingUp, FileText, Megaphone, Cpu, Activity, Package, BookOpen, Contact, Brain, Users, Search, Award, Truck, Settings, Layout, Building, PieChart, Gavel, Coffee, Lightbulb, Briefcase, Share2, Server, Network, LifeBuoy, Calendar, Code2, Database, UserPlus, Globe, Shield, PenTool, Lock, Rocket, Landmark, Bot, Layers, ShieldAlert, CreditCard, Heart, Crown, GraduationCap, Target, BarChart, Send, Zap, DollarSign, ChevronDown, Handshake, Fingerprint, Key, Sun, Phone, Smartphone, ShoppingBag, Globe2, Terminal, Workflow, ZapOff, Anchor, Bell, Box, CheckCircle, Clipboard, Compass, Eye, Filter, Gift, HelpCircle, Image, Link, List, Mail, Map, MapPin, Mic, Moon, MousePointer, Music, Navigation, Paperclip, Play, Plus, Power, Printer, Radio, Save, Scissors, Share, Star, Table, Tag, Thermometer, ThumbsUp, Trash, Video, Volume2, Watch, Wifi, Wind, Smile, X, Edit3, Move, ExternalLink, Grid3X3, Square, ShieldCheck, BriefcaseIcon, Microscope, HardHat, ArrowLeft
} from "lucide-react";
import { WindowNode } from '@/components/shared/WindowNode';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// --- CONSTANTS ---
const PIXELS_PER_INCH = 96;

// --- THEMES ---
const themes: Record<string, any> = {
    cyan: { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)', shadow: 'rgba(6,182,212,0.3)', blur: 'bg-cyan-500/30', iconBg: 'bg-cyan-500/20', iconText: 'text-cyan-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' },
    amber: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', shadow: 'rgba(245, 158, 11, 0.3)', blur: 'bg-amber-500/30', iconBg: 'bg-amber-500/20', iconText: 'text-amber-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(245, 158, 11, 0.6)]' },
    blue: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', shadow: 'rgba(59,130,246,0.3)', blur: 'bg-blue-500/30', iconBg: 'bg-blue-500/20', iconText: 'text-blue-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(59, 130, 246, 0.6)]' },
    emerald: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', shadow: 'rgba(16,185,129,0.3)', blur: 'bg-emerald-500/30', iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(16, 185, 129, 0.6)]' },
    rose: { bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)', shadow: 'rgba(244,63,94,0.3)', blur: 'bg-rose-500/30', iconBg: 'bg-rose-500/20', iconText: 'text-rose-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(244, 63, 94, 0.6)]' },
    purple: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)', shadow: 'rgba(168,85,247,0.3)', blur: 'bg-purple-500/30', iconBg: 'bg-purple-500/20', iconText: 'text-purple-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(168, 85, 247, 0.6)]' },
    orange: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', shadow: 'rgba(249,115,22,0.3)', blur: 'bg-orange-500/30', iconBg: 'bg-orange-500/20', iconText: 'text-orange-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(249, 115, 22, 0.6)]' },
    indigo: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)', shadow: 'rgba(99,102,241,0.3)', blur: 'bg-indigo-500/30', iconBg: 'bg-indigo-500/20', iconText: 'text-indigo-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(99, 102, 241, 0.6)]' },
    red: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', shadow: 'rgba(239,68,68,0.3)', blur: 'bg-red-500/30', iconBg: 'bg-red-500/20', iconText: 'text-red-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(239, 68, 68, 0.6)]' },
    slate: { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.3)', shadow: 'rgba(100,116,139,0.3)', blur: 'bg-slate-500/30', iconBg: 'bg-slate-500/20', iconText: 'text-slate-400', iconShadow: 'drop-shadow-[0_0_8px_rgba(100, 116, 139, 0.6)]' }
};

const DEPARTMENTS_DATA: Record<string, { title: string, layers: any[] }> = {
    board: { title: "Board of Directors", layers: [
        { id: 'board-treasury', label: 'MultiSig Treasury', path: 'board-treasury', icon: Landmark, theme: 'slate' },
        { id: 'legal-audit', label: 'Protocol Compliance', path: 'legal-audit', icon: FileCheck, theme: 'slate' },
        { id: 'governance', label: 'Protocol Governance', path: 'governance', icon: Gavel, theme: 'slate' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },
    
    ceo: { title: "Executive Center", layers: [
        { id: 'board-liaison', label: 'Board Liaison', path: 'board-liaison', icon: Users, theme: 'amber' },
        { id: 'crisis-management', label: 'Crisis Management', path: 'crisis-management', icon: ShieldAlert, theme: 'amber' },
        { id: 'culture-steering', label: 'Culture Steering', path: 'culture-steering', icon: Heart, theme: 'amber' },
        { id: 'esg', label: 'ESG & Impact', path: 'esg', icon: Globe, theme: 'amber' },
        { id: 'executive-dashboard', label: 'Executive Dashboard', path: 'executive-dashboard', icon: Layout, theme: 'amber' },
        { id: 'kpis', label: 'Global KPIs', path: 'kpis', icon: BarChart, theme: 'amber' },
        { id: 'investor-relations', label: 'Investor Relations', path: 'investor-relations', icon: Handshake, theme: 'amber' },
        { id: 'ma', label: 'M&A Strategy', path: 'ma', icon: BriefcaseIcon, theme: 'amber' },
        { id: 'public-relations', label: 'Public Relations', path: 'public-relations', icon: Megaphone, theme: 'amber' },
        { id: 'strategy', label: 'Vision & Strategy', path: 'strategy', icon: Target, theme: 'amber' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },
    
    coo: { title: "Operations Center", layers: [
        { id: 'cx', label: 'Customer Experience', path: 'cx', icon: Smile, theme: 'cyan' },
        { id: 'facilities', label: 'Facilities Management', path: 'facilities', icon: Building, theme: 'cyan' },
        { id: 'procurement', label: 'Global Procurement', path: 'procurement', icon: ShoppingBag, theme: 'cyan' },
        { id: 'visas', label: 'Global Visas', path: 'visas', icon: Globe, theme: 'cyan' },
        { id: 'logistics', label: 'Neural Logistics', path: 'logistics', icon: Share2, theme: 'cyan' },
        { id: 'omnichannel', label: 'Omnichannel Engine', path: 'omnichannel', icon: MessageSquare, theme: 'cyan' },
        { id: 'kamban', label: 'Operational Kamban', path: 'kamban', icon: Layout, theme: 'cyan' },
        { id: 'team', label: 'Operations Team', path: 'team', icon: Users, theme: 'cyan' },
        { id: 'quality', label: 'Quality Assurance', path: 'quality', icon: Award, theme: 'cyan' },
        { id: 'supply', label: 'Supply Chain', path: 'supply', icon: Truck, theme: 'cyan' },
        { id: 'whatsapp', label: 'WhatsApp Flows', path: 'whatsapp', icon: Smartphone, theme: 'cyan' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },
    
    cto: { title: "Technology Center", layers: [
        { id: 'orchestrator', label: 'AI Orchestrator', path: 'orchestrator', icon: Cpu, theme: 'cyan' },
        { id: 'voice-center', label: 'AI Voice Center', path: 'voice-center', icon: Phone, theme: 'cyan' },
        { id: 'web-builder', label: 'AI Web Builder', path: 'web-builder', icon: Globe, theme: 'cyan' },
        { id: 'api', label: 'API Gateway', path: 'api', icon: Code2, theme: 'cyan' },
        { id: 'cloud', label: 'Cloud Infrastructure', path: 'cloud', icon: Server, theme: 'cyan' },
        { id: 'integrations', label: 'Cloud Integrations', path: 'integrations', icon: Network, theme: 'cyan' },
        { id: 'security', label: 'Cyber Security', path: 'security', icon: Shield, theme: 'cyan' },
        { id: 'data', label: 'Data Warehouse', path: 'data', icon: Database, theme: 'cyan' },
        { id: 'devops', label: 'DevOps Pipeline', path: 'devops', icon: Terminal, theme: 'cyan' },
        { id: 'meet-agents', label: 'Meet AI Agents', path: 'meet-agents', icon: Bot, theme: 'cyan' },
        { id: 'automation', label: 'Neural Automation', path: 'automation', icon: Workflow, theme: 'cyan' },
        { id: 'quantum', label: 'Quantum Protocols', path: 'quantum', icon: Zap, theme: 'cyan' },
        { id: 'smart-contracts', label: 'Smart Contracts', path: 'smart-contracts', icon: FileText, theme: 'cyan' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },
    
    cfo: { title: "Financial Center", layers: [
        { id: 'audit-prep', label: 'Audit Prep', path: 'audit-prep', icon: FileCheck, theme: 'emerald' },
        { id: 'billing', label: 'Billing Engine', path: 'billing', icon: CreditCard, theme: 'emerald' },
        { id: 'cash-flow', label: 'Cash Flow', path: 'cash-flow', icon: Landmark, theme: 'emerald' },
        { id: 'revenue', label: 'Revenue Streams', path: 'revenue', icon: TrendingUp, theme: 'emerald' },
        { id: 'tax', label: 'Tax Management', path: 'tax', icon: Gavel, theme: 'emerald' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },
    
    cmo: { title: "Marketing Center", layers: [
        { id: 'affiliates', label: 'Affiliate Program', path: 'affiliates', icon: Link, theme: 'orange' },
        { id: 'brand', label: 'Brand Identity', path: 'brand', icon: Award, theme: 'orange' },
        { id: 'content', label: 'Content Factory', path: 'content', icon: PenTool, theme: 'orange' },
        { id: 'events', label: 'Corporate Events', path: 'events', icon: Calendar, theme: 'orange' },
        { id: 'crm', label: 'Customer Relations', path: 'crm', icon: Contact, theme: 'orange' },
        { id: 'loyalty', label: 'Loyalty Programs', path: 'loyalty', icon: Gift, theme: 'orange' },
        { id: 'analytics', label: 'Market Analytics', path: 'analytics', icon: BarChart, theme: 'orange' },
        { id: 'goals', label: 'Marketing Goals', path: 'goals', icon: Target, theme: 'orange' },
        { id: 'campaigns', label: 'Omni Campaigns', path: 'campaigns', icon: Megaphone, theme: 'orange' },
        { id: 'market-share', label: 'Market Share', path: 'market-share', icon: PieChart, theme: 'orange' },
        { id: 'seo', label: 'SEO Engine', path: 'seo', icon: Search, theme: 'orange' },
        { id: 'social', label: 'Social Media', path: 'social', icon: Share2, theme: 'orange' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },
    
    chro: { title: "Human Resources Center", layers: [
        { id: 'hris', label: 'HR Registry', path: 'hris', icon: Users, theme: 'purple' },
        { id: 'payroll', label: 'Payroll Engine', path: 'payroll', icon: DollarSign, theme: 'purple' },
        { id: 'heart', label: 'Performance', path: 'heart', icon: Heart, theme: 'purple' },
        { id: 'recruitment', label: 'Talent Acquisition', path: 'recruitment', icon: UserPlus, theme: 'purple' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },
    
    cso: { title: "Strategy Center", layers: [
        { id: 'expansion', label: 'Global Expansion', path: 'expansion', icon: Globe, theme: 'red' },
        { id: 'growth', label: 'Growth Strategy', path: 'growth', icon: Zap, theme: 'red' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },

    ciso: { title: "Security Center", layers: [
        { id: 'threats', label: 'Threat Intelligence', path: 'threats', icon: ShieldAlert, theme: 'blue' },
        { id: 'compliance', label: 'InfoSec Compliance', path: 'compliance', icon: ShieldCheck, theme: 'blue' },
        { id: 'sec-ops', label: 'Security Ops', path: 'sec-ops', icon: Lock, theme: 'blue' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },

    clo: { title: "Legal Center", layers: [
        { id: 'contracts', label: 'Contract Lifecycle', path: 'contracts', icon: FileText, theme: 'slate' },
        { id: 'litigation', label: 'Litigation Center', path: 'litigation', icon: Gavel, theme: 'slate' },
        { id: 'ip', label: 'Intellectual Property', path: 'ip', icon: Lightbulb, theme: 'slate' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },

    cpo: { title: "Product Center", layers: [
        { id: 'roadmap', label: 'Product Roadmap', path: 'roadmap', icon: Map, theme: 'indigo' },
        { id: 'discovery', label: 'User Discovery', path: 'discovery', icon: Search, theme: 'indigo' },
        { id: 'design', label: 'Design System', path: 'design', icon: PenTool, theme: 'indigo' }
    ].sort((a, b) => a.label.localeCompare(b.label)) },

    cdo: { title: "Data Center", layers: [
        { id: 'governance', label: 'Data Governance', path: 'governance', icon: Database, theme: 'purple' },
        { id: 'bi', label: 'Business Intelligence', path: 'bi', icon: BarChart, theme: 'purple' },
        { id: 'ml', label: 'Neural Modeling', path: 'ml', icon: Brain, theme: 'purple' }
    ].sort((a, b) => a.label.localeCompare(b.label)) }
};

// --- NODES ---

const AxesNode = () => (
    <div className="relative pointer-events-none w-[20000px] h-[20000px] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full border-l border-dashed border-white/20 z-[1]" />
        <div className="absolute top-1/2 left-0 w-full h-[1px] border-t border-dashed border-white/20 z-[1]" />
        <div className="absolute inset-0 z-[1]">
            {Array.from({ length: 100 }).map((_, i) => {
                const pos = (i - 50) * PIXELS_PER_INCH;
                if (i === 50) return null;
                return (
                    <div key={`tick-y-${i}`} style={{ top: `calc(50% + ${pos}px)`, left: '50%' }} className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center">
                        <div className="w-2 h-[1px] bg-white/40" />
                        <span className="ml-2 text-[8px] font-mono text-white/20">{- (i - 50)}"</span>
                    </div>
                );
            })}
            {Array.from({ length: 100 }).map((_, i) => {
                const pos = (i - 50) * PIXELS_PER_INCH;
                if (i === 50) return null;
                return (
                    <div key={`tick-x-${i}`} style={{ left: `calc(50% + ${pos}px)`, top: '50%' }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                        <div className="h-2 w-[1px] bg-white/40" />
                        <span className="mt-2 text-[8px] font-mono text-white/20">{i - 50}"</span>
                    </div>
                );
            })}
        </div>
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 text-white/10 text-xl font-mono uppercase tracking-[1em]">Y+ NORTE</div>
        <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 text-white/10 text-xl font-mono uppercase tracking-[1em]">Y- SUR</div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white/40 rounded-full blur-[2px] z-[2]" />
    </div>
);

const TitleNode = ({ data }: NodeProps) => (
    <div className="pointer-events-none select-none flex flex-col items-center" style={{ transform: 'translate(-50%, -50%)' }}>
        <h1 className="text-6xl md:text-8xl font-thin text-white tracking-tighter whitespace-nowrap drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            {data.title}
        </h1>
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mt-4" />
    </div>
);

const LayerNode = ({ data }: NodeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [lastTap, setLastTap] = useState(0);
    const theme = themes[data.theme || 'cyan'];
    
    return (
        <div className="relative group">
            <AnimatePresence>
                {isHovered && (
                    <motion.div initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: -280 }} exit={{ opacity: 0, y: 0 }} className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[50] pointer-events-none">
                        <span className="text-2xl font-black tracking-[0.4em] uppercase text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)] whitespace-nowrap">
                            {data.label}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
            <motion.div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => {
                    const now = Date.now();
                    const DOUBLE_TAP_DELAY = 500;
                    if (now - lastTap < DOUBLE_TAP_DELAY) {
                        data.onDoubleClick?.();
                    } else {
                        data.onClick?.();
                    }
                    setLastTap(now);
                }}
                className={cn(
                    "w-[380px] md:w-[460px] h-[380px] md:h-[460px] rounded-[6rem] backdrop-blur-[40px] border transition-all duration-300 flex flex-col items-center justify-center cursor-pointer pointer-events-auto",
                    isHovered ? "scale-105" : "scale-100"
                )}
                style={{
                    transform: 'translate(-50%, -50%) rotateX(60deg) rotateZ(-45deg)',
                    transformStyle: 'preserve-3d',
                    backgroundColor: isHovered ? theme.bg : (data.isPrimary ? 'rgba(255, 255, 255, 0.04)' : theme.bg.replace('0.15', '0.03')),
                    borderColor: isHovered ? theme.border : (data.isPrimary ? 'rgba(255, 255, 255, 0.45)' : theme.border.replace('0.3', '0.2')),
                    boxShadow: isHovered 
                        ? `inset 0 0 100px ${theme.shadow}, 0 50px 100px rgba(0,0,0,0.8), 0 0 40px ${theme.shadow}` 
                        : (data.isPrimary 
                            ? '0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,255,255,0.1), 0 0 20px rgba(255,255,255,0.1)'
                            : `0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px ${theme.shadow.replace('0.3', '0.05')}, 0 0 20px ${theme.shadow.replace('0.3', '0.1')}`
                        ),
                }}
            >
                {data.icon && (
                    <div style={{ transform: 'rotateZ(45deg) rotateX(-20deg)' }} className={cn(
                        "p-8 rounded-full transition-all duration-300",
                        isHovered ? theme.iconBg : "bg-white/5"
                    )}>
                        <data.icon className={cn(
                            "w-24 h-24 transition-all duration-300",
                            isHovered ? theme.iconText : (data.isPrimary ? "text-white/20" : theme.iconText.replace('text-', 'text-').replace('400', '400/30')),
                            isHovered && theme.iconShadow
                        )} />
                    </div>
                )}
            </motion.div>
        </div>
    );
};

const ActionNode = ({ data }: NodeProps) => (
    <div className="relative group cursor-pointer pointer-events-auto" style={{ transform: 'translate(-50%, -50%)' }} onClick={data.onClick}>
        <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center gap-3 px-8 py-4 rounded-[2rem] bg-neutral-900/80 backdrop-blur-md border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all group-hover:border-cyan-500/50 group-hover:bg-neutral-800/90"
        >
            <ArrowLeft className="w-5 h-5 text-white/50 group-hover:text-cyan-400 transition-colors" />
            <span className="text-sm font-black tracking-[0.2em] uppercase text-white/70 group-hover:text-white transition-colors">
                {data.label}
            </span>
        </motion.div>
    </div>
);

const FolderNode = ({ data }: NodeProps) => {
    const theme = themes[data.theme || 'cyan'];
    const [isHovered, setIsHovered] = useState(false);
    const [lastTap, setLastTap] = useState(0);

    return (
        <div 
            className="group cursor-pointer pointer-events-auto"
            style={{ transform: 'translate(-50%, -50%) rotateX(60deg) rotateZ(-45deg)', transformStyle: 'preserve-3d' }}
        >
            <motion.div 
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => {
                    const now = Date.now();
                    const DOUBLE_TAP_DELAY = 500;
                    if (now - lastTap < DOUBLE_TAP_DELAY) {
                        data.onDoubleClick?.();
                    } else {
                        data.onClick?.();
                    }
                    setLastTap(now);
                }}
                whileHover={{ scale: 1.05 }}
                className={cn(
                    "w-[420px] h-[420px] rounded-[6rem] border-4 border-dashed transition-all duration-300 flex flex-col items-center justify-center backdrop-blur-3xl",
                    isHovered ? theme.bg : "bg-white/5"
                )}
                style={{ borderColor: theme.border, boxShadow: `0 0 60px ${theme.shadow}, inset 0 0 40px ${theme.shadow}` }}
            >
                <div className="flex flex-col items-center gap-6" style={{ transform: 'rotateZ(45deg) rotateX(-20deg)' }}>
                    <div className={cn("p-8 rounded-full shadow-2xl", theme.iconBg)}>
                        {data.icon ? (
                            <data.icon className={cn("w-20 h-20", theme.iconText)} />
                        ) : (
                            <Layers className={cn("w-20 h-20", theme.iconText)} />
                        )}
                    </div>
                    <div className="text-center space-y-1">
                        <span className="block text-6xl font-thin tracking-[0.1em] text-white uppercase drop-shadow-2xl">{data.role}</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const nodeTypes = { axesNode: AxesNode, titleNode: TitleNode, layerNode: LayerNode, windowNode: WindowNode, actionNode: ActionNode, folderNode: FolderNode };

export default function UnifiedWorkspace() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const entityId = params.entityId as string;
    const { currentUser, activeEntity } = useAuth();
    
    const roleParam = searchParams.get('role') || 'ceo';
    const [activeRole, setActiveRole] = useState<string>(roleParam);

    useEffect(() => {
        if (roleParam !== activeRole) {
            setActiveRole(roleParam);
            setExpandedDepts([]);
            setOpenWindows([]);
        }
    }, [roleParam, activeRole]);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [gridType, setGridType] = useState<'none' | 'dots' | 'lines'>('none');
    const [savedLayout, setSavedLayout] = useState<Record<string, { x: number, y: number }>>({});
    const [expandedDepts, setExpandedDepts] = useState<string[]>([]);

    const currentDeptData = useMemo(() => DEPARTMENTS_DATA[activeRole] || DEPARTMENTS_DATA.ceo, [activeRole]);

    const toCanvas = (xInches: number, yInches: number) => ({ x: xInches * PIXELS_PER_INCH, y: -yInches * PIXELS_PER_INCH });
    const fromCanvas = (xPixels: number, yPixels: number) => ({ x: Math.round(xPixels / PIXELS_PER_INCH * 100) / 100, y: Math.round(-yPixels / PIXELS_PER_INCH * 100) / 100 });

    // --- REGLA 4: PERSISTENCIA EN LA BÓVEDA ---
    useEffect(() => {
        if (!currentUser || !activeEntity) return;
        // Cambiamos a un documento 'global' para que todos los roles compartan las mismas ventanas
        const layoutRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/workspace-layout`, 'global');
        
        const unsubscribe = onSnapshot(layoutRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSavedLayout(data.positions || {});
                setPersistedWindows(data.openWindows || []);
            }
        });
        return () => unsubscribe();
    }, [currentUser, activeEntity]); // Eliminamos activeRole como dependencia para evitar resets de snapshot

    const savePosition = async (nodeId: string, xInches: number, yInches: number) => {
        if (!currentUser || !activeEntity) return;
        const layoutRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/workspace-layout`, 'global');
        const newPositions = { ...savedLayout, [nodeId]: { x: xInches, y: yInches } };
        await setDoc(layoutRef, { positions: newPositions }, { merge: true });
    };

    const persistWindowState = async (windowIds: string[]) => {
        if (!currentUser || !activeEntity) return;
        const layoutRef = doc(db, `users/${currentUser.uid}/entities/${activeEntity}/workspace-layout`, 'global');
        await setDoc(layoutRef, { openWindows: windowIds }, { merge: true });
    };

    const updateNodePosition = (nodeId: string, xInches: number, yInches: number) => {
        const newPos = toCanvas(xInches, yInches);
        setNodes((nds) => nds.map((node) => node.id === nodeId ? { ...node, position: newPos } : node));
        savePosition(nodeId, xInches, yInches);
    };

    const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);
    const cartesianPos = useMemo(() => selectedNode ? fromCanvas(selectedNode.position.x, selectedNode.position.y) : { x: 0, y: 0 }, [selectedNode]);

    const spawnWindow = (layer: any) => {
        setNodes((nds) => {
            if (nds.some(node => node.id === `window-${layer.id}`)) return nds;

            const windowCount = nds.filter(node => node.id.startsWith('window-')).length;
            const xInches = 15 + (windowCount * 10);
            const yInches = -15 - (windowCount * 10);
            const pos = toCanvas(xInches, yInches);

            const uniqueId = `window-${layer.role || activeRole}-${layer.id}`;
            const newNode: Node = {
                id: uniqueId,
                type: 'windowNode',
                position: pos,
                data: {
                    id: layer.id, label: layer.label, icon: layer.icon,
                    url: `/nucleo/${entityId}/${layer.role || activeRole}/${layer.path}`,
                    onClose: () => {
                        setOpenWindows(prev => prev.filter(id => id !== uniqueId));
                        setNodes(currNodes => currNodes.filter(n => n.id !== uniqueId));
                    }
                }
            };

            setOpenWindows(prev => prev.includes(uniqueId) ? prev : [...prev, uniqueId]);
            
            return [...nds, newNode];
        });
    };

    // Función para encontrar un layer y su rol correspondiente en cualquier departamento
    const findLayerAcrossDepts = (layerId: string) => {
        for (const role in DEPARTMENTS_DATA) {
            const layer = (DEPARTMENTS_DATA as any)[role].layers.find((l: any) => l.id === layerId);
            if (layer) return { layer, role };
        }
        return null;
    };

    // --- GESTIÓN DE NODOS BASE (DEPARTAMENTO) ---
    useEffect(() => {
        const baseNodes: Node[] = [];
        
        // Ejes
        baseNodes.push({ id: 'global-axes', type: 'axesNode', position: { x: 0, y: 0 }, draggable: false, selectable: false, zIndex: -1, data: {} });

        // Título
        const titleSaved = savedLayout['dept-title'] || { x: 0, y: -3 };
        baseNodes.push({
            id: 'dept-title', type: 'titleNode', position: toCanvas(titleSaved.x, titleSaved.y),
            draggable: true, style: { pointerEvents: 'none' }, data: { title: currentDeptData.title }
        });

        // Retorno
        const actionSaved = savedLayout['action-return'] || { x: 0, y: -4.5 };
        baseNodes.push({
            id: 'action-return', type: 'actionNode', position: toCanvas(actionSaved.x, actionSaved.y),
            draggable: true, zIndex: 110, data: { 
                label: 'Regresar a la Suite',
                onClick: () => router.push(`/nucleo/${entityId}`)
            }
        });

        const toggleDept = (role: string) => {
            setExpandedDepts(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
        };

        const allNodesData: any[] = [];
        
        const rainbowThemes = ['rose', 'orange', 'amber', 'emerald', 'cyan', 'blue', 'indigo', 'purple', 'slate'];

        // 1. Capas del rol activo (CTO) - Siempre expandidas y BLANCAS
        currentDeptData.layers.forEach(layer => {
            allNodesData.push({ ...layer, role: activeRole, type: 'layer', isPrimary: true });
        });

        // 2. Capas de todos los demás departamentos (Colapsables y ARCOIRIS)
        let deptIndex = 0;
        Object.entries(DEPARTMENTS_DATA).forEach(([role, dept]) => {
            if (role === activeRole) return;
            
            const isExpanded = expandedDepts.includes(role);
            const theme = rainbowThemes[deptIndex % rainbowThemes.length];
            deptIndex++;
            
            if (isExpanded) {
                // Si está expandido, añadir botón de colapsar + todas las capas
                allNodesData.push({ 
                    id: `folder-${role}`, 
                    title: dept.title, 
                    role: role.toUpperCase(),
                    icon: dept.layers[0]?.icon,
                    theme: theme, 
                    type: 'folder', 
                    isExpanded: true,
                    onClick: () => toggleDept(role),
                    onDoubleClick: () => spawnWindow({ ...dept.layers[0], role })
                });
                dept.layers.forEach(layer => {
                    allNodesData.push({ ...layer, role: role, type: 'layer', theme: theme, isPrimary: false });
                });
            } else {
                // Si está colapsado, añadir solo el folder
                allNodesData.push({ 
                    id: `folder-${role}`, 
                    title: dept.title, 
                    role: role.toUpperCase(),
                    icon: dept.layers[0]?.icon,
                    theme: theme, 
                    type: 'folder', 
                    isExpanded: false,
                    onClick: () => toggleDept(role),
                    onDoubleClick: () => spawnWindow({ ...dept.layers[0], role })
                });
            }
        });

        allNodesData.forEach((item, index) => {
            const nodeId = item.type === 'folder' ? item.id : `layer-${item.role}-${item.id}`;
            const saved = savedLayout[nodeId] || { x: 0, y: -7 - (index * 2) };
            
            if (item.type === 'folder') {
                newNodes.push({
                    id: nodeId, type: 'folderNode', position: toCanvas(saved.x, saved.y),
                    draggable: false, zIndex: 1000 - index,
                    data: { ...item }
                });
            } else {
                newNodes.push({
                    id: nodeId, type: 'layerNode', position: toCanvas(saved.x, saved.y),
                    draggable: false, zIndex: 1000 - index,
                    style: { zIndex: 1000 - index, pointerEvents: 'none' },
                    data: { 
                        ...item, 
                        onClick: () => setSelectedNodeId(nodeId),
                        onDoubleClick: () => spawnWindow(item)
                    }
                });
            }
        });

        setNodes(prev => {
            const windowNodes = prev.filter(n => n.type === 'windowNode');
            return [...newNodes, ...windowNodes];
        });
    }, [activeRole, entityId, savedLayout, currentDeptData, expandedDepts]);

    const onNodeDragStop = (event: any, node: Node) => {
        if (node.id === 'dept-title' || node.id === 'action-return' || node.id.startsWith('layer-') || node.type === 'windowNode') {
            const pos = node.type === 'windowNode' ? node.position : fromCanvas(node.position.x, node.position.y);
            savePosition(node.id, pos.x, pos.y);
        }
    };

    return (
        <div className="w-full h-screen bg-black flex flex-col relative overflow-hidden">
            <AnimatePresence>
                {selectedNodeId && selectedNode && !isMobile && (
                    <motion.div initial={{ x: -400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -400, opacity: 0 }} className="fixed left-8 top-[58%] -translate-y-1/2 z-[300] w-64 bg-[#0D0F14]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-[0_0_80px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3 text-white/40"><Move className="w-4 h-4" /><span className="text-[10px] font-bold tracking-[0.2em] uppercase">Coordenadas</span></div>
                            <button onClick={() => setSelectedNodeId(null)} className="text-white/20 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div><div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1 px-1">Elemento</div><div className="text-sm font-medium text-white/90 px-1 truncate">{selectedNode.data.label || selectedNode.data.title}</div></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2"><label className="text-[9px] font-bold text-white/30 uppercase tracking-widest px-1">Eje X</label><input type="number" step="0.1" value={cartesianPos.x} onChange={(e) => updateNodePosition(selectedNodeId, Number(e.target.value), cartesianPos.y)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500/50 transition-all" /></div>
                                <div className="space-y-2"><label className="text-[9px] font-bold text-white/30 uppercase tracking-widest px-1">Eje Y</label><input type="number" step="0.1" value={cartesianPos.y} onChange={(e) => updateNodePosition(selectedNodeId, cartesianPos.x, Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500/50 transition-all" /></div>
                            </div>
                            <div className="pt-2">{selectedNode.id.startsWith('layer-') && (<button onClick={() => spawnWindow(selectedNode.data)} className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-2xl transition-all shadow-[0_10px_30px_rgba(6,182,212,0.3)] active:scale-95 flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" /><span>ABRIR MÓDULO</span></button>)}</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={cn(
                "fixed bottom-8 z-[200] flex gap-2 bg-[#0D0F14]/90 backdrop-blur-3xl border border-white/10 p-2 rounded-2xl shadow-2xl transition-all",
                isMobile ? "right-4 scale-[0.6] origin-right bottom-4 p-1.5" : "right-[240px]"
            )}>
                <button onClick={() => setGridType('none')} className={cn("p-2 md:p-3 rounded-xl transition-all", gridType === 'none' ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40")} title="Sin Cuadrícula"><Square className="w-5 h-5" /></button>
                <button onClick={() => setGridType('dots')} className={cn("p-2 md:p-3 rounded-xl transition-all", gridType === 'dots' ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40")} title="Puntos"><div className="w-5 h-5 flex items-center justify-center font-black text-xs">.</div></button>
                <button onClick={() => setGridType('lines')} className={cn("p-2 md:p-3 rounded-xl transition-all", gridType === 'lines' ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40")} title="Líneas"><Grid3X3 className="w-5 h-5" /></button>
            </div>
            <div className={cn("fixed bottom-8 left-8 z-[200] transition-all", isMobile && "left-4 bottom-4 scale-[0.6] origin-left")}>
                <button onClick={() => router.push(`/nucleo/${entityId}`)} className="w-16 h-16 bg-[#0D0F14]/90 backdrop-blur-3xl border border-white/10 rounded-2xl flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.9)] hover:border-cyan-500/50 hover:scale-105 transition-all active:scale-95 group">
                    <span className="text-white/40 group-hover:text-cyan-400 font-black text-3xl transition-colors tracking-tighter">N</span>
                </button>
            </div>

            <div className="flex-1 w-full h-full relative z-0">
                <ReactFlow 
                    nodes={nodes} 
                    edges={edges} 
                    onNodesChange={onNodesChange} 
                    onEdgesChange={onEdgesChange} 
                    onNodeClick={(e, n) => (n.id.startsWith('layer-') || n.id === 'dept-title' || n.type === 'windowNode') && setSelectedNodeId(n.id)} 
                    onNodeDragStop={onNodeDragStop} 
                    nodeTypes={nodeTypes} 
                    className="bg-[#050505]" 
                    proOptions={{ hideAttribution: true }} 
                    minZoom={0.01} 
                    maxZoom={4} 
                    fitView 
                    fitViewOptions={{ 
                        padding: 0.2,
                        nodes: nodes.filter(n => n.id === 'dept-title' || n.id.startsWith('layer-')),
                        duration: 800
                    }}
                >
                    {gridType !== 'none' && <Background variant={gridType === 'dots' ? BackgroundVariant.Dots : BackgroundVariant.Lines} color="#ffffff" gap={PIXELS_PER_INCH} size={1} className="opacity-[0.03]" />}
                    <MiniMap style={{ backgroundColor: '#0D0F14', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }} maskColor="rgba(0, 0, 0, 0.8)" nodeColor={(n) => n.type === 'layerNode' ? '#06b6d4' : n.type === 'titleNode' ? '#ffffff' : '#ffffff05'} />
                    <Controls className="bg-[#0D0F14]/90 border-white/10 rounded-xl overflow-hidden" />
                </ReactFlow>
            </div>
        </div>
    );
}
