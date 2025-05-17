"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Shapes } from "lucide-react"; // Changed Aperture to Shapes

const Menubar = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <nav className="bg-transparent border-b border-border/15 fixed top-0 left-0 right-0 z-50 pointer-events-none backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[hsl(var(--background))/80] to-transparent pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between mx-auto p-4 h-16">
          {" "}
          {/* Standard height for a menubar */}
          <Link
            href="/"
            className="flex items-center space-x-3 rtl:space-x-reverse"
          >
            <Shapes className="h-8 w-8 text-primary" />
            <span className="self-center text-2xl font-semibold whitespace-nowrap text-foreground">
              IfcClassifier
            </span>
          </Link>
          <div className="flex items-center">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-6 w-6 text-foreground" />
              ) : (
                <Moon className="h-6 w-6 text-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Menubar;
