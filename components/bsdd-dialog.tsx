"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  searchBSDDInDictionaries,
  getBSDDDictionaries,
  POPULAR_DICTIONARIES,
  BsddClass,
  BsddDictionary,
  fetchDictionaryClasses
} from "@/services/bsdd-service";
import {
  Plus,
  Check,
  AlertCircle,
  Search,
  Filter,
  Globe,
  X,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface BsddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: { code: string; name: string; color: string }) => void;
  existingCodes: Set<string>;
  onRemove?: (code: string) => void;
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

// Removed legacy search modes in favor of two-step flow

export function BsddDialog({ open, onOpenChange, onAdd, existingCodes, onRemove }: BsddDialogProps) {
  const { t } = useTranslation();

  // Step state
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<'select' | 'search'>("select");
  const [selectedDictionaryUris, setSelectedDictionaryUris] = useState<string[]>([]);

  // Results state
  const [searchResults, setSearchResults] = useState<BsddClass[]>([]);
  const [prefetchedResults, setPrefetchedResults] = useState<BsddClass[]>([]);
  const [availableDictionaries, setAvailableDictionaries] = useState<BsddDictionary[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefetchLoading, setPrefetchLoading] = useState(false);
  const [prefetchError, setPrefetchError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const prefetchOffsetsRef = useRef<Record<string, number>>({});
  const lastPrefetchKeyRef = useRef<string>("");
  const selectionKey = useMemo(() => selectedDictionaryUris.slice().sort().join('|'), [selectedDictionaryUris]);
  const [showFilters, setShowFilters] = useState(false);
  const [dictionaryQuery, setDictionaryQuery] = useState("");

  // Filter state
  const [typeFilter, setTypeFilter] = useState<'all' | 'Class' | 'Property' | 'Material' | 'GroupOfProperties'>('all');
  const [searchInFilter, setSearchInFilter] = useState<'all' | 'name' | 'definition' | 'code'>('all');
  const [dictionaryFilter, setDictionaryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'name' | 'dictionary'>('relevance');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [dictSortCategory, setDictSortCategory] = useState<'priority' | 'name' | 'code' | 'release' | 'updated' | 'status'>('priority');
  const [dictSortAsc, setDictSortAsc] = useState<boolean>(true);

  // Current results
  const currentResults = useMemo(() => (query.trim() ? searchResults : prefetchedResults), [query, searchResults, prefetchedResults]);
  const overallLoading = query.trim() ? loading : prefetchLoading;
  const overallError = query.trim() ? error : prefetchError;

  // Extract unique dictionaries from current results for filtering
  const availableDictionariesInResults = useMemo(() => {
    const dictMap = new Map<string, { uri: string; name: string; version?: string }>();

    currentResults.forEach(cls => {
      if (cls.dictionaryUri) {
        const existing = dictMap.get(cls.dictionaryUri);
        if (!existing) {
          // Try to find the full dictionary name from availableDictionaries first
          const fullDict = availableDictionaries.find(dict => dict.uri === cls.dictionaryUri);
          let dictName = 'Unknown';

          if (fullDict) {
            // Use the full name from availableDictionaries
            dictName = fullDict.name;
          } else if (cls.dictionaryName) {
            // Fallback to classification's dictionary name
            dictName = cls.dictionaryName;
          } else if (cls.dictionaryUri) {
            // Final fallback to URI extraction (same as display code)
            const parts = cls.dictionaryUri.split('/');

            // Get the dictionary identifier (second to last part usually)
            let extractedName = '';
            if (parts.length >= 2) {
              extractedName = parts[parts.length - 2]; // cciconstruction, etim, ifc, etc.
            }

            // Remove version numbers if they're in the last part
            const lastPart = parts[parts.length - 1] || '';
            if (!/^(v?\d+\.?\d*|latest)$/i.test(lastPart)) {
              extractedName = lastPart;
            }

            // Convert common abbreviations to readable names (same mapping as display code)
            const nameMap: Record<string, string> = {
              'ifc': 'IFC',
              'etim': 'ETIM',
              'uniclass2015': 'Uniclass',
              'cciconstruction': 'CCI Construction',
              'nlsfb2005': 'NL-SfB',
              'buildingsmart': 'buildingSMART'
            };

            dictName = nameMap[extractedName.toLowerCase()] || extractedName || 'Unknown';
          }

          dictMap.set(cls.dictionaryUri, {
            uri: cls.dictionaryUri,
            name: dictName,
            version: fullDict?.version
          });
        }
      }
    });

    return Array.from(dictMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentResults, availableDictionaries]);

  const filteredDictionaries = useMemo(() => {
    const q = dictionaryQuery.trim().toLowerCase();
    if (!q) return availableDictionaries;
    return availableDictionaries.filter((dict) => {
      const name = (dict.name || "").toLowerCase();
      const uri = (dict.uri || "").toLowerCase();
      const org = (dict.organizationCode || "").toLowerCase();
      const code = (dict.dictionaryCode || "").toLowerCase();
      return name.includes(q) || uri.includes(q) || org.includes(q) || code.includes(q);
    });
  }, [availableDictionaries, dictionaryQuery]);

  // Group dictionaries with same name; sort latest version first in each group
  type DictGroup = { key: string; name: string; items: BsddDictionary[] };
  const groupedDictionaries: DictGroup[] = useMemo(() => {
    // Build groups keyed by normalized name
    const groups = new Map<string, DictGroup>();

    const normalize = (s?: string) => (s || '').trim().toLowerCase();
    const deriveNameFromUri = (uri: string) => {
      const parts = (uri || '').split('/');
      let seg = '';
      if (parts.length >= 2) seg = parts[parts.length - 2];
      const last = parts[parts.length - 1] || '';
      if (!/^(v?\d+\.?\d*|latest)$/i.test(last)) seg = last;
      return seg || uri;
    };

    const parseVersion = (v?: string) => {
      if (!v) return { major: -1, minor: -1, patch: -1 };
      const m = v.replace(/^v/i, '').split('.').map((x) => Number(x));
      return { major: m[0] || 0, minor: m[1] || 0, patch: m[2] || 0 };
    };

    for (const d of filteredDictionaries) {
      const displayName = (d.name && d.name.trim()) || deriveNameFromUri(d.uri);
      const key = normalize(displayName);
      if (!groups.has(key)) {
        groups.set(key, { key, name: displayName, items: [] });
      }
      groups.get(key)!.items.push(d);
    }

    // Sort versions in each group: newest first
    const out: DictGroup[] = Array.from(groups.values()).map((g) => ({
      ...g,
      items: g.items.slice().sort((a, b) => {
        const A = parseVersion(a.version);
        const B = parseVersion(b.version);
        if (B.major !== A.major) return B.major - A.major;
        if (B.minor !== A.minor) return B.minor - A.minor;
        if (B.patch !== A.patch) return B.patch - A.patch;
        return (b.version || '').localeCompare(a.version || '');
      })
    }));

    // Priority ordering based on availableDictionaries order (popular first)
    const uriPriority = new Map<string, number>();
    availableDictionaries.forEach((d, idx) => uriPriority.set(d.uri, idx));

    // Sort groups per user setting
    if (dictSortCategory === 'priority') {
      out.sort((a, b) => {
        const pa = Math.min(...a.items.map(it => uriPriority.get(it.uri) ?? Number.MAX_SAFE_INTEGER));
        const pb = Math.min(...b.items.map(it => uriPriority.get(it.uri) ?? Number.MAX_SAFE_INTEGER));
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      });
    } else if (dictSortCategory === 'name') {
      out.sort((a, b) => a.name.localeCompare(b.name) * (dictSortAsc ? 1 : -1));
    } else if (dictSortCategory === 'code') {
      const codeOf = (d: BsddDictionary) => (d.dictionaryCode || (d.uri.split('/').slice(-2, -1)[0] || d.uri)).toLowerCase();
      const codeA = (g: DictGroup) => codeOf(g.items[0]);
      out.sort((a, b) => codeA(a).localeCompare(codeA(b)) * (dictSortAsc ? 1 : -1));
    } else if (dictSortCategory === 'release') {
      const ts = (s?: string) => s ? Date.parse(s) || 0 : 0;
      out.sort((a, b) => ((ts(b.items[0].releaseDate) - ts(a.items[0].releaseDate)) * (dictSortAsc ? 1 : -1)) || a.name.localeCompare(b.name));
    } else if (dictSortCategory === 'updated') {
      const ts = (s?: string) => s ? Date.parse(s) || 0 : 0;
      out.sort((a, b) => ((ts(b.items[0].lastUpdatedUtc) - ts(a.items[0].lastUpdatedUtc)) * (dictSortAsc ? 1 : -1)) || a.name.localeCompare(b.name));
    } else if (dictSortCategory === 'status') {
      const val = (g: DictGroup) => (g.items[0].status || '').toLowerCase();
      out.sort((a, b) => val(a).localeCompare(val(b)) * (dictSortAsc ? 1 : -1) || a.name.localeCompare(b.name));
    }

    return out;
  }, [filteredDictionaries, availableDictionaries, dictSortCategory, dictSortAsc]);

  // Load available dictionaries on open
  useEffect(() => {
    if (!open) return;

    getBSDDDictionaries()
      .then(apiDictionaries => {
        // Prefer API data (authoritative names/codes), but keep Popular ordering on top
        const apiMap = new Map<string, BsddDictionary>();
        for (const d of apiDictionaries) apiMap.set(d.uri, d);

        const popularOrdered: BsddDictionary[] = [];
        for (const p of POPULAR_DICTIONARIES as BsddDictionary[]) {
          const fromApi = apiMap.get(p.uri);
          popularOrdered.push(fromApi ?? p);
        }

        // Append the rest of API dictionaries not already included
        const rest = apiDictionaries.filter(d => !popularOrdered.some(x => x.uri === d.uri));

        setAvailableDictionaries([...popularOrdered, ...rest]);
      })
      .catch(console.error);
  }, [open]);

  // Search effect across selected dictionaries
  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      // switching back to empty query: use prefetched list, stop loading
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      // If no dictionaries selected yet, skip the search
      if (selectedDictionaryUris.length === 0) {
        setSearchResults([]);
        setLoading(false);
        return;
      }

      const searchPromise = searchBSDDInDictionaries(query, selectedDictionaryUris, {
        limit: 250,
        typeFilter: typeFilter === 'all' ? undefined : (typeFilter as 'Class' | 'Property' | 'Material' | 'GroupOfProperties'),
        signal: controller.signal
      }).then(result => {
        // Apply client-side filtering based on searchInFilter
        let filteredClasses = result.classes;

        if (searchInFilter !== 'all') {
          filteredClasses = result.classes.filter(cls => {
            const searchTerm = query.toLowerCase();

            switch (searchInFilter) {
              case 'name':
                return cls.name.toLowerCase().includes(searchTerm);
              case 'definition':
                return cls.definition && cls.definition.toLowerCase().includes(searchTerm);
              case 'code':
                return cls.code && cls.code.toLowerCase().includes(searchTerm);
              default:
                return true;
            }
          });
        }

        setSearchResults(filteredClasses);
      });

      searchPromise
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e instanceof Error ? e.message : String(e));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedDictionaryUris, typeFilter, searchInFilter, open]);

  // Prefetch classes from selected dictionaries when entering search step with empty query
  useEffect(() => {
    if (!open) return;
    if (step !== 'search') return;
    if (query.trim()) return; // if user already typed, don't prefetch
    if (selectedDictionaryUris.length === 0) {
      setPrefetchedResults([]);
      setPrefetchError(null);
      return;
    }

    // If selection unchanged and we already have data, don't reload
    if (lastPrefetchKeyRef.current === selectionKey && prefetchedResults.length > 0) {
      setPrefetchLoading(false);
      return;
    }

    const controller = new AbortController();
    setPrefetchLoading(true);
    setPrefetchError(null);
    prefetchOffsetsRef.current = Object.fromEntries(selectedDictionaryUris.map(u => [u, 0]));
    lastPrefetchKeyRef.current = selectionKey;

    Promise.allSettled(selectedDictionaryUris.map(async (uri) => {
      // Fetch first page (up to 1000) of classes per dictionary for initial browse
      const data = await fetchDictionaryClasses({ uri, limit: 1000, offset: 0, signal: controller.signal });
      const classes = (data.classes ?? []);
      // Map to BsddClass
      return classes.map((cls: any) => {
        let finalCode = cls.referenceCode ?? cls.code ?? "";
        if (!finalCode.trim()) {
          const name = cls.name || "";
          if (name) {
            finalCode = name.split(' ').slice(0, 3).map((w: string) => w.substring(0, 3).toUpperCase()).join('-').replace(/[^A-Z0-9\-]/g, '');
          }
        }
        const dict = availableDictionaries.find(d => d.uri === uri);
        return {
          uri: cls.uri,
          code: finalCode,
          name: cls.name ?? "",
          classType: cls.classType ?? "",
          referenceCode: cls.referenceCode,
          dictionaryName: dict?.name,
          dictionaryUri: uri,
          definition: cls.definition ?? cls.descriptionPart,
          synonyms: cls.synonyms,
        } as BsddClass;
      }).filter((c: BsddClass) => c.name && c.name.trim().length > 0);
    }))
      .then((results) => {
        const agg: BsddClass[] = [];
        const seen = new Set<string>();
        for (const r of results) {
          if (r.status === 'fulfilled') {
            for (const c of r.value) {
              const key = c.uri || `${c.dictionaryUri}::${c.code}`;
              if (!seen.has(key)) {
                seen.add(key);
                agg.push(c);
              }
            }
          }
        }
        setPrefetchedResults(agg);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setPrefetchError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPrefetchLoading(false);
      });

    return () => controller.abort();
  }, [open, step, query, selectedDictionaryUris, availableDictionaries]);

  const maybeLoadMorePrefetch = useCallback(async () => {
    if (!open) return;
    if (step !== 'search') return;
    if (query.trim()) return;
    if (isLoadingMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    const controller = new AbortController();
    try {
      const results = await Promise.allSettled(selectedDictionaryUris.map(async (uri) => {
        const currentOffset = prefetchOffsetsRef.current[uri] ?? 0;
        const nextOffset = currentOffset + 1000;
        prefetchOffsetsRef.current[uri] = nextOffset;
        const data = await fetchDictionaryClasses({ uri, limit: 1000, offset: nextOffset, signal: controller.signal });
        const classes = (data.classes ?? []);
        const dict = availableDictionaries.find(d => d.uri === uri);
        return classes.map((cls: any) => {
          let finalCode = cls.referenceCode ?? cls.code ?? "";
          if (!finalCode.trim()) {
            const name = cls.name || "";
            if (name) {
              finalCode = name.split(' ').slice(0, 3).map((w: string) => w.substring(0, 3).toUpperCase()).join('-').replace(/[^A-Z0-9\-]/g, '');
            }
          }
          return {
            uri: cls.uri,
            code: finalCode,
            name: cls.name ?? "",
            classType: cls.classType ?? "",
            referenceCode: cls.referenceCode,
            dictionaryName: dict?.name,
            dictionaryUri: uri,
            definition: cls.definition ?? cls.descriptionPart,
            synonyms: cls.synonyms,
          } as BsddClass;
        }).filter((c: BsddClass) => c.name && c.name.trim().length > 0);
      }));

      const more: BsddClass[] = [];
      const seen = new Set<string>(prefetchedResults.map(c => c.uri || `${c.dictionaryUri}::${c.code}`));
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const c of r.value) {
            const key = c.uri || `${c.dictionaryUri}::${c.code}`;
            if (!seen.has(key)) {
              seen.add(key);
              more.push(c);
            }
          }
        }
      }
      if (more.length > 0) setPrefetchedResults(prev => [...prev, ...more]);
    } catch (e) {
      // ignore
    } finally {
      setIsLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [open, step, query, selectedDictionaryUris, prefetchedResults, availableDictionaries, isLoadingMore]);

  // No local selection state needed; rely on existingCodes from parent

  // Reset dictionary filter if not present in current results
  useEffect(() => {
    if (dictionaryFilter !== 'all') {
      const isFilterValid = availableDictionariesInResults.some(dict => dict.uri === dictionaryFilter);
      if (!isFilterValid) {
        setDictionaryFilter('all');
      }
    }
  }, [availableDictionariesInResults, dictionaryFilter]);

  const handleAdd = useCallback((cls: BsddClass) => {
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
  }, [onAdd]);

  const handleRemove = useCallback((cls: BsddClass) => {
    if (!cls.code) return;
    if (typeof (onRemove) === 'function') {
      onRemove(cls.code);
    }
  }, [onRemove]);

  // Toggle add/remove directly
  const handleToggleAddRemove = useCallback((cls: BsddClass) => {
    if (existingCodes.has(cls.code)) {
      handleRemove(cls);
    } else {
      handleAdd(cls);
    }
  }, [existingCodes, handleAdd, handleRemove]);

  const [resultSortAsc, setResultSortAsc] = useState<boolean>(true);
  const [hideAdded, setHideAdded] = useState<boolean>(false);

  const filteredAndSortedResults = useMemo(() => {
    let filtered = currentResults.filter(cls => {
      // Dictionary filter on aggregated results
      if (dictionaryFilter !== 'all') {
        if (!cls.dictionaryUri?.includes(dictionaryFilter)) {
          return false;
        }
      }
      if (hideAdded && existingCodes.has(cls.code)) {
        return false;
      }
      return true;
    });

    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * (resultSortAsc ? 1 : -1);
        case 'dictionary':
          // Extract clean dictionary names for sorting
          const getDictionaryDisplayName = (cls: BsddClass) => {
            if (cls.dictionaryName) return cls.dictionaryName;
            if (cls.dictionaryUri) {
              // Extract clean name from URI
              // Example: https://identifier.buildingsmart.org/uri/molio/cciconstruction/1.0
              const parts = cls.dictionaryUri.split('/');

              // Get the dictionary identifier (second to last part usually)
              let dictName = '';
              if (parts.length >= 2) {
                dictName = parts[parts.length - 2]; // cciconstruction, etim, ifc, etc.
              }

              // Remove version numbers if they're in the last part
              const lastPart = parts[parts.length - 1] || '';
              if (!/^(v?\d+\.?\d*|latest)$/i.test(lastPart)) {
                dictName = lastPart;
              }

              // Convert common abbreviations to readable names
              const nameMap: Record<string, string> = {
                'ifc': 'IFC',
                'etim': 'ETIM',
                'uniclass2015': 'Uniclass 2015',
                'cciconstruction': 'CCI Construction',
                'nlsfb2005': 'NL-SfB 2005',
                'buildingsmart': 'buildingSMART'
              };

              return nameMap[dictName.toLowerCase()] || dictName || 'Unknown';
            }
            return 'Unknown';
          };

          const dictA = getDictionaryDisplayName(a);
          const dictB = getDictionaryDisplayName(b);

          // First sort by dictionary name, then by classification name within dictionary
          const dictComparison = dictA.localeCompare(dictB) * (resultSortAsc ? 1 : -1);
          if (dictComparison !== 0) return dictComparison;
          return a.name.localeCompare(b.name) * (resultSortAsc ? 1 : -1);

        case 'relevance':
        default:
          // Keep original order (API relevance)
          return 0;
      }
    });

    return filtered;
  }, [currentResults, dictionaryFilter, sortBy, resultSortAsc, hideAdded, existingCodes]);


  const getDictionaryInfo = useCallback((cls: BsddClass): { code: string; name: string } => {
    let code = '';
    let name = '';

    const found = cls.dictionaryUri ? availableDictionaries.find(d => d.uri === cls.dictionaryUri) : undefined;

    // Prefer API-provided or looked-up human-friendly name
    if (cls.dictionaryName && cls.dictionaryName.trim().length > 0) {
      name = cls.dictionaryName;
    } else if (found?.name && found.name.trim().length > 0) {
      name = found.name;
    }

    // Determine code from lookup or URI
    if (found?.dictionaryCode && found.dictionaryCode.trim().length > 0) {
      code = found.dictionaryCode;
    } else if (cls.dictionaryUri) {
      const parts = cls.dictionaryUri.split('/');
      let segment = '';
      if (parts.length >= 2) {
        segment = parts[parts.length - 2];
      }
      const lastPart = parts[parts.length - 1] || '';
      if (!/^(v?\d+\.?\d*|latest)$/i.test(lastPart)) {
        segment = lastPart;
      }
      code = segment || '';

      // Provide nice fallback names for well-known codes when name missing
      if (!name) {
        const nameMap: Record<string, string> = {
          'ifc': 'IFC',
          'etim': 'ETIM',
          'uniclass2015': 'Uniclass 2015',
          'cciconstruction': 'CCI Construction',
          'nlsfb2005': 'NL-SfB 2005',
          'buildingsmart': 'buildingSMART'
        };
        name = nameMap[segment.toLowerCase()] || segment || 'Unknown';
      }
    }

    return { code: code || 'Unknown', name: name || 'Unknown' };
  }, [availableDictionaries]);


  // No bulk add / select all

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" aria-describedby="bsdd-dialog-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("classifications.browseBSDDTitle", "Browse buildingSMART Data Dictionary")}
          </DialogTitle>
          <div id="bsdd-dialog-description" className="sr-only">
            Search and browse classifications from the buildingSMART Data Dictionary. You can search globally across all dictionaries or within specific standards.
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 py-2 min-h-0">
          {/* Search Controls */}
          <div className="flex flex-col gap-3">
            {step === 'search' && (
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("classifications.searchBSDDPlaceholder", "Search classifications...")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground mr-1">
                  <span>{sortBy === 'relevance' ? 'Relevance' : sortBy === 'name' ? 'Name' : 'Dictionary'}</span>
                  {sortBy !== 'relevance' && (
                    <Switch checked={resultSortAsc} onCheckedChange={setResultSortAsc} />
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setStep('select')}>
                  Change dictionaries
                </Button>
              </div>
            )}

            {/* Step 1: select dictionaries */}
            {step === 'select' && (
              <div className="flex flex-col gap-3">
                <div className="text-sm text-muted-foreground">
                  Choose one or more dictionaries to search in.
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={dictionaryQuery}
                    onChange={(e) => setDictionaryQuery(e.target.value)}
                    placeholder="Filter dictionaries..."
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-md">
                  <ScrollArea className="h-[60vh]">
                    <div className="flex items-center justify-end px-2 py-1 sticky top-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b z-10">
                      {dictSortCategory !== 'priority' && (
                        <div className="flex items-center gap-2 mr-3">
                          <div className="text-xs text-muted-foreground">{(dictSortCategory === 'release' || dictSortCategory === 'updated') ? (dictSortAsc ? 'Newest' : 'Oldest') : (dictSortAsc ? 'A-Z' : 'Z-A')}</div>
                          <Switch checked={dictSortAsc} onCheckedChange={setDictSortAsc} />
                        </div>
                      )}
                      <div className="text-xs mr-2 text-muted-foreground">Sort</div>
                      <Select value={dictSortCategory} onValueChange={(v) => setDictSortCategory(v as any)}>
                        <SelectTrigger className="h-7 w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="priority">Popular first</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="code">Code</SelectItem>
                          <SelectItem value="release">Release date</SelectItem>
                          <SelectItem value="updated">Last updated</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-1 grid grid-cols-1 gap-2">
                      {groupedDictionaries.map((group) => {
                        const latest = group.items[0];
                        const latestChecked = selectedDictionaryUris.includes(latest.uri);
                        const expanded = !!expandedGroups[group.key];
                        const hasMultiple = group.items.length > 1;
                        return (
                          <div key={group.key} className="border rounded-md">
                            <div className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 ${latestChecked ? 'bg-primary/5' : ''}`}
                              tabIndex={0}
                              role="button"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  if ((e.target as HTMLElement).closest('a')) return;
                                  setSelectedDictionaryUris((prev) => {
                                    if (!latestChecked) return [...prev, latest.uri];
                                    return prev.filter(u => u !== latest.uri);
                                  });
                                }
                              }}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('a')) return;
                                setSelectedDictionaryUris((prev) => {
                                  if (!latestChecked) return [...prev, latest.uri];
                                  return prev.filter(u => u !== latest.uri);
                                });
                              }}
                            >
                              {hasMultiple && (
                                <button type="button" className="p-1" onClick={(e) => { e.stopPropagation(); setExpandedGroups(prev => ({ ...prev, [group.key]: !expanded })); }}>
                                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              )}
                              <Checkbox
                                checked={latestChecked}
                                onClick={(e) => { e.stopPropagation(); }}
                                onCheckedChange={(value) => {
                                  setSelectedDictionaryUris((prev) => {
                                    if (value) {
                                      if (prev.includes(latest.uri)) return prev;
                                      return [...prev, latest.uri];
                                    } else {
                                      return prev.filter((u) => u !== latest.uri);
                                    }
                                  });
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium truncate">{group.name}</div>
                                  <div className="flex items-center gap-2 ml-2 shrink-0">
                                    <Badge variant="outline">{latest.version ? `v${latest.version}` : ' '}</Badge>
                                    {(() => {
                                      const parts = (latest.uri || '').split('/');
                                      let segment = '';
                                      if (parts.length >= 2) segment = parts[parts.length - 2];
                                      const lastPart = parts[parts.length - 1] || '';
                                      if (!/^(v?\d+\.?\d*|latest)$/i.test(lastPart)) segment = lastPart;
                                      const codeValue = (latest.dictionaryCode || segment || '').trim();
                                      return (
                                        <Badge variant="secondary" className="text-xs" title="Dictionary code">
                                          {codeValue || 'Unknown'}
                                        </Badge>
                                      );
                                    })()}
                                    <a
                                      href={latest.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                                      title="Open dictionary"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground truncate" title={latest.uri}>{latest.uri}</div>
                              </div>
                            </div>
                            {expanded && hasMultiple && group.items.slice(1).map((dict) => {
                              const checked = selectedDictionaryUris.includes(dict.uri);
                              return (
                                <div key={dict.uri} className={`flex items-center gap-3 p-3 pl-8 cursor-pointer hover:bg-muted/50 ${checked ? 'bg-primary/5' : ''}`}
                                  tabIndex={0}
                                  role="button"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      if ((e.target as HTMLElement).closest('a')) return;
                                      setSelectedDictionaryUris((prev) => {
                                        if (!checked) return [...prev, dict.uri];
                                        return prev.filter(u => u !== dict.uri);
                                      });
                                    }
                                  }}
                                  onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('a')) return;
                                    setSelectedDictionaryUris((prev) => {
                                      if (!checked) return [...prev, dict.uri];
                                      return prev.filter(u => u !== dict.uri);
                                    });
                                  }}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onClick={(e) => { e.stopPropagation(); }}
                                    onCheckedChange={(value) => {
                                      setSelectedDictionaryUris((prev) => {
                                        if (value) {
                                          if (prev.includes(dict.uri)) return prev;
                                          return [...prev, dict.uri];
                                        } else {
                                          return prev.filter((u) => u !== dict.uri);
                                        }
                                      });
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <div className="font-medium truncate">{dict.name}</div>
                                      <div className="flex items-center gap-2 ml-2 shrink-0">
                                        <Badge variant="outline">{dict.version ? `v${dict.version}` : ' '}</Badge>
                                        {(() => {
                                          const parts = (dict.uri || '').split('/');
                                          let segment = '';
                                          if (parts.length >= 2) segment = parts[parts.length - 2];
                                          const lastPart = parts[parts.length - 1] || '';
                                          if (!/^(v?\d+\.?\d*|latest)$/i.test(lastPart)) segment = lastPart;
                                          const codeValue = (dict.dictionaryCode || segment || '').trim();
                                          return (
                                            <Badge variant="secondary" className="text-xs" title="Dictionary code">
                                              {codeValue || 'Unknown'}
                                            </Badge>
                                          );
                                        })()}
                                        <a
                                          href={dict.uri}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                                          title="Open dictionary"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate" title={dict.uri}>{dict.uri}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* Filters */}
            {showFilters && step === 'search' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Type</label>
                    <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all' | 'Class' | 'Property' | 'Material' | 'GroupOfProperties')}>
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="Class">Classes</SelectItem>
                        <SelectItem value="Property">Properties</SelectItem>
                        <SelectItem value="Material">Materials</SelectItem>
                        <SelectItem value="GroupOfProperties">Property Groups</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Sort by</label>
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'relevance' | 'name' | 'dictionary')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relevance">Relevance</SelectItem>
                        <SelectItem value="name">Name A-Z</SelectItem>
                        <SelectItem value="dictionary">Dictionary</SelectItem>
                      </SelectContent>
                    </Select>
                    {sortBy !== 'relevance' && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{resultSortAsc ? 'A-Z / A→Z' : 'Z-A / Z→A'}</span>
                        <Switch checked={resultSortAsc} onCheckedChange={setResultSortAsc} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Search In</label>
                    <Select value={searchInFilter} onValueChange={(value) => setSearchInFilter(value as 'all' | 'name' | 'definition' | 'code')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Search everywhere" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All fields</SelectItem>
                        <SelectItem value="name">Name only</SelectItem>
                        <SelectItem value="definition">Definition only</SelectItem>
                        <SelectItem value="code">Code only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {availableDictionariesInResults.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">Dictionary</label>
                      <Select value={dictionaryFilter} onValueChange={setDictionaryFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All dictionaries" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All dictionaries</SelectItem>
                          {availableDictionariesInResults.map((dict) => (
                            <SelectItem key={dict.uri} value={dict.uri}>
                              <div className="flex flex-col">
                                <div className="font-medium">{dict.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {dict.version && `v${dict.version}`}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Hide added</span>
                        <Switch checked={hideAdded} onCheckedChange={setHideAdded} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 flex flex-col min-h-0">
            {step === 'search' && (
              <>
                {/* Bulk Actions */}
                {/* No bulk actions */}

                <div className="flex-1 border rounded-b-lg overflow-hidden">
                  <ScrollArea className="h-[60vh]" viewportProps={{
                    onScroll: (e) => {
                      const tgt = e.currentTarget;
                      if (tgt.scrollHeight - tgt.scrollTop - tgt.clientHeight < 200) {
                        maybeLoadMorePrefetch();
                      }
                    }
                  }}>
                    {overallLoading && (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span className="text-muted-foreground">
                          {query.trim() ? t("buttons.loadingBSDD", "Searching bSDD...") : 'Loading dictionary content...'}
                        </span>
                      </div>
                    )}

                    {overallError && (
                      <div className="p-4 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> {overallError}
                      </div>
                    )}

                    {!overallLoading && !overallError && !query.trim() && (
                      <div className="p-8 text-center text-muted-foreground">
                        <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium mb-1">Search the bSDD</p>
                        <p className="text-sm">Search within your selected dictionaries</p>
                      </div>
                    )}

                    {!overallLoading && !overallError && query.trim() && filteredAndSortedResults.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium mb-1">No results found</p>
                        <p className="text-sm">
                          Try adjusting your search terms or filters
                        </p>
                      </div>
                    )}

                    {!overallLoading && !overallError && filteredAndSortedResults.length > 0 && (
                      <div className="divide-y">
                        {filteredAndSortedResults.map((cls) => {
                          const isAdded = existingCodes.has(cls.code);
                          const isSelected = existingCodes.has(cls.code);

                          return (
                            <div
                              key={cls.code}
                              className={`flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onClick={(e) => { e.stopPropagation(); handleToggleAddRemove(cls); }}
                                onCheckedChange={() => handleToggleAddRemove(cls)}
                                className="mt-1"
                              />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <code className="font-mono text-sm font-medium bg-muted px-2 py-0.5 rounded">
                                          {cls.code}
                                        </code>
                                        {cls.classType && (
                                          <Badge variant="outline" className="text-xs">
                                            {cls.classType}
                                          </Badge>
                                        )}
                                        {(cls.dictionaryName || cls.dictionaryUri) && (() => {
                                          const info = getDictionaryInfo(cls);
                                          const nameValue = (info.name || '').trim();
                                          const codeValue = (info.code || '').trim();
                                          const showCode = !!codeValue; // always show code if present
                                          return (
                                            <div className="flex items-center gap-2">
                                              <Badge variant="secondary" className="text-xs shrink-0" title={cls.dictionaryUri}>
                                                {info.name}
                                              </Badge>
                                              {showCode && (
                                                <Badge variant="outline" className="text-xs shrink-0" title="Dictionary code">
                                                  {info.code}
                                                </Badge>
                                              )}
                                              {cls.uri && (
                                                <a
                                                  href={cls.uri}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                                  title="Open in bSDD"
                                                >
                                                  View
                                                  <ExternalLink className="h-3 w-3" />
                                                </a>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    <p className="text-sm font-medium text-foreground mb-1">
                                      {cls.name}
                                    </p>
                                    {cls.definition && (
                                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                        {cls.definition}
                                      </p>
                                    )}
                                    {cls.synonyms && cls.synonyms.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {cls.synonyms.slice(0, 2).map((synonym, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {synonym}
                                          </Badge>
                                        ))}
                                        {cls.synonyms.length > 2 && (
                                          <Badge variant="outline" className="text-xs">
                                            +{cls.synonyms.length - 2} more
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isAdded ? (
                                      <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleAddRemove(cls); }}>
                                        <Check className="h-4 w-4 mr-1" />
                                        Remove
                                      </Button>
                                    ) : (
                                      <Button size="sm" onClick={(e) => { e.stopPropagation(); handleToggleAddRemove(cls); }}>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {step === 'select' && (
                <span>
                  {selectedDictionaryUris.length > 0 ? `${selectedDictionaryUris.length} selected` : 'No dictionary selected'}
                </span>
              )}
              {step === 'search' && filteredAndSortedResults.length > 0 && (
                <span>
                  {filteredAndSortedResults.length} result{filteredAndSortedResults.length === 1 ? '' : 's'}
                  {dictionaryFilter !== 'all' && ' (filtered)'}
                  {searchInFilter !== 'all' && ` (searching ${searchInFilter})`}
                  {sortBy !== 'relevance' && ` (sorted by ${sortBy})`}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("buttons.cancel")}
              </Button>
              {step === 'select' && (
                <>
                  {selectedDictionaryUris.length > 0 && (
                    <Button variant="ghost" onClick={() => setSelectedDictionaryUris([])}>
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  )}
                  <Button disabled={selectedDictionaryUris.length === 0} onClick={() => setStep('search')}>
                    Continue
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
