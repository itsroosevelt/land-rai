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
              const appId = '${process.env.NEXT_PUBLIC_META_APP_ID}';
              
              if (!appId || appId === 'undefined') {
                console.error('🚀 [ROOSEVELT META SDK]: Error - NEXT_PUBLIC_META_APP_ID no configurado.');
                return;
              }

              FB.init({
                appId: appId,
                cookie: true,
                xfbml: true,
                version: 'v21.0'
              });
              
              // Solo ejecutar verificación de estado si estamos en HTTPS (Meta lo exige)
              if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
                try {
                  FB.getLoginStatus(function() {
                    window.FB_READY = true;
                    console.log('🚀 [ROOSEVELT META SDK]: Inicializado.');
                  });
                } catch (e) {
                  console.warn('🚀 [ROOSEVELT META SDK]: getLoginStatus bloqueado por el navegador.');
                  window.FB_READY = true; // Forzamos listo para no bloquear modales
                }
              } else {
                window.FB_READY = true;
                console.log('🚀 [ROOSEVELT META SDK]: Modo HTTP detectado, omitiendo verificación de estado.');
              }
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

