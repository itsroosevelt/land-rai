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
    monthlyPrice: '$49.00',
    monthlyPriceUSD: 49.00,
    annualPrice: '$39.20',
    annualPriceUSD: 39.20,
    description: 'Initial access to start operating within Roosevelt.',
    featuresHeader: 'Starter includes:',
    features: [
      '1 active workspace',
      'Base dashboard & essential support',
      'Up to 1,000 monthly automations',
      'Standard integrations',
      'Chat with Roosevelt AI Assistant'
    ],
    accent: 'border-white/10 bg-black',
    highlighted: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    monthlyPrice: '$100.00',
    monthlyPriceUSD: 100.00,
    annualPrice: '$80.00',
    annualPriceUSD: 80.00,
    description: 'Expanded workflow for high-paced teams and operations.',
    featuresHeader: 'All of Starter, and:',
    features: [
      '3 active workspaces',
      'Priority dashboard & support',
      'Up to 10,000 monthly automations',
      'Custom branding & forms',
      'AI research assistant',
      'Shared team workspace'
    ],
    accent: 'border-white/10 bg-black',
    highlighted: false,
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: '$199.00',
    monthlyPriceUSD: 199.00,
    annualPrice: '$159.20',
    annualPriceUSD: 159.20,
    description: 'Advanced coverage for more robust operations.',
    featuresHeader: 'All of Standard, and:',
    features: [
      '10 active workspaces',
      'Premium support & faster responses',
      'Up to 50,000 monthly automations',
      'Advanced API access & webhooks',
      'Detailed analytics & audit logs',
      'Enhanced security & data controls'
    ],
    accent: 'border-blue-500/50 bg-black shadow-lg shadow-blue-500/5',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 'Contact',
    monthlyPriceUSD: 0,
    annualPrice: 'Contact',
    annualPriceUSD: 0,
    description: 'Dedicated resources for complex corporate requirements.',
    featuresHeader: 'All features mentioned, and:',
    features: [
      'Unlimited workspaces & members',
      'Dedicated manager & Custom SLA',
      'Unlimited automation runs',
      'Custom integrations & database',
      'Enterprise security & SSO',
      'Assured compliance controls'
    ],
    accent: 'border-white/10 bg-black',
    highlighted: false,
    isEnterprise: true,
  },
] as const;

