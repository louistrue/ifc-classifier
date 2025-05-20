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

export function SettingsPanel() {
  const [defaultClassification, setDefaultClassification] = useState<string>("");
  const [alwaysLoad, setAlwaysLoad] = useState<boolean>(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsed: AppSettings = JSON.parse(stored);
        setDefaultClassification(parsed.defaultClassification || "");
        setAlwaysLoad(parsed.alwaysLoad || false);
      } catch (err) {
        console.error("Failed to parse stored settings", err);
      }
    }
  }, []);

  // Persist settings whenever they change
  useEffect(() => {
    const toStore: AppSettings = { defaultClassification, alwaysLoad };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(toStore));
  }, [defaultClassification, alwaysLoad]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Application Settings</h3>
      <div className="grid gap-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="default-classification" className="text-right">
            Default Classification
          </Label>
          <Select
            value={defaultClassification}
            onValueChange={setDefaultClassification}
          >
            <SelectTrigger id="default-classification" className="col-span-3">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              <SelectItem value="uniclass">Uniclass Pr</SelectItem>
              <SelectItem value="ebkph">eBKP-H</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="autoload" className="text-right">
            Always load on start
          </Label>
          <div className="col-span-3">
            <Switch
              id="autoload"
              checked={alwaysLoad}
              onCheckedChange={setAlwaysLoad}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
