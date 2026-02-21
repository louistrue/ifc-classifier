"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import type { ThemeState } from "beautiful-theme-toggle";

export default function BeautifulThemeToggle({ size = 80 }: { size?: number | string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<import("beautiful-theme-toggle").ThemeToggle | null>(null);
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
          setTheme(state);
        },
      });

      toggleRef.current = instance;
    });

    return () => {
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
