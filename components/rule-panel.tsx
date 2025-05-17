"use client";

import { useState, useEffect } from "react";
import { Rule, RuleCondition, useIFCContext } from "@/context/ifc-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, Play, Settings2, PlayCircle } from "lucide-react";

// Define a more specific type for what a rule property could be.
// This might come from your IFC model's available properties/categories.
const availableRuleProperties = [
  { value: "ifcType", label: "IFC Type (e.g., IFCWALL)" },
  { value: "name", label: "Name" },
  { value: "Pset_WallCommon.IsExternal", label: "IsExternal (Wall)" },
  { value: "Pset_WallCommon.IsLoadBearing", label: "IsLoadBearing (Wall)" },
  { value: "Pset_BuildingStorey.Name", label: "Building Storey Name" },
  // Add more relevant properties here
];

const availableOperators = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "greaterThan", label: "Greater Than" },
  { value: "lessThan", label: "Less Than" },
];

export function RulePanel() {
  const { rules, addRule, removeRule, updateRule, classifications, previewRuleHighlight, previewingRuleId } =
    useIFCContext();
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<Rule | null>(null);
  const [editingRule, setEditingRule] = useState<Partial<Rule> | null>(null);

  const openNewRuleDialog = () => {
    setEditingRule({
      id: `rule-${Date.now()}`,
      name: "",
      description: "",
      conditions: [
        {
          property: availableRuleProperties[0].value,
          operator: "equals",
          value: "",
        },
      ],
      classificationCode: Object.keys(classifications)[0] || "", // Default to first classification
      active: true,
    });
    setIsRuleDialogOpen(true);
  };

  const openEditRuleDialog = (rule: Rule) => {
    setCurrentRule(rule);
    setEditingRule({ ...rule });
    setIsRuleDialogOpen(true);
  };

  const handleSaveRule = () => {
    if (editingRule) {
      if (currentRule) {
        updateRule(editingRule as Rule);
      } else {
        addRule(editingRule as Rule);
      }
      setIsRuleDialogOpen(false);
      setCurrentRule(null);
      setEditingRule(null);
    }
  };

  const handleConditionChange = (
    index: number,
    field: keyof RuleCondition,
    value: string | number | boolean
  ) => {
    if (editingRule && editingRule.conditions) {
      const updatedConditions = [...editingRule.conditions];
      updatedConditions[index] = {
        ...updatedConditions[index],
        [field]: value,
      };
      setEditingRule({ ...editingRule, conditions: updatedConditions });
    }
  };

  const addConditionField = () => {
    if (editingRule && editingRule.conditions) {
      setEditingRule({
        ...editingRule,
        conditions: [
          ...editingRule.conditions,
          {
            property: availableRuleProperties[0].value,
            operator: "equals",
            value: "",
          },
        ],
      });
    }
  };

  const removeConditionField = (index: number) => {
    if (editingRule && editingRule.conditions) {
      const updatedConditions = editingRule.conditions.filter(
        (_, i) => i !== index
      );
      setEditingRule({ ...editingRule, conditions: updatedConditions });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Rules Engine</h3>
        <Button size="sm" onClick={openNewRuleDialog}>
          <Plus className="mr-2" /> Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
          <Settings2 className="mx-auto h-12 w-12 opacity-50 mb-2" />
          <p className="font-semibold">No rules defined yet.</p>
          <p className="text-sm mt-1">
            Create rules to automatically classify elements based on their
            properties.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="p-4 border rounded-lg bg-card shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-md">{rule.name}</h4>
                  <p className="text-xs text-muted-foreground mb-1">
                    {rule.description}
                  </p>
                  <Badge variant={rule.active ? "secondary" : "outline"}>
                    {rule.active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="ml-2">
                    Applies to:{" "}
                    {classifications[rule.classificationCode]?.name ||
                      rule.classificationCode}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => previewRuleHighlight(rule.id)}
                    title={previewingRuleId === rule.id ? "Clear Preview" : "Preview Rule Impact"}
                  >
                    {previewingRuleId === rule.id ? (
                      <PlayCircle className="text-orange-500" />
                    ) : (
                      <Play className="text-blue-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditRuleDialog(rule)}
                    title="Edit Rule"
                  >
                    <Edit />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRule(rule.id)}
                    title="Delete Rule"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-dashed">
                <div className="text-xs font-medium mb-1 text-muted-foreground uppercase">
                  Conditions:
                </div>
                <div className="space-y-1">
                  {rule.conditions.map(
                    (condition: RuleCondition, index: number) => (
                      <div
                        key={index}
                        className="text-xs flex items-center gap-1 p-1 bg-muted/50 rounded"
                      >
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] py-0"
                        >
                          {availableRuleProperties.find(
                            (p) => p.value === condition.property
                          )?.label || condition.property}
                        </Badge>
                        <span className="font-mono text-[10px]">
                          {availableOperators.find(
                            (o) => o.value === condition.operator
                          )?.label || condition.operator}
                        </span>
                        <Badge
                          variant="secondary"
                          className="font-mono text-[10px] py-0"
                        >
                          {String(condition.value)}
                        </Badge>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingRule && (
        <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {currentRule ? "Edit Rule" : "Add New Rule"}
              </DialogTitle>
              <DialogDescription>
                Define the conditions and classification for this rule.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="rule-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="rule-name"
                  value={editingRule.name || ""}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, name: e.target.value })
                  }
                  className="col-span-3"
                  placeholder="e.g., External Non-Loadbearing Walls"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="rule-description" className="text-right">
                  Description
                </Label>
                <Input
                  id="rule-description"
                  value={editingRule.description || ""}
                  onChange={(e) =>
                    setEditingRule({
                      ...editingRule,
                      description: e.target.value,
                    })
                  }
                  className="col-span-3"
                  placeholder="Briefly describe what this rule does"
                />
              </div>

              <div className="col-span-4">
                <Label className="text-sm font-medium">Conditions</Label>
                <div className="mt-2 space-y-3 rounded-md border p-3">
                  {editingRule.conditions?.map((condition, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-4">
                        <Select
                          value={condition.property}
                          onValueChange={(value) =>
                            handleConditionChange(index, "property", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRuleProperties.map((prop) => (
                              <SelectItem key={prop.value} value={prop.value}>
                                {prop.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Select
                          value={condition.operator}
                          onValueChange={(value) =>
                            handleConditionChange(index, "operator", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableOperators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4">
                        <Input
                          value={String(condition.value)}
                          onChange={(e) =>
                            handleConditionChange(
                              index,
                              "value",
                              e.target.value
                            )
                          }
                          placeholder="Value"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeConditionField(index)}
                          disabled={(editingRule.conditions?.length || 0) <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addConditionField}
                    className="mt-2"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Condition
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="rule-classification" className="text-right">
                  Apply Classification
                </Label>
                <div className="col-span-3">
                  <Select
                    value={editingRule.classificationCode || ""}
                    onValueChange={(value) =>
                      setEditingRule({
                        ...editingRule,
                        classificationCode: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select classification to apply" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(classifications).map(
                        ([code, classification]) => (
                          <SelectItem key={code} value={code}>
                            {classification.name} ({code})
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="rule-active" className="text-right">
                  Active
                </Label>
                <div className="col-span-3">
                  <Switch
                    id="rule-active"
                    checked={editingRule.active || false}
                    onCheckedChange={(checked) =>
                      setEditingRule({ ...editingRule, active: checked })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSaveRule}>Save Rule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
