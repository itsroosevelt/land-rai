'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export function IdentitySwitcher() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="fixed top-8 left-8 z-[9000]">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        onClick={() => router.push('/nucleo')}
        className="text-white/40 hover:text-white transition-all font-semibold tracking-[0.35em] text-[10px] uppercase bg-transparent border-0 outline-none"
      >
        {t('nav.nucleo')}
      </motion.button>
    </div>
  );
}
