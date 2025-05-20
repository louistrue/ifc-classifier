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

interface AppSettings {
  defaultClassification: string;
  alwaysLoad: boolean;
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
  return { defaultClassification: "", alwaysLoad: false };
};

export function SettingsPanel() {
  // Initialize state directly from localStorage
  const [defaultClassification, setDefaultClassification] = useState<string>(
    () => getInitialSettings().defaultClassification
  );
  const [alwaysLoad, setAlwaysLoad] = useState<boolean>(
    () => getInitialSettings().alwaysLoad
  );

  // Persist settings whenever they change
  useEffect(() => {
    const toStore: AppSettings = { defaultClassification, alwaysLoad };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(toStore));
  }, [defaultClassification, alwaysLoad]);

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
      </div>
    </div>
  );
}
