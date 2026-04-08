import type { Metadata } from "next";
import Script from "next/script";
import { Montserrat } from "next/font/google"; // Font updated to Montserrat

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/SidebarContext";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import AppWalletProvider from "@/components/solana/AppWalletProvider";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Roosevelt | Artificial Intelligence",
  description: `A Next-Generation Artificial Intelligence infrastructure designed to act as a unified command center. It's a proactive manager integrating business strategy with personal optimization. 
  
How it works:
• Total Interconnectivity: Links digital assets, blockchains (like Solana), and admin tools for a real-time 360° view.
• Predictive Analysis: Detects patterns, financial risks, and crypto opportunities before they become problems.
• Autonomous Execution: Resolves technical tasks independently, letting you focus on high-level decisions.

Impact Areas: Web3 Ecosystems, Business Direction, and Time Optimization. 

It is the bridge between the founder's vision and operational execution, evolving with your business.`,
  icons: {
    icon: [
      { url: "/assets/newlogo.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/newlogo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/assets/newlogo.png", sizes: "180x180", type: "image/png" },
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${montserrat.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AppWalletProvider>
              <SidebarProvider>
                {children}
                <Toaster position="top-right" richColors theme="dark" />
              </SidebarProvider>
            </AppWalletProvider>
          </AuthProvider>
        </ThemeProvider>
        <Script src="https://terminal.jup.ag/main-v3.js" strategy="lazyOnload" />
        <Script id="meta-sdk-core" strategy="afterInteractive">
          {`
            window.fbAsyncInit = function() {
              // Si la variable de entorno falla (Vercel), usamos el ID hardcoded como respaldo de seguridad
              const envAppId = '${process.env.NEXT_PUBLIC_META_APP_ID}';
              const appId = (!envAppId || envAppId === 'undefined') ? '1239485381164246' : envAppId;
              
              FB.init({
                appId: appId,
                cookie: true,
                xfbml: true,
                version: 'v21.0'
              });
              
              FB.getLoginStatus(function() {
                window.FB_READY = true;
                console.log('🚀 [ROOSEVELT META SDK]: Inicializado y verificado.');
                console.log('📡 [META CONFIG]: App ID cargado (últimos 4):', appId.slice(-4));
                if (appId === '1239485381164246' && envAppId === 'undefined') {
                  console.warn('⚠️ [ROOSEVELT INFO]: Usando App ID de respaldo (la variable en Vercel está vacía).');
                }
              });
            };
            (function(d, s, id) {
              var js, fjs = d.getElementsByTagName(s)[0];
              if (d.getElementById(id)) return;
              js = d.createElement(s); js.id = id;
              js.src = "https://connect.facebook.net/en_US/sdk.js";
              fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
          `}
        </Script>
      </body>
    </html>
  );
}

