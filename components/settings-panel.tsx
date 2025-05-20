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
        <h3 className="text-lg font-medium mb-6">Application Settings</h3>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/30 space-y-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="default-classification" className="col-span-1 cursor-help">
                    Default Classification
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sets the default classification system.</p>
                </TooltipContent>
              </Tooltip>
              <Select
                value={defaultClassification}
                onValueChange={setDefaultClassification}
              >
                <SelectTrigger id="default-classification" className="col-span-2">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="uniclass">Uniclass Pr</SelectItem>
                  <SelectItem value="ebkph">eBKP-H</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="autoload" className="col-span-1 cursor-help">
                    Always apply on load
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>If enabled, the selected 'Default Classification' will be automatically applied on load.</p>
                </TooltipContent>
              </Tooltip>
              <div className="col-span-2">
                <Switch
                  id="autoload"
                  checked={alwaysLoad}
                  onCheckedChange={setAlwaysLoad}
                />
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 space-y-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Label className="block mb-2 cursor-help">Model URLs</Label>
              </TooltipTrigger>
              <TooltipContent>
                <p>Manage a list of IFC model URLs. You can add custom URLs or use the demo models.</p>
              </TooltipContent>
            </Tooltip>
            {modelUrls.length > 0 && (
              <ul className="space-y-1">
                {modelUrls.map((m, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <span className="truncate mr-2" title={m.url}>
                      {m.name}
                    </span>
                    <button
                      onClick={() =>
                        setModelUrls(modelUrls.filter((_, i) => i !== idx))
                      }
                      className="text-destructive hover:underline text-sm"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <input
                    className="col-span-1 border rounded px-2 py-1 text-sm cursor-help"
                    placeholder="Name"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enter a descriptive name for the model URL.</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <input
                    className="col-span-2 border rounded px-2 py-1 text-sm cursor-help"
                    placeholder="URL"
                    value={newModelUrl}
                    onChange={(e) => setNewModelUrl(e.target.value)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enter the direct URL to an IFC model file (.ifc).</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex gap-2 justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="text-sm underline cursor-help"
                    onClick={() => {
                      if (!newModelName || !newModelUrl) return;
                      setModelUrls([...modelUrls, { name: newModelName, url: newModelUrl }]);
                      setNewModelName("");
                      setNewModelUrl("");
                    }}
                  >
                    add
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add the specified name and URL to your list of models.</p>
                </TooltipContent>
              </Tooltip>
              {demoModels.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="text-sm underline cursor-help"
                      onClick={() => {
                        const combined = [...modelUrls];
                        demoModels.forEach((d) => {
                          if (!combined.find((m) => m.url === d.url)) {
                            combined.push(d);
                          }
                        });
                        setModelUrls(combined);
                      }}
                    >
                      add demo models
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add a predefined set of demo models to your list. Duplicates will be ignored.</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
