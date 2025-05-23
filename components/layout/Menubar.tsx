"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Shapes, HelpCircle, ChevronDown } from "lucide-react";
import DocumentationModal from "@/components/docs/DocumentationModal";
import { useTranslation } from "react-i18next";

const Menubar = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(event.target as Node)
      ) {
        setIsLangDropdownOpen(false);
      }
    }
    if (isLangDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLangDropdownOpen]);

  if (!mounted) {
    return null;
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setIsLangDropdownOpen(false);
  };

  return (
    <nav className="bg-transparent border-b border-border/15 fixed top-0 left-0 right-0 z-50 pointer-events-none backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[hsl(var(--background))/80] to-transparent pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between mx-auto p-4 h-16">
          <Link
            href="/"
            className="flex items-center space-x-3 rtl:space-x-reverse"
          >
            <Shapes className="h-8 w-8 text-primary" />
            <span className="self-center text-2xl font-semibold whitespace-nowrap text-foreground">
              {"IfcClassifier"}
            </span>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="relative" ref={langDropdownRef}>
              <button
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="p-2 h-[40px] w-[60px] flex items-center justify-center rounded-md bg-background border border-border text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Language selector"
                type="button"
              >
                {i18n.language.toUpperCase()}
                <ChevronDown
                  size={16}
                  className={`ml-1 transition-transform duration-200 ${isLangDropdownOpen ? "rotate-180" : ""
                    }`}
                />
              </button>
              {isLangDropdownOpen && (
                <div className="absolute top-full mt-1 w-full rounded-md bg-background border border-border shadow-lg z-10 py-1">
                  <button
                    onClick={() => changeLanguage("en")}
                    className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                  >
                    <span className="text-base">🇬🇧</span>
                    EN
                  </button>
                  <button
                    onClick={() => changeLanguage("de")}
                    className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                  >
                    <span className="text-base">🇩🇪</span>
                    DE
                  </button>
                  <button
                    onClick={() => changeLanguage("fr")}
                    className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                  >
                    <span className="text-base">🇫🇷</span>
                    FR
                  </button>
                  <button
                    onClick={() => changeLanguage("it")}
                    className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                  >
                    <span className="text-base">🇮🇹</span>
                    IT
                  </button>
                </div>
              )}
            </div>
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
      {isDocsModalOpen && (
        <DocumentationModal onClose={() => setIsDocsModalOpen(false)} />
      )}
    </nav>
  );
};

export default Menubar;
