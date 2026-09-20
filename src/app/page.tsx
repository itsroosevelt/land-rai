'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';


import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroAskRooseveltBar } from '@/components/landing/HeroAskRooseveltBar';
import { useLanguage } from '@/contexts/LanguageContext';

import { InnovationSection } from '@/components/home/InnovationSection';
import { PhilosophySection } from '@/components/home/PhilosophySection';
import { ArchitectureSection } from '@/components/home/ArchitectureSection';
import BracketsSectionClient from '@/components/home/BracketsSectionClient';
import { JoinSection } from '@/components/home/JoinSection';
import { ShowcaseSection } from '@/components/home/ShowcaseSection';
import { PillarsSection } from '@/components/home/PillarsSection';
import { GiantsSection } from '@/components/home/GiantsSection';
import { CTASection } from '@/components/home/CTASection';
import { ReviewsSection } from '@/components/home/ReviewsSection';
import Footer from '@/components/home/Footer';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  seed: number;
}

const BlueParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationFrame = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const particleCount = 450;
    particles.current = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      size: Math.random() * 1.5 + 0.5,
      seed: Math.random()
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current.forEach((p) => {
        p.x += p.vx + Math.sin(Date.now() * 0.001 + p.seed * 10) * 0.2;
        p.y += p.vy + Math.cos(Date.now() * 0.001 + p.seed * 10) * 0.2;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const opacity = 0.1 + p.seed * 0.3;
        ctx.fillStyle = `rgba(59, 130, 246, ${opacity})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrame.current = requestAnimationFrame(animate);
    };

    const animation = animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-[5] pointer-events-none" />;
};

export default function LandingPage() {
  const { language, t } = useLanguage();

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col selection:bg-white/10 overflow-x-hidden">
      <LandingNavbar />

      {/* Central Roosevelt AI GIF - Low Z-index */}
      <div className="absolute top-0 left-0 w-full h-screen pointer-events-none z-0 opacity-100 overflow-hidden">
        <img
          src="/assets/Roosevelt Ai.gif"
          alt="Roosevelt AI"
          className="absolute top-[32%] md:top-[38%] xl:top-[47%] left-[53%] -translate-x-1/2 -translate-y-1/2 w-full max-w-[110vw] md:max-w-[90vw] xl:max-w-6xl h-auto scale-[1.95] md:scale-[1.35] xl:scale-[1.35] object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>

      {/* Blue Particles - Middle Z-index (Over the GIF) */}
      <BlueParticles />

      {/* Main Content Container */}
      <div className="relative z-[10] w-full px-6 md:px-12 xl:px-[76px] flex flex-col xl:flex-row items-center xl:items-end justify-end xl:justify-between min-h-screen pb-12 md:pb-16 xl:pb-[76px] gap-8 xl:gap-8">
        
        {/* Left Column: Hero Text */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full xl:w-2/3 flex flex-col items-center xl:items-start text-center xl:text-left justify-center mt-4 md:mt-8 relative top-0"
        >
          {/* Eyebrow / Overline */}
          <span className="text-blue-400 text-xs md:text-sm tracking-[0.2em] uppercase font-medium mb-3 block">
            Autonomous Infrastructure
          </span>

          {/* Main Title (H1) */}
          <h1 className="text-2xl md:text-4xl xl:text-5xl font-light tracking-tight text-white mb-4 leading-[1.15]">
            Welcome to the new era <br className="hidden md:block" />
            of autonomy with{' '}
            <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-blue-500 bg-clip-text text-transparent font-light">
              Roosevelt
            </span>
          </h1>

          {/* Unified Description */}
          <p className="text-sm md:text-base text-zinc-300 font-light leading-relaxed max-w-xl">
            Stop configuring processes and start delegating results. Roosevelt is the intelligent agent that manages your personal and business infrastructure from end to end.
          </p>
        </motion.div>

        {/* Right Column: Interactive Roosevelt AI Bar Preview (Sample) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="w-full xl:w-1/2 flex xl:justify-end justify-center xl:mr-4 xl:mb-2 mb-4 shrink-0"
        >
          <HeroAskRooseveltBar />
        </motion.div>

      </div>

      <main className="w-full">
        <InnovationSection />
        <PhilosophySection />
        <ArchitectureSection />
        <BracketsSectionClient />
        <JoinSection />
        {/* ShowcaseSection and PillarsSection with Roosevelt AI Background */}
        <div className="relative overflow-hidden w-full">
          <div className="absolute inset-0 pointer-events-none z-0 opacity-80 overflow-hidden flex items-center justify-center">
            <img
              src="/assets/Roosevelt Ai.gif"
              alt="Roosevelt AI Background"
              className="w-full max-w-[110vw] md:max-w-[90vw] xl:max-w-6xl h-auto scale-[1.55] md:scale-[1.35] xl:scale-[1.35] object-cover opacity-80"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="relative z-10">
            <ShowcaseSection />
            <PillarsSection />
          </div>
        </div>
        <GiantsSection />
        <CTASection />
        <ReviewsSection />
      </main>

      <Footer />
    </div>
  );
}
