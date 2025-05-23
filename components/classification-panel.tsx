"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { FixedSizeList as List } from "react-window"; // Import react-window
import {
  useIFCContext,
  type SelectedElementInfo,
  type LoadedModelData,
  type ClassificationItem,
} from "@/context/ifc-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  Palette,
  Eraser,
  CircleOff,
  ChevronDown,
  MoreHorizontal,
  ChevronUp,
  X,
  Download,
  AlertTriangle,
  Upload,
  FileOutput,
  FileInput,
  FileSpreadsheet,
  ArchiveRestore,
  Star,
  Cuboid,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  exportIfcWithClassificationsService,
  downloadFile,
  type ExportClassificationData,
} from "@/services/ifc-export-service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

// Helper function to compare two arrays of SelectedElementInfo (order-independent)
function areElementArraysEqual(arr1: any[], arr2: any[]): boolean {
  if (!arr1 || !arr2) return arr1 === arr2; // Handle null/undefined cases
  if (arr1.length !== arr2.length) return false;
  const key = (el: any) => `${el.modelID}-${el.expressID}`;
  const set1 = new Set(arr1.map(key));
  for (const el of arr2) {
    if (!set1.has(key(el))) return false;
  }
  return true;
}

// Define sortable keys
type SortableKey = "code" | "name" | "elementsCount";

// Define AppSettings interface locally or import if available globally
interface AppSettings {
  defaultClassification: string;
  alwaysLoad: boolean;
}
const SETTINGS_KEY = "appSettings";

