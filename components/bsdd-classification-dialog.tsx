"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchBSDDClasses, type BSDDClass } from "@/services/bsdd-service";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (cls: BSDDClass) => void;
}

export function BSDDClassificationDialog({ open, onOpenChange, onSelect }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BSDDClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const classes = await searchBSDDClasses(query);
      setResults(classes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("classifications.bsddDialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={t("classifications.bsddSearchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />
            <Button onClick={handleSearch} disabled={loading}>
              {t("buttons.search")}
            </Button>
          </div>
          <ScrollArea className="h-64 border rounded">
            {loading && (
              <p className="p-2 text-sm">{t("buttons.loading")}</p>
            )}
            {error && (
              <p className="p-2 text-sm text-destructive">{error}</p>
            )}
            {!loading && !error && results.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">
                {t("classifications.noSearchResults")}
              </p>
            )}
            {!loading && !error && results.length > 0 && (
              <ul className="divide-y">
                {results.map((cls) => (
                  <li key={cls.uri}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start font-normal"
                      onClick={() => {
                        onSelect(cls);
                        onOpenChange(false);
                      }}
                    >
                      <span className="mr-2 font-mono text-sm">{cls.code}</span>
                      {cls.name}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
