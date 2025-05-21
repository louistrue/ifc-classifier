"use client";

import React from 'react';
import { useTranslation, Trans } from 'react-i18next';

// Simple translation component
export const T = ({
    keyName,
    ns,
    options
}: {
    keyName: string;
    ns?: string;
    options?: any
}) => {
    const { t } = useTranslation(ns);
    // Convert to string to avoid type issues
    return <>{String(t(keyName, options))}</>;
};

// Example of how to use Trans component for complex translations with HTML
export const TransExample = () => {
    const { t } = useTranslation();

    return (
        <Trans i18nKey="complexExample" t={t}>
            This is a <strong>complex</strong> example with <a href="/link">HTML elements</a>.
        </Trans>
    );
};

// Language switcher component
export const LanguageSwitcher = () => {
    const { i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="flex gap-2">
            <button
                className={`px-2 py-1 rounded ${i18n.language === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => changeLanguage('en')}
            >
                EN
            </button>
            <button
                className={`px-2 py-1 rounded ${i18n.language === 'de' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => changeLanguage('de')}
            >
                DE
            </button>
        </div>
    );
}; 