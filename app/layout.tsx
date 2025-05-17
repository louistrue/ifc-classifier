import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/app/theme-provider";
import { IFCContextProvider } from "@/context/ifc-context";
import Script from 'next/script';
import Menubar from "@/components/layout/Menubar";

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
        {/* You can keep existing meta tags or use the metadata object above */}
        {/* <title>IFC Viewer with Classification System</title> */}
        {/* <meta name="description" content="Web-based IFC viewer with rule-based classification system"/> */}
      </head>
      <body className={`${inter.className} h-full flex flex-col overflow-hidden`}>
        <IFCContextProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="flex flex-col h-full">
              <Menubar />
              <main className="flex-1 overflow-hidden">{children}</main>
            </div>
          </ThemeProvider>
        </IFCContextProvider>
        <Script
          src="https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
