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

interface ModelSource {
  name: string;
  url: string;
}

interface AppSettings {
  defaultClassification: string;
  alwaysLoad: boolean;
  modelUrls: ModelSource[];
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

export function SettingsPanel() {
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
  }, [defaultClassification, alwaysLoad, modelUrls]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium mb-6">Application Settings</h3>
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-muted/30">
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="default-classification" className="col-span-1">
              Default Classification
            </Label>
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
        </div>
        <div className="p-4 rounded-lg bg-muted/30">
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="autoload" className="col-span-1">
              Always load on start
            </Label>
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
          <Label className="block mb-2">Model URLs</Label>
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
            <input
              className="col-span-1 border rounded px-2 py-1 text-sm"
              placeholder="Name"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
            />
            <input
              className="col-span-2 border rounded px-2 py-1 text-sm"
              placeholder="URL"
              value={newModelUrl}
              onChange={(e) => setNewModelUrl(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              className="text-sm underline"
              onClick={() => {
                if (!newModelName || !newModelUrl) return;
                setModelUrls([...modelUrls, { name: newModelName, url: newModelUrl }]);
                setNewModelName("");
                setNewModelUrl("");
              }}
            >
              add
            </button>
            {demoModels.length > 0 && (
              <button
                className="text-sm underline"
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
