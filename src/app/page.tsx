'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';

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
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  const handleClaim = () => {
    if (!connected) {
      setVisible(true);
    } else {
      // Logic for claiming tokens can go here
      console.log('Claiming 150 tokens...');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col items-center justify-end overflow-hidden selection:bg-white/10">
      <LandingNavbar />

      {/* Central Roosevelt AI GIF - Low Z-index */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <img
          src="/assets/Roosevelt Ai.gif"
          alt="Roosevelt AI"
          className="w-full max-w-6xl h-auto scale-[1.5] -translate-y-[20px]"
        />
      </div>

      {/* Blue Particles - Middle Z-index (Over the GIF) */}
      <BlueParticles />

      {/* Content Container - Hero Text on the left */}
      <div className="relative z-[10] w-full px-10 md:px-28 flex flex-col justify-end min-h-screen pb-20">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <span className="text-blue-500 text-[10px] md:text-xs tracking-[0.3em] uppercase font-bold mb-6 block">
            Autonomous Infrastructure
          </span>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-white mb-8 leading-[1.1]">
            New era <br />
            of automation <br />
            with <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent font-bold">Roosevelt</span>
          </h1>
          <p className="text-[11px] md:text-sm text-white/40 font-medium leading-relaxed max-w-xl">
            Responsive Artificial Intelligence that doesn't just suggest, it acts, unlocking your full potential.
            Delegate the complexity of your business and personal activities to a system that never sleeps.
          </p>
        </motion.div>
      </div>

      {/* Token Claim Card - Bottom Right */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.2, duration: 0.8, ease: "easeOut" }}
        className="fixed bottom-28 right-28 z-[50] w-[650px] p-8 rounded-[2rem] bg-black border border-white/10 shadow-2xl transition-all duration-500 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] group overflow-hidden"
      >
        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-6">
            <p className="text-[11px] text-blue-400 font-bold tracking-widest uppercase">Special Offer</p>

            <img
              src="https://firebasestorage.googleapis.com/v0/b/roosevelt-491004.firebasestorage.app/o/Logo%20Tienda%20Ecol%C3%B3gica%20Minimalista%20Beige%20(1).png?alt=media&token=c3d4ea4a-d7ce-40f3-8e44-239d79a7ecc7"
              alt="Token Promo"
              className="w-28 h-28 object-contain"
            />

            <div className="space-y-4">
              <div className="text-[11px] text-white/80 leading-relaxed uppercase tracking-wider">
                Use our token and get a <span className="text-white font-bold mx-1">25% discount</span> on all our subscriptions.
              </div>
            </div>
          </div>

          <Button
            onClick={handleClaim}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-14 font-semibold transition-all hover:scale-[1.02] active:scale-95 text-lg"
          >
            {connected ? 'Tokens Claimed' : 'Claim 150 Tokens'}
          </Button>
        </div>
      </motion.div>

      {/* Footer Branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[9px] tracking-[0.6em] uppercase text-white/40"
      >
        Autonomous Management System
      </motion.div>
    </div>
  );
}
