'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LandingNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Infrastructure', href: '#infrastructure' },
    { name: 'Product', href: '#product' },
    { name: 'Build', href: '#build' },
    { name: 'Features', href: '#features' },
    { name: 'Brain', href: '#brain' },
    { name: 'Responsibility', href: '#responsibility' },
    { name: 'Social Impact', href: '#impact' },
    { name: 'About', href: '#about' },
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
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <span className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent leading-none tracking-tight">
              Roosevelt
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden xl:flex items-center gap-10 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-white transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="hidden xl:flex items-center gap-6">
            <Link href="/login?mode=login">
              <Button 
                variant="ghost" 
                className="text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-full px-8 h-10"
              >
                Login
              </Button>
            </Link>
            <Link href="/login?register=true">
              <Button 
                className="bg-white text-black hover:bg-white/90 text-sm rounded-full px-8 h-10 font-semibold transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Get Started
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
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl xl:hidden flex flex-col p-8"
          >
            <div className="flex justify-between items-center mb-16">
               <div className="flex items-center">
                <span className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent tracking-tight">Roosevelt</span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-white/70 hover:text-white"
              >
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="flex flex-col gap-8">
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
                    className="text-3xl font-extralight tracking-tight text-white/40 hover:text-white transition-colors flex items-center justify-between group"
                  >
                    {link.name}
                    <ChevronRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="mt-auto space-y-4">
              <Link href="/login?mode=login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full h-16 rounded-2xl border-white/10 text-white hover:bg-white/5 text-xl font-light">
                  Login
                </Button>
              </Link>
              <Link href="/login?register=true" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full h-16 rounded-2xl bg-white text-black hover:bg-white/90 text-xl font-semibold">
                  Get Started
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
