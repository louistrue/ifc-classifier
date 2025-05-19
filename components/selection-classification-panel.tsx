"use client"

import { useState, useEffect } from "react"
import { useIFCContext, type SelectedElementInfo } from "@/context/ifc-context"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export function SelectionClassificationPanel() {
  const {
    selectedElement,
    classifications,
    assignClassificationToElement,
    unassignClassificationFromElement,
  } = useIFCContext()

  const classificationCodes = Object.keys(classifications)
  const [selectedCode, setSelectedCode] = useState<string>("")

  useEffect(() => {
    if (classificationCodes.length > 0) {
      if (!selectedCode || !classifications[selectedCode]) {
        setSelectedCode(classificationCodes[0])
      }
    } else {
      setSelectedCode("")
    }
  }, [classificationCodes, classifications, selectedCode])

  if (!selectedElement) return null

  const elementMatches = (el: SelectedElementInfo) =>
    el.modelID === selectedElement.modelID && el.expressID === selectedElement.expressID

  const assignedCodes = classificationCodes.filter(code =>
    (classifications[code].elements || []).some(elementMatches)
  )

  const handleAssign = () => {
    if (selectedCode) {
      assignClassificationToElement(selectedCode, selectedElement)
    }
  }

  const handleUnassign = () => {
    if (selectedCode) {
      unassignClassificationFromElement(selectedCode, selectedElement)
    }
  }

  const isSelectedAssigned = assignedCodes.includes(selectedCode)

  return (
    <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
      <div className="p-3 bg-background/80 border border-border rounded-lg shadow-lg space-y-2">
        <div className="flex items-center gap-2">
          <Select value={selectedCode} onValueChange={setSelectedCode}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Classification" />
            </SelectTrigger>
            <SelectContent>
              {classificationCodes.map(code => {
                const cls = classifications[code]
                return (
                  <SelectItem key={code} value={code}>
                    {cls.name || code}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={isSelectedAssigned ? handleUnassign : handleAssign}>
            {isSelectedAssigned ? "Unassign" : "Assign"}
          </Button>
        </div>
        {assignedCodes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {assignedCodes.map(code => {
              const cls = classifications[code]
              return (
                <Badge key={code} style={{ backgroundColor: cls.color, color: "white" }}>
                  {cls.name || code}
                </Badge>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

