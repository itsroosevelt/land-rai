import AppWalletProvider from "@/components/solana/AppWalletProvider";

export default function SubscriptionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppWalletProvider>
      {children}
    </AppWalletProvider>
  );
}
