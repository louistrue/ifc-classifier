"use client";

import { useState } from "react";
import { Layers, Filter, Settings as SettingsIcon } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ClassificationPanel } from "@/components/classification-panel";
import { RulePanel } from "@/components/rule-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { useTranslation } from "react-i18next";

interface MobileNavProps {
  onSettingsChanged: () => void;
}

export default function MobileNav({ onSettingsChanged }: MobileNavProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<"classifications" | "rules" | "settings" | null>(null);

  const close = () => setActive(null);

  return (
    <>
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur flex border-t">
        <button
          onClick={() => setActive("classifications")}
          className="flex-1 flex flex-col items-center justify-center py-2 text-xs"
          aria-label={t("navigation.classificationsTab")}
        >
          <Layers className="w-5 h-5" />
          {t("navigation.classificationsTab")}
        </button>
        <button
          onClick={() => setActive("rules")}
          className="flex-1 flex flex-col items-center justify-center py-2 text-xs"
          aria-label={t("rulesPanel")}
        >
          <Filter className="w-5 h-5" />
          {t("rulesPanel")}
        </button>
        <button
          onClick={() => setActive("settings")}
          className="flex-1 flex flex-col items-center justify-center py-2 text-xs"
          aria-label={t("settingsPanel")}
        >
          <SettingsIcon className="w-5 h-5" />
          {t("settingsPanel")}
        </button>
      </div>

      <Sheet open={active !== null} onOpenChange={(o) => !o && close()}>
        <SheetContent className="sm:hidden p-0">
          {active === "classifications" && (
            <div className="h-full overflow-y-auto p-2">
              <ClassificationPanel />
            </div>
          )}
          {active === "rules" && (
            <div className="h-full overflow-y-auto p-2">
              <RulePanel />
            </div>
          )}
          {active === "settings" && (
            <div className="h-full overflow-y-auto p-2">
              <SettingsPanel onSettingsChanged={onSettingsChanged} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
