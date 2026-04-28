'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Mail, CheckCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CheckoutModal from '@/components/subscriptions/CheckoutModal';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$19.99',
    priceUSD: 19.99,
    lxrPrice: '$14.99',
    lxrPriceUSD: 14.99,
    description: 'Acceso inicial para empezar a operar dentro de Roosevelt.',
    features: ['1 espacio activo', 'Panel base', 'Soporte esencial'],
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
    description: 'Flujo ampliado para equipos y operaciones con mayor ritmo.',
    features: ['Multiples herramientas', 'Prioridad operativa', 'Escalado flexible'],
    accent: 'border-white/20 bg-white/[0.06]',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Contacto',
    priceUSD: 0,
    lxrPrice: 'Contacto',
    lxrPriceUSD: 0,
    description: 'Cobertura avanzada para una operacion mas robusta.',
    features: ['Soporte dedicado', 'Expansión avanzada', 'Arquitectura ampliada'],
    accent: 'border-white/10 bg-white/[0.03]',
    highlighted: false,
    isEnterprise: true,
  } as any,
] as const;

export default function SubscriptionsPage() {
  const router = useRouter();
  const { currentUser, activeEntity, loading } = useAuth();
  const { status: subscriptionStatus, plan, expiresAt } = useSubscriptionStatus();
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[number] | null>(null);

  // Use 'life' as default entity if not set
  const entityId = activeEntity || 'life';

  const hasActiveSubscription = subscriptionStatus === 'active';

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-black text-white">
        {hasActiveSubscription && (
          <div className="bg-green-600/10 border-b border-green-600/30 px-6 py-4">
            <div className="mx-auto max-w-7xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-sm text-green-300">
                  ✓ Tienes una suscripción activa ({plan}) válida hasta {expiresAt ? new Date(expiresAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <Button
                onClick={() => router.push(`/nucleo/${entityId}`)}
                className="bg-green-600 hover:bg-green-700 text-white rounded-full h-10"
              >
                Ir al Dashboard
              </Button>
            </div>
          </div>
        )}

        <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 py-16 sm:px-10 lg:px-12">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-4 text-[11px] uppercase tracking-[0.45em] text-white/40">
              Subscription
            </p>
            <h1 className="text-4xl font-light tracking-tight text-white sm:text-5xl">
              Elige tu suscripcion
            </h1>
            <p className="mt-4 text-sm text-white/55 sm:text-base">
              Acceso inmediato a Roosevelt con opciones de pago flexibles.
            </p>
            {currentUser?.email ? (
              <p className="mt-3 text-xs uppercase tracking-[0.28em] text-white/30">
                {currentUser.email}
              </p>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className={`rounded-3xl border backdrop-blur-sm p-8 ${plan.accent} flex min-h-[420px] flex-col relative overflow-hidden transition-all duration-300 hover:border-white/20 ${
                  plan.highlighted ? 'lg:scale-105 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10' : ''
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600/20 to-transparent h-px" />
                )}

                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/35">
                      {plan.name}
                    </p>
                    {plan.id === 'pro' && (
                      <span className="text-[10px] px-3 py-1 bg-blue-600/30 text-blue-200 rounded-full uppercase tracking-widest">
                        Popular
                      </span>
                    )}
                  </div>

                  {!plan.isEnterprise && (
                    <div className="mt-5 flex items-end gap-2 mb-5">
                      <span className="text-5xl font-light tracking-tight text-white">
                        {plan.price}
                      </span>
                      <span className="pb-2 text-sm uppercase tracking-[0.25em] text-white/35">
                        / mes
                      </span>
                    </div>
                  )}

                  <p className="text-sm leading-6 text-white/60">{plan.description}</p>
                </div>

                <div className="mb-10 space-y-4">
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-3 text-sm text-white/75"
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
                    <Button className="w-full h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center gap-2">
                      <Mail className="w-4 h-4" />
                      Contactarse con nuestro equipo
                    </Button>
                  </a>
                ) : (
                  <Button
                    onClick={() => setSelectedPlan(plan as typeof plans[number])}
                    className="mt-auto h-12 rounded-full bg-white text-black hover:bg-white/90"
                  >
                    Get Started
                  </Button>
                )}
              </article>
            ))}
          </div>

          <div className="mt-16 max-w-2xl mx-auto text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40 mb-4">
              💎 Ahorra con LXR
            </p>
            <p className="text-sm text-white/60">
              Paga con nuestro token LXR y obtén descuentos exclusivos.
              Starter: <span className="text-green-400">$14.99</span> (vs $19.99) •
              Pro: <span className="text-green-400">$74.99</span> (vs $99.99)
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
      </main>
    </ProtectedRoute>
  );
}
