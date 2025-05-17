"use client"

import { useState } from "react"
import { useIFCContext } from "@/context/ifc-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Plus, Trash2, Edit, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function ClassificationPanel() {
  const { classifications, addClassification, removeClassification, updateClassification, applyRuleToClassification } =
    useIFCContext()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newClassification, setNewClassification] = useState({
    code: "",
    name: "",
    color: "#3b82f6",
  })

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Classifications</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Classification
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Classification</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">
                  Code
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
                  Name
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
                  Color
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
                    className="w-12 p-1 h-9"
                  />
                  <Input
                    value={newClassification.color}
                    onChange={(e) =>
                      setNewClassification({
                        ...newClassification,
                        color: e.target.value,
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddClassification}>Add Classification</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
                    <Button variant="ghost" size="icon">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
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
