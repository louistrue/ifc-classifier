"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Check, Plus, Library } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ModelSource {
  name: string;
  url: string;
}

interface AppSettings {
  defaultClassification: string;
  alwaysLoad: boolean;
  modelUrls: ModelSource[];
}

// Define props for SettingsPanel
interface SettingsPanelProps {
  onSettingsChanged: () => void;
}

const SETTINGS_KEY = "appSettings";

// Helper function to safely get settings from localStorage for initialization
const getInitialSettings = (): AppSettings => {
  if (typeof window !== "undefined") {
    // Ensure running in browser
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppSettings;
        // Ensure structure is what we expect, provide defaults if not
        return {
          defaultClassification: parsed.defaultClassification || "",
          alwaysLoad: parsed.alwaysLoad || false,
          modelUrls: parsed.modelUrls || [],
        };
      } catch (err) {
        console.error(
          "Failed to parse stored settings for initial state:",
          err
        );
      }
    }
  }
  // Default settings if nothing in localStorage or if parsing failed
  return { defaultClassification: "", alwaysLoad: false, modelUrls: [] };
};

export function SettingsPanel({ onSettingsChanged }: SettingsPanelProps) {
  // Add translation hook
  const { t } = useTranslation();

  // Initialize state directly from localStorage
  const [defaultClassification, setDefaultClassification] = useState<string>(
    () => getInitialSettings().defaultClassification
  );
  const [alwaysLoad, setAlwaysLoad] = useState<boolean>(
    () => getInitialSettings().alwaysLoad
  );
  const [modelUrls, setModelUrls] = useState<ModelSource[]>(
    () => getInitialSettings().modelUrls
  );
  const [newModelName, setNewModelName] = useState("");
  const [newModelUrl, setNewModelUrl] = useState("");
  const [demoModels, setDemoModels] = useState<ModelSource[]>([]);

  useEffect(() => {
    const fetchDemo = async () => {
      try {
        const res = await fetch("/data/demo_models.json");
        if (res.ok) {
          const data: ModelSource[] = await res.json();
          setDemoModels(data);
        }
      } catch (err) {
        console.error("Failed to load demo models", err);
      }
    };
    fetchDemo();
  }, []);

  // Persist settings whenever they change
  useEffect(() => {
    const toStore: AppSettings = {
      defaultClassification,
      alwaysLoad,
      modelUrls,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(toStore));
    onSettingsChanged(); // Call the callback after settings are saved
  }, [defaultClassification, alwaysLoad, modelUrls, onSettingsChanged]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <h3 className="text-lg font-medium mb-6">{t("applicationSettings")}</h3>
        <div className="space-y-6">
          {/* New Encompassing Card for General Load Behavior */}
          <div className="p-4 rounded-lg bg-muted/40 border border-border/50 shadow-sm space-y-4">
            {/* Always Apply on Load Switch - now at the top of this encompassing card */}
            <div className="p-4 rounded-md bg-muted/30">
              <div className="grid grid-cols-3 items-center gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label
                      htmlFor="autoload"
                      className="col-span-1 cursor-help font-semibold"
                    >
                      {/* User requested shorter text */}
                      {t("settings.alwaysApplyOnLoadCombinedShort")}
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    className="max-w-xs p-3 bg-popover text-popover-foreground shadow-lg rounded-md"
                  >
                    <p className="font-semibold text-sm mb-1.5 border-b pb-1 border-border/50">
                      {t("tooltips.alwaysApplyOnLoadCombinedTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("tooltips.alwaysApplyOnLoadCombinedDescription")}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <div className="col-span-2 flex items-center justify-start">
                  <Switch
                    id="autoload"
                    checked={alwaysLoad}
                    onCheckedChange={setAlwaysLoad}
                  />
                </div>
              </div>
            </div>

            {/* Nested Card for Default Classification */}
            <div className="p-4 rounded-md bg-muted/30 border-l-4 border-primary/50 ml-1 pl-5">
              <div className="grid grid-cols-3 items-center gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label
                      htmlFor="default-classification"
                      className="col-span-1 cursor-help"
                    >
                      {t("settings.defaultClassification")}
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("tooltips.defaultClassification")}</p>
                  </TooltipContent>
                </Tooltip>
                <Select
                  value={defaultClassification}
                  onValueChange={setDefaultClassification}
                >
                  <SelectTrigger
                    id="default-classification"
                    className="col-span-2"
                  >
                    <SelectValue placeholder={t("settings.none")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("settings.none")}</SelectItem>
                    <SelectItem value="uniclass">Uniclass Pr</SelectItem>
                    <SelectItem value="ebkph">eBKP-H</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Nested Card for Model URLs - also controlled by the master switch conceptually */}
            {/* We won't disable the inputs here, as users might want to manage URLs even if auto-load is off */}
            {/* but the visual nesting implies connection */}
            <div className="p-4 rounded-md bg-muted/30 border-l-4 border-primary/50 ml-1 pl-5 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label className="cursor-help">
                      {t("settings.modelUrls")}
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("tooltips.modelUrls")}</p>
                  </TooltipContent>
                </Tooltip>
                {demoModels.length > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-muted-foreground hover:text-primary"
                    onClick={() => {
                      const combined = [...modelUrls];
                      demoModels.forEach((d) => {
                        if (
                          !combined.find(
                            (mU) => mU.url === d.url && mU.name === d.name
                          )
                        ) {
                          combined.push(d);
                        }
                      });
                      setModelUrls(combined);
                    }}
                  >
                    <Library className="h-4 w-4 mr-1" />
                    {t("settings.demoModels")}
                  </Button>
                )}
              </div>
              {modelUrls.length > 0 && (
                <ul className="space-y-2">
                  {modelUrls.map((m, idx) => {
                    const isCustom = !demoModels.some(
                      (dm) => dm.url === m.url && dm.name === m.name
                    );
                    return (
                      <li
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-md bg-background/50 hover:bg-muted/40 transition-colors shadow-sm border"
                      >
                        <div className="flex items-center overflow-hidden">
                          {isCustom && (
                            <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0" />
                          )}
                          {!isCustom && (
                            <Library className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" />
                          )}
                          <div className="flex flex-col overflow-hidden">
                            <span
                              className="font-medium truncate"
                              title={m.name}
                            >
                              {m.name}
                            </span>
                            <span
                              className="text-xs text-muted-foreground truncate"
                              title={m.url}
                            >
                              {m.url}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/80 ml-2 flex-shrink-0"
                          onClick={() =>
                            setModelUrls(modelUrls.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {/* Inputs for adding a new URL - combined with inline add button */}
              <div className="grid grid-cols-3 items-end gap-2 pt-2">
                <Input
                  placeholder={t("settings.name")}
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="col-span-1"
                />
                {/* Wrapper for URL input and inline Add button */}
                <div className="col-span-2 flex items-center gap-2">
                  <Input
                    placeholder={t("settings.url")}
                    value={newModelUrl}
                    onChange={(e) => setNewModelUrl(e.target.value)}
                    className="flex-grow" // Input takes available space
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (!newModelName || !newModelUrl) return;
                      setModelUrls([
                        ...modelUrls,
                        { name: newModelName, url: newModelUrl },
                      ]);
                      setNewModelName("");
                      setNewModelUrl("");
                    }}
                    disabled={!newModelName || !newModelUrl} // Disable if inputs are empty
                    title={t("settings.addThisUrl")}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