export function ClassificationPanel() {
  const {
    classifications,
    addClassification,
    removeClassification,
    updateClassification,
    toggleClassificationHighlight,
    highlightedClassificationCode,
    showAllClassificationColors,
    toggleShowAllClassificationColors,
    loadedModels,
    selectedElement,
    assignClassificationToElement,
    unassignClassificationFromElement,
    unassignElementFromAllClassifications,
    removeAllClassifications,
    exportClassificationsAsJson,
    exportClassificationsAsExcel,
    importClassificationsFromJson,
    importClassificationsFromExcel,
    mapClassificationsFromModel,
  } = useIFCContext();
  const { t } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClassification, setNewClassification] = useState({
    code: "",
    name: "",
    color: "#3b82f6",
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentClassificationForEdit, setCurrentClassificationForEdit] =
    useState<ClassificationItem | null>(null);
  const [isMapFromModelDialogOpen, setIsMapFromModelDialogOpen] =
    useState(false);
  const [mapPsetName, setMapPsetName] = useState("");
  const [mapPropertyName, setMapPropertyName] = useState("");
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapPsetNameError, setMapPsetNameError] = useState<string | null>(null);
  const [mapPropertyNameError, setMapPropertyNameError] = useState<
    string | null
  >(null);
  const [defaultUniclassPr, setDefaultUniclassPr] = useState<
    ClassificationItem[]
  >([]);
  const [isLoadingUniclass, setIsLoadingUniclass] = useState(true);
  const [errorLoadingUniclass, setErrorLoadingUniclass] = useState<
    string | null
  >(null);

  // State for eBKP-H
  const [defaultEBKPH, setDefaultEBKPH] = useState<ClassificationItem[]>([]);
  const [isLoadingEBKPH, setIsLoadingEBKPH] = useState(true);
  const [errorLoadingEBKPH, setErrorLoadingEBKPH] = useState<string | null>(
    null
  );
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  const [sortConfig, setSortConfig] = useState<{
    key: SortableKey;
    direction: "ascending" | "descending";
  }>({ key: "code", direction: "ascending" });
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [classificationCodeToRemove, setClassificationCodeToRemove] = useState<
    string | null
  >(null);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [isConfirmRemoveAllOpen, setIsConfirmRemoveAllOpen] = useState(false);
  const [currentDefaultClassification, setCurrentDefaultClassification] =
    useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClassificationEntries = useMemo(() => {
    const entries = Object.entries(classifications);
    if (!searchQuery) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(([code, item]) => {
      const cls = item as ClassificationItem;
      return (
        code.toLowerCase().includes(q) || cls.name.toLowerCase().includes(q)
      );
    });
  }, [classifications, searchQuery]);

  const listWrapperRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(0);
  const [listWidth, setListWidth] = useState(0);

  // State for export functionality
  const [isExporting, setIsExporting] = useState(false);
  const [selectedModelIdForExport, setSelectedModelIdForExport] = useState<
    string | undefined
  >(undefined);

  // Determine if any classifications have elements assigned
  const hasClassifiedElements = useMemo(() => {
    return Object.values(classifications).some(
      (c) => c.elements && c.elements.length > 0
    );
  }, [classifications]);

  // Get models that are suitable for export (have rawBuffer and modelID)
  const exportableModels = useMemo(() => {
    return loadedModels.filter(
      (model) => model.rawBuffer && model.modelID !== null
    );
  }, [loadedModels]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleExportJson = () => {
    const json = exportClassificationsAsJson();
    downloadFile(json, "classifications.json", "application/json");
  };

  const handleExportExcel = () => {
    const wbData = exportClassificationsAsExcel();
    downloadFile(
      wbData,
      "classifications.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  };

  const triggerImport = () => fileInputRef.current?.click();
  const triggerExcelImport = () => excelInputRef.current?.click();

  const handleMapFromModel = async () => {
    // Reset previous errors
    setMapError(null);
    setMapPsetNameError(null);
    setMapPropertyNameError(null);

    // Validate inputs
    let hasError = false;
    if (!mapPsetName.trim()) {
      setMapPsetNameError(t("errors.psetNameRequired"));
      hasError = true;
    }

    if (!mapPropertyName.trim()) {
      setMapPropertyNameError(t("errors.propertyNameRequired"));
      hasError = true;
    }

    if (hasError) return;

    // Start loading state
    setIsMapLoading(true);

    try {
      // Use setTimeout to ensure the UI updates with the loading state
      // before starting the potentially heavy operation
      await new Promise((resolve) => {
        setTimeout(() => resolve(null), 10);
      });

      // Now perform the actual mapping operation
      await mapClassificationsFromModel(mapPsetName, mapPropertyName);
      setIsMapFromModelDialogOpen(false);
      // After mapping, show classification colors and sort by elements count
      if (!showAllClassificationColors) toggleShowAllClassificationColors();
      setSortConfig({ key: "elementsCount", direction: "descending" });
      // Reset form on success
      setMapPsetName("");
      setMapPropertyName("");
    } catch (error) {
      console.error("Error mapping classifications from model:", error);
      setMapError(
        error instanceof Error ? error.message : t("errors.unknownMappingError")
      );
    } finally {
      setIsMapLoading(false);
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        importClassificationsFromJson(text);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importClassificationsFromExcel(file);
    e.target.value = "";
  };

  // Effect to manage the default selected model for export
  useEffect(() => {
    if (exportableModels.length > 0) {
      if (
        !selectedModelIdForExport ||
        !exportableModels.find((m) => m.id === selectedModelIdForExport)
      ) {
        setSelectedModelIdForExport(exportableModels[0].id);
      }
    } else {
      setSelectedModelIdForExport(undefined);
    }
  }, [exportableModels, selectedModelIdForExport]);

  useEffect(() => {
    const fetchUniclassData = async () => {
      setIsLoadingUniclass(true);
      setErrorLoadingUniclass(null);
      try {
        const response = await fetch("/data/uniclass_pr.json");
        if (!response.ok)
          throw new Error(
            `Failed to fetch Uniclass PR data: ${response.statusText}`
          );
        const data: ClassificationItem[] = await response.json();
        setDefaultUniclassPr(data);
      } catch (error) {
        console.error("Error loading Uniclass PR data:", error);
        setErrorLoadingUniclass(
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setIsLoadingUniclass(false);
      }
    };

    const fetcheBKPHData = async () => {
      setIsLoadingEBKPH(true);
      setErrorLoadingEBKPH(null);
      try {
        const response = await fetch("/data/ebkph.json");
        if (!response.ok)
          throw new Error(
            `Failed to fetch eBKP-H data: ${response.statusText}`
          );
        const data: ClassificationItem[] = await response.json();
        setDefaultEBKPH(data);
      } catch (error) {
        console.error("Error loading eBKP-H data:", error);
        setErrorLoadingEBKPH(
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setIsLoadingEBKPH(false);
      }
    };

    fetchUniclassData();
    fetcheBKPHData();
  }, []);

  const sortedClassificationEntries = useMemo(() => {
    const currentEntries = filteredClassificationEntries;

    if (!sortConfig) {
      return currentEntries;
    }

    return [...currentEntries].sort((entryA, entryB) => {
      const itemA = entryA[1] as ClassificationItem;
      const itemB = entryB[1] as ClassificationItem;

      let valA: string | number, valB: string | number;

      switch (sortConfig.key) {
        case "code":
          valA = itemA.code;
          valB = itemB.code;
          break;
        case "name":
          valA = itemA.name;
          valB = itemB.name;
          break;
        case "elementsCount":
          valA = itemA.elements?.length || 0;
          valB = itemB.elements?.length || 0;
          break;
        default:
          return 0;
      }

      let comparison = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      } else if (typeof valA === "string" && typeof valB === "string") {
        comparison = valA.localeCompare(valB);
      } else {
        if (valA < valB) comparison = -1;
        else if (valA > valB) comparison = 1;
      }
      return sortConfig.direction === "ascending" ? comparison : -comparison;
    });
  }, [filteredClassificationEntries, sortConfig]);

  const requestSort = (key: SortableKey) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    // Handles resizing of the list container
    if (listWrapperRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0) return;
        const entry = entries[0];
        setListHeight(entry.contentRect.height);
        setListWidth(entry.contentRect.width);
      });
      resizeObserver.observe(listWrapperRef.current);
      // Initial measurement
      setListHeight(listWrapperRef.current.offsetHeight);
      setListWidth(listWrapperRef.current.offsetWidth);
      return () => resizeObserver.disconnect();
    }
  }, [sortedClassificationEntries.length]); // Re-observe if the list appears/disappears

  const handleAddAllUniclassPr = useCallback(() => {
    if (!defaultUniclassPr || defaultUniclassPr.length === 0) return;
    let addedCount = 0;
    defaultUniclassPr.forEach((defClass) => {
      if (!classifications[defClass.code]) {
        addClassification(defClass);
        addedCount++;
      }
    });
    console.log(`Added ${addedCount} Uniclass Pr classifications.`);
  }, [defaultUniclassPr, classifications, addClassification]);

  const handleAddAlleBKPH = useCallback(() => {
    if (!defaultEBKPH || defaultEBKPH.length === 0) return;
    let addedCount = 0;
    defaultEBKPH.forEach((defClass) => {
      if (!classifications[defClass.code]) {
        addClassification(defClass);
        addedCount++;
      }
    });
    console.log(`Added ${addedCount} eBKP-H classifications.`);
  }, [defaultEBKPH, classifications, addClassification]);

  const areAllUniclassAdded = useCallback(() => {
    if (
      isLoadingUniclass ||
      errorLoadingUniclass ||
      defaultUniclassPr.length === 0
    )
      return false;
    return defaultUniclassPr.every(
      (defClass) => !!classifications[defClass.code]
    );
  }, [
    isLoadingUniclass,
    errorLoadingUniclass,
    defaultUniclassPr,
    classifications,
  ]);

  const areAlleBKPHAdded = useCallback(() => {
    if (isLoadingEBKPH || errorLoadingEBKPH || defaultEBKPH.length === 0)
      return false;
    return defaultEBKPH.every((defClass) => !!classifications[defClass.code]);
  }, [isLoadingEBKPH, errorLoadingEBKPH, defaultEBKPH, classifications]);

  // Auto load default classifications based on stored settings
  useEffect(() => {
    if (hasAutoLoaded) return;
    const stored = localStorage.getItem("appSettings");
    if (!stored) return;
    try {
      const { defaultClassification, alwaysLoad } = JSON.parse(stored);
      if (!alwaysLoad) return;
      if (
        defaultClassification === "uniclass" &&
        !isLoadingUniclass &&
        !errorLoadingUniclass &&
        defaultUniclassPr.length > 0 &&
        !areAllUniclassAdded()
      ) {
        handleAddAllUniclassPr();
        setHasAutoLoaded(true);
      } else if (
        defaultClassification === "ebkph" &&
        !isLoadingEBKPH &&
        !errorLoadingEBKPH &&
        defaultEBKPH.length > 0 &&
        !areAlleBKPHAdded()
      ) {
        handleAddAlleBKPH();
        setHasAutoLoaded(true);
      }
    } catch (err) {
      console.error("Failed to auto load classifications", err);
    }
  }, [
    isLoadingUniclass,
    isLoadingEBKPH,
    defaultUniclassPr,
    defaultEBKPH,
    errorLoadingUniclass,
    errorLoadingEBKPH,
    hasAutoLoaded,
    areAllUniclassAdded,
    areAlleBKPHAdded,
    handleAddAllUniclassPr,
    handleAddAlleBKPH,
  ]);

  const handleAddClassification = () => {
    if (newClassification.code && newClassification.name) {
      // Check if classification with the same code already exists
      if (classifications[newClassification.code]) {
        // Handle existing classification (e.g., show an error, or decide not to add)
        console.warn(
          `Classification with code ${newClassification.code} already exists.`
        );
        // Optionally, clear inputs or provide feedback to the user
        return;
      }
      addClassification({
        ...newClassification,
        elements: [],
      } as ClassificationItem);
      setNewClassification({
        code: "",
        name: "",
        color: "#3b82f6",
      });
      setIsAddDialogOpen(false);
    }
  };

  const handleAddDefaultClassification = (
    defaultClassification: ClassificationItem
  ) => {
    if (classifications[defaultClassification.code]) {
      // Handle existing classification (e.g., show an error, or decide not to add)
      console.warn(
        `Classification with code ${defaultClassification.code} already exists.`
      );
      // Optionally, provide feedback to the user (e.g., toast notification)
      return;
    }
    addClassification(defaultClassification);
  };

  const handleOpenEditDialog = (classificationToEdit: ClassificationItem) => {
    setCurrentClassificationForEdit(classificationToEdit);
    setIsEditDialogOpen(true);
  };

  const handleUpdateClassification = () => {
    if (currentClassificationForEdit) {
      updateClassification(
        currentClassificationForEdit.code,
        currentClassificationForEdit
      );
      setIsEditDialogOpen(false);
      setCurrentClassificationForEdit(null);
    }
  };

  const handleAssignSelected = () => {
    if (selectedElement && highlightedClassificationCode) {
      assignClassificationToElement(
        highlightedClassificationCode,
        selectedElement
      );
    }
  };

  const handleUnassignSelected = () => {
    if (selectedElement && highlightedClassificationCode) {
      unassignClassificationFromElement(
        highlightedClassificationCode,
        selectedElement
      );
    }
  };

  const handleClearSelected = () => {
    if (selectedElement) {
      unassignElementFromAllClassifications(selectedElement);
    }
  };

  // Component to render each row in the virtualized list
  const ClassificationRow = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const [code, classification] = sortedClassificationEntries[index];
    const item = classification as ClassificationItem;

    const codeColWidth = "33%";
    const nameColWidth = "38%";
    const elementsColWidth = "29%";

    const isHighlighted = item.code === highlightedClassificationCode;

    // Define base classes for the row
    let rowClasses =
      "flex items-stretch border-b border-border/50 last:border-b-0 cursor-pointer";
    if (isHighlighted) {
      // Tailwind arbitrary values for inset box shadow. Using a distinct highlight color.
      // Using a variable for the color that would ideally come from your Tailwind theme (e.g., border-highlight or similar)
      // For now, let's use a derivative of accent-foreground or a specific color if available.
      // Using a semi-transparent white or black can also work depending on theme.
      // Let's use a slightly more opaque version of accent-foreground for the inset shadow.
      rowClasses +=
        " bg-accent hover:bg-accent text-accent-foreground shadow-[inset_0_0_0_2px_rgba(var(--accent-foreground-rgb),0.4)]";
    } else {
      rowClasses += " hover:bg-muted/50";
    }

    return (
      <div
        style={style}
        key={code}
        className={rowClasses}
        onClick={() => toggleClassificationHighlight(item.code)}
      >
        {/* Code cell */}
        <div style={{ width: codeColWidth }} className="flex items-center p-2">
          <div className="flex items-center gap-2 truncate">
            {/* Removed ring from color dot, consider a scale or opacity change if needed */}
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-150 ${
                isHighlighted ? "scale-110" : ""
              }`}
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate" title={code}>
              {code}
            </span>
          </div>
        </div>
        {/* Name cell */}
        <div style={{ width: nameColWidth }} className="p-2 truncate">
          <span title={item.name}>{item.name}</span>
        </div>
        {/* Elements cell */}
        <div
          style={{ width: elementsColWidth }}
          className={`flex items-center justify-center p-2 text-sm ${
            isHighlighted
              ? "text-accent-foreground/80"
              : "text-muted-foreground"
          }`}
        >
          <span>{item.elements?.length || 0}</span>
        </div>
      </div>
    );
  };

  const SortIndicator = ({
    columnKey,
    currentSortConfig,
  }: {
    columnKey: SortableKey;
    currentSortConfig: {
      key: SortableKey;
      direction: "ascending" | "descending";
    } | null;
  }) => {
    if (!currentSortConfig || currentSortConfig.key !== columnKey) {
      // Return a subtle, less prominent icon or even an empty span if no default indicator is desired for non-active columns.
      // Using ChevronDown with opacity to suggest clickability without implying active sort.
      return <ChevronDown className="w-3 h-3 ml-1 text-muted-foreground/30" />;
    }
    if (currentSortConfig.direction === "ascending") {
      return <ChevronUp className="w-3 h-3 ml-1 text-primary" />;
    }
    return <ChevronDown className="w-3 h-3 ml-1 text-primary" />;
  };

  const handleExportIFC = async () => {
    if (isExporting || !selectedModelIdForExport) {
      alert(t("alerts.pleaseSelectModel"));
      return;
    }

    const modelToExport = loadedModels.find(
      (model) => model.id === selectedModelIdForExport
    );

    if (!modelToExport || !modelToExport.rawBuffer) {
      alert(t("alerts.selectedModelNotAvailable"));
      return;
    }

    if (!hasClassifiedElements || Object.keys(classifications).length === 0) {
      alert(t("alerts.noClassifiedElementsToExport"));
      return;
    }

    setIsExporting(true);
    console.log(
      `Exporting IFC model '${modelToExport.name}' with classifications...`
    );

    try {
      const exportData: ExportClassificationData = {};
      for (const code in classifications) {
        const currentClass = classifications[code] as ClassificationItem; // Cast to ClassificationItem
        if (
          currentClass &&
          currentClass.elements &&
          currentClass.elements.length > 0
        ) {
          // Only include classifications with elements
          exportData[code] = {
            name: currentClass.name || code,
            code: currentClass.code || code,
            color: currentClass.color,
            elements: currentClass.elements.map((el: SelectedElementInfo) => ({
              modelID: el.modelID, // Important if Python script needs to filter by modelID from a global element list
              expressID: el.expressID,
            })),
          };
        }
      }

      if (Object.keys(exportData).length === 0) {
        alert("No classifications have elements assigned. Nothing to export.");
        setIsExporting(false);
        return;
      }

      const modifiedIfcData = await exportIfcWithClassificationsService(
        modelToExport.rawBuffer,
        exportData
      );

      if (modifiedIfcData) {
        const originalFileName = modelToExport.name || "model.ifc";
        const baseName = originalFileName.endsWith(".ifc")
          ? originalFileName.slice(0, -4)
          : originalFileName;
        const newFileName = `${baseName}_classified.ifc`;
        downloadFile(modifiedIfcData, newFileName, "application/octet-stream");
      } else {
        alert("IFC export failed. Please check the console for more details.");
      }
    } catch (error) {
      console.error("An error occurred during the IFC export process:", error);
      alert(
        "An error occurred during export. Please check the console for details."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const showExportSection =
    hasClassifiedElements && exportableModels.length > 0;

  useEffect(() => {
    // Load default classification setting from localStorage on mount
    if (typeof window !== "undefined") {
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        try {
          const parsedSettings: AppSettings = JSON.parse(storedSettings);
          setCurrentDefaultClassification(
            parsedSettings.defaultClassification || ""
          );
        } catch (err) {
          console.error(
            "Failed to parse stored settings in ClassificationPanel:",
            err
          );
          setCurrentDefaultClassification("");
        }
      } else {
        setCurrentDefaultClassification("");
      }
    }
  }, []);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="shrink-0 space-y-2">
        <div className="flex justify-between items-center gap-2">
          <h3 className="text-lg font-medium whitespace-nowrap">
            {t("classificationsPanel")}
          </h3>
          <div className="flex items-center gap-2">
            {" "}
            {/* Wrapper for right-aligned controls */}
            {/* Color Switch - restored structure */}
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center p-0.5 bg-muted rounded-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className={`px-2 py-1 h-auto rounded-full text-xs transition-all duration-150 ease-in-out flex items-center justify-center
                        ${
                          !showAllClassificationColors
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      onClick={() => {
                        if (showAllClassificationColors)
                          toggleShowAllClassificationColors();
                      }}
                    >
                      <CircleOff
                        className={`w-4 h-4 flex-shrink-0 ${
                          !showAllClassificationColors ? "md:mr-1.5" : ""
                        }`}
                      />
                      <span
                        className={
                          !showAllClassificationColors
                            ? "hidden md:inline"
                            : "hidden"
                        }
                      >
                        {t("original")}
                      </span>
                      <span className="sr-only">
                        {t("tooltips.originalColors")}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("tooltips.originalColors")}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className={`px-2 py-1 h-auto rounded-full text-xs transition-all duration-150 ease-in-out flex items-center justify-center
                        ${
                          showAllClassificationColors
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      onClick={() => {
                        if (!showAllClassificationColors)
                          toggleShowAllClassificationColors();
                      }}
                    >
                      <Palette
                        className={`w-4 h-4 flex-shrink-0 ${
                          showAllClassificationColors ? "md:mr-1.5" : ""
                        }`}
                      />
                      <span
                        className={
                          showAllClassificationColors
                            ? "hidden md:inline"
                            : "hidden"
                        }
                      >
                        {t("colors")}
                      </span>
                      <span className="sr-only">
                        {t("tooltips.classificationColors")}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("tooltips.classificationColors")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            {/* 3-dot Manage Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1.5 h-auto">
                  {" "}
                  {/* Subtle look */}
                  <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                  <span className="sr-only">Manage Classifications</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Classification
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                  {t("sections.defaultSets")}
                </DropdownMenuLabel>
                {isLoadingUniclass && (
                  <DropdownMenuItem disabled>
                    {t("buttons.loadingUniclass")}
                  </DropdownMenuItem>
                )}
                {errorLoadingUniclass && (
                  <DropdownMenuItem disabled className="text-destructive">
                    {t("buttons.uniclassError", {
                      message: errorLoadingUniclass,
                    })}
                  </DropdownMenuItem>
                )}
                {!isLoadingUniclass &&
                  !errorLoadingUniclass &&
                  defaultUniclassPr.length > 0 && (
                    <DropdownMenuItem
                      onClick={handleAddAllUniclassPr}
                      disabled={areAllUniclassAdded()}
                    >
                      {t("buttons.loadUniclass", {
                        count: defaultUniclassPr.length,
                      })}
                      {currentDefaultClassification === "uniclass" && (
                        <Star className="ml-2 h-4 w-4 text-yellow-400 fill-yellow-400" />
                      )}
                    </DropdownMenuItem>
                  )}
                {!isLoadingUniclass &&
                  !errorLoadingUniclass &&
                  defaultUniclassPr.length === 0 && (
                    <DropdownMenuItem disabled>
                      {t("buttons.noUniclassFound")}
                    </DropdownMenuItem>
                  )}
                {isLoadingEBKPH && (
                  <DropdownMenuItem disabled>
                    {t("buttons.loadingEbkph")}
                  </DropdownMenuItem>
                )}
                {errorLoadingEBKPH && (
                  <DropdownMenuItem disabled className="text-destructive">
                    {t("buttons.ebkphError", { message: errorLoadingEBKPH })}
                  </DropdownMenuItem>
                )}
                {!isLoadingEBKPH &&
                  !errorLoadingEBKPH &&
                  defaultEBKPH.length > 0 && (
                    <DropdownMenuItem
                      onClick={handleAddAlleBKPH}
                      disabled={areAlleBKPHAdded()}
                    >
                      {t("buttons.loadEbkph", { count: defaultEBKPH.length })}
                      {currentDefaultClassification === "ebkph" && (
                        <Star className="ml-2 h-4 w-4 text-yellow-400 fill-yellow-400" />
                      )}
                    </DropdownMenuItem>
                  )}
                {!isLoadingEBKPH &&
                  !errorLoadingEBKPH &&
                  defaultEBKPH.length === 0 && (
                    <DropdownMenuItem disabled>
                      {t("buttons.noEbkphFound")}
                    </DropdownMenuItem>
                  )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                  {t("sections.manageData")}
                </DropdownMenuLabel>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FileOutput className="mr-2 h-4 w-4" />{" "}
                    {t("buttons.export")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={handleExportJson}>
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportExcel}>
                      Excel
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArchiveRestore className="mr-2 h-4 w-4" />{" "}
                    {t("buttons.load")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        triggerImport();
                      }}
                    >
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        triggerExcelImport();
                      }}
                    >
                      Excel
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  onSelect={() => setIsMapFromModelDialogOpen(true)}
                >
                  <FileInput className="mr-2 h-4 w-4" />{" "}
                  {t("buttons.mapFromModel")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onSelect={() => setIsConfirmRemoveAllOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("buttons.removeAllClassifications")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("classifications.searchPlaceholder")}
          className="w-full"
        />

        {/* "Add New Classification" Dialog - Restored */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("classifications.addNew")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">
                  {t("classifications.code")}
                </Label>
                <Input
                  id="code"
                  value={newClassification.code}
                  onChange={(e) =>
                    setNewClassification({
                      ...newClassification,
                      code: e.target.value,
                    })
                  }
                  placeholder="e.g. C01.02"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  {t("classifications.name")}
                </Label>
                <Input
                  id="name"
                  value={newClassification.name}
                  onChange={(e) =>
                    setNewClassification({
                      ...newClassification,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g. Aussenwände"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="color" className="text-right">
                  {t("classifications.color")}
                </Label>
                <div className="flex col-span-3 gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={newClassification.color}
                    onChange={(e) =>
                      setNewClassification({
                        ...newClassification,
                        color: e.target.value,
                      })
                    }
                    className="w-full p-1 h-9"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                {t("buttons.cancel")}
              </Button>
              <Button onClick={handleAddClassification}>
                {t("buttons.add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* The old "Row 2 Management Dropdown section" is now fully replaced by the 3-dot menu in the header and this restored dialog. */}
        {/* The hidden file input for import is kept at the end of the component. */}
        <Dialog
          open={isMapFromModelDialogOpen}
          onOpenChange={(open) => {
            setIsMapFromModelDialogOpen(open);
            if (!open) {
              // Reset form state when closing
              setMapError(null);
              setMapPsetNameError(null);
              setMapPropertyNameError(null);
              setIsMapLoading(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("classifications.mapFromModelTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("classifications.mapFromModelDescription", {
                  defaultValue:
                    "Extract classifications from property values in the model.",
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {mapError && (
                <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">
                  <AlertTriangle className="h-4 w-4 inline-block mr-2" />
                  {mapError}
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="map-pset" className="text-right">
                  {t("classifications.psetName")}
                </Label>
                <div className="col-span-3 space-y-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          id="map-pset"
                          value={mapPsetName}
                          onChange={(e) => {
                            setMapPsetName(e.target.value);
                            setMapPsetNameError(null);
                          }}
                          placeholder="e.g. Pset_BuildingCommon"
                          className={
                            mapPsetNameError ? "border-destructive" : ""
                          }
                        />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p>
                          {t("tooltips.psetNameHelp", {
                            defaultValue:
                              "The exact name of the property set containing classification values.",
                          })}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {mapPsetNameError && (
                    <p className="text-destructive text-xs">
                      {mapPsetNameError}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="map-prop" className="text-right">
                  {t("classifications.propertyName")}
                </Label>
                <div className="col-span-3 space-y-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          id="map-prop"
                          value={mapPropertyName}
                          onChange={(e) => {
                            setMapPropertyName(e.target.value);
                            setMapPropertyNameError(null);
                          }}
                          placeholder="e.g. Classification"
                          className={
                            mapPropertyNameError ? "border-destructive" : ""
                          }
                        />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p>
                          {t("tooltips.propertyNameHelp", {
                            defaultValue:
                              "The exact name of the property containing the classification code or identifier.",
                          })}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {mapPropertyNameError && (
                    <p className="text-destructive text-xs">
                      {mapPropertyNameError}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsMapFromModelDialogOpen(false)}
                disabled={isMapLoading}
              >
                {t("buttons.cancel")}
              </Button>
              <Button onClick={handleMapFromModel} disabled={isMapLoading}>
                {isMapLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {t("buttons.loading")}
                  </>
                ) : (
                  t("buttons.apply")
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Classification Dialog */}
      {currentClassificationForEdit && (
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(isOpen) => {
            setIsEditDialogOpen(isOpen);
            if (!isOpen) setCurrentClassificationForEdit(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit Classification: {currentClassificationForEdit.code}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-code" className="text-right">
                  Code
                </Label>
                <Input
                  id="edit-code"
                  value={currentClassificationForEdit.code}
                  readOnly
                  className="col-span-3 bg-muted"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  value={currentClassificationForEdit.name}
                  onChange={(e) =>
                    setCurrentClassificationForEdit({
                      ...currentClassificationForEdit,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g. Aussenwände"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-color" className="text-right">
                  Color
                </Label>
                <div className="flex col-span-3 gap-2">
                  <Input
                    id="edit-color"
                    type="color"
                    value={currentClassificationForEdit.color}
                    onChange={(e) =>
                      setCurrentClassificationForEdit({
                        ...currentClassificationForEdit,
                        color: e.target.value,
                      })
                    }
                    className="w-full p-1 h-9"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setCurrentClassificationForEdit(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateClassification}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedElement && (
        <div className="mt-4 space-y-2 border-t pt-4">
          {highlightedClassificationCode ? (
            <>
              <Button className="w-full" onClick={handleAssignSelected}>
                {t("buttons.assignSelected")}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={handleUnassignSelected}
              >
                {t("buttons.removeSelected")}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("messages.highlightToAssign")}
            </p>
          )}
          <Button
            className="w-full"
            variant="outline"
            onClick={handleClearSelected}
          >
            {t("buttons.clearFromAll")}
          </Button>
        </div>
      )}
      {sortedClassificationEntries.length === 0 ? (
        <div className="text-center py-8 flex-grow flex flex-col items-center justify-center">
          {searchQuery ? (
            <p className="text-base font-medium text-foreground/80">
              {t("classifications.noSearchResults")}
            </p>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <Cuboid className="h-12 w-12 text-foreground/30" />
              </div>
              <p className="text-base font-medium text-foreground/80 mb-2">
                {t("noClassificationsAdded")}
              </p>
              <p className="text-sm text-foreground/60">
                {t("addClassification")}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex-grow overflow-hidden bg-card shadow-sm rounded-lg flex flex-col min-h-0 border border-border">
          <div className="shrink-0 border-b border-border p-2">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="flex">
                  <TableHead
                    style={{ width: "33%" }}
                    className="py-1.5 px-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => requestSort("code")}
                  >
                    <div className="flex items-center">
                      {t("classifications.code")}
                      <SortIndicator
                        columnKey="code"
                        currentSortConfig={sortConfig}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    style={{ width: "38%" }}
                    className="py-1.5 px-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => requestSort("name")}
                  >
                    <div className="flex items-center">
                      {t("classifications.name")}
                      <SortIndicator
                        columnKey="name"
                        currentSortConfig={sortConfig}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    style={{ width: "29%" }}
                    className="py-1.5 px-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors text-center"
                    onClick={() => requestSort("elementsCount")}
                  >
                    <div className="flex items-center justify-center">
                      {t("classifications.elements")}
                      <SortIndicator
                        columnKey="elementsCount"
                        currentSortConfig={sortConfig}
                      />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          <div
            className="flex-grow overflow-hidden relative"
            ref={listWrapperRef}
          >
            {listHeight > 0 && listWidth > 0 && (
              <List
                height={listHeight}
                width={listWidth}
                itemCount={sortedClassificationEntries.length}
                itemSize={48}
                className="w-full"
              >
                {ClassificationRow}
              </List>
            )}
            {highlightedClassificationCode &&
              classifications[highlightedClassificationCode] && (
                <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-10">
                  {isSpeedDialOpen && (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-full w-10 h-10 shadow-lg bg-background hover:bg-muted"
                              onClick={() => {
                                const item =
                                  classifications[
                                    highlightedClassificationCode!
                                  ];
                                if (item) handleOpenEditDialog(item);
                                setIsSpeedDialOpen(false);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>{t("classifications.editClassification")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-full w-10 h-10 shadow-lg text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive bg-background"
                              onClick={() => {
                                setClassificationCodeToRemove(
                                  highlightedClassificationCode!
                                );
                                setIsConfirmRemoveOpen(true);
                                setIsSpeedDialOpen(false);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>{t("classifications.removeClassification")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                  <Button
                    variant="default"
                    size="icon"
                    className="rounded-full w-12 h-12 shadow-xl"
                    onClick={() => setIsSpeedDialOpen(!isSpeedDialOpen)}
                  >
                    {isSpeedDialOpen ? (
                      <X className="w-5 h-5" />
                    ) : (
                      <MoreHorizontal className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              )}
          </div>
        </div>
      )}

      {showExportSection && (
        <div className="mt-auto pt-4 border-t space-y-3">
          <h4 className="text-md font-medium">
            {t("classifications.exportClassifiedModel")}
          </h4>
          {exportableModels.length > 1 && (
            <div>
              <Label
                htmlFor="model-select-export"
                className="text-sm font-normal text-muted-foreground"
              >
                {t("classifications.selectModelToExport")}
              </Label>
              <Select
                value={selectedModelIdForExport}
                onValueChange={setSelectedModelIdForExport}
              >
                <SelectTrigger id="model-select-export" className="w-full mt-1">
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {exportableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} (ID: {model.modelID})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {exportableModels.length === 1 && selectedModelIdForExport && (
            <div className="text-sm text-muted-foreground">
              {t("classifications.exportingModel")}{" "}
              <span className="font-medium text-foreground">
                {exportableModels.find((m) => m.id === selectedModelIdForExport)
                  ?.name || "Selected Model"}
              </span>
            </div>
          )}
          <Button
            onClick={handleExportIFC}
            disabled={isExporting || !selectedModelIdForExport}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 ease-in-out shadow hover:shadow-md flex items-center justify-center py-2.5"
          >
            <Download
              className={`mr-2 h-5 w-5 ${isExporting ? "animate-spin" : ""}`}
            />
            <span className="text-base font-medium">
              {isExporting
                ? t("classifications.exporting")
                : t("classifications.exportIFC")}
            </span>
          </Button>
        </div>
      )}
      {classificationCodeToRemove && (
        <Dialog
          open={isConfirmRemoveOpen}
          onOpenChange={setIsConfirmRemoveOpen}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <DialogTitle className="text-lg font-medium">
                  Confirm Removal
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to remove the classification &nbsp;
              <span className="font-semibold text-foreground">
                {classificationCodeToRemove}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmRemoveOpen(false)}
                className="sm:w-auto w-full"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  removeClassification(classificationCodeToRemove!);
                  setIsConfirmRemoveOpen(false);
                  setClassificationCodeToRemove(null);
                }}
                className="sm:w-auto w-full"
              >
                Remove Classification
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {isConfirmRemoveAllOpen && (
        <Dialog
          open={isConfirmRemoveAllOpen}
          onOpenChange={setIsConfirmRemoveAllOpen}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <DialogTitle className="text-lg font-medium">
                  Confirm Removal
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to remove all classifications? This action
              cannot be undone.
            </DialogDescription>
            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmRemoveAllOpen(false)}
                className="sm:w-auto w-full"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  removeAllClassifications();
                  setIsConfirmRemoveAllOpen(false);
                }}
                className="sm:w-auto w-full"
              >
                Remove All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Input for file import, remains hidden and functional */}
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        onChange={handleImportJson}
        className="hidden"
      />
      <input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ref={excelInputRef}
        onChange={handleImportExcel}
        className="hidden"
      />
    </div>
  );
}
