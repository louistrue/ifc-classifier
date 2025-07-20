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
      <div className="fixed inset-x-0 bottom-0 z-40 flex h-12 border-t border-border bg-background text-foreground">
        <Sheet
          open={openTab === "classifications"}
          onOpenChange={(o) => setOpenTab(o ? "classifications" : null)}
        >
          <SheetTrigger asChild>
            <button className="flex flex-1 flex-col items-center justify-center text-xs">
              <Layers className="h-5 w-5" />
              <span className="leading-none">
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
            <button className="flex flex-1 flex-col items-center justify-center text-xs">
              <Filter className="h-5 w-5" />
              <span className="leading-none">{t("rulesPanel")}</span>
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
            <button className="flex flex-1 flex-col items-center justify-center text-xs">
              <Settings className="h-5 w-5" />
              <span className="leading-none">{t("settingsPanel")}</span>
            </button>
          </SheetTrigger>
          <SheetContent className="h-[80vh] overflow-y-auto p-2">
            <SettingsPanel onSettingsChanged={onSettingsChanged} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
