"use client";
import React, { createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Language } from '@/lib/i18n';
import '../lib/i18n-config';

interface I18nContextProps {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, options?: any) => string;
}

const I18nContext = createContext<I18nContextProps>({
  lang: 'en',
  setLang: () => { },
  t: (key: string) => key,
});

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const { t, i18n } = useTranslation();

  // Safely cast to Language type
  const lang = (i18n.language && (i18n.language === 'en' || i18n.language === 'de' || i18n.language === 'fr' || i18n.language === 'it')
    ? i18n.language
    : 'en') as Language;

  const setLang = (newLang: Language) => {
    i18n.changeLanguage(newLang);
  };

  // Listen for language changes from i18next
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      if (lng && (lng === 'en' || lng === 'de' || lng === 'fr' || lng === 'it')) {
        localStorage.setItem('language', lng);
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  // Initialize language from browser or localStorage on mount
  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language | null;
    if (savedLang && (savedLang === 'en' || savedLang === 'de' || savedLang === 'fr' || savedLang === 'it')) {
      setLang(savedLang);
    }
  }, []);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
