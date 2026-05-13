"use client";

import React from "react";
import { Send, Users, Smartphone, Mail, Globe, Sparkles, BarChart3, Filter, TrendingUp } from "lucide-react";


export default function CampaignsPage() {
    return (
        <div className="flex min-h-screen bg-[#0a0a0a] text-white overflow-y-auto custom-scrollbar">
            <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-6 sm:space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Campañas Omnicanal</h1>
                        <p className="text-neutral-400 mt-1 text-xs sm:text-sm leading-relaxed max-w-sm">
                            Lanza campañas masivas inteligentes en segundos.
                        </p>
                    </div>
                    <button className="w-full sm:w-auto bg-pink-600 hover:bg-pink-500 px-5 py-2 sm:py-1.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-pink-600/20 font-semibold text-xs active:scale-95">
                        <Send className="w-3.5 h-3.5" /> Crear Campaña
                    </button>
                </div>

                {/* Campaign Channels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        { icon: <Smartphone />, label: "kamban Masivo", desc: "Integrado con API oficial", color: "from-green-500/10 to-green-600/5", border: "border-green-500/20", iconColor: "text-green-500" },
                        { icon: <Mail />, label: "Email Marketing", desc: "Diseños responsivos e inteligentes", color: "from-blue-500/10 to-blue-600/5", border: "border-blue-500/20", iconColor: "text-blue-500" },
                        { icon: <Globe />, label: "Anuncios Dinámicos", desc: "Facebook, Instagram y TikTok", color: "from-purple-500/10 to-purple-600/5", border: "border-purple-500/20", iconColor: "text-purple-500" },
                    ].map((channel, i) => (
                        <div key={i} className={`bg-gradient-to-br ${channel.color} border ${channel.border} p-5 rounded-2xl cursor-pointer hover:bg-white/[0.02] transition-all group active:scale-95`}>
                            <div className={`bg-white/5 w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${channel.iconColor} group-hover:scale-110 transition-transform`}>
                                {React.cloneElement(channel.icon as React.ReactElement, { size: 18 })}
                            </div>
                            <h3 className="font-semibold text-sm sm:text-base text-white/90">{channel.label}</h3>
                            <p className="text-neutral-500 text-[11px] sm:text-xs mt-1 leading-relaxed">{channel.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Active Campaigns List */}
                    <div className="lg:col-span-3 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col p-5 sm:p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xs sm:text-sm font-semibold flex items-center gap-2 uppercase tracking-[0.2em] text-neutral-400">
                                <BarChart3 className="w-4 h-4 text-pink-500" /> 
                                Campañas Activas
                            </h2>
                            <button className="bg-white/5 p-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                                <Filter className="w-3.5 h-3.5 text-neutral-400" />
                            </button>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 sm:py-20 px-4 space-y-4">
                            <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center animate-pulse">
                                <Sparkles className="w-7 h-7 text-pink-400" />
                            </div>
                            <div className="max-w-xs mx-auto">
                                <p className="text-white/80 font-semibold text-xs sm:text-sm uppercase tracking-wider">No hay campañas programadas hoy</p>
                                <p className="text-[11px] sm:text-xs text-neutral-500 mt-2 leading-relaxed">
                                    Usa nuestra IA para generar copys persuasivos y lanza tu primera campaña ahora para maximizar tu alcance.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Audience Section */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 sm:p-6">
                        <h2 className="text-xs sm:text-sm font-semibold mb-6 flex items-center gap-2 uppercase tracking-[0.2em] text-neutral-400">
                            <Users className="w-4 h-4 text-blue-500" /> 
                            Audiencias
                        </h2>
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Total Alcance</p>
                                <p className="text-2xl font-bold mt-1 text-white">14,240</p>
                                <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                                    <TrendingUp className="w-3 h-3" /> ↑ 12% desde el mes pasado
                                </p>
                            </div>
                            <div className="space-y-3">
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em] px-1">Segmentos Top</p>
                                {["Clientes Hot", "Olvidados", "Nuevos Leads"].map((tag, idx) => (
                                    <div key={idx} className="flex items-center justify-between px-2 py-1.5 text-[11px] font-medium text-neutral-400 hover:text-white transition-colors cursor-default">
                                        <span>{tag}</span>
                                        <span className="text-blue-400 font-mono text-[10px]">{100 - (idx * 20)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