export default function SubscriptionsPage() {
  const router = useRouter();
  const { currentUser, activeEntity, loading } = useAuth();
  const { status: subscriptionStatus, plan: activePlanId, expiresAt } = useSubscriptionStatus();
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[number] | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [isAnnual, setIsAnnual] = useState(true);

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
  const currentPlanPrice = currentPlan
    ? (isAnnual ? currentPlan.annualPriceUSD : currentPlan.monthlyPriceUSD)
    : 0;

  const plansToRender = hasActiveSubscription && currentPlan ? [currentPlan] : plans;

  // Map selected plan to structure expected by CheckoutModal
  const checkoutPlan = selectedPlan
    ? {
        id: selectedPlan.id,
        name: selectedPlan.name,
        price: isAnnual ? selectedPlan.annualPrice : selectedPlan.monthlyPrice,
        priceUSD: isAnnual ? selectedPlan.annualPriceUSD : selectedPlan.monthlyPriceUSD,
        lxrPrice: isAnnual ? `$${(selectedPlan.annualPriceUSD * 0.75).toFixed(2)}` : `$${(selectedPlan.monthlyPriceUSD * 0.75).toFixed(2)}`,
        lxrPriceUSD: isAnnual ? selectedPlan.annualPriceUSD * 0.75 : selectedPlan.monthlyPriceUSD * 0.75,
        features: [...selectedPlan.features],
      }
    : null;

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

          <section className="mx-auto flex min-h-screen w-full max-w-[90rem] flex-col justify-center px-6 py-16 sm:px-10 lg:px-12 relative z-[10]">


            <div className="mx-auto mb-10 max-w-2xl text-center z-[40]">
              <h1 className="text-xl sm:text-2xl font-light tracking-wide text-white/90">
                Find the right plan for your business
              </h1>
            </div>

            <div className="mx-auto w-full max-w-[90rem] rounded-3xl border border-white/5 bg-white/[0.03] backdrop-blur-md p-8 sm:p-10 shadow-2xl relative z-[20]">
              {/* Toggle switch for billing cycle */}
              {!hasActiveSubscription && (
                <div className="flex justify-end items-center gap-3 mb-8 w-full z-[40]">
                  <span className="text-xs uppercase tracking-wider text-white/60">
                    Annual <span className="bg-gradient-to-r from-[#53a7ff] to-[#0055ff] bg-clip-text text-transparent font-semibold">(Save 20% with one-year commitment)</span>
                  </span>
                  <button
                    onClick={() => setIsAnnual(!isAnnual)}
                    className={`w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none p-1 relative flex items-center ${
                      isAnnual ? 'bg-blue-600' : 'bg-white/20'
                    }`}
                    aria-label="Toggle billing cycle"
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
                        isAnnual ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              <div className={`grid gap-6 ${hasActiveSubscription ? 'max-w-md mx-auto grid-cols-1 w-full' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
                {plansToRender.map((plan) => {
                  const isCurrentPlan = subscriptionStatus === 'active' && activePlanId?.toLowerCase() === plan.id.toLowerCase();
                  const displayPrice = isAnnual ? plan.annualPrice : plan.monthlyPrice;
                  const displayPriceUSD = isAnnual ? plan.annualPriceUSD : plan.monthlyPriceUSD;

                  // Render Action Button inline below pricing
                  const renderButton = () => {
                    if (plan.isEnterprise) {
                      const emailSubject = encodeURIComponent("Interés en Plan Enterprise");
                      const emailBody = encodeURIComponent("Hola, estoy interesado en comprar un plan Enterprise para más empresas y mejoras.");
                      return (
                        <a
                          href={`https://mail.google.com/mail/?view=cm&fs=1&to=sales@byroosevelt.com&su=${emailSubject}&body=${emailBody}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full"
                        >
                          <Button className="w-full h-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center font-normal tracking-wider text-[11px] transition-all duration-300">
                            Contact Sales
                          </Button>
                        </a>
                      );
                    }

                    if (isCurrentPlan) {
                      return (
                        <Button
                          disabled
                          className="h-10 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold tracking-widest text-[10px] uppercase cursor-default flex items-center justify-center gap-2 w-full"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          Current Plan
                        </Button>
                      );
                    }

                    return (
                      <Button
                        onClick={() => setSelectedPlan(plan as any)}
                        className={`h-10 rounded-full text-[11px] transition-all duration-300 w-full ${
                          plan.highlighted
                            ? 'bg-blue-600 hover:bg-blue-700 text-white font-normal shadow-md shadow-blue-900/20'
                            : 'bg-transparent border border-white/10 text-blue-400 hover:text-blue-300 hover:bg-white/5 font-normal'
                        }`}
                      >
                        {hasActiveSubscription 
                          ? displayPriceUSD > currentPlanPrice 
                            ? 'Upgrade' 
                            : 'Get started' 
                          : 'Get started'}
                      </Button>
                    );
                  };

                  return (
                    <article
                      key={plan.id}
                      className={`rounded-3xl border backdrop-blur-sm p-7 ${plan.accent} flex min-h-[540px] flex-col relative overflow-hidden transition-all duration-300 hover:border-white/20 ${
                        plan.highlighted && !isCurrentPlan ? 'ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10' : ''
                      } ${
                        isCurrentPlan ? 'ring-2 ring-emerald-500/80 shadow-2xl shadow-emerald-500/20 border-emerald-500/40 bg-gradient-to-b from-emerald-950/15 via-black/40 to-black/80' : ''
                      }`}
                    >
                      {isCurrentPlan && (
                        <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />
                      )}
                      {plan.highlighted && !isCurrentPlan && (
                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600/30 to-transparent h-px" />
                      )}

                      {/* Header Title */}
                      <div className="flex items-center justify-between mb-1.5">
                        <h2 className="text-lg sm:text-xl font-light text-white tracking-wide">
                          {plan.name}
                        </h2>
                        {isCurrentPlan ? (
                          <span className="text-[8px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full uppercase tracking-widest font-semibold animate-pulse">
                            Active
                          </span>
                        ) : plan.highlighted && (
                          <span className="text-[8px] px-2 py-0.5 bg-blue-600/30 text-blue-200 rounded-full uppercase tracking-widest font-semibold">
                            Popular
                          </span>
                        )}
                      </div>

                      {/* Price Section */}
                      <div className="mt-1 mb-4">
                        {!plan.isEnterprise ? (
                          <div className="flex flex-col">
                            <span className="text-2xl sm:text-3xl font-normal text-white tracking-tight">
                              {displayPrice}
                            </span>
                            <span className="text-[10px] text-white/40 mt-0.5 font-normal">
                              per user / month
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-xl sm:text-2xl font-light text-white tracking-tight">
                              Contact
                            </span>
                            <span className="text-[10px] text-white/40 mt-0.5 font-normal">
                              sales for pricing
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Button Placement directly below pricing */}
                      <div className="mb-5 w-full">
                        {renderButton()}
                      </div>

                      <p className="text-[11px] leading-relaxed text-white/40 font-normal mb-5">{plan.description}</p>

                      {/* Features List */}
                      <div className="flex-grow">
                        <p className="text-[9px] font-semibold text-white/40 mb-3 tracking-wider uppercase">
                          {plan.featuresHeader}
                        </p>
                        <div className="space-y-3">
                          {plan.features.map((feature) => (
                            <div
                              key={feature}
                              className="flex items-start gap-2.5 text-[11px] text-white/60 font-normal"
                            >
                              <div className="flex h-4 w-4 items-center justify-center rounded-full border border-white/10 bg-white/5 shrink-0 mt-0.5">
                                <Check className="h-2.5 w-2.5 text-white/70" />
                              </div>
                              <span className="leading-tight">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

          </section>

          {checkoutPlan && (
            <CheckoutModal
              plan={checkoutPlan}
              onClose={() => setSelectedPlan(null)}
              entityId={entityId}
            />
          )}

          {/* Log Out - Top Left */}
          <div className="fixed top-8 left-8 md:top-12 md:left-12 z-[50]">
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
              <span className="text-sm font-normal tracking-wide">Log out</span>
            </button>
          </div>

          {/* Go to Nucleo & Wallet - Top Right */}
          <div className="fixed top-8 right-8 md:top-12 md:right-12 z-[50] flex items-center gap-4">
            {hasHistory && (
              <Button
                onClick={() => router.push('/configuracion')}
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white rounded-full flex items-center gap-2 h-10 px-5 text-xs font-normal tracking-wider uppercase transition-all duration-300 shadow-md backdrop-blur-sm"
              >
                <Wallet className="w-3.5 h-3.5" />
                Wallet
              </Button>
            )}
            <button
              onClick={() => router.push('/nucleo')}
              className="group flex items-center gap-2 text-white/40 hover:text-white transition-all duration-300"
            >
              <span className="text-sm font-normal tracking-wide">Go to Nucleo</span>
            </button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
