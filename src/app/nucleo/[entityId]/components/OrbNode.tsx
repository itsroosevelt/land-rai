'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LucideIcon, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface OrbNodeProps {
    href?: string;
    onClick?: () => void;
    icon: LucideIcon;
    title: string;
    subtitle: string;
    color: string;
    isComingSoon?: boolean;
}

const shadowColors: Record<string, string> = {
    blue: 'rgba(59, 130, 246, 0.5)',
    emerald: 'rgba(16, 185, 129, 0.5)',
    purple: 'rgba(168, 85, 247, 0.5)',
    slate: 'rgba(100, 116, 139, 0.5)',
    amber: 'rgba(245, 158, 11, 0.5)',
    pink: 'rgba(236, 72, 153, 0.5)',
    rose: 'rgba(244, 63, 94, 0.5)',
    indigo: 'rgba(99, 102, 241, 0.5)',
    orange: 'rgba(249, 115, 22, 0.5)',
};

export const OrbNode = ({ href, onClick, icon: Icon, title, subtitle, color, isComingSoon = false }: OrbNodeProps) => {
    const { activeEntityRoute } = useAuth();
    const finalHref = href?.replace('{entity}', activeEntityRoute || '');

    const handleBlockedClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toast.info(`${title} (${subtitle})`, {
            description: 'This suite will be available soon in the enterprise environment.',
            duration: 3000,
        });
    };

    const InnerContent = (
        <>
            <motion.div
                className="flex items-center justify-center transition-all duration-500 relative"
                whileHover={!isComingSoon ? {
                    filter: `drop-shadow(0 0 35px ${shadowColors[color] || 'rgba(255,255,255,0.4)'})`,
                    scale: 1.12
                } : undefined}
            >
                <div className="relative flex items-center justify-center">
                    <Icon className={`w-10 h-10 transition-colors duration-500 ${
                        isComingSoon
                            ? 'text-white/35 group-hover:text-white/50'
                            : 'text-white/70 group-hover:text-white'
                    }`} />

                    {isComingSoon && (
                        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[8px] font-medium tracking-[0.25em] uppercase text-neutral-400 whitespace-nowrap pointer-events-none select-none z-20">
                            coming soon
                        </span>
                    )}
                </div>
            </motion.div>
            <div className="text-center transition-all duration-500">
                <p className={`text-sm font-bold uppercase tracking-tight whitespace-nowrap transition-opacity duration-300 ${
                    isComingSoon ? 'text-white/50' : 'text-white opacity-70 group-hover:opacity-100'
                }`}>
                    {title}
                </p>
                <p className={`text-[9px] uppercase tracking-[0.2em] transition-opacity duration-300 ${
                    isComingSoon ? 'text-neutral-600' : 'text-neutral-500 opacity-50 group-hover:opacity-100'
                }`}>
                    {subtitle}
                </p>
            </div>
        </>
    );

    if (isComingSoon) {
        return (
            <div
                role="button"
                tabIndex={0}
                onClick={handleBlockedClick}
                className="group flex flex-col items-center gap-2 cursor-not-allowed select-none outline-none"
                title={`${title}: Coming Soon`}
            >
                {InnerContent}
            </div>
        );
    }

    if (finalHref && finalHref !== '#') {
        return (
            <Link href={finalHref} className="group flex flex-col items-center gap-2">
                {InnerContent}
            </Link>
        );
    }

    return (
        <button onClick={onClick} className="group flex flex-col items-center gap-2 cursor-pointer outline-none bg-transparent border-none p-0 inline-flex">
            {InnerContent}
        </button>
    );
};

