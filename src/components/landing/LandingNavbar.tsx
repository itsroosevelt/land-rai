'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronRight, ChevronDown, Globe } from 'lucide-react';
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
    { name: t('nav.infrastructure'), href: '#features', hasDropdown: true },
    { name: t('nav.product'), href: '#brain', hasDropdown: true },
    { name: t('nav.build'), href: '#responsibility', hasDropdown: true },
    { name: t('nav.about'), href: '#about', hasDropdown: false },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 w-full z-[100] transition-all duration-300 px-8 py-3 backdrop-blur-md border-b border-white/5 bg-black/60"
      >
        <div className="w-full flex items-center justify-between relative">
          
          {/* Logo and Left-aligned Menu Container */}
          <div className="flex items-center gap-12">
            <Link href="/" className="font-normal flex items-center gap-2.5 hover:opacity-90 transition-opacity shrink-0">
              <img src="/assets/newlogo.png" alt="Roosevelt Logo" className="h-[34px] w-[34px] object-contain" />
              <span className="text-[22px] tracking-tight leading-none text-white">Roosevelt</span>
            </Link>

            {/* Desktop Links (Left-Aligned next to Logo) */}
            <div className="hidden xl:flex items-center gap-6">
              {navLinks.map((link) => (
                <div key={link.name} className="relative group/menu py-2">
                  <Link 
                    href={link.href}
                    className="text-sm font-normal text-gray-400 hover:text-white transition-colors flex items-center gap-1 relative"
                  >
                    {link.name}
                    {link.hasDropdown && (
                      <ChevronDown size={14} className="opacity-70 group-hover/menu:opacity-100 transition-opacity" />
                    )}
                  </Link>
                  {/* Dropdown Menu */}
                  {link.hasDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-48 rounded-xl bg-black/95 border border-white/10 p-2 shadow-2xl backdrop-blur-xl opacity-0 translate-y-2 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:translate-y-0 group-hover/menu:pointer-events-auto transition-all duration-300 z-50">
                      {link.name === t('nav.infrastructure') && (
                        <>
                          <Link href="#features" className="block px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            {language === 'es' ? 'Funciones' : 'Features'}
                          </Link>
                          <Link href="#brain" className="block px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            {language === 'es' ? 'Cerebro' : 'Brain'}
                          </Link>
                        </>
                      )}
                      {link.name === t('nav.product') && (
                        <>
                          <Link href="#responsibility" className="block px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            {language === 'es' ? 'Responsabilidad' : 'Responsibility'}
                          </Link>
                          <Link href="#impact" className="block px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            {language === 'es' ? 'Impacto Social' : 'Social Impact'}
                          </Link>
                        </>
                      )}
                      {link.name === t('nav.build') && (
                        <>
                          <Link href="/login?register=true" className="block px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            {language === 'es' ? 'Comenzar Proyecto' : 'Start Project'}
                          </Link>
                          <Link href="#docs" className="block px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            {language === 'es' ? 'Documentación' : 'Documentation'}
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="hidden xl:flex items-center gap-4">
            {/* Language Switcher (Globe Icon) */}
            <button
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              title={language === 'es' ? 'Cambiar idioma a Inglés' : 'Switch language to Spanish'}
              className="text-gray-400 hover:text-white transition-colors p-2 flex items-center justify-center mr-1"
            >
              <Globe size={18} />
            </button>

            <Link href="/login?mode=login">
              <button 
                className="px-9 py-1 text-sm font-normal text-white bg-transparent border border-white/20 rounded-full hover:bg-white/5 transition-colors h-auto min-h-0"
              >
                {t('nav.signIn')}
              </button>
            </Link>
            <Link href="/login?register=true">
              <button 
                className="px-9 py-1 text-sm font-normal bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-full transition-colors shadow-lg shadow-blue-500/20 h-auto min-h-0"
              >
                {t('nav.signUp')}
              </button>
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
                <span className="text-lg font-normal text-white tracking-tight">Roosevelt</span>
                
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
