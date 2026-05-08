'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Check, Wallet, DollarSign, Zap, CreditCard, Store, Info } from 'lucide-react';
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
  entityId: string | null;
}

export default function CheckoutModal({ plan, onClose, entityId: propEntityId }: CheckoutModalProps) {
  const router = useRouter();
  const { currentUser, activeEntity } = useAuth();
  const { connected, disconnect } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [isBillingValid, setIsBillingValid] = useState(false);

  const entityId = propEntityId || activeEntity || '';

  const handleSuccess = () => {
    onClose();
    setTimeout(() => {
      router.push('/nucleo');
    }, 1500);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[1200px] bg-[#0a0a0a] border-white/10 text-white rounded-2xl p-0 overflow-hidden min-h-[800px] h-[95vh]">
        <DialogTitle className="sr-only">Checkout - {plan.name}</DialogTitle>

        <div className="flex flex-col lg:flex-row h-full">
          {/* Left Column: Form & Summary */}
          <div className="w-full lg:w-1/2 bg-[#111111] border-r border-white/5 p-8 lg:p-12 flex flex-col justify-start overflow-y-auto">
            <div className="max-w-[480px] w-full mx-auto">
              <div className="mb-8 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </div>
              </div>

              {/* Billing Form (Contact Info & Address) */}
              <div className="mb-10">
                <h3 className="text-xl font-semibold tracking-wide text-white mb-6">Contact & Billing</h3>
                <BillingForm
                  initialEmail={currentUser?.email || ''}
                  onDataChange={setBillingData}
                  isValid={isBillingValid}
                  onValidChange={setIsBillingValid}
                />
              </div>

              {/* Order Summary */}
              <div className="pt-8 border-t border-white/10">
                <p className="text-sm font-medium text-white/60 mb-2">Pay Roosevelt</p>
                <h2 className="text-4xl font-semibold tracking-tight text-white mb-8">
                  USD {plan.priceUSD.toFixed(2)}
                </h2>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-3 border-b border-white/10">
                    <span className="text-sm font-medium text-white/90">{plan.name} Plan</span>
                    <span className="text-sm font-semibold text-white">USD {plan.priceUSD.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b border-white/10">
                    <span className="text-sm font-medium text-white/90">Subtotal</span>
                    <span className="text-sm font-semibold text-white">USD {plan.priceUSD.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/90">Tax</span>
                      <Info className="w-3 h-3 text-white/40" />
                    </div>
                    <span className="text-xs font-medium text-white/50">Calculated after address</span>
                  </div>

                  <div className="flex justify-between items-center py-3 mt-2">
                    <span className="text-base font-semibold text-white">Total due</span>
                    <span className="text-base font-semibold text-white">USD {plan.priceUSD.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Method */}
          <div className="w-full lg:w-1/2 bg-black p-8 lg:p-12 overflow-y-auto">
            <div className="max-w-[480px] w-full mx-auto">
              <div>
                <h3 className="text-xl font-semibold tracking-wide text-white mb-6">Payment method</h3>

                <Tabs defaultValue="phantom" className="w-full">
                  {/* Main Payment Types */}
                  <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 rounded-xl p-1 mb-8 h-12">
                    <TabsTrigger value="phantom" className="data-[state=active]:bg-white/10 h-full flex items-center justify-center gap-2 font-semibold tracking-wide">
                      <Wallet className="w-4 h-4" /> Phantom
                    </TabsTrigger>
                    <TabsTrigger value="card" className="data-[state=active]:bg-white/10 h-full flex items-center justify-center gap-2 font-semibold tracking-wide">
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

                  <TabsContent value="phantom" className="space-y-6">
                    {/* Connect Wallet Prompt */}
                    <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-center transition-all duration-300">
                      <p className="text-sm text-blue-200 font-semibold tracking-wide">
                        {connected ? 'Wallet connected securely' : 'Connect your Phantom wallet'}
                      </p>
                      <div className="flex flex-col items-center gap-3">
                        <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 !text-white !font-semibold !rounded-full !h-12 !px-8 !transition-colors" />
                        {connected && (
                          <button 
                            onClick={() => disconnect()}
                            className="text-[10px] text-blue-300 hover:text-red-400 transition-colors uppercase tracking-[0.2em] font-bold mt-1"
                          >
                            Disconnect Wallet
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Crypto Token Selection */}
                    <div className="pt-6 border-t border-white/10">
                      <p className="text-sm font-medium text-white/60 mb-4">Select Crypto Token</p>
                      <Tabs defaultValue="lxr" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10 rounded-lg p-1 mb-6 h-12">
                          <TabsTrigger value="lxr" className="data-[state=active]:bg-white/10 font-semibold tracking-wide relative">
                            LXR
                            <span className="absolute -top-2 -right-2 text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold shadow-lg">
                              -25%
                            </span>
                          </TabsTrigger>
                          <TabsTrigger value="usdc" className="data-[state=active]:bg-white/10 font-semibold tracking-wide">USDC</TabsTrigger>
                          <TabsTrigger value="sol" className="data-[state=active]:bg-white/10 font-semibold tracking-wide">SOL</TabsTrigger>
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
