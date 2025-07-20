"use client"

import { useState } from "react";
import { Layers, Filter, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ClassificationPanel } from "@/components/classification-panel";
import { RulePanel } from "@/components/rule-panel";
import { SettingsPanel } from "@/components/settings-panel";

interface MobileTabsProps {
  onSettingsChanged: () => void;
}

export default function MobileTabs({ onSettingsChanged }: MobileTabsProps) {
  const { t } = useTranslation();
  const [openTab, setOpenTab] = useState<
    "classifications" | "rules" | "settings" | null
  >(null);

  return (
    <div className="md:hidden">
      {/* Mobile Navigation Tabs - Above footer */}
      <div className="fixed inset-x-0 bottom-10 z-40 flex h-16 border-t border-border/50 bg-background/98 backdrop-blur-md text-foreground shadow-2xl">
        <Sheet
          open={openTab === "classifications"}
          onOpenChange={(o) => setOpenTab(o ? "classifications" : null)}
        >
          <SheetTrigger asChild>
            <button className="flex flex-1 flex-col items-center justify-center gap-1.5 text-xs font-medium hover:bg-accent/20 transition-colors rounded-none px-2 py-3">
              <Layers className="h-5 w-5 text-foreground/80" />
              <span className="leading-tight text-center">
                {t("navigation.classificationsTab")}
              </span>
            </button>
          </SheetTrigger>
          <SheetContent className="h-[80vh] overflow-y-auto p-2">
            <ClassificationPanel />
          </SheetContent>
        </Sheet>
        <Sheet
          open={openTab === "rules"}
          onOpenChange={(o) => setOpenTab(o ? "rules" : null)}
        >
          <SheetTrigger asChild>
            <button className="flex flex-1 flex-col items-center justify-center gap-1.5 text-xs font-medium hover:bg-accent/20 transition-colors rounded-none px-2 py-3">
              <Filter className="h-5 w-5 text-foreground/80" />
              <span className="leading-tight text-center">{t("rulesPanel")}</span>
            </button>
          </SheetTrigger>
          <SheetContent className="h-[80vh] overflow-y-auto p-2">
            <RulePanel />
          </SheetContent>
        </Sheet>
        <Sheet
          open={openTab === "settings"}
          onOpenChange={(o) => setOpenTab(o ? "settings" : null)}
        >
          <SheetTrigger asChild>
            <button className="flex flex-1 flex-col items-center justify-center gap-1.5 text-xs font-medium hover:bg-accent/20 transition-colors rounded-none px-2 py-3">
              <Settings className="h-5 w-5 text-foreground/80" />
              <span className="leading-tight text-center">{t("settingsPanel")}</span>
            </button>
          </SheetTrigger>
          <SheetContent className="h-[80vh] overflow-y-auto p-2">
            <SettingsPanel onSettingsChanged={onSettingsChanged} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile Footer - At the very bottom */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-background/98 backdrop-blur-sm border-t border-border/30">
        <div className="px-4 py-2.5 flex items-center justify-center">
          <div className="flex items-center space-x-2.5 text-xs text-muted-foreground/80">
            <a
              href="https://github.com/louistrue/ifc-classifier"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="flex items-center hover:text-primary transition-colors"
            >
              <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
            <span>•</span>
            <span>© {new Date().getFullYear()}</span>
            <span>•</span>
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.en.html"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="AGPL-3.0"
              className="hover:text-primary hover:underline transition-colors"
            >
              AGPL-3.0
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
