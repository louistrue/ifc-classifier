"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Shapes, HelpCircle, ChevronDown } from "lucide-react";
import DocumentationModal from "@/components/docs/DocumentationModal";
import { useTranslation } from "react-i18next";
import BeautifulThemeToggle from "@/components/layout/BeautifulThemeToggle";

const Menubar = () => {
  const [mounted, setMounted] = useState(false);
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
            <BeautifulThemeToggle size={32} />
            <div className="relative" ref={langDropdownRef}>
              <button
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="p-2 h-[40px] w-[60px] flex items-center justify-center rounded-md bg-background border border-border text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t('languageSelector')}
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
                <div className="absolute top-full mt-2 min-w-[120px] rounded-md bg-background border border-border shadow-lg z-10 p-1">
                  <button
                    onClick={() => changeLanguage("en")}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-sm flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-5 h-4 rounded-sm overflow-hidden flex-shrink-0" viewBox="0 0 60 40">
                      <rect width="60" height="40" fill="#012169"/>
                      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8"/>
                      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="5" strokeDasharray="0,8,0,8"/>
                      <path d="M30,0 v40 M0,20 h60" stroke="#fff" strokeWidth="13"/>
                      <path d="M30,0 v40 M0,20 h60" stroke="#C8102E" strokeWidth="8"/>
                    </svg>
                    EN
                  </button>
                  <button
                    onClick={() => changeLanguage("de")}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-sm flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-5 h-4 rounded-sm overflow-hidden flex-shrink-0" viewBox="0 0 60 40">
                      <rect width="60" height="13.33" y="0" fill="#000"/>
                      <rect width="60" height="13.33" y="13.33" fill="#D00"/>
                      <rect width="60" height="13.34" y="26.66" fill="#FFCE00"/>
                    </svg>
                    DE
                  </button>
                  <button
                    onClick={() => changeLanguage("fr")}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-sm flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-5 h-4 rounded-sm overflow-hidden flex-shrink-0" viewBox="0 0 60 40">
                      <rect width="20" height="40" x="0" fill="#002654"/>
                      <rect width="20" height="40" x="20" fill="#fff"/>
                      <rect width="20" height="40" x="40" fill="#ED2939"/>
                    </svg>
                    FR
                  </button>
                  <button
                    onClick={() => changeLanguage("it")}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-sm flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-5 h-4 rounded-sm overflow-hidden flex-shrink-0" viewBox="0 0 60 40">
                      <rect width="20" height="40" x="0" fill="#009246"/>
                      <rect width="20" height="40" x="20" fill="#fff"/>
                      <rect width="20" height="40" x="40" fill="#CE2B37"/>
                    </svg>
                    IT
                  </button>
                </div>
              )}
            </div>
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
