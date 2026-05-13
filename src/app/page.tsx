'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';


import { LandingNavbar } from '@/components/landing/LandingNavbar';

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
  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col selection:bg-white/10 overflow-x-hidden">
      <LandingNavbar />

      {/* Central Roosevelt AI GIF - Low Z-index */}
      <div className="relative xl:absolute xl:inset-0 pointer-events-none z-0 opacity-100 min-h-[85svh] xl:min-h-0 overflow-hidden">
        <img
          src="/assets/Roosevelt Ai.gif"
          alt="Roosevelt AI"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[110vw] md:max-w-[90vw] xl:max-w-6xl h-auto scale-[1.4] md:scale-[1.2] xl:scale-[1.2] object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>

      {/* Blue Particles - Middle Z-index (Over the GIF) */}
      <BlueParticles />

      {/* Main Content Container */}
      <div className="relative z-[10] w-full px-6 md:px-16 xl:px-28 pt-10 xl:pt-0 flex flex-col xl:flex-row items-center xl:items-end justify-between min-h-0 xl:min-h-[85vh] pb-20 xl:pb-32 gap-12 xl:gap-8">
        
        {/* Left Column: Hero Text */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full xl:w-1/2 flex flex-col items-center xl:items-start text-center xl:text-left justify-center mt-4 md:mt-8 xl:mt-[55vh] relative top-0 xl:top-20"
        >
          <span className="text-blue-500 text-[9px] md:text-[10px] tracking-[0.3em] uppercase font-bold mb-4 md:mb-5 block">
            Autonomous Infrastructure
          </span>
          <h1 className="text-2xl md:text-4xl xl:text-5xl font-semibold tracking-tight text-white mb-6 md:mb-8 leading-[1.15]">
            Welcome to the <br className="hidden xl:block" />
            new era of autonomy <br className="hidden xl:block" />
            with <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent font-bold">Roosevelt</span>
          </h1>
          <p className="text-[10px] md:text-xs text-white/60 font-medium leading-relaxed max-w-lg">
            Stop configuring processes and start delegating results. Roosevelt is the intelligent agent that manages your personal and business infrastructure from end to end.
          </p>
        </motion.div>


      </div>

    </div>
  );
}
