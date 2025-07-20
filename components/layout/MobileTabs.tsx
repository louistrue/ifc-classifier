"use client";

import { useState } from "react";
import { Layers, Filter, Settings } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ClassificationPanel from "@/components/classification-panel";
import RulePanel from "@/components/rule-panel";
import SettingsPanel from "@/components/settings-panel";
import { useTranslation } from "react-i18next";

interface MobileTabsProps {
  onSettingsChanged: () => void;
}

export default function MobileTabs({ onSettingsChanged }: MobileTabsProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<"classifications" | "rules" | "settings" | null>(null);
  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 flex justify-around bg-background/90 backdrop-blur-md border-t border-border md:hidden">
        <button
          className="flex flex-col items-center flex-1 py-2 text-xs"
          onClick={() => setActive("classifications")}
          aria-label={t("navigation.classificationsTab")}
        >
          <Layers className="w-5 h-5" />
          <span>{t("navigation.classificationsTab")}</span>
        </button>
        <button
          className="flex flex-col items-center flex-1 py-2 text-xs"
          onClick={() => setActive("rules")}
          aria-label={t("rulesPanel")}
        >
          <Filter className="w-5 h-5" />
          <span>{t("rulesPanel")}</span>
        </button>
        <button
          className="flex flex-col items-center flex-1 py-2 text-xs"
          onClick={() => setActive("settings")}
          aria-label={t("settingsPanel")}
        >
          <Settings className="w-5 h-5" />
          <span>{t("settingsPanel")}</span>
        </button>
      </nav>
      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="p-0 max-w-none w-screen h-[90vh] flex flex-col">
          {active === "classifications" && (
            <div className="flex-1 overflow-y-auto p-2">
              <ClassificationPanel />
            </div>
          )}
          {active === "rules" && (
            <div className="flex-1 overflow-y-auto p-2">
              <RulePanel />
            </div>
          )}
          {active === "settings" && (
            <div className="flex-1 overflow-y-auto p-2">
              <SettingsPanel onSettingsChanged={onSettingsChanged} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
