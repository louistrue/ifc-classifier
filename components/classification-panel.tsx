"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { FixedSizeList as List } from "react-window"; // Import react-window
import {
  useIFCContext,
  type SelectedElementInfo,
  type LoadedModelData,
  type ClassificationItem,
} from "@/context/ifc-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Trash2, Edit, Eye, Palette, Eraser, CircleOff, ChevronDown, MoreHorizontal, ChevronUp, X, Download, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  exportIfcWithClassificationsService,
  downloadFile,
  type ExportClassificationData
} from "@/services/ifc-export-service"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
type SortableKey = 'code' | 'name' | 'elementsCount';

export function ClassificationPanel() {
  const {
    classifications,
    addClassification,
    removeClassification,
    removeAllClassifications,
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
    exportClassificationsAsJson,
    importClassificationsFromJson,
  } = useIFCContext()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newClassification, setNewClassification] = useState({
    code: "",
    name: "",
    color: "#3b82f6",
  })
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentClassificationForEdit, setCurrentClassificationForEdit] = useState<ClassificationItem | null>(null)
  const [defaultUniclassPr, setDefaultUniclassPr] = useState<ClassificationItem[]>([])
  const [isLoadingUniclass, setIsLoadingUniclass] = useState(true)
  const [errorLoadingUniclass, setErrorLoadingUniclass] = useState<string | null>(null)

  // State for eBKP-H
  const [defaultEBKPH, setDefaultEBKPH] = useState<ClassificationItem[]>([])
  const [isLoadingEBKPH, setIsLoadingEBKPH] = useState(true)
  const [errorLoadingEBKPH, setErrorLoadingEBKPH] = useState<string | null>(null)

  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'ascending' | 'descending' }>({ key: 'code', direction: 'ascending' })
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false)
  const [classificationToRemove, setClassificationToRemove] =
    useState<ClassificationItem | null>(null)
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false)
  const [isConfirmRemoveAllOpen, setIsConfirmRemoveAllOpen] = useState(false)

  const classificationEntries = Object.entries(classifications) // Get entries once

  const listWrapperRef = useRef<HTMLDivElement>(null)
  const [listHeight, setListHeight] = useState(0)
  const [listWidth, setListWidth] = useState(0)

  // State for export functionality
  const [isExporting, setIsExporting] = useState(false)
  const [selectedModelIdForExport, setSelectedModelIdForExport] = useState<string | undefined>(undefined)

  // Determine if any classifications have elements assigned
  const hasClassifiedElements = useMemo(() => {
    return Object.values(classifications).some(c => c.elements && c.elements.length > 0)
  }, [classifications])

  // Get models that are suitable for export (have rawBuffer and modelID)
  const exportableModels = useMemo(() => {
    return loadedModels.filter(model => model.rawBuffer && model.modelID !== null)
  }, [loadedModels])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportJson = () => {
    const json = exportClassificationsAsJson()
    downloadFile(json, 'classifications.json', 'application/json')
  }

  const triggerImport = () => fileInputRef.current?.click()

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result
      if (typeof text === 'string') {
        importClassificationsFromJson(text)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Effect to manage the default selected model for export
  useEffect(() => {
    if (exportableModels.length > 0) {
      if (!selectedModelIdForExport || !exportableModels.find(m => m.id === selectedModelIdForExport)) {
        setSelectedModelIdForExport(exportableModels[0].id)
      }
    } else {
      setSelectedModelIdForExport(undefined)
    }
  }, [exportableModels, selectedModelIdForExport])

  useEffect(() => {
    const fetchUniclassData = async () => {
      setIsLoadingUniclass(true)
      setErrorLoadingUniclass(null)
      try {
        const response = await fetch("/data/uniclass_pr.json")
        if (!response.ok) throw new Error(`Failed to fetch Uniclass PR data: ${response.statusText}`)
        const data: ClassificationItem[] = await response.json()
        setDefaultUniclassPr(data)
      } catch (error) {
        console.error("Error loading Uniclass PR data:", error)
        setErrorLoadingUniclass(error instanceof Error ? error.message : "Unknown error")
      } finally {
        setIsLoadingUniclass(false)
      }
    }

    const fetcheBKPHData = async () => {
      setIsLoadingEBKPH(true)
      setErrorLoadingEBKPH(null)
      try {
        const response = await fetch("/data/ebkph.json")
        if (!response.ok) throw new Error(`Failed to fetch eBKP-H data: ${response.statusText}`)
        const data: ClassificationItem[] = await response.json()
        setDefaultEBKPH(data)
      } catch (error) {
        console.error("Error loading eBKP-H data:", error)
        setErrorLoadingEBKPH(error instanceof Error ? error.message : "Unknown error")
      } finally {
        setIsLoadingEBKPH(false)
      }
    }

    fetchUniclassData()
    fetcheBKPHData()
  }, [])

  const sortedClassificationEntries = useMemo(() => {
    const currentEntries = Object.entries(classifications)

    if (!sortConfig) {
      return currentEntries
    }

    return [...currentEntries].sort((entryA, entryB) => {
      const itemA = entryA[1] as ClassificationItem
      const itemB = entryB[1] as ClassificationItem

      let valA: string | number, valB: string | number

      switch (sortConfig.key) {
        case 'code':
          valA = itemA.code
          valB = itemB.code
          break
        case 'name':
          valA = itemA.name
          valB = itemB.name
          break
        case 'elementsCount':
          valA = itemA.elements?.length || 0
          valB = itemB.elements?.length || 0
          break
        default:
          return 0
      }

      let comparison = 0
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB)
      } else {
        if (valA < valB) comparison = -1
        else if (valA > valB) comparison = 1
      }
      return sortConfig.direction === 'ascending' ? comparison : -comparison
    })
  }, [classifications, sortConfig])

  const requestSort = (key: SortableKey) => {
    let direction: 'ascending' | 'descending' = 'ascending'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending'
    }
    setSortConfig({ key, direction })
  }

  useEffect(() => {
    // Handles resizing of the list container
    if (listWrapperRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        if (!entries || entries.length === 0) return
        const entry = entries[0]
        setListHeight(entry.contentRect.height)
        setListWidth(entry.contentRect.width)
      })
      resizeObserver.observe(listWrapperRef.current)
      // Initial measurement
      setListHeight(listWrapperRef.current.offsetHeight)
      setListWidth(listWrapperRef.current.offsetWidth)
      return () => resizeObserver.disconnect()
    }
  }, [sortedClassificationEntries.length]) // Re-observe if the list appears/disappears

  const handleAddAllUniclassPr = () => {
    if (!defaultUniclassPr || defaultUniclassPr.length === 0) return
    let addedCount = 0
    defaultUniclassPr.forEach(defClass => {
      if (!classifications[defClass.code]) {
        addClassification(defClass)
        addedCount++
      }
    })
    console.log(`Added ${addedCount} Uniclass Pr classifications.`)
  }

  const handleAddAlleBKPH = () => {
    if (!defaultEBKPH || defaultEBKPH.length === 0) return
    let addedCount = 0
    defaultEBKPH.forEach(defClass => {
      if (!classifications[defClass.code]) {
        addClassification(defClass)
        addedCount++
      }
    })
    console.log(`Added ${addedCount} eBKP-H classifications.`)
  }

  const areAllUniclassAdded = () => {
    if (isLoadingUniclass || errorLoadingUniclass || defaultUniclassPr.length === 0) return false
    return defaultUniclassPr.every(defClass => !!classifications[defClass.code])
  }

  const areAlleBKPHAdded = () => {
    if (isLoadingEBKPH || errorLoadingEBKPH || defaultEBKPH.length === 0) return false
    return defaultEBKPH.every(defClass => !!classifications[defClass.code])
  }

  const handleAddClassification = () => {
    if (newClassification.code && newClassification.name) {
      // Check if classification with the same code already exists
      if (classifications[newClassification.code]) {
        // Handle existing classification (e.g., show an error, or decide not to add)
        console.warn(`Classification with code ${newClassification.code} already exists.`)
        // Optionally, clear inputs or provide feedback to the user
        return
      }
      addClassification({
        ...newClassification,
        elements: [],
      } as ClassificationItem)
      setNewClassification({
        code: "",
        name: "",
        color: "#3b82f6",
      })
      setIsAddDialogOpen(false)
    }
  }

  const handleAddDefaultClassification = (defaultClassification: ClassificationItem) => {
    if (classifications[defaultClassification.code]) {
      // Handle existing classification (e.g., show an error, or decide not to add)
      console.warn(`Classification with code ${defaultClassification.code} already exists.`)
      // Optionally, provide feedback to the user (e.g., toast notification)
      return
    }
    addClassification(defaultClassification)
  }

  const handleOpenEditDialog = (classificationToEdit: ClassificationItem) => {
    setCurrentClassificationForEdit(classificationToEdit)
    setIsEditDialogOpen(true)
  }

  const handleUpdateClassification = () => {
    if (currentClassificationForEdit) {
      updateClassification(currentClassificationForEdit.code, currentClassificationForEdit)
      setIsEditDialogOpen(false)
      setCurrentClassificationForEdit(null)
    }
  }

  const handleAssignSelected = () => {
    if (selectedElement && highlightedClassificationCode) {
      assignClassificationToElement(highlightedClassificationCode, selectedElement)
    }
  }

  const handleUnassignSelected = () => {
    if (selectedElement && highlightedClassificationCode) {
      unassignClassificationFromElement(highlightedClassificationCode, selectedElement)
    }
  }

  const handleClearSelected = () => {
    if (selectedElement) {
      unassignElementFromAllClassifications(selectedElement)
    }
  }

  // Component to render each row in the virtualized list
  const ClassificationRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const [code, classification] = sortedClassificationEntries[index]
    const item = classification as ClassificationItem

    const codeColWidth = "33%"
    const nameColWidth = "38%"
    const elementsColWidth = "29%"

    const isHighlighted = item.code === highlightedClassificationCode

    // Define base classes for the row
    let rowClasses = "flex items-stretch border-b border-border/50 last:border-b-0 cursor-pointer"
    if (isHighlighted) {
      // Tailwind arbitrary values for inset box shadow. Using a distinct highlight color.
      // Using a variable for the color that would ideally come from your Tailwind theme (e.g., border-highlight or similar)
      // For now, let's use a derivative of accent-foreground or a specific color if available.
      // Using a semi-transparent white or black can also work depending on theme.
      // Let's use a slightly more opaque version of accent-foreground for the inset shadow.
      rowClasses += " bg-accent hover:bg-accent text-accent-foreground shadow-[inset_0_0_0_2px_rgba(var(--accent-foreground-rgb),0.4)]"
    } else {
      rowClasses += " hover:bg-muted/50"
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
              className={`w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-150 ${isHighlighted ? 'scale-110' : ''}`}
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate" title={code}>{code}</span>
          </div>
        </div>
        {/* Name cell */}
        <div style={{ width: nameColWidth }} className="p-2 truncate">
          <span title={item.name}>{item.name}</span>
        </div>
        {/* Elements cell */}
        <div style={{ width: elementsColWidth }} className={`flex items-center justify-center p-2 text-sm ${isHighlighted ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>
          <span>{item.elements?.length || 0}</span>
        </div>
      </div>
    )
  }

  const SortIndicator = ({ columnKey, currentSortConfig }: { columnKey: SortableKey, currentSortConfig: { key: SortableKey; direction: 'ascending' | 'descending' } | null }) => {
    if (!currentSortConfig || currentSortConfig.key !== columnKey) {
      // Return a subtle, less prominent icon or even an empty span if no default indicator is desired for non-active columns.
      // Using ChevronDown with opacity to suggest clickability without implying active sort.
      return <ChevronDown className="w-3 h-3 ml-1 text-muted-foreground/30" />
    }
    if (currentSortConfig.direction === 'ascending') {
      return <ChevronUp className="w-3 h-3 ml-1 text-primary" />
    }
    return <ChevronDown className="w-3 h-3 ml-1 text-primary" />
  }

  const handleExportIFC = async () => {
    if (isExporting || !selectedModelIdForExport) {
      alert("Please select a model to export.")
      return
    }

    const modelToExport = loadedModels.find(model => model.id === selectedModelIdForExport)

    if (!modelToExport || !modelToExport.rawBuffer) {
      alert("Selected model is not available for export or its data is missing.")
      return
    }

    if (!hasClassifiedElements || Object.keys(classifications).length === 0) {
      alert("There are no classifications with assigned elements to export.")
      return
    }

    setIsExporting(true)
    console.log(`Exporting IFC model '${modelToExport.name}' with classifications...`)

    try {
      const exportData: ExportClassificationData = {}
      for (const code in classifications) {
        const currentClass = classifications[code] as ClassificationItem // Cast to ClassificationItem
        if (currentClass && currentClass.elements && currentClass.elements.length > 0) { // Only include classifications with elements
          exportData[code] = {
            name: currentClass.name || code,
            code: currentClass.code || code,
            color: currentClass.color,
            elements: currentClass.elements.map((el: SelectedElementInfo) => ({
              modelID: el.modelID, // Important if Python script needs to filter by modelID from a global element list
              expressID: el.expressID,
            })),
          }
        }
      }

      if (Object.keys(exportData).length === 0) {
        alert("No classifications have elements assigned. Nothing to export.")
        setIsExporting(false)
        return
      }

      const modifiedIfcData = await exportIfcWithClassificationsService(
        modelToExport.rawBuffer,
        exportData
      )

      if (modifiedIfcData) {
        const originalFileName = modelToExport.name || "model.ifc"
        const baseName = originalFileName.endsWith('.ifc')
          ? originalFileName.slice(0, -4)
          : originalFileName
        const newFileName = `${baseName}_classified.ifc`
        downloadFile(modifiedIfcData, newFileName, "application/octet-stream")
        alert("IFC model exported successfully!")
      } else {
        alert("IFC export failed. Please check the console for more details.")
      }
    } catch (error) {
      console.error("An error occurred during the IFC export process:", error)
      alert("An error occurred during export. Please check the console for details.")
    } finally {
      setIsExporting(false)
    }
  }

  const showExportSection = hasClassifiedElements && exportableModels.length > 0

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="shrink-0 space-y-2">
        <div className="flex justify-between items-center gap-2">
          <h3 className="text-lg font-medium whitespace-nowrap">Classifications</h3>
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center p-0.5 bg-muted rounded-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className={`px-2 py-1 h-auto rounded-full text-xs transition-all duration-150 ease-in-out flex items-center justify-center
                      ${!showAllClassificationColors
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
                    onClick={() => { if (showAllClassificationColors) toggleShowAllClassificationColors(); }}
                  >
                    <CircleOff className={`w-4 h-4 flex-shrink-0 ${!showAllClassificationColors ? 'md:mr-1.5' : ''}`} />
                    <span className={!showAllClassificationColors ? 'hidden md:inline' : 'hidden'}>Original</span>
                    <span className="sr-only">Show original model colors</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show original model colors (hides all classification colors).</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className={`px-2 py-1 h-auto rounded-full text-xs transition-all duration-150 ease-in-out flex items-center justify-center
                      ${showAllClassificationColors
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
                    onClick={() => { if (!showAllClassificationColors) toggleShowAllClassificationColors(); }}
                  >
                    <Palette className={`w-4 h-4 flex-shrink-0 ${showAllClassificationColors ? 'md:mr-1.5' : ''}`} />
                    <span className={showAllClassificationColors ? 'hidden md:inline' : 'hidden'}>Colors</span>
                    <span className="sr-only">Apply all classification colors</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Apply all classification colors to the model.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Row 2: Action Buttons (Add New, Add Default) - Aligned to the center */}
        <div className="flex justify-center items-center gap-2 flex-wrap sm:flex-nowrap">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="whitespace-nowrap">
                <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
                Add New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Classification</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="code" className="text-right">Code</Label>
                  <Input
                    id="code"
                    value={newClassification.code}
                    onChange={(e) => setNewClassification({ ...newClassification, code: e.target.value })}
                    placeholder="e.g. C01.02"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input
                    id="name"
                    value={newClassification.name}
                    onChange={(e) => setNewClassification({ ...newClassification, name: e.target.value })}
                    placeholder="e.g. Aussenwände"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="color" className="text-right">Color</Label>
                  <div className="flex col-span-3 gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={newClassification.color}
                      onChange={(e) => setNewClassification({ ...newClassification, color: e.target.value })}
                      className="w-full p-1 h-9"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddClassification}>Add Classification</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="whitespace-nowrap">
                Manage
                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Default Classification Sets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isLoadingUniclass && <DropdownMenuItem disabled>Loading Uniclass Pr...</DropdownMenuItem>}
              {errorLoadingUniclass && <DropdownMenuItem disabled className="text-destructive">Uniclass Pr Error: {errorLoadingUniclass}</DropdownMenuItem>}
              {!isLoadingUniclass && !errorLoadingUniclass && defaultUniclassPr.length > 0 && (
                <DropdownMenuItem onClick={handleAddAllUniclassPr} disabled={areAllUniclassAdded()}>
                  Load Uniclass Pr ({defaultUniclassPr.length} items)
                </DropdownMenuItem>
              )}
              {!isLoadingUniclass && !errorLoadingUniclass && defaultUniclassPr.length === 0 && (
                <DropdownMenuItem disabled>No Uniclass Pr items found.</DropdownMenuItem>
              )}
              {isLoadingEBKPH && <DropdownMenuItem disabled>Loading eBKP-H...</DropdownMenuItem>}
              {errorLoadingEBKPH && <DropdownMenuItem disabled className="text-destructive">eBKP-H Error: {errorLoadingEBKPH}</DropdownMenuItem>}
              {!isLoadingEBKPH && !errorLoadingEBKPH && defaultEBKPH.length > 0 && (
                <DropdownMenuItem onClick={handleAddAlleBKPH} disabled={areAlleBKPHAdded()}>
                  Load eBKP-H ({defaultEBKPH.length} items)
                </DropdownMenuItem>
              )}
              {!isLoadingEBKPH && !errorLoadingEBKPH && defaultEBKPH.length === 0 && (
                <DropdownMenuItem disabled>No eBKP-H items found.</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportJson}>Export Classifications</DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); triggerImport(); }}>Import Classifications</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); setIsConfirmRemoveAllOpen(true); }}>Remove All Classifications</DropdownMenuItem>
            </DropdownMenuContent>
            <input type="file" accept="application/json" ref={fileInputRef} onChange={handleImportJson} className="hidden" />
          </DropdownMenu>
        </div>
      </div>

      {/* Edit Classification Dialog */}
      {currentClassificationForEdit && (
        <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
          setIsEditDialogOpen(isOpen);
          if (!isOpen) setCurrentClassificationForEdit(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Classification: {currentClassificationForEdit.code}</DialogTitle>
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
              <Button variant="outline" onClick={() => {
                setIsEditDialogOpen(false);
                setCurrentClassificationForEdit(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateClassification}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {sortedClassificationEntries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-card shadow-sm rounded-lg p-4 flex-grow border border-border">
          <p>No classifications added yet.</p>
          <p className="text-sm mt-2">Add a classification to start organizing your IFC elements.</p>
        </div>
      ) : (
        <div className="flex-grow overflow-hidden bg-card shadow-sm rounded-lg flex flex-col min-h-0 border border-border">
          <div className="shrink-0 border-b border-border p-2">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="flex">
                  <TableHead style={{ width: "33%" }} className="py-1.5 px-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('code')}>
                    <div className="flex items-center">Code<SortIndicator columnKey="code" currentSortConfig={sortConfig} /></div>
                  </TableHead>
                  <TableHead style={{ width: "38%" }} className="py-1.5 px-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('name')}>
                    <div className="flex items-center">Name<SortIndicator columnKey="name" currentSortConfig={sortConfig} /></div>
                  </TableHead>
                  <TableHead style={{ width: "29%" }} className="py-1.5 px-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors text-center" onClick={() => requestSort('elementsCount')}>
                    <div className="flex items-center justify-center">Elements<SortIndicator columnKey="elementsCount" currentSortConfig={sortConfig} /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          <div className="flex-grow overflow-hidden relative" ref={listWrapperRef}>
            {(listHeight > 0 && listWidth > 0) && (
              <List height={listHeight} width={listWidth} itemCount={sortedClassificationEntries.length} itemSize={48} className="w-full">
                {ClassificationRow}
              </List>
            )}
            {highlightedClassificationCode && classifications[highlightedClassificationCode] && (
              <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-10">
                {isSpeedDialOpen && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="rounded-full w-10 h-10 shadow-lg bg-background hover:bg-muted" onClick={() => { const item = classifications[highlightedClassificationCode!]; if (item) handleOpenEditDialog(item); setIsSpeedDialOpen(false); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left"><p>Edit Classification</p></TooltipContent>
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
                              const item = classifications[highlightedClassificationCode!]
                              if (item) {
                                setClassificationToRemove(item)
                                setIsConfirmRemoveOpen(true)
                              }
                              setIsSpeedDialOpen(false)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left"><p>Remove Classification</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
                <Button variant="default" size="icon" className="rounded-full w-12 h-12 shadow-xl" onClick={() => setIsSpeedDialOpen(!isSpeedDialOpen)}>
                  {isSpeedDialOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedElement && (
        <div className="mt-4 space-y-2 border-t pt-4">
          {highlightedClassificationCode ? (
            <>
              <Button className="w-full" onClick={handleAssignSelected}>Assign Selected Element</Button>
              <Button className="w-full" variant="outline" onClick={handleUnassignSelected}>Remove Selected from Classification</Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Highlight a classification to assign.</p>
          )}
          <Button className="w-full" variant="outline" onClick={handleClearSelected}>Clear from All Classifications</Button>
        </div>
      )}

      {showExportSection && (
        <div className="mt-auto pt-4 border-t space-y-3">
          <h4 className="text-md font-medium">Export Classified Model</h4>
          {exportableModels.length > 1 && (
            <div>
              <Label htmlFor="model-select-export" className="text-sm font-normal text-muted-foreground">Select model to export:</Label>
              <Select value={selectedModelIdForExport} onValueChange={setSelectedModelIdForExport}>
                <SelectTrigger id="model-select-export" className="w-full mt-1">
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {exportableModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} (ID: {model.modelID})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {exportableModels.length === 1 && (
            <div className="text-sm text-muted-foreground">
              Exporting model: <span className="font-medium text-foreground">{exportableModels[0].name}</span>
            </div>
          )}
          <Button
            onClick={handleExportIFC}
            disabled={isExporting || !selectedModelIdForExport}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 ease-in-out shadow hover:shadow-md flex items-center justify-center py-2.5"
          >
            <Download className={`mr-2 h-5 w-5 ${isExporting ? 'animate-spin' : ''}`} />
            <span className="text-base font-medium">
              {isExporting ? "Exporting..." : "Export IFC"}
            </span>
          </Button>
        </div>
      )}
    </div>
    {classificationToRemove && (
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
            Are you sure you want to remove the classification "
            <span className="font-semibold text-foreground">
              {classificationToRemove.code}
            </span>
            "? This action cannot be undone.
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
                removeClassification(classificationToRemove.code)
                setIsConfirmRemoveOpen(false)
                setClassificationToRemove(null)
              }}
              className="sm:w-auto w-full"
            >
              Remove Classification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

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
          Are you sure you want to remove all classifications? This action cannot
          be undone.
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
              removeAllClassifications()
              setIsConfirmRemoveAllOpen(false)
            }}
            className="sm:w-auto w-full"
          >
            Remove All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
