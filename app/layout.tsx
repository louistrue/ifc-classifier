import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/app/theme-provider";
import { IFCContextProvider } from "@/context/ifc-context";
import { I18nProvider } from "@/context/i18n-context";
import I18nClientProvider from "./i18n-client-provider";
import Script from "next/script";
import Menubar from "@/components/layout/Menubar";
import Footer from "@/components/layout/Footer";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IFC Classifier",
  description: "Classify and manage IFC models",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full overflow-hidden">
      <head>
        {/* Metadata handled via the metadata object above */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#ffffff" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className={`${inter.className} h-full flex flex-col overflow-hidden`}>
        <IFCContextProvider>
          <I18nClientProvider>
            <I18nProvider>
              <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <div className="flex flex-col h-full">
                  <Menubar />
                  <main className="flex-1 overflow-hidden">{children}</main>
                  <Footer />
                </div>
              </ThemeProvider>
            </I18nProvider>
          </I18nClientProvider>
        </IFCContextProvider>
        <Analytics />
        <Script src="https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
