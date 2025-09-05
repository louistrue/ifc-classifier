"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchBSDDClasses, BsddClass } from "@/services/bsdd-service";
import { Plus, Check, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BsddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: { code: string; name: string; color: string }) => void;
  existingCodes: Set<string>;
}

const generateRandomColor = () => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 20);
  const lightness = 45 + Math.floor(Math.random() * 10);
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number): string => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export function BsddDialog({ open, onOpenChange, onAdd, existingCodes }: BsddDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BsddClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      searchBSDDClasses(query, controller.signal)
        .then((cls) => {
          setResults(cls);
          setError(null);
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => setLoading(false));
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const handleAdd = (cls: BsddClass) => {
    // Validate the classification object before adding
    if (!cls.code || !cls.name) {
      console.warn('Invalid BSDD classification: missing code or name', cls);
      setError('Invalid classification data from BSDD');
      return;
    }

    // Ensure code is trimmed and not empty after trimming
    const trimmedCode = cls.code.trim();
    if (!trimmedCode) {
      console.warn('Invalid BSDD classification: empty code after trimming', cls);
      setError('Classification code cannot be empty');
      return;
    }

    onAdd({
      code: trimmedCode,
      name: cls.name.trim() || cls.name,
      color: generateRandomColor()
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("classifications.browseBSDDTitle", "Browse bSDD")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <Input
            placeholder={t(
              "classifications.searchBSDDPlaceholder",
              "Search bSDD...",
            )}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ScrollArea className="h-64 border rounded-md">
            {loading && (
              <div className="p-4 text-sm text-muted-foreground">
                {t("buttons.loadingBSDD", "Loading bSDD...")}
              </div>
            )}
            {error && (
              <div className="p-4 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            {!loading && !error && !query.trim() && (
              <div className="p-4 text-sm text-muted-foreground">
                {t(
                  "classifications.enterSearchTerm",
                  "Enter a search term to browse bSDD.",
                )}
              </div>
            )}
            {!loading && !error && query.trim() && results.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                {t("classifications.noSearchResults")}
              </div>
            )}
            {!loading && !error && results.length > 0 && (
              <ul className="divide-y">
                {results.map((cls) => {
                  const added = existingCodes.has(cls.code);
                  return (
                    <li
                      key={cls.code}
                      className="flex items-center justify-between p-2"
                    >
                      <div className="mr-2">
                        <div className="font-medium">{cls.code}</div>
                        <div className="text-sm text-muted-foreground">
                          {cls.name}
                        </div>
                      </div>
                      {added ? (
                        <Button variant="secondary" size="sm" disabled>
                          <Check className="h-4 w-4 mr-1" />
                          {t("buttons.added", "Added")}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => handleAdd(cls)}>
                          <Plus className="h-4 w-4 mr-1" />
                          {t("buttons.add")}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("buttons.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
