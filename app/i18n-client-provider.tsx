"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n-config";

export default function I18nClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isReady, setIsReady] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const checkAndSetReady = () => {
      if (i18n.isInitialized && i18n.hasLoadedNamespace("common")) {
        setIsReady(true);
        return true;
      }
      return false;
    };

    // Check immediately in case it's already ready
    if (checkAndSetReady()) {
      return;
    }

    const handleInitialized = () => {
      checkAndSetReady();
    };

    const handleLoaded = () => {
      checkAndSetReady();
    };

    i18n.on("initialized", handleInitialized);
    i18n.on("loaded", handleLoaded);

    // If not already initialized, wait for it
    if (!i18n.isInitialized) {
      // The i18n instance from config should initialize itself
    } else {
      // Already initialized, just check if namespace is loaded
      checkAndSetReady();
    }

    return () => {
      i18n.off("initialized", handleInitialized);
      i18n.off("loaded", handleLoaded);
    };
  }, []);

  if (!isReady) {
    return <div>{t('loadingTranslations')}</div>;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
