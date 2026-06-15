'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Mail, CheckCircle, ArrowRight, LogOut, Clock, Wallet } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CheckoutModal from '@/components/subscriptions/CheckoutModal';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

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
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.8 }}
    />
  );
};

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$19.99',
    priceUSD: 19.99,
    lxrPrice: '$14.99',
    lxrPriceUSD: 14.99,
    description: 'Initial access to start operating within Roosevelt.',
    features: ['1 active workspace', 'Base dashboard', 'Essential support'],
    accent: 'border-white/10 bg-white/[0.03]',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$99.99',
    priceUSD: 99.99,
    lxrPrice: '$74.99',
    lxrPriceUSD: 74.99,
    description: 'Expanded workflow for high-paced teams and operations.',
    features: ['Multiple tools', 'Operational priority', 'Flexible scaling'],
    accent: 'border-white/20 bg-white/[0.06]',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Contact',
    priceUSD: 0,
    lxrPrice: 'Contact',
    lxrPriceUSD: 0,
    description: 'Advanced coverage for more robust operations.',
    features: ['Dedicated support', 'Advanced expansion', 'Extended architecture'],
    accent: 'border-white/10 bg-white/[0.03]',
    highlighted: false,
    isEnterprise: true,
  } as any,
] as const;

export default function SubscriptionsPage() {
  const router = useRouter();
  const { currentUser, activeEntity, loading } = useAuth();
  const { status: subscriptionStatus, plan: activePlanId, expiresAt } = useSubscriptionStatus();
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[number] | null>(null);
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    const checkHistory = async () => {
      if (!currentUser) return;
      try {
        // 1. Check if current subscription exists (which indicates a previous payment)
        const subRef = doc(db, `users/${currentUser.uid}/subscriptions/current`);
        const subSnap = await getDoc(subRef);
        if (subSnap.exists()) {
          setHasHistory(true);
          return;
        }

        // 2. Or check if there are any paid payment requests
        const requestsRef = collection(db, `users/${currentUser.uid}/paymentRequests`);
        const q = query(requestsRef, where('status', '==', 'paid'));
        const reqSnap = await getDocs(q);
        if (!reqSnap.empty) {
          setHasHistory(true);
        }
      } catch (err) {
        console.error('Error checking history:', err);
      }
    };

    checkHistory();
  }, [currentUser, activeEntity]);

  // Use active entity from context
  const entityId = activeEntity;

  const hasActiveSubscription = subscriptionStatus === 'active';
  const currentPlan = plans.find(p => p.id === activePlanId?.toLowerCase());
  const currentPlanPrice = currentPlan ? currentPlan.priceUSD : 0;

  const plansToRender = hasActiveSubscription && currentPlan ? [currentPlan] : plans;

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-black text-white relative selection:bg-white/10">
        <BlueParticles />
        
        {/* We need relative z-[10] on the content so it stays above the fixed particles background */}
        <div className="relative z-[10]">
          {hasActiveSubscription && (
            <div className="relative z-[50] bg-gradient-to-r from-emerald-950/30 via-emerald-900/20 to-emerald-950/30 border-b border-emerald-500/20 px-6 py-3.5 backdrop-blur-xl shadow-lg shadow-emerald-950/20">
              <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 animate-pulse">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-400" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 w-fit">
                      Active: {activePlanId}
                    </span>
                    <p className="text-sm font-normal text-emerald-100/90 tracking-wide">
                      Your subscription is active and valid until <span className="text-emerald-300 font-semibold">{expiresAt ? new Date(expiresAt).toLocaleDateString() : 'N/A'}</span>
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => router.push('/nucleo')}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-black font-semibold tracking-wider text-xs rounded-full h-9 px-6 transition-all duration-300 shadow-md shadow-emerald-500/20"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}

          <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 py-16 sm:px-10 lg:px-12 relative z-[10]">
            {/* Top Right Wallet Button */}
            {hasHistory && (
              <div className="absolute top-8 right-6 sm:right-10 lg:right-12 z-[40]">
                <Button
                  onClick={() => router.push('/configuracion')}
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white rounded-full flex items-center gap-2 h-10 px-5 text-xs font-normal tracking-wider uppercase transition-all duration-300 shadow-md backdrop-blur-sm"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Wallet
                </Button>
              </div>
            )}

            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-4 text-[11px] uppercase tracking-[0.45em] text-white/40 font-normal">
                Subscription
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Choose your subscription
              </h1>
              <p className="mt-4 text-sm text-white/55 sm:text-base font-normal">
                Immediate access to Roosevelt with flexible payment options.
              </p>
              {currentUser?.email ? (
                <p className="mt-3 text-xs uppercase tracking-[0.28em] text-white/30">
                  {currentUser.email}
                </p>
              ) : null}
            </div>

            <div className={`grid gap-6 ${hasActiveSubscription ? 'max-w-md mx-auto grid-cols-1 w-full' : 'lg:grid-cols-3'}`}>
              {plansToRender.map((plan) => {
                const isCurrentPlan = subscriptionStatus === 'active' && activePlanId?.toLowerCase() === plan.id.toLowerCase();
                return (
                  <article
                    key={plan.id}
                    className={`rounded-3xl border backdrop-blur-sm p-8 ${plan.accent} flex min-h-[420px] flex-col relative overflow-hidden transition-all duration-300 hover:border-white/20 ${
                      plan.highlighted && !isCurrentPlan ? 'lg:scale-105 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10' : ''
                    } ${
                      isCurrentPlan ? 'lg:scale-105 ring-2 ring-emerald-500/80 shadow-2xl shadow-emerald-500/20 border-emerald-500/40 bg-gradient-to-b from-emerald-950/15 via-black/40 to-black/80' : ''
                    }`}
                  >
                    {isCurrentPlan && (
                      <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />
                    )}
                    {plan.highlighted && !isCurrentPlan && (
                      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600/20 to-transparent h-px" />
                    )}

                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs uppercase tracking-[0.35em] text-white/35 font-semibold">
                          {plan.name}
                        </p>
                        {isCurrentPlan ? (
                          <span className="text-[10px] px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full uppercase tracking-widest font-semibold animate-pulse">
                            Active Plan
                          </span>
                        ) : plan.id === 'pro' && (
                          <span className="text-[10px] px-3 py-1 bg-blue-600/30 text-blue-200 rounded-full uppercase tracking-widest font-semibold">
                            Popular
                          </span>
                        )}
                      </div>

                      {!plan.isEnterprise && (
                        <div className="mt-5 flex items-end gap-2 mb-5">
                          <span className="text-5xl font-semibold tracking-tight text-white">
                            {plan.price}
                          </span>
                          <span className="pb-2 text-sm uppercase tracking-[0.25em] text-white/35 font-normal">
                            / month
                          </span>
                        </div>
                      )}

                      <p className="text-sm leading-6 text-white/60 font-normal">{plan.description}</p>
                    </div>

                    <div className="mb-10 space-y-4">
                      {plan.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center gap-3 text-sm text-white/75 font-normal"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {plan.isEnterprise ? (
                      <a
                        href="mailto:info@rooseveltcorp.com?subject=Enterprise Plan Inquiry"
                        className="mt-auto"
                      >
                        <Button className="w-full h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center gap-2 font-normal tracking-wider text-xs">
                          <Mail className="w-4 h-4" />
                          Contact our team
                        </Button>
                      </a>
                    ) : isCurrentPlan ? (
                      <Button
                        disabled
                        className="mt-auto h-12 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-semibold tracking-widest text-xs uppercase cursor-default flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setSelectedPlan(plan as typeof plans[number])}
                        className={`mt-auto h-12 rounded-full font-normal tracking-widest text-xs uppercase shadow-lg transition-all duration-300 ${
                          hasActiveSubscription 
                            ? plan.priceUSD > currentPlanPrice
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20 animate-pulse font-semibold' 
                              : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                            : 'bg-white text-black hover:bg-gray-100'
                        }`}
                      >
                        {hasActiveSubscription 
                          ? plan.priceUSD > currentPlanPrice 
                            ? 'Upgrade to ' + plan.name 
                            : 'Get Started' 
                          : 'Get Started'}
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="mt-16 max-w-2xl mx-auto text-center">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40 mb-4 font-normal">
                💎 Save with LXR
              </p>
              <p className="text-sm text-white/60 font-normal">
                Pay with our LXR token and unlock exclusive discounts.
                Starter: <span className="text-green-400 font-semibold">$14.99</span> (vs $19.99) •
                Pro: <span className="text-green-400 font-semibold">$74.99</span> (vs $99.99)
              </p>
            </div>

          </section>

          {selectedPlan && (
            <CheckoutModal
              plan={selectedPlan}
              onClose={() => setSelectedPlan(null)}
              entityId={entityId}
            />
          )}

          {/* Log Out - Bottom Left */}
          <div className="fixed bottom-8 left-8 md:bottom-12 md:left-12 z-[50]">
            <button
              onClick={async () => {
                try {
                  await signOut(auth);
                  router.push('/login');
                } catch (error) {
                  console.error('Error logging out:', error);
                  toast.error('Error al cerrar sesión');
                }
              }}
              className="group flex items-center gap-2 text-white/40 hover:text-white transition-all duration-300"
            >
              <LogOut className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={1.5} />
              <span className="text-sm font-normal tracking-wide">Log out</span>
            </button>
          </div>

          {/* Go to Nucleo - Bottom Right */}
          <div className="fixed bottom-8 right-8 md:bottom-12 md:right-12 z-[50]">
            <button
              onClick={() => router.push('/nucleo')}
              className="group flex items-center gap-2 text-white/40 hover:text-white transition-all duration-300"
            >
              <span className="text-sm font-normal tracking-wide">Go to Nucleo</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
