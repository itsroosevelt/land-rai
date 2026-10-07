'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronDown, Globe, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { MENU_TEXT } from './navMenuText';
import { MENU_IDS, ECOSYSTEM_ASSETS, OWN_MENU_TEXT, getMegaMenus, isOwnMenu, type MenuId } from './navMenus';
import { SocialIcons } from './SocialIcons';

const VIEW_MORE_HREF = 'https://www.luxorintelligence.com/coming-soon';

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

  const [activeMega, setActiveMega] = useState<MenuId | null>(null);
  // Acordeón del menú móvil: estado propio, para que el cierre al tocar fuera del panel de escritorio no lo afecte.
  const [mobileExpanded, setMobileExpanded] = useState<MenuId | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuText = MENU_TEXT[language];
  const megaMenus = getMegaMenus(language);

  const handleMouseEnter = (id: MenuId | null) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMega(id);
  };
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Tabletas grandes con pantalla táctil usan los menús de escritorio: cerrar el panel al tocar fuera.
    const onOutside = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setActiveMega(null);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, []);

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setActiveMega(null), 300);
  };
  const own = OWN_MENU_TEXT[language];
  const menuLabel = (id: MenuId) => (isOwnMenu(id) ? own[id as keyof typeof own].label : menuText[id as keyof typeof menuText] as string);
  const menuIntro = (id: MenuId) => (isOwnMenu(id) ? own[id as keyof typeof own].intro : menuText.mega.intro_desc);
  const megaTitle: Record<MenuId, string> = {
    product: own.product.title,
    infrastructure: own.infrastructure.title,
    build: own.build.title,
    project: menuText.mega.title_project,
    ecosystem: menuText.mega.title_ecosystem,
    utility: menuText.mega.title_utility,
    security: menuText.mega.title_security,
    onchain: menuText.mega.title_onchain,
  };

  return (
    <>
      <motion.nav
        ref={navRef}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        onMouseLeave={handleMouseLeave}
        className="fixed top-0 left-0 w-full z-[100] transition-all duration-300 px-8 py-3 bg-transparent"
      >
        <div className="w-full flex items-center justify-between relative">
          
          {/* Logo and Left-aligned Menu Container */}
          <div className="flex items-center gap-12">
            <Link href="/" className="font-normal flex items-center gap-1 hover:opacity-90 transition-opacity shrink-0">
              <img src="/assets/rai-logo.png" alt="Roosevelt Logo" className="h-[64px] w-[64px] md:h-[76px] md:w-[76px] object-contain transition-transform duration-300" />
              <span className="text-[30px] tracking-tight leading-none text-white">Roosevelt</span>
            </Link>

            {/* Desktop Links (Left-Aligned next to Logo) — menús copiados del sitio de la empresa */}
            <div className="hidden xl:flex items-center space-x-1">

              {MENU_IDS.map((id) => (
                <div key={id} className="relative" onMouseEnter={() => handleMouseEnter(id)}>
                  <button
                    onClick={() => handleMouseEnter(id)}
                    className={cn(
                      'flex items-center gap-1.5 text-[14px] px-3 py-2 rounded-full transition-all',
                      activeMega === id ? 'bg-white/10 text-white' : 'text-white hover:bg-white/5'
                    )}
                  >
                    {menuLabel(id)}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="hidden xl:flex items-center gap-4">
            {/* Redes y enlaces (copiados del sitio de la empresa) */}
            <SocialIcons className="hidden 2xl:flex" />
            <div className="hidden 2xl:block h-6 w-[1px] bg-white/10" />

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
                className="px-11 py-2 text-sm font-semibold text-white bg-transparent border border-white/20 rounded-full hover:bg-white/5 transition-colors h-auto min-h-0"
              >
                {t('nav.signIn')}
              </button>
            </Link>
            <Link href="/login?register=true">
              <button 
                className="px-11 py-2 text-sm font-semibold bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-full transition-colors shadow-lg shadow-blue-500/20 h-auto min-h-0"
              >
                {t('nav.signUp')}
              </button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="xl:hidden p-3 -mr-2 text-white/80 hover:text-white transition-colors"
            aria-label="Menu"
            onClick={() => { setMobileExpanded(null); setIsMobileMenuOpen(true); }}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Mega Menus Overlay */}
        <AnimatePresence>
          {activeMega && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="hidden xl:block absolute top-full left-0 w-full max-h-[calc(100vh-88px)] overflow-y-auto bg-black border-b border-white/10 shadow-2xl"
              onMouseEnter={() => handleMouseEnter(activeMega)}
            >
              <div className="w-full px-12 py-10">
                <div className="grid grid-cols-4 gap-8 max-w-7xl mx-auto">
                  <div className="col-span-1 border-r border-white/5 pr-8">
                    <h3 className="text-white text-lg font-normal mb-4">{megaTitle[activeMega]}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{menuIntro(activeMega)}</p>
                    {!isOwnMenu(activeMega) && (
                      <div className="mt-6">
                        <a href={VIEW_MORE_HREF} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs font-normal uppercase tracking-wider hover:text-blue-300 flex items-center gap-2 group">
                          {menuText.view_more}
                          <ExternalLink size={12} className="transition-transform group-hover:translate-x-1" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="col-span-3">
                    <div className={activeMega === 'ecosystem' || activeMega === 'project' ? 'grid grid-cols-3 gap-x-4 gap-y-0' : 'grid grid-cols-2 gap-x-12 gap-y-1'}>
                      {activeMega === 'ecosystem' && ECOSYSTEM_ASSETS.map((asset) => (
                        <a
                          key={asset.title}
                          href={asset.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-white/[0.03]"
                        >
                          <img src={asset.image} alt={asset.title} width={56} height={56} className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
                          <span className="text-[10px] font-semibold leading-relaxed tracking-wide text-white/80">{asset.title}</span>
                        </a>
                      ))}
                      {megaMenus[activeMega].map((item, idx) => {
                        const Icon = item.icon;
                        const imageCard = activeMega === 'ecosystem' || activeMega === 'project';
                        return (
                          <a
                            key={idx}
                            href={item.href}
                            target={item.local ? undefined : '_blank'}
                            rel={item.local ? undefined : 'noopener noreferrer'}
                            onClick={item.local ? () => setActiveMega(null) : undefined}
                            className="flex items-center gap-4 p-2 transition-all hover:bg-white/[0.03] rounded-xl group"
                          >
                            {item.image ? (
                              <div className="flex-shrink-0 w-14 h-14">
                                <img src={item.image} alt={item.title} width={56} height={56} className="h-14 w-14 rounded-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                              </div>
                            ) : (
                              <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center">
                                <Icon size={40} className="transition-colors text-blue-500 group-hover:text-blue-400" strokeWidth={1.5} />
                              </div>
                            )}
                            <div className={imageCard ? '' : 'pt-1'}>
                              <h4 className="text-white font-normal text-sm mb-1">{item.title}</h4>
                              <p className="text-white/40 text-[11px] leading-relaxed">{item.desc}</p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl xl:hidden flex flex-col p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <img src="/assets/rai-logo.png" alt="Roosevelt Logo" className="w-10 h-10 object-contain transition-transform duration-300" />
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

            <div className="flex flex-col gap-4 mb-8">
              <Link href="/login?mode=login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full h-14 rounded-full bg-transparent text-white border border-white/20 hover:bg-white hover:text-black text-2xl font-light transition-all duration-300">
                  {t('nav.signIn')}
                </Button>
              </Link>
              <Link href="/login?register=true" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full h-14 rounded-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white border-0 shadow-lg shadow-blue-500/20 text-2xl font-light transition-all duration-300">
                  {t('nav.signUp')}
                </Button>
              </Link>
            </div>

            <div className="flex flex-col gap-1">
              {MENU_IDS.map((id, i) => {
                const isExpanded = mobileExpanded === id;
                return (
                  <motion.div
                    key={id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col"
                  >
                    <button
                      onClick={() => setMobileExpanded(isExpanded ? null : id)}
                      className="text-2xl font-light tracking-tight text-white transition-colors flex items-center justify-between py-2.5 min-h-[48px]"
                    >
                      {menuLabel(id)}
                      <ChevronDown className={cn('w-5 h-5 text-white/40 transition-transform', isExpanded && 'rotate-180')} />
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden flex flex-col gap-3 pl-4 border-l border-white/5 my-1"
                        >
                          {id === 'ecosystem' && ECOSYSTEM_ASSETS.map((asset) => (
                            <a
                              key={asset.title}
                              href={asset.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-base text-white/60 hover:text-white transition-colors py-1 flex items-center gap-3"
                            >
                              <img src={asset.image} alt={asset.title} width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
                              {asset.title}
                            </a>
                          ))}
                          {megaMenus[id].map((sub, sIdx) => (
                            <a
                              key={sIdx}
                              href={sub.href}
                              target={sub.local ? undefined : '_blank'}
                              rel={sub.local ? undefined : 'noopener noreferrer'}
                              onClick={sub.local ? () => setIsMobileMenuOpen(false) : undefined}
                              className="text-base text-white/60 hover:text-white transition-colors py-1 flex items-center gap-3"
                            >
                              <sub.icon size={16} className="text-blue-500" />
                              {sub.title}
                            </a>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5">
              <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest block mb-3">
                {menuText.followUs}
              </span>
              <SocialIcons className="!grid grid-cols-4 gap-y-7 w-full justify-items-center text-white/70 [&_svg]:h-6 [&_svg]:w-6" />
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
