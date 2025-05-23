"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
  CreatableCombobox,
  ComboboxOption,
} from "@/components/ui/creatable-combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Edit,
  Play,
  Settings2,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Tag,
  MoreHorizontal,
  FileOutput,
  ArchiveRestore,
  AlertTriangle,
  CopyPlus,
} from "lucide-react";
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
import { downloadFile } from "@/services/ifc-export-service";
import { useTranslation } from "react-i18next";
import { HexColorPicker } from "react-colorful";

const availableOperators = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "notEquals" },
  { value: "contains", label: "contains" },
  { value: "greaterThan", label: "greaterThan" },
  { value: "lessThan", label: "lessThan" },
];

// Function to generate a random HEX color
const generateRandomColor = () => {
  const hue = Math.floor(Math.random() * 360); // Random hue
  const saturation = 70 + Math.floor(Math.random() * 20); // 70-90% saturation
  const lightness = 45 + Math.floor(Math.random() * 10); // 45-55% lightness

  // Convert HSL to hex
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  let r, g, b;
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
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export function RulePanel() {
  const {
    rules,
    addRule,
    removeRule,
    updateRule,
    classifications,
    addClassification,
    previewRuleHighlight,
    previewingRuleId,
    availableProperties,
    exportRulesAsJson,
    exportRulesAsExcel,
    importRulesFromJson,
    importRulesFromExcel,
    removeAllRules,
  } = useIFCContext();
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<Rule | null>(null);
  const [editingRule, setEditingRule] = useState<Partial<Rule> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [isConfirmRemoveAllOpen, setIsConfirmRemoveAllOpen] = useState(false);

  const [isConfirmRemoveRuleOpen, setIsConfirmRemoveRuleOpen] = useState(false);
  const [ruleToRemove, setRuleToRemove] = useState<Rule | null>(null);

  // Default eBKP-H rules state
  const [defaultEBKPHRules, setDefaultEBKPHRules] = useState<Rule[]>([]);
  const [isLoadingEBKPHRules, setIsLoadingEBKPHRules] = useState(true);
  const [errorLoadingEBKPHRules, setErrorLoadingEBKPHRules] = useState<string | null>(
    null
  );

  const { t } = useTranslation();

  const [isClassificationDialogOpen, setIsClassificationDialogOpen] = useState(false);
  const [newClassificationData, setNewClassificationData] = useState({
    code: "",
    name: "",
    color: "#3b82f6",
  });

  useEffect(() => {
    const fetchEBKPHRules = async () => {
      setIsLoadingEBKPHRules(true);
      setErrorLoadingEBKPHRules(null);
      try {
        const response = await fetch("/data/ebkph_rules.json");
        if (!response.ok)
          throw new Error(`Failed to fetch eBKP-H rules: ${response.statusText}`);
        const data: Rule[] = await response.json();
        setDefaultEBKPHRules(data);
      } catch (error) {
        console.error("Error loading eBKP-H rules:", error);
        setErrorLoadingEBKPHRules(
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setIsLoadingEBKPHRules(false);
      }
    };
    fetchEBKPHRules();
  }, []);

  const propertyOptions =
    availableProperties && availableProperties.length > 0
      ? availableProperties.map((p) => ({ value: p, label: p }))
      : [{ value: "ifcType", label: "ifcType" }];

  // Create a list of classification options for the combobox
  const classificationOptions = useMemo(() =>
    Object.entries(classifications)
      .filter(([code]) => code !== "")
      .map(([code, classification]) => ({
        value: code,
        label: `${classification.name} (${code})`,
        color: classification.color
      })),
    [classifications]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const ruleNameSuggestions = useMemo(
    () => Array.from(new Set(rules.map((r) => r.name))),
    [rules]
  );
  const filteredRules = useMemo(() => {
    if (!searchQuery) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter((r) => r.name.toLowerCase().includes(q));
  }, [rules, searchQuery]);

  const openNewRuleDialog = (base?: Rule) => {
    setCurrentRule(null);
    setEditingRule({
      id: `rule-${Date.now()}`,
      name: base ? `${base.name} Copy` : "",
      description: base?.description || "",
      conditions: base?.conditions?.map((c) => ({ ...c })) || [
        {
          property: propertyOptions[0].value,
          operator: "equals",
          value: "",
        },
      ],
      classificationCode:
        base?.classificationCode || Object.keys(classifications)[0] || "",
      active: base?.active ?? true,
    });
    setIsRuleDialogOpen(true);
  };

  const openEditRuleDialog = (rule: Rule) => {
    setCurrentRule(rule);
    setEditingRule({ ...rule });
    setIsRuleDialogOpen(true);
  };

  const handleExportJson = () => {
    const json = exportRulesAsJson();
    downloadFile(json, "rules.json", "application/json");
  };

  const handleExportExcel = () => {
    const wbData = exportRulesAsExcel();
    downloadFile(
      wbData,
      "rules.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  };

  const triggerImport = () => fileInputRef.current?.click();
  const triggerExcelImport = () => excelInputRef.current?.click();

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        importRulesFromJson(text);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importRulesFromExcel(file);
    e.target.value = "";
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
            property: propertyOptions[0].value,
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

  const confirmRemoveRule = (rule: Rule) => {
    setRuleToRemove(rule);
    setIsConfirmRemoveRuleOpen(true);
  };

  const handleAddDefaultEBKPHRules = useCallback(() => {
    if (!defaultEBKPHRules || defaultEBKPHRules.length === 0) return;
    let addedCount = 0;
    defaultEBKPHRules.forEach((defRule) => {
      if (!rules.find((r) => r.id === defRule.id)) {
        addRule(defRule);
        addedCount++;
      }
    });
    console.log(`Added ${addedCount} eBKP-H rules.`);
  }, [defaultEBKPHRules, rules, addRule]);

  const areAllDefaultEBKPHRulesAdded = useCallback(() => {
    if (
      isLoadingEBKPHRules ||
      errorLoadingEBKPHRules ||
      defaultEBKPHRules.length === 0
    )
      return false;
    return defaultEBKPHRules.every((defRule) =>
      rules.some((r) => r.id === defRule.id)
    );
  }, [isLoadingEBKPHRules, errorLoadingEBKPHRules, defaultEBKPHRules, rules]);

  // Function to handle creating a new classification if needed
  const handleClassificationChange = (value: string) => {
    // Check if this classification already exists
    if (!classifications[value]) {
      // Open dialog for creating a new classification
      setNewClassificationData({
        code: value,
        name: value,
        color: generateRandomColor(),
      });
      setIsClassificationDialogOpen(true);
      return;
    }

    // Update the rule with the selected classification
    setEditingRule({
      ...editingRule!,
      classificationCode: value,
    });
  };

  // Function to create a new classification with the dialog data
  const createNewClassification = () => {
    if (!newClassificationData.code || !newClassificationData.name) return;

    // Create the classification
    addClassification({
      code: newClassificationData.code,
      name: newClassificationData.name,
      color: newClassificationData.color,
      elements: []
    });

    // Update the rule
    setEditingRule({
      ...editingRule!,
      classificationCode: newClassificationData.code,
    });

    setIsClassificationDialogOpen(false);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h3 className="text-lg font-medium">{t('rulesEngine')}</h3>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="p-1.5 h-auto">
                <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                <span className="sr-only">{t('rules.manageRules')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openNewRuleDialog()}>
                <Plus className="mr-2 h-4 w-4" /> {t('rules.addNew')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                {t('sections.defaultSets')}
              </DropdownMenuLabel>
              {isLoadingEBKPHRules && (
                <DropdownMenuItem disabled>
                  {t('rules.loadingEbkph')}
                </DropdownMenuItem>
              )}
              {errorLoadingEBKPHRules && (
                <DropdownMenuItem disabled className="text-destructive">
                  {t('rules.ebkphError', { message: errorLoadingEBKPHRules })}
                </DropdownMenuItem>
              )}
              {!isLoadingEBKPHRules &&
                !errorLoadingEBKPHRules &&
                defaultEBKPHRules.length > 0 && (
                  <DropdownMenuItem
                    onClick={handleAddDefaultEBKPHRules}
                    disabled={areAllDefaultEBKPHRulesAdded()}
                  >
                    {t('rules.loadEbkph', { count: defaultEBKPHRules.length })}
                  </DropdownMenuItem>
                )}
              {!isLoadingEBKPHRules &&
                !errorLoadingEBKPHRules &&
                defaultEBKPHRules.length === 0 && (
                  <DropdownMenuItem disabled>
                    {t('rules.noEbkphFound')}
                  </DropdownMenuItem>
                )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                {t('sections.manageData')}
              </DropdownMenuLabel>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileOutput className="mr-2 h-4 w-4" /> {t('buttons.export')}
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
                  <ArchiveRestore className="mr-2 h-4 w-4" /> {t('buttons.load')}
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onSelect={() => {
                  if (rules.length > 0) {
                    setIsConfirmRemoveAllOpen(true);
                  }
                }}
                disabled={rules.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" /> {t('rules.removeAllRules')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('rules.searchPlaceholder')}
        list="rule-name-suggestions"
        className="w-full"
      />
      <datalist id="rule-name-suggestions">
        {ruleNameSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {rules.length === 0 ? (
        <div className="flex items-center justify-center flex-col py-8 flex-grow">
          <div className="flex justify-center mb-4">
            <Settings2 className="h-12 w-12 text-foreground/30" />
          </div>
          <p className="text-base font-medium text-foreground/80 mb-2">{t('noRulesDefined')}</p>
          <p className="text-sm text-foreground/60">
            {t('createRulesDescription')}
          </p>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="text-center py-8 flex-grow flex items-center justify-center">
          <p className="text-base font-medium text-foreground/80">
            {t('rules.noSearchResults')}
          </p>
        </div>
      ) : (
        <div className="space-y-4 flex-grow overflow-auto">
          {filteredRules.map((rule) => {
            const targetClassification =
              classifications[rule.classificationCode];
            return (
              <div
                key={rule.id}
                className="p-4 rounded-lg bg-card shadow-md hover:shadow-lg hover:bg-muted/60 transition-all duration-150 cursor-default"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {rule.active ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <h4 className="font-semibold text-lg text-foreground truncate">
                        {rule.name}
                      </h4>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {rule.description}
                      </p>
                    )}
                    {targetClassification && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Tag className="h-3.5 w-3.5" />
                        <span
                          style={{
                            color: targetClassification.color || "inherit",
                          }}
                          className="font-medium"
                        >
                          {targetClassification.name || rule.classificationCode}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                      onClick={() => previewRuleHighlight(rule.id)}
                      title={
                        previewingRuleId === rule.id
                          ? t('buttons.clearPreview')
                          : t('buttons.previewRule')
                      }
                    >
                      {previewingRuleId === rule.id ? (
                        <PlayCircle className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={() => openEditRuleDialog(rule)}
                      title={t('buttons.editRule')}
                    >
                      <Edit className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={() => openNewRuleDialog(rule)}
                      title={t('buttons.copyRule')}
                    >
                      <CopyPlus className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => confirmRemoveRule(rule)}
                      title={t('buttons.deleteRule')}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                {rule.conditions && rule.conditions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="text-xs font-medium mb-2 text-muted-foreground/80 uppercase tracking-wider">
                      {t('rules.conditions')}
                    </div>
                    <div className="space-y-1.5 pl-1">
                      {rule.conditions.map(
                        (condition: RuleCondition, index: number) => (
                          <div
                            key={index}
                            className="flex flex-nowrap items-baseline gap-x-2 p-1 bg-muted/30 rounded text-xs"
                          >
                            <span className="font-medium text-foreground/90 whitespace-nowrap">
                              {propertyOptions.find(
                                (p) => p.value === condition.property
                              )?.label || condition.property}
                            </span>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {t(`operators.${condition.operator}`)}
                            </span>
                            <span className="font-semibold text-accent-foreground bg-accent/50 py-0.5 px-1.5 rounded whitespace-nowrap break-all">
                              {String(condition.value)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-center mt-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => openNewRuleDialog()}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {editingRule && (
        <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden px-6 pt-6 pb-4">
            <DialogHeader className="pb-2">
              <DialogTitle>
                {currentRule ? t('rules.editRule') : t('rules.addNew')}
              </DialogTitle>
              <DialogDescription>
                {t('rules.defineConditions')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-6 py-4 max-h-[calc(90vh-180px)] overflow-y-auto px-1">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="rule-name" className="font-medium">
                  {t('rules.name')}
                </Label>
                <div className="relative">
                  <Input
                    id="rule-name"
                    value={editingRule.name || ""}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, name: e.target.value })
                    }
                    className="focus-visible:ring-offset-0"
                    placeholder={t('rules.namePlaceholder')}
                  />
                </div>
              </div>

              {/* Description Field */}
              <div className="space-y-2">
                <Label htmlFor="rule-description" className="font-medium">
                  {t('rules.description')}
                </Label>
                <div className="relative">
                  <Textarea
                    id="rule-description"
                    value={editingRule.description || ""}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        description: e.target.value,
                      })
                    }
                    className="min-h-[120px] focus-visible:ring-offset-0"
                    placeholder={t('rules.descriptionPlaceholder')}
                  />
                </div>
              </div>

              {/* Conditions Section */}
              <div className="space-y-3">
                <Label className="font-medium">
                  {t('rules.conditions')}
                </Label>
                <div className="rounded-md border p-3 space-y-3">
                  {editingRule.conditions?.map((condition, index) => (
                    <div key={index} className="grid sm:grid-cols-12 gap-3 items-center">
                      <div className="col-span-full sm:col-span-5 mb-2 sm:mb-0">
                        <div className="relative w-full">
                          <CreatableCombobox
                            options={propertyOptions}
                            value={condition.property}
                            onChange={(value) =>
                              handleConditionChange(index, "property", value)
                            }
                            placeholder={t('rules.propertyPlaceholder')}
                            searchPlaceholder={t('rules.searchPropertyPlaceholder')}
                            emptyResultText={t('rules.noPropertyFound')}
                            className="w-full"
                            popoverClassName="w-full max-w-[450px]"
                          />
                        </div>
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Select
                          value={condition.operator}
                          onValueChange={(value) =>
                            handleConditionChange(index, "operator", value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('rules.operatorPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableOperators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {t(`operators.${op.value}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Input
                          id={`condition-value-${index}`}
                          value={String(condition.value)}
                          onChange={(e) =>
                            handleConditionChange(index, "value", e.target.value)
                          }
                          className="w-full focus-visible:ring-offset-0"
                          placeholder={
                            condition.property.toLowerCase().includes("is") ||
                              condition.property.toLowerCase().includes("has")
                              ? t('rules.booleanValuePlaceholder')
                              : t('rules.valuePlaceholder')
                          }
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeConditionField(index)}
                          disabled={(editingRule.conditions?.length || 0) <= 1}
                          className="h-9 w-9"
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
                    className="w-full sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" /> {t('buttons.addCondition')}
                  </Button>
                </div>
              </div>

              {/* Classification Section - Complete Redesign */}
              <div className="mt-2 bg-muted/20 border rounded-md">
                <div className="p-3 border-b flex justify-between items-center">
                  <h3 className="text-sm font-medium">
                    {t('rules.applyClassification')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="rule-active" className="text-sm cursor-pointer">
                      {t('rules.active')}
                    </Label>
                    <Switch
                      id="rule-active"
                      checked={editingRule.active || false}
                      onCheckedChange={(checked) =>
                        setEditingRule({ ...editingRule, active: checked })
                      }
                    />
                  </div>
                </div>
                <div className="p-4 w-full">
                  <div className="relative w-full">
                    <CreatableCombobox
                      options={classificationOptions}
                      value={editingRule.classificationCode || ""}
                      onChange={handleClassificationChange}
                      placeholder={t('rules.selectClassification')}
                      searchPlaceholder={t('rules.searchClassificationPlaceholder')}
                      emptyResultText={t('rules.noClassificationFound')}
                      createText={(value) => t('rules.createNewClassification', { value })}
                      className="w-full"
                      renderOption={(option) => (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: option.color || "#3b82f6" }}
                          />
                          <span className="truncate">{option.label}</span>
                        </div>
                      )}
                      popoverClassName="w-full max-w-[550px]"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-2 pb-1 flex justify-center sm:justify-end gap-3">
              <DialogClose asChild>
                <Button variant="outline">{t('buttons.cancel')}</Button>
              </DialogClose>
              <Button onClick={handleSaveRule}>{t('buttons.saveRule')}</Button>
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
                  {t('rules.confirmRemoval')}
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              {t('rules.confirmRemoveAll')}
            </DialogDescription>
            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmRemoveAllOpen(false)}
                className="sm:w-auto w-full"
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  removeAllRules();
                  setIsConfirmRemoveAllOpen(false);
                }}
                className="sm:w-auto w-full"
              >
                {t('buttons.removeAll')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {ruleToRemove && isConfirmRemoveRuleOpen && (
        <Dialog
          open={isConfirmRemoveRuleOpen}
          onOpenChange={setIsConfirmRemoveRuleOpen}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <DialogTitle className="text-lg font-medium">
                  {t('rules.confirmRuleRemoval')}
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              {t('rules.confirmRemoveRule')}
            </DialogDescription>
            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsConfirmRemoveRuleOpen(false);
                  setRuleToRemove(null);
                }}
                className="sm:w-auto w-full"
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  removeRule(ruleToRemove.id);
                  setIsConfirmRemoveRuleOpen(false);
                  setRuleToRemove(null);
                }}
                className="sm:w-auto w-full"
              >
                {t('buttons.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {newClassificationData && (
        <Dialog
          open={isClassificationDialogOpen}
          onOpenChange={(open) => {
            setIsClassificationDialogOpen(open);
            // If dialog is closed without saving, don't create classification
            if (!open && editingRule && !classifications[newClassificationData.code]) {
              // Keep rule dialog open but clear the classification field
              setEditingRule({
                ...editingRule,
                classificationCode: "",
              });
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('classifications.createFromRule')}</DialogTitle>
              <DialogDescription>
                {t('addClassification')}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-5">
              {/* Code and Name fields in a card */}
              <div className="bg-muted/20 border rounded-md overflow-hidden">
                <div className="p-3 border-b">
                  <h3 className="text-sm font-medium">{t('classifications.basicInfo')}</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <Label htmlFor="classification-code" className="text-sm font-medium block mb-1.5">
                      {t('classifications.code')}
                    </Label>
                    <Input
                      id="classification-code"
                      value={newClassificationData.code}
                      onChange={(e) =>
                        setNewClassificationData({
                          ...newClassificationData,
                          code: e.target.value,
                        })
                      }
                      className="w-full"
                      placeholder={t('classifications.codePlaceholder')}
                    />
                  </div>

                  <div>
                    <Label htmlFor="classification-name" className="text-sm font-medium block mb-1.5">
                      {t('classifications.name')}
                    </Label>
                    <Input
                      id="classification-name"
                      value={newClassificationData.name}
                      onChange={(e) =>
                        setNewClassificationData({
                          ...newClassificationData,
                          name: e.target.value,
                        })
                      }
                      className="w-full"
                      placeholder={t('classifications.namePlaceholder')}
                    />
                  </div>
                </div>
              </div>

              {/* Color picker in a card */}
              <div className="bg-muted/20 border rounded-md overflow-hidden">
                <div className="p-3 border-b">
                  <h3 className="text-sm font-medium">{t('classifications.color')}</h3>
                </div>
                <div className="p-4">
                  <div className="flex flex-col space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className="h-10 rounded border border-input w-full"
                        style={{ backgroundColor: newClassificationData.color }}
                      />
                      <Input
                        type="text"
                        value={newClassificationData.color}
                        onChange={(e) =>
                          setNewClassificationData({
                            ...newClassificationData,
                            color: e.target.value,
                          })
                        }
                        className="font-mono text-center w-full"
                      />
                    </div>
                    <div className="w-full flex justify-center">
                      <HexColorPicker
                        color={newClassificationData.color}
                        onChange={(color) =>
                          setNewClassificationData({
                            ...newClassificationData,
                            color,
                          })
                        }
                        className="w-full max-w-[280px] h-[180px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsClassificationDialogOpen(false)}
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                onClick={createNewClassification}
                disabled={!newClassificationData.code || !newClassificationData.name}
              >
                {t('buttons.add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
