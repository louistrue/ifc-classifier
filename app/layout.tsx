import type React from "react";
import "@/app/globals.css";
import { ThemeProvider } from "@/app/theme-provider";
import Menubar from "@/components/layout/Menubar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full overflow-hidden">
      <head>
        <title>IFC Viewer with Classification System</title>
        <meta
          name="description"
          content="Web-based IFC viewer with rule-based classification system"
        />
      </head>
      <body className="h-full flex flex-col overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="flex flex-col h-full">
            <Menubar />
            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
