"use client";
import React, { createContext, useContext, useState } from 'react';
import { translations, Language } from '@/lib/i18n';

interface I18nContextProps {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextProps>({
  lang: 'en',
  setLang: () => {},
  t: (key: string) => translations['en'][key] || key,
});

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>('en');
  const t = (key: string) => translations[lang][key] || key;
  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
