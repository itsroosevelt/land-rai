'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { BillingData } from '../BillingForm';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

interface CardPaymentProps {
  plan: string;
  planName: string;
  priceUSD: number;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  onSuccess: () => void;
  userId: string;
  entityId: string;
  billingData: BillingData | null;
  isBillingValid: boolean;
}

function PaymentForm({
  plan,
  planName,
  priceUSD,
  isProcessing,
  setIsProcessing,
  onSuccess,
  userId,
  entityId,
  clientSecret,
  billingData,
  isBillingValid,
}: CardPaymentProps & { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { currentUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast.error('Stripe no está cargado');
      return;
    }

    setIsProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        toast.error(`Error: ${error.message}`);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        const response = await fetch('/api/subscriptions/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            userId,
            entityId,
            plan,
            billingData,
          }),
        });

        if (!response.ok) {
          throw new Error('Error activando suscripción');
        }

        toast.success('¡Suscripción activada exitosamente!');
        onSuccess();
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(`Error: ${error.message || 'Pago fallido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="text-sm text-white/60 mb-2">Monto a pagar:</div>
        <div className="text-3xl font-light text-white">
          ${(priceUSD * 1.1).toFixed(2)}
        </div>
        <div className="text-xs text-white/40 mt-1">
          (Incluye 10% de impuestos)
        </div>
      </div>

      <PaymentElement
        options={{
          layout: 'tabs',
          defaultValues: {
            billingDetails: {
              email: currentUser?.email || '',
            },
          },
        }}
      />

      <Button
        type="submit"
        disabled={isProcessing || !stripe || !isBillingValid}
        className="w-full h-12 rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-50"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Procesando...
          </>
        ) : (
          `Pagar $${(priceUSD * 1.1).toFixed(2)}`
        )}
      </Button>

      {!isBillingValid && (
        <div className="flex items-center gap-2 p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-yellow-300">Completa los datos de facturación para continuar</p>
        </div>
      )}

      <p className="text-xs text-white/40 text-center">
        ✓ Pago seguro con Stripe
      </p>
    </form>
  );
}

export default function CardPayment({
  plan,
  planName,
  priceUSD,
  isProcessing,
  setIsProcessing,
  onSuccess,
  userId,
  entityId,
  billingData,
  isBillingValid,
}: CardPaymentProps) {
  const { currentUser } = useAuth();
  const [clientSecret, setClientSecret] = useState('');
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        setLoadingIntent(true);
        const response = await fetch('/api/subscriptions/stripe-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            userId,
            entityId,
            priceUSD,
            planName,
          }),
        });

        if (!response.ok) {
          throw new Error('Error creando PaymentIntent');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (error: any) {
        console.error('Error:', error);
        toast.error('Error inicializando pago: ' + error.message);
      } finally {
        setLoadingIntent(false);
      }
    };

    if (currentUser && mounted) {
      createPaymentIntent();
    }
  }, [plan, currentUser, priceUSD, planName, mounted]);

  if (!mounted || loadingIntent || !clientSecret) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-white/60">
          {loadingIntent ? 'Inicializando pago...' : 'Cargando...'}
        </span>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#ffffff',
            colorBackground: '#000000',
            colorText: '#ffffff',
            borderRadius: '0.5rem',
          },
        },
      }}
    >
      <PaymentForm
        plan={plan}
        planName={planName}
        priceUSD={priceUSD}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        onSuccess={onSuccess}
        userId={userId}
        entityId={entityId}
        clientSecret={clientSecret}
        billingData={billingData}
        isBillingValid={isBillingValid}
      />
    </Elements>
  );
}
