"use client";

import { useEffect, useState } from "react";
import "../lib/i18n-config";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n-config";

export default function I18nClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInitialized, setIsInitialized] = useState(i18n.isInitialized);

  // Initialize i18next on the client side
  useEffect(() => {
    if (!i18n.isInitialized) {
      i18n.init().then(() => {
        setIsInitialized(true);
      });
    }
  }, []);

  if (!isInitialized) {
    return null;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
