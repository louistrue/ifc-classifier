"use client";

import Link from "next/link";
import { Github, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border/15 bg-background/70 backdrop-blur-sm text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span>
            <Link href="https://www.lt.plus" className="hover:text-primary underline">
              lt.plus
            </Link>
            {" — "}Licensed under AGPL3
          </span>
        </div>
        <Link
          href="https://github.com/louistrue/ifc-classifier"
          className="flex items-center space-x-1 hover:text-primary"
        >
          <Github className="h-4 w-4" />
          <span>GitHub</span>
        </Link>
      </div>
    </footer>
  );
}
