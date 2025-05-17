"use client"

import { useState } from "react"
import { useIFCContext } from "@/context/ifc-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Plus, Trash2, Edit, Eye, Palette, Eraser, CircleOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  const [currentClassificationForEdit, setCurrentClassificationForEdit] = useState<any | null>(null)

  const handleAddClassification = () => {
    if (newClassification.code && newClassification.name) {
      addClassification({
        ...newClassification,
        elements: [],
      })
      setNewClassification({
        code: "",
        name: "",
        color: "#3b82f6",
      })
      setIsAddDialogOpen(false)
    }
  }

  const handleOpenEditDialog = (classificationToEdit: any) => {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
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

      {Object.keys(classifications).length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-card shadow-md rounded-lg p-4">
          <p>No classifications added yet.</p>
          <p className="text-sm mt-2">Add a classification to start organizing your IFC elements.</p>
        </div>
      ) : (
        <Table className="bg-card shadow-md rounded-lg">
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Elements</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(classifications).map(([code, classification]) => (
              <TableRow key={code}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: classification.color }} />
                    {code}
                  </div>
                </TableCell>
                <TableCell>{classification.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{classification.elements?.length || 0} elements</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleClassificationHighlight(classification.code)}
                    >
                      <Eye className={`w-4 h-4 ${highlightedClassificationCode === classification.code ? "text-primary" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(classification)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeClassification(code)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
