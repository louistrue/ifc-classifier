"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import type { ThemeState } from "beautiful-theme-toggle";

export default function BeautifulThemeToggle({ size = 80 }: { size?: number | string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<import("beautiful-theme-toggle").ThemeToggle | null>(null);
  const themeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    let instance: import("beautiful-theme-toggle").ThemeToggle | null = null;

    import("beautiful-theme-toggle").then(({ ThemeToggle }) => {
      if (!containerRef.current) return;

      const initialState: ThemeState | "system" =
        theme === "dark" || theme === "light" ? theme : (resolvedTheme as ThemeState) ?? "system";

      instance = new ThemeToggle({
        element: containerRef.current,
        size,
        initialState,
        onChange: (state: ThemeState) => {
          // Delay the page theme change until the toggle animation finishes.
          // next-themes' disableTransitionOnChange injects a temporary
          // * { transition: none !important } that cancels running CSS
          // transitions. By deferring setTheme, the toggle animates fully
          // before the kill-style is ever injected.
          if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current);
          themeTimeoutRef.current = setTimeout(() => setTheme(state), 800);
        },
      });

      toggleRef.current = instance;
    });

    return () => {
      if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current);
      instance?.destroy();
      toggleRef.current = null;
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external theme changes into the toggle
  useEffect(() => {
    const resolved = theme === "system" ? resolvedTheme : theme;
    if (toggleRef.current && (resolved === "dark" || resolved === "light")) {
      if (toggleRef.current.getTheme() !== resolved) {
        toggleRef.current.setTheme(resolved, false);
      }
    }
  }, [theme, resolvedTheme]);

  return <div ref={containerRef} className="theme-toggle-wrap flex items-center" />;
}
