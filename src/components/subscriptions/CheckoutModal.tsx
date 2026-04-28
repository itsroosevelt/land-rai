'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Check, Wallet, DollarSign, Zap, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import LxrPayment from './methods/LxrPayment';
import UsdcPayment from './methods/UsdcPayment';
import SolPayment from './methods/SolPayment';
import CardPayment from './methods/CardPayment';
import BillingForm, { BillingData } from './BillingForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CheckoutModalProps {
  plan: {
    id: string;
    name: string;
    price: string;
    priceUSD: number;
    lxrPrice?: string;
    lxrPriceUSD?: number;
    features: string[];
  };
  onClose: () => void;
  entityId: string;
}

export default function CheckoutModal({ plan, onClose, entityId: propEntityId }: CheckoutModalProps) {
  const router = useRouter();
  const { currentUser, activeEntity } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [isBillingValid, setIsBillingValid] = useState(false);

  const entityId = propEntityId || activeEntity || 'life';

  const handleSuccess = () => {
    onClose();
    setTimeout(() => {
      router.push(`/nucleo/${entityId}`);
    }, 1500);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] bg-black border-white/10 text-white rounded-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">Checkout - {plan.name}</DialogTitle>

        <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] min-h-[600px]">
          {/* Columna Izquierda: Resumen del Plan */}
          <div className="hidden lg:flex flex-col bg-gradient-to-b from-white/5 to-white/[0.02] border-r border-white/10 p-8 justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40 mb-4">Plan seleccionado</p>
              <h2 className="text-4xl font-light tracking-tight text-white mb-2">{plan.name}</h2>
              <p className="text-2xl font-light text-white mb-8">
                ${plan.priceUSD.toFixed(2)}<span className="text-sm text-white/40">/mes</span>
              </p>

              <div className="space-y-3 mb-8">
                {plan.features.slice(0, 3).map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
                    <span className="text-sm text-white/70">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-4 mb-6">
                <p className="text-xs text-blue-300 mb-3 font-medium">Conecta tu wallet Phantom</p>
                <div className="flex justify-center">
                  <WalletMultiButton />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Check className="w-3 h-3 text-green-400" />
                Pagos seguros en Solana Mainnet
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Check className="w-3 h-3 text-green-400" />
                Suscripción válida por 30 días
              </div>
            </div>
          </div>

          {/* Columna Derecha: Formulario + Métodos de Pago */}
          <div className="flex flex-col bg-black p-6 lg:p-8 overflow-y-auto">
            {/* Resumen Mobile */}
            <div className="lg:hidden mb-6 pb-6 border-b border-white/10">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40 mb-2">Plan</p>
              <div className="flex justify-between items-baseline mb-4">
                <h3 className="text-2xl font-light text-white">{plan.name}</h3>
                <p className="text-xl font-light text-white">${plan.priceUSD.toFixed(2)}/mes</p>
              </div>
              <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3">
                <p className="text-xs text-blue-300 mb-2 font-medium">Conecta tu wallet Phantom</p>
                <div className="flex justify-center">
                  <WalletMultiButton />
                </div>
              </div>
            </div>

            {/* Formulario de Facturación */}
            <div className="mb-6">
              <BillingForm
                initialEmail={currentUser?.email || ''}
                onDataChange={setBillingData}
                isValid={isBillingValid}
                onValidChange={setIsBillingValid}
              />
            </div>

            {/* Métodos de Pago */}
            <div className="flex-1">
              <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-5">
                <DollarSign className="w-4 h-4 text-white/60" />
                <h3 className="text-sm font-medium text-white">Método de Pago</h3>
              </div>

              <Tabs defaultValue="lxr" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-white/5 border border-white/10 rounded-lg p-1 mb-6">
                  <TabsTrigger value="lxr" className="text-xs sm:text-sm data-[state=active]:bg-white/10 relative flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span className="hidden sm:inline">LXR</span>
                    <span className="absolute -top-2 -right-1 text-[10px] bg-green-600 text-white px-2 py-0.5 rounded">
                      -25%
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="usdc" className="text-xs sm:text-sm data-[state=active]:bg-white/10 flex items-center justify-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    <span className="hidden sm:inline">USDC</span>
                  </TabsTrigger>
                  <TabsTrigger value="sol" className="text-xs sm:text-sm data-[state=active]:bg-white/10 flex items-center justify-center gap-1">
                    <Wallet className="w-3 h-3" />
                    <span className="hidden sm:inline">SOL</span>
                  </TabsTrigger>
                  <TabsTrigger value="card" className="text-xs sm:text-sm data-[state=active]:bg-white/10 flex items-center justify-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    <span className="hidden sm:inline">Tarjeta</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="lxr">
                  <LxrPayment
                    plan={plan.id}
                    priceUSD={plan.lxrPriceUSD || plan.priceUSD}
                    discount={((plan.priceUSD - (plan.lxrPriceUSD || plan.priceUSD)) / plan.priceUSD * 100).toFixed(0)}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                    onSuccess={handleSuccess}
                    userId={currentUser?.uid || ''}
                    entityId={entityId}
                    billingData={billingData}
                    isBillingValid={isBillingValid}
                  />
                </TabsContent>

                <TabsContent value="usdc">
                  <UsdcPayment
                    plan={plan.id}
                    priceUSD={plan.priceUSD}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                    onSuccess={handleSuccess}
                    userId={currentUser?.uid || ''}
                    entityId={entityId}
                    billingData={billingData}
                    isBillingValid={isBillingValid}
                  />
                </TabsContent>

                <TabsContent value="sol">
                  <SolPayment
                    plan={plan.id}
                    priceUSD={plan.priceUSD}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                    onSuccess={handleSuccess}
                    userId={currentUser?.uid || ''}
                    entityId={entityId}
                    billingData={billingData}
                    isBillingValid={isBillingValid}
                  />
                </TabsContent>

                <TabsContent value="card">
                  <CardPayment
                    plan={plan.id}
                    planName={plan.name}
                    priceUSD={plan.priceUSD}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                    onSuccess={handleSuccess}
                    userId={currentUser?.uid || ''}
                    entityId={entityId}
                    billingData={billingData}
                    isBillingValid={isBillingValid}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
