'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, CreditCard, Store, Info, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import QrTokenPayment from './methods/QrTokenPayment';
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
  entityId: string | null;
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
    router.push('/nucleo');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] w-screen h-[100dvh] max-h-none bg-[#0a0a0a] border-none text-white sm:rounded-none p-0 overflow-hidden">
        <DialogTitle className="sr-only">Checkout - {plan.name}</DialogTitle>

        <div className="flex flex-col lg:flex-row h-full">
          {/* Left Column: Form & Summary */}
          <div className="w-full lg:w-1/2 bg-[#111111] border-r border-white/5 p-6 lg:p-12 flex flex-col justify-start overflow-y-auto">
            <div className="max-w-[600px] w-full mx-auto">
              <div className="mb-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                  <Store className="w-4.5 h-4.5 text-white" />
                </div>
              </div>

              {/* Billing Form (Contact Info & Address) */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold tracking-wide text-white mb-4">Contact & Billing</h3>
                <BillingForm
                  initialEmail={currentUser?.email || ''}
                  onDataChange={setBillingData}
                  isValid={isBillingValid}
                  onValidChange={setIsBillingValid}
                />
              </div>

              {/* Order Summary */}
              <div className="pt-6 border-t border-white/10">
                <p className="text-xs font-medium text-white/60 mb-1.5">Pay Roosevelt</p>
                <h2 className="text-3xl font-semibold tracking-tight text-white mb-6">
                  USD {plan.priceUSD.toFixed(2)}
                </h2>

                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                    <span className="text-xs font-medium text-white/90">{plan.name} Plan</span>
                    <span className="text-xs font-semibold text-white">USD {plan.priceUSD.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                    <span className="text-xs font-medium text-white/90">Subtotal</span>
                    <span className="text-xs font-semibold text-white">USD {plan.priceUSD.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/90">Tax</span>
                      <Info className="w-3 h-3 text-white/40" />
                    </div>
                    <span className="text-[11px] font-medium text-white/50">Calculated after address</span>
                  </div>

                  <div className="flex justify-between items-center py-2 mt-1">
                    <span className="text-sm font-semibold text-white">Total due</span>
                    <span className="text-sm font-semibold text-white">USD {plan.priceUSD.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Method */}
          <div className="w-full lg:w-1/2 bg-black p-6 lg:p-12 overflow-y-auto">
            <div className="max-w-[600px] w-full mx-auto">
              <div>
                <h3 className="text-lg font-semibold tracking-wide text-white mb-4">Payment method</h3>

                <Tabs defaultValue="phantom" className="w-full">
                  {/* Main Payment Types */}
                  <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 rounded-xl p-1 mb-6 h-10">
                    <TabsTrigger value="phantom" className="data-[state=active]:bg-white/10 h-full flex items-center justify-center gap-2 text-xs font-semibold tracking-wide">
                      <Wallet className="w-4 h-4" /> Phantom
                    </TabsTrigger>
                    <TabsTrigger value="card" className="data-[state=active]:bg-white/10 h-full flex items-center justify-center gap-2 text-xs font-semibold tracking-wide">
                      <CreditCard className="w-4 h-4" /> Card
                    </TabsTrigger>
                  </TabsList>

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

                  <TabsContent value="phantom" className="space-y-4">
                    <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl p-4 flex items-start gap-3 transition-all duration-300">
                      <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-blue-200" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-blue-200 font-semibold uppercase tracking-[0.2em]">
                          Unique Phantom QR per entity checkout
                        </p>
                        <p className="text-[11px] text-blue-100/80 leading-4">
                          We generate a unique payment code tied to this exact subscription request inside your active entity.
                          Once Phantom confirms the payment on mainnet, Roosevelt verifies it automatically and activates access.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      <p className="text-xs font-medium text-white/60 mb-3">Select Crypto Token</p>
                      <Tabs defaultValue="lxr" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 bg-white/5 border border-white/10 rounded-lg p-1 mb-4 h-10">
                          <TabsTrigger value="lxr" className="data-[state=active]:bg-white/10 text-xs font-semibold tracking-wide relative">
                            LXR
                            <span className="absolute -top-2 -right-2 text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold shadow-lg">
                              -25%
                            </span>
                          </TabsTrigger>
                          <TabsTrigger value="usdc" className="data-[state=active]:bg-white/10 text-xs font-semibold tracking-wide">USDC</TabsTrigger>
                          <TabsTrigger value="usdt" className="data-[state=active]:bg-white/10 text-xs font-semibold tracking-wide">USDT</TabsTrigger>
                          <TabsTrigger value="sol" className="data-[state=active]:bg-white/10 text-xs font-semibold tracking-wide">SOL</TabsTrigger>
                        </TabsList>

                        <TabsContent value="lxr">
                          <QrTokenPayment
                            plan={plan.id}
                            priceUSD={plan.lxrPriceUSD || plan.priceUSD}
                            paymentMethod="lxr"
                            isProcessing={isProcessing}
                            setIsProcessing={setIsProcessing}
                            onSuccess={handleSuccess}
                            userId={currentUser?.uid || ''}
                            entityId={entityId}
                            billingData={billingData}
                            isBillingValid={isBillingValid}
                            discountLabel={`Save ${((plan.priceUSD - (plan.lxrPriceUSD || plan.priceUSD)) / plan.priceUSD * 100).toFixed(0)}% by paying with LXR`}
                          />
                        </TabsContent>

                        <TabsContent value="usdc">
                          <QrTokenPayment
                            plan={plan.id}
                            priceUSD={plan.priceUSD}
                            paymentMethod="usdc"
                            isProcessing={isProcessing}
                            setIsProcessing={setIsProcessing}
                            onSuccess={handleSuccess}
                            userId={currentUser?.uid || ''}
                            entityId={entityId}
                            billingData={billingData}
                            isBillingValid={isBillingValid}
                          />
                        </TabsContent>

                        <TabsContent value="usdt">
                          <QrTokenPayment
                            plan={plan.id}
                            priceUSD={plan.priceUSD}
                            paymentMethod="usdt"
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
                          <QrTokenPayment
                            plan={plan.id}
                            priceUSD={plan.priceUSD}
                            paymentMethod="sol"
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
                  </TabsContent>
                </Tabs>
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
