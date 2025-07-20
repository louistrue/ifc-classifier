"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListTree, Layers, Filter, Settings } from "lucide-react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SpatialTreePanel } from "@/components/spatial-tree-panel";
import { ModelInfo } from "@/components/model-info";
import { ClassificationPanel } from "@/components/classification-panel";
import { RulePanel } from "@/components/rule-panel";
import { SettingsPanel } from "@/components/settings-panel";

interface MobileNavProps {
  onSettingsChanged: () => void;
}

export default function MobileNav({ onSettingsChanged }: MobileNavProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<null | "explore" | "classify" | "rules" | "settings">(null);

  const close = () => setActive(null);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-border bg-background/95 backdrop-blur">
        <button onClick={() => setActive("explore")} className="flex flex-col items-center py-2 px-3 text-xs" aria-label={t('modelExplorer')}> 
          <ListTree className="h-5 w-5" />
          {t('modelExplorerShort') || t('modelExplorer')}
        </button>
        <button onClick={() => setActive("classify")} className="flex flex-col items-center py-2 px-3 text-xs" aria-label={t('navigation.classificationsTab')}>
          <Layers className="h-5 w-5" />
          {t('classifyShort') || t('navigation.classificationsTab')}
        </button>
        <button onClick={() => setActive("rules")} className="flex flex-col items-center py-2 px-3 text-xs" aria-label={t('rulesPanel')}>
          <Filter className="h-5 w-5" />
          {t('rulesShort') || t('rulesPanel')}
        </button>
        <button onClick={() => setActive("settings") } className="flex flex-col items-center py-2 px-3 text-xs" aria-label={t('settingsPanel')}>
          <Settings className="h-5 w-5" />
          {t('settingsShort') || t('settingsPanel')}
        </button>
      </nav>

      <Sheet open={active === "explore"} onOpenChange={(o) => !o && close()}>
        <SheetContent side="bottom" className="md:hidden h-[85vh] overflow-y-auto p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">{t('modelExplorer')}</h3>
            <div className="h-60 overflow-y-auto border border-border rounded-md">
              <SpatialTreePanel />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">{t('properties')}</h3>
            <div className="overflow-y-auto max-h-60 border border-border rounded-md p-2">
              <ModelInfo />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={active === "classify"} onOpenChange={(o) => !o && close()}>
        <SheetContent side="bottom" className="md:hidden h-[85vh] overflow-y-auto p-4">
          <ClassificationPanel />
        </SheetContent>
      </Sheet>

      <Sheet open={active === "rules"} onOpenChange={(o) => !o && close()}>
        <SheetContent side="bottom" className="md:hidden h-[85vh] overflow-y-auto p-4">
          <RulePanel />
        </SheetContent>
      </Sheet>

      <Sheet open={active === "settings"} onOpenChange={(o) => !o && close()}>
        <SheetContent side="bottom" className="md:hidden h-[85vh] overflow-y-auto p-4">
          <SettingsPanel onSettingsChanged={onSettingsChanged} />
        </SheetContent>
      </Sheet>
    </>
  );
}
