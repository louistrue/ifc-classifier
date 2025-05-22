"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n-config";
import { HttpBackendOptions, RequestCallback } from "i18next-http-backend";

export default function I18nClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isReady, setIsReady] = useState(false);
  const [initAttempted, setInitAttempted] = useState(false);

  useEffect(() => {
    if (initAttempted) {
      // If init was already attempted, subsequent readiness checks might be handled by events or direct checks.
      // We mainly want to prevent re-calling i18n.init().
      // If it's already ready from the first attempt, isReady would be true.
      return;
    }
    setInitAttempted(true);

    const checkAndSetReady = () => {
      if (i18n.isInitialized && i18n.hasLoadedNamespace("common")) {
        setIsReady(true);
        return true; // Indicate readiness was met
      }
      return false; // Indicate not ready yet
    };

    // Check immediately in case it's already ready (e.g. from HMR or other scenarios)
    if (checkAndSetReady()) {
      return; // Already ready, no need to init or listen to events
    }

    const handleInitialized = () => {
      checkAndSetReady(); // Ensure namespace is loaded when 'initialized' event fires
    };

    i18n.on("initialized", handleInitialized);

    // Proceed with initialization if not already caught by the immediate check
    i18n
      .init({
        debug: process.env.NODE_ENV === "development",
        fallbackLng: "en",
        interpolation: {
          escapeValue: false,
        },
        supportedLngs: ["en", "de"],
        ns: ["common"],
        defaultNS: "common",
        backend: {
          loadPath: "/locales/{{lng}}/{{ns}}.json",
          request: async (
            options: HttpBackendOptions,
            url: string,
            payload: any,
            callback: RequestCallback
          ) => {
            try {
              console.log("i18next-http-backend requesting URL:", url);
              const response = await fetch(url);
              if (!response.ok) {
                return callback(
                  new Error(`Failed to load ${url}: ${response.statusText}`),
                  { data: null as any, status: response.status }
                );
              }
              const data = await response.json();
              callback(null, { data, status: response.status });
            } catch (e) {
              console.error("i18next-http-backend request error:", e);
              callback(e, { data: null as any, status: 0 });
            }
          },
        },
        react: {
          useSuspense: false,
        },
      })
      .then(() => {
        // After init promise resolves, check again.
        // For i18next-http-backend, this .then() should mean namespaces are loaded.
        checkAndSetReady();
      })
      .catch((err) => {
        console.error("i18next main initialization error:", err);
      });

    return () => {
      i18n.off("initialized", handleInitialized);
    };
  }, [initAttempted]); // Effect depends on initAttempted to run the core logic once.

  if (!isReady) {
    return null;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
