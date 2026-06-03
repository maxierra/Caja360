import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/app/providers";
import { SupportFloatingButton } from "@/components/support-floating-button";

export const metadata: Metadata = {
  title: "POS SaaS — Punto de venta en la nube",
  description:
    "Stock, caja, tickets e informes para tu comercio. Probá el POS en una demo en vivo y empezá gratis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('theme');var r=document.documentElement;r.classList.remove('dark','light');r.classList.add(t==='light'?'light':'dark');}catch(e){document.documentElement.classList.add('dark');}})();`}
        </Script>
        <Providers>{children}</Providers>
        <SupportFloatingButton />
      </body>
    </html>
  );
}
