"use client"

import { useState, useEffect, useRef } from "react"
import { FixedSizeList as List } from "react-window"; // Import react-window
import { useIFCContext } from "@/context/ifc-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Trash2, Edit, Eye, Palette, Eraser, CircleOff, ChevronDown, MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Define an interface for our classification structure
interface ClassificationItem {
  code: string;
  name: string;
  color: string;
  elements: any[]; // Consider defining a more specific type for elements if possible
}

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

export function ClassificationPanel() {
  const {
    classifications,
    addClassification,
    removeClassification,
    updateClassification,
    toggleClassificationHighlight,
    highlightedClassificationCode,
    showAllClassificationColors,
    toggleShowAllClassificationColors
  } = useIFCContext()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newClassification, setNewClassification] = useState({
    code: "",
    name: "",
    color: "#3b82f6",
  })
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentClassificationForEdit, setCurrentClassificationForEdit] = useState<ClassificationItem | null>(null)
  const [defaultUniclassPr, setDefaultUniclassPr] = useState<ClassificationItem[]>([]);
  const [isLoadingUniclass, setIsLoadingUniclass] = useState(true);
  const [errorLoadingUniclass, setErrorLoadingUniclass] = useState<string | null>(null);

  // State for eBKP-H
  const [defaultEBKPH, setDefaultEBKPH] = useState<ClassificationItem[]>([]);
  const [isLoadingEBKPH, setIsLoadingEBKPH] = useState(true);
  const [errorLoadingEBKPH, setErrorLoadingEBKPH] = useState<string | null>(null);

  const classificationEntries = Object.entries(classifications); // Get entries once

  const listWrapperRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(0);
  const [listWidth, setListWidth] = useState(0);

  useEffect(() => {
    const fetchUniclassData = async () => {
      setIsLoadingUniclass(true);
      setErrorLoadingUniclass(null);
      try {
        const response = await fetch("/data/uniclass_pr.json");
        if (!response.ok) throw new Error(`Failed to fetch Uniclass PR data: ${response.statusText}`);
        const data: ClassificationItem[] = await response.json();
        setDefaultUniclassPr(data);
      } catch (error) {
        console.error("Error loading Uniclass PR data:", error);
        setErrorLoadingUniclass(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsLoadingUniclass(false);
      }
    };

    const fetcheBKPHData = async () => {
      setIsLoadingEBKPH(true);
      setErrorLoadingEBKPH(null);
      try {
        const response = await fetch("/data/ebkph.json");
        if (!response.ok) throw new Error(`Failed to fetch eBKP-H data: ${response.statusText}`);
        const data: ClassificationItem[] = await response.json();
        setDefaultEBKPH(data);
      } catch (error) {
        console.error("Error loading eBKP-H data:", error);
        setErrorLoadingEBKPH(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsLoadingEBKPH(false);
      }
    };

    fetchUniclassData();
    fetcheBKPHData();
  }, []);

  useEffect(() => {
    // Handles resizing of the list container
    if (listWrapperRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
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
  }, [classificationEntries.length]); // Re-observe if the list appears/disappears

  const handleAddAllUniclassPr = () => {
    if (!defaultUniclassPr || defaultUniclassPr.length === 0) return;
    let addedCount = 0;
    defaultUniclassPr.forEach(defClass => {
      if (!classifications[defClass.code]) {
        addClassification(defClass);
        addedCount++;
      }
    });
    console.log(`Added ${addedCount} Uniclass Pr classifications.`);
  };

  const handleAddAlleBKPH = () => {
    if (!defaultEBKPH || defaultEBKPH.length === 0) return;
    let addedCount = 0;
    defaultEBKPH.forEach(defClass => {
      if (!classifications[defClass.code]) {
        addClassification(defClass);
        addedCount++;
      }
    });
    console.log(`Added ${addedCount} eBKP-H classifications.`);
  };

  const areAllUniclassAdded = () => {
    if (isLoadingUniclass || errorLoadingUniclass || defaultUniclassPr.length === 0) return false;
    return defaultUniclassPr.every(defClass => !!classifications[defClass.code]);
  };

  const areAlleBKPHAdded = () => {
    if (isLoadingEBKPH || errorLoadingEBKPH || defaultEBKPH.length === 0) return false;
    return defaultEBKPH.every(defClass => !!classifications[defClass.code]);
  };

  const handleAddClassification = () => {
    if (newClassification.code && newClassification.name) {
      // Check if classification with the same code already exists
      if (classifications[newClassification.code]) {
        // Handle existing classification (e.g., show an error, or decide not to add)
        console.warn(`Classification with code ${newClassification.code} already exists.`);
        // Optionally, clear inputs or provide feedback to the user
        return;
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
      console.warn(`Classification with code ${defaultClassification.code} already exists.`);
      // Optionally, provide feedback to the user (e.g., toast notification)
      return;
    }
    addClassification(defaultClassification);
  };

  const handleOpenEditDialog = (classificationToEdit: ClassificationItem) => {
    setCurrentClassificationForEdit(classificationToEdit);
    setIsEditDialogOpen(true);
  }

  const handleUpdateClassification = () => {
    if (currentClassificationForEdit) {
      updateClassification(currentClassificationForEdit.code, currentClassificationForEdit);
      setIsEditDialogOpen(false);
      setCurrentClassificationForEdit(null);
    }
  }

  // Component to render each row in the virtualized list
  const ClassificationRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const [code, classification] = classificationEntries[index];
    const item = classification as ClassificationItem;

    const codeColWidth = "30%";
    const nameColWidth = "35%";
    const elementsColWidth = "20%";
    const actionsColWidth = "15%";

    const isHighlighted = item.code === highlightedClassificationCode;

    // Define base classes for the row
    let rowClasses = "flex items-stretch border-b border-border/50 last:border-b-0 cursor-pointer";
    if (isHighlighted) {
      // Tailwind arbitrary values for inset box shadow. Using a distinct highlight color.
      // Using a variable for the color that would ideally come from your Tailwind theme (e.g., border-highlight or similar)
      // For now, let's use a derivative of accent-foreground or a specific color if available.
      // Using a semi-transparent white or black can also work depending on theme.
      // Let's use a slightly more opaque version of accent-foreground for the inset shadow.
      rowClasses += " bg-accent hover:bg-accent text-accent-foreground shadow-[inset_0_0_0_2px_rgba(var(--accent-foreground-rgb),0.4)]";
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
        <div style={{ width: elementsColWidth }} className={`flex items-center p-2 text-xs ${isHighlighted ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>
          <span>{item.elements?.length || 0}</span>
        </div>
        {/* Actions cell - ensure button styling is okay with new row highlight */}
        <div style={{ width: actionsColWidth }} className="flex items-center justify-end p-2">
          <div className="flex justify-end items-center gap-1">
            <DropdownMenu>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`w-7 h-7 rounded-md ${isHighlighted ? 'hover:bg-accent-foreground/10 text-accent-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>More actions</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEditDialog(item); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); removeClassification(item.code); }} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-wrap justify-between items-center gap-2 shrink-0">
        <h3 className="text-lg font-medium whitespace-nowrap">Classifications</h3>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
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
                Add Default
                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Default Classification Sets</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Uniclass Pr Option */}
              {isLoadingUniclass && <DropdownMenuItem disabled>Loading Uniclass Pr...</DropdownMenuItem>}
              {errorLoadingUniclass && <DropdownMenuItem disabled className="text-destructive">Uniclass Pr Error: {errorLoadingUniclass}</DropdownMenuItem>}
              {!isLoadingUniclass && !errorLoadingUniclass && defaultUniclassPr.length > 0 && (
                <DropdownMenuItem
                  onClick={handleAddAllUniclassPr}
                  disabled={areAllUniclassAdded()}
                >
                  Load Uniclass Pr ({defaultUniclassPr.length} items)
                </DropdownMenuItem>
              )}
              {!isLoadingUniclass && !errorLoadingUniclass && defaultUniclassPr.length === 0 && (
                <DropdownMenuItem disabled>No Uniclass Pr items found.</DropdownMenuItem>
              )}

              {/* eBKP-H Option */}
              {isLoadingEBKPH && <DropdownMenuItem disabled>Loading eBKP-H...</DropdownMenuItem>}
              {errorLoadingEBKPH && <DropdownMenuItem disabled className="text-destructive">eBKP-H Error: {errorLoadingEBKPH}</DropdownMenuItem>}
              {!isLoadingEBKPH && !errorLoadingEBKPH && defaultEBKPH.length > 0 && (
                <DropdownMenuItem
                  onClick={handleAddAlleBKPH}
                  disabled={areAlleBKPHAdded()}
                >
                  Load eBKP-H ({defaultEBKPH.length} items)
                </DropdownMenuItem>
              )}
              {!isLoadingEBKPH && !errorLoadingEBKPH && defaultEBKPH.length === 0 && (
                <DropdownMenuItem disabled>No eBKP-H items found.</DropdownMenuItem>
              )}

            </DropdownMenuContent>
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

      {classificationEntries.length === 0 ? (
        // Styling for empty state, ensure it also looks good, maybe similar card look but simpler
        <div className="text-center py-8 text-muted-foreground bg-card shadow-sm rounded-lg p-4 flex-grow border border-border">
          <p>No classifications added yet.</p>
          <p className="text-sm mt-2">Add a classification to start organizing your IFC elements.</p>
        </div>
      ) : (
        // Main container for the list, matches ModelInfo styling
        <div className="flex-grow overflow-hidden bg-card shadow-sm rounded-lg flex flex-col min-h-0 border border-border">
          {/* Static Header Part - styled like ModelInfo header section */}
          <div className="shrink-0 border-b border-border p-3"> {/* Added p-3 for consistency */}
            <Table className="w-full">
              <TableHeader>
                <TableRow className="flex">
                  {/* Removed border-r from TableHead for cleaner look, relying on padding and structure */}
                  <TableHead style={{ width: "30%" }} className="p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Code</TableHead>
                  <TableHead style={{ width: "35%" }} className="p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</TableHead>
                  <TableHead style={{ width: "20%" }} className="p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Elements</TableHead>
                  <TableHead style={{ width: "15%" }} className="text-right p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* Scrollable List Part */}
          <div className="flex-grow overflow-hidden relative" ref={listWrapperRef}>
            {(listHeight > 0 && listWidth > 0) && (
              <List
                height={listHeight}
                width={listWidth}
                itemCount={classificationEntries.length}
                itemSize={48}
                className="w-full"
              >
                {ClassificationRow}
              </List>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
