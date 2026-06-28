'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export const LandingNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: t('nav.infrastructure'), href: '#infrastructure' },
    { name: t('nav.product'), href: '#product' },
    { name: t('nav.build'), href: '#build' },
    { name: t('nav.features'), href: '#features' },
    { name: t('nav.brain'), href: '#brain' },
    { name: t('nav.responsibility'), href: '#responsibility' },
    { name: t('nav.socialImpact'), href: '#impact' },
    { name: t('nav.about'), href: '#about' },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={cn(
          'fixed top-0 left-0 w-full z-[100] transition-all duration-500 px-6 py-4 md:px-14',
          isScrolled 
            ? 'bg-black/60 backdrop-blur-xl border-b border-white/5 py-3' 
            : 'bg-transparent py-6'
        )}
      >
        <div className="w-full flex items-center justify-between relative">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 relative transition-transform duration-300 group-hover:scale-105 shrink-0">
              <img src="/assets/newlogo.png" alt="Roosevelt Logo" className="object-contain w-full h-full drop-shadow-[0_0_8px_rgba(37,99,235,0.3)]" />
            </div>
            <span className="text-2xl font-semibold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent leading-none tracking-tight">
              Roosevelt
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden xl:flex items-center gap-10 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href}
                className="text-xs font-normal text-white/70 hover:text-white transition-colors relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-white transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="hidden xl:flex items-center gap-4">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-0.5 mr-2">
              <button
                onClick={() => setLanguage('es')}
                className={cn(
                  "text-[10px] font-normal tracking-wider px-2 py-0.5 rounded-full transition-all duration-300",
                  language === 'es' 
                    ? "bg-white text-black" 
                    : "text-white/50 hover:text-white"
                )}
              >
                ES
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  "text-[10px] font-normal tracking-wider px-2 py-0.5 rounded-full transition-all duration-300",
                  language === 'en' 
                    ? "bg-white text-black" 
                    : "text-white/50 hover:text-white"
                )}
              >
                EN
              </button>
            </div>

            <Link href="/login?mode=login">
              <Button 
                className="bg-transparent text-white border border-white/20 hover:bg-white hover:text-black hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] text-xs rounded-full px-6 h-8 font-normal transition-all duration-300"
              >
                {t('nav.signIn')}
              </Button>
            </Link>
            <Link href="/login?register=true">
              <Button 
                className="bg-transparent text-white border border-blue-500/50 hover:bg-gradient-to-r hover:from-blue-400 hover:to-blue-600 hover:border-transparent hover:scale-105 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] text-xs rounded-full px-6 h-8 font-normal transition-all duration-300"
              >
                {t('nav.signUp')}
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="xl:hidden p-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl xl:hidden flex flex-col p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2.5">
                <img src="/assets/newlogo.png" alt="Roosevelt Logo" className="w-6 h-6 object-contain drop-shadow-[0_0_8px_rgba(37,99,235,0.3)]" />
                <span className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent tracking-tight">Roosevelt</span>
                
                {/* Language Switcher */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-0.5 ml-2">
                  <button
                    onClick={() => setLanguage('es')}
                    className={cn(
                      "text-[9px] font-normal tracking-wider px-2 py-0.5 rounded-full transition-all duration-300",
                      language === 'es' 
                        ? "bg-white text-black" 
                        : "text-white/50 hover:text-white"
                    )}
                  >
                    ES
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={cn(
                      "text-[9px] font-normal tracking-wider px-2 py-0.5 rounded-full transition-all duration-300",
                      language === 'en' 
                        ? "bg-white text-black" 
                        : "text-white/50 hover:text-white"
                    )}
                  >
                    EN
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.name}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link 
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-light tracking-tight text-white/40 hover:text-white transition-colors flex items-center justify-between group py-0.5"
                  >
                    {link.name}
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="mt-auto space-y-2 pb-2">
              <Link href="/login?mode=login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full h-10 rounded-lg bg-transparent text-white border border-white/20 hover:bg-white hover:text-black text-xs font-normal transition-all duration-300">
                  {t('nav.signIn')}
                </Button>
              </Link>
              <Link href="/login?register=true" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full h-10 rounded-lg bg-transparent text-white border border-blue-500/50 hover:bg-gradient-to-r hover:from-blue-400 hover:to-blue-600 hover:border-transparent text-xs font-normal transition-all duration-300">
                  {t('nav.signUp')}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
