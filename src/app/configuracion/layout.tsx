import AppWalletProvider from "@/components/solana/AppWalletProvider";

export default function ConfiguracionLayout({
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
