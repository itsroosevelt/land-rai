'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Phone, Mail, ArrowLeft } from 'lucide-react';

// ... (keep BlueParticles unchanged)
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

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-[10] pointer-events-none" />;
};

function LoginContent() {
  const searchParams = useSearchParams();
  const isRegisterParam = searchParams.get('register') === 'true';
  const isLoginParam = searchParams.get('mode') === 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(isRegisterParam || isLoginParam);
  const [isRegistering, setIsRegistering] = useState(isRegisterParam);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isHoveringText, setIsHoveringText] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/subscriptions');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Cuenta creada exitosamente');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push('/subscriptions');
    } catch (error: any) {
      toast.error('Error en autenticación: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: any, providerName: string) => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      if (providerName === 'Google' && result.user) {
        const { queueGmailBootstrap } = await import('@/lib/integrations/gmailAutoConnect');
        queueGmailBootstrap({
          userId: result.user.uid,
          email: result.user.email,
        });
      }
      toast.success(`Iniciaste sesión con ${providerName}`);
      router.push('/subscriptions');
    } catch (error: any) {
      toast.error(`Error con ${providerName}: ` + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col items-center justify-center overflow-hidden selection:bg-white/10 py-12">
      {/* Blue Particles - Background */}
      <BlueParticles />

      {/* Content Container */}
      <div className="relative z-[20] w-full flex flex-col items-center justify-center px-6 py-6 min-h-screen">
        <AnimatePresence mode="wait">
          {!showForm ? (
            <motion.div
              key="buttons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-4 flex flex-col items-center"
              onMouseEnter={() => setIsHoveringText(true)}
              onMouseLeave={() => setIsHoveringText(false)}
            >
              <div className="flex flex-col items-center mb-10 text-center">
                <div className="flex flex-wrap justify-center gap-x-[0.25em] text-3xl md:text-5xl font-normal tracking-tight text-white leading-[1.15]">
                  {"Welcome to your".split(' ').map((word, wordIndex) => (
                    <motion.span
                      key={`welcome-word-${wordIndex}`}
                      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ delay: 0.3 + (wordIndex * 0.15), duration: 0.8, ease: "easeOut" }}
                      className="inline-block"
                    >
                      {word}
                    </motion.span>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-x-[0.25em] text-3xl md:text-5xl font-normal tracking-tight text-white leading-[1.15] mt-1">
                  {"Personal Assistant".split(' ').map((word, wordIndex) => (
                    <motion.span
                      key={`admin-word-${wordIndex}`}
                      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ delay: 0.3 + 0.6 + (wordIndex * 0.15), duration: 0.8, ease: "easeOut" }}
                      className="inline-block"
                    >
                      {word}
                    </motion.span>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => { setShowForm(true); setIsRegistering(true); setShowEmailForm(false); }}
                className="w-full max-w-sm h-14 rounded-full bg-white/5 border-white/10 text-white/90 hover:bg-white/10 font-light text-xs md:text-sm tracking-widest transition-all shadow-lg"
              >
                GET MY DIGITAL CHARACTER
              </Button>

              <Button
                variant="outline"
                className="w-full max-w-sm h-14 rounded-full bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white/20 font-light text-xs md:text-sm tracking-widest transition-all shadow-lg"
                onClick={() => { setShowForm(true); setIsRegistering(false); setShowEmailForm(false); }}
              >
                I ALREADY HAVE MY DIGITAL CHARACTER
              </Button>

              <button
                type="button"
                onClick={() => router.push('/')}
                className="text-[9px] md:text-[10px] text-white/40 hover:text-white pt-6 transition-colors tracking-[0.3em] font-semibold uppercase"
              >
                Return to main page
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md mx-auto px-4 flex flex-col items-center space-y-6"
            >
              {/* Preserved animated title greeting */}
              <div className="text-center px-2 max-w-xl mx-auto flex flex-col gap-2 justify-center mb-2">
                {(isRegistering 
                  ? ["I'm Roosevelt, and I'm ready to get to work for you"]
                  : ["Welcome back! I’ve been keeping everything ready for you"]
                ).map((line, lineIndex) => (
                  <div
                    key={`${isRegistering ? 'reg' : 'log'}-line-${lineIndex}`}
                    className="flex flex-wrap justify-center gap-x-[0.25em] gap-y-1 text-white font-normal text-2xl md:text-3xl tracking-tight leading-snug"
                  >
                    {line.split(' ').map((word, wordIndex) => (
                      <motion.span
                        key={`${isRegistering ? 'reg' : 'log'}-word-${lineIndex}-${wordIndex}`}
                        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{ 
                          delay: 0.2 + (lineIndex * 1.2) + (wordIndex * 0.12), 
                          duration: 0.7, 
                          ease: "easeOut" 
                        }}
                        className="inline-block"
                      >
                        {word}
                      </motion.span>
                    ))}
                  </div>
                ))}
              </div>

              {/* Single Column X/Twitter-style Capsule List */}
              <div className="w-full max-w-[340px] flex flex-col gap-3 mx-auto">
                {showEmailForm ? (
                  <motion.form
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onSubmit={handleEmailLogin}
                    className="space-y-3 w-full"
                  >
                    <div className="space-y-1">
                      <Input
                        type="email"
                        placeholder="Email"
                        className="bg-white/5 border-white/20 rounded-full h-11 focus:border-white/40 text-white placeholder:text-white/40 transition-all text-sm px-6 text-center w-full"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <Input
                        type="password"
                        placeholder="Password"
                        className="bg-white/5 border-white/20 rounded-full h-11 focus:border-white/40 text-white placeholder:text-white/40 transition-all text-sm px-6 text-center w-full"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 rounded-full bg-white text-black hover:bg-neutral-200 font-medium text-sm transition-all shadow-md disabled:opacity-50 mt-1"
                      disabled={loading}
                    >
                      {loading ? 'Synchronizing...' : (isRegistering ? 'Create account' : 'Log in')}
                    </Button>

                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      className="w-full text-center text-xs text-white/50 hover:text-white pt-2 flex items-center justify-center gap-1 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Use another method
                    </button>
                  </motion.form>
                ) : isRegistering ? (
                  /* REGISTER MODE (matching Screenshot 1: Create your account) */
                  <>
                    {/* Primary Button: Sign up with X (White pill) */}
                    <Button
                      type="button"
                      onClick={() => handleSocialLogin(new TwitterAuthProvider(), 'X')}
                      className="w-full h-11 rounded-full bg-white text-black hover:bg-neutral-200 transition-all flex items-center justify-center gap-2.5 font-medium text-sm shadow-md"
                      disabled={loading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14"><path fill="currentColor" d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z" /></svg>
                      <span>Sign up with X</span>
                    </Button>

                    {/* Sign up with email */}
                    <Button
                      type="button"
                      onClick={() => setShowEmailForm(true)}
                      className="w-full h-11 rounded-full bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2.5 font-medium text-sm shadow-sm"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Sign up with email</span>
                    </Button>

                    {/* Sign up with Apple */}
                    <Button
                      type="button"
                      onClick={() => handleSocialLogin(new OAuthProvider('apple.com'), 'Apple')}
                      className="w-full h-11 rounded-full bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2.5 font-medium text-sm shadow-sm"
                      disabled={loading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="15" height="15"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                      <span>Sign up with Apple</span>
                    </Button>

                    {/* Sign up with Google */}
                    <Button
                      type="button"
                      onClick={() => handleSocialLogin(new GoogleAuthProvider(), 'Google')}
                      className="w-full h-11 rounded-full bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2.5 font-medium text-sm shadow-sm"
                      disabled={loading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="16" height="16"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" /><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" /><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" /><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" /></svg>
                      <span>Sign up with Google</span>
                    </Button>
                  </>
                ) : (
                  /* LOGIN MODE (matching Screenshot 2: Log into your account) */
                  <>
                    {/* Login with Google */}
                    <Button
                      type="button"
                      onClick={() => handleSocialLogin(new GoogleAuthProvider(), 'Google')}
                      className="w-full h-11 rounded-full bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2.5 font-medium text-sm shadow-sm"
                      disabled={loading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="16" height="16"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" /><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" /><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" /><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" /></svg>
                      <span>Login with Google</span>
                    </Button>

                    {/* Login with X */}
                    <Button
                      type="button"
                      onClick={() => handleSocialLogin(new TwitterAuthProvider(), 'X')}
                      className="w-full h-11 rounded-full bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2.5 font-medium text-sm shadow-sm"
                      disabled={loading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="13" height="13"><path fill="currentColor" d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z" /></svg>
                      <span>Login with X</span>
                    </Button>

                    {/* Login with Apple */}
                    <Button
                      type="button"
                      onClick={() => handleSocialLogin(new OAuthProvider('apple.com'), 'Apple')}
                      className="w-full h-11 rounded-full bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2.5 font-medium text-sm shadow-sm"
                      disabled={loading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="15" height="15"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                      <span>Login with Apple</span>
                    </Button>

                    {/* Login with email */}
                    <Button
                      type="button"
                      onClick={() => setShowEmailForm(true)}
                      className="w-full h-11 rounded-full bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2.5 font-medium text-sm shadow-sm"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Login with email</span>
                    </Button>
                  </>
                )}
              </div>

              {/* Bottom Switch Footer */}
              <div className="text-center text-sm text-white/60 pt-3">
                {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setShowEmailForm(false);
                  }}
                  className="font-semibold text-white hover:underline transition-colors ml-1"
                >
                  {isRegistering ? 'Sign in' : 'Sign up'}
                </button>
              </div>

              {/* Go Back */}
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setShowEmailForm(false);
                }}
                className="text-[9px] md:text-[10px] text-white/40 hover:text-white/80 pt-4 pb-8 transition-colors tracking-[0.3em] font-semibold uppercase"
              >
                Go back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[9px] tracking-[0.6em] uppercase text-white/40 whitespace-nowrap"
      >
        Autonomous Management System
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LoginContent />
    </Suspense>
  );
}


