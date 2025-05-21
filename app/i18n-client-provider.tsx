'use client';

import { useEffect } from 'react';
import '../lib/i18n-config';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n-config';

export default function I18nClientProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    // Initialize i18next on the client side
    useEffect(() => {
        // This triggers the loading of resources
        if (!i18n.isInitialized) {
            i18n.init();
        }
    }, []);

    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
} 