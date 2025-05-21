"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Shapes, HelpCircle } from "lucide-react";
import DocumentationModal from "@/components/docs/DocumentationModal";
import { useI18n } from "@/context/i18n-context";
import { useTranslation } from "react-i18next";

const Menubar = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <nav className="bg-transparent border-b border-border/15 fixed top-0 left-0 right-0 z-50 pointer-events-none backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[hsl(var(--background))/80] to-transparent pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between mx-auto p-4 h-16">
          <Link href="/" className="flex items-center space-x-3 rtl:space-x-reverse">
            <Shapes className="h-8 w-8 text-primary" />
            <span className="self-center text-2xl font-semibold whitespace-nowrap text-foreground">
              {t("appName")}
            </span>
          </Link>
          <div className="flex items-center space-x-2">
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="p-2 rounded-md bg-background border border-border text-foreground hover:bg-accent focus:outline-none"
              aria-label="Language"
            >
              <option value="en">EN</option>
              <option value="de">DE</option>
            </select>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-6 w-6 text-foreground" />
              ) : (
                <Moon className="h-6 w-6 text-foreground" />
              )}
            </button>
            <button
              onClick={() => setIsDocsModalOpen(!isDocsModalOpen)}
              className="p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={t("openDocs")}
            >
              <HelpCircle className="h-6 w-6 text-foreground" />
            </button>
          </div>
        </div>
      </div>
      {isDocsModalOpen && <DocumentationModal onClose={() => setIsDocsModalOpen(false)} />}
    </nav>
  );
};

export default Menubar;
