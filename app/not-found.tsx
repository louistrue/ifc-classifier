"use client";

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-4xl font-bold mb-4">{t('pageNotFoundTitle')}</h1>
            <p className="mb-8 text-lg">{t('pageNotFoundMessage')}</p>
            <Link href="/" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                {t('returnHome')}
            </Link>
        </div>
    );
}
