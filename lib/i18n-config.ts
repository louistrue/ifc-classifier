import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Don't want to use this?
// Have a look at the Quick start guide 
// for passing in lng and translations on init
// https://react.i18next.com/guides/quick-start

i18n
    // Load translation using http -> see /public/locales
    .use(Backend)
    // detect user language
    // learn more: https://github.com/i18next/i18next-browser-languageDetector
    .use(LanguageDetector)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
        debug: process.env.NODE_ENV === 'development',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        supportedLngs: ['en', 'de'],
        ns: ['common'],
        defaultNS: 'common',
        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n; 