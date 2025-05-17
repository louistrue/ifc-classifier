"use client";

import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import type { IfcAPI } from "web-ifc"; // Import IfcAPI type
import { Properties } from "web-ifc"; // Ensure Properties is imported

// Define types for Rules
export interface RuleCondition {
  property: string;
  operator: string;
  value: string | number | boolean; // Keeping this general as previously discussed
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  classificationCode: string;
  active: boolean;
}

// Define a basic type for the spatial tree node (can be expanded)
export interface SpatialStructureNode {
  expressID: number;
  type: string; // e.g., "IFCPROJECT", "IFCSITE", "IFCBUIILDING", etc.
  children: SpatialStructureNode[];
  // You might add more properties extracted from GetSpatialStructure, like Name
  GlobalId?: any;
  Name?: any;
  [key: string]: any; // Allow other properties
}

// Represents a single loaded IFC model's data in the context
export interface LoadedModelData {
  id: string; // Unique ID for this loaded instance (e.g., generated timestamp or uuid)
  name: string; // Original file name
  url: string; // Blob URL
  modelID: number | null; // Model ID from ifcAPI.OpenModel()
  spatialTree: SpatialStructureNode | null;
  // Potentially add other per-model states here if needed, like categories, classifications etc.
  // For now, classifications and rules will be global.
}

// Type for selected element, now includes modelID
export interface SelectedElementInfo {
  modelID: number;
  expressID: number;
}

interface IFCContextType {
  loadedModels: LoadedModelData[]; // Array of loaded models
  selectedElement: SelectedElementInfo | null;
  highlightedElements: SelectedElementInfo[]; // Assuming highlights can also be model-specific
  elementProperties: any | null; // Properties of the selectedElement
  availableCategories: Record<number, string[]>; // Categories per modelID
  classifications: Record<string, any>; // Global classifications for now
  rules: Rule[]; // Global rules for now
  ifcApi: IfcAPI | null;
  highlightedClassificationCode: string | null;
  showAllClassificationColors: boolean; // Added for global classification colors visibility
  previewingRuleId: string | null; // Added to track active rule preview

  replaceIFCModel: (
    url: string,
    name: string,
    fileId?: string
  ) => Promise<number | null>; // Returns modelID or null
  addIFCModel: (
    url: string,
    name: string,
    fileId?: string
  ) => Promise<number | null>; // Returns modelID or null
  removeIFCModel: (id: string) => void; // id is LoadedModelData.id
  setModelIDForLoadedModel: (loadedModelId: string, ifcModelId: number) => void;
  setSpatialTreeForModel: (
    modelID: number,
    tree: SpatialStructureNode | null
  ) => void;

  selectElement: (selection: SelectedElementInfo | null) => void;
  toggleClassificationHighlight: (classificationCode: string) => void;
  setElementProperties: (properties: any | null) => void;
  setAvailableCategoriesForModel: (
    modelID: number,
    categories: string[]
  ) => void;
  setIfcApi: (api: IfcAPI | null) => void;
  toggleShowAllClassificationColors: () => void; // Added new toggle function

  // Classification and Rule methods (can remain global or be refactored later if needed per model)
  addClassification: (classification: any) => void;
  removeClassification: (code: string) => void;
  updateClassification: (code: string, classification: any) => void;
  addRule: (rule: Rule) => void;
  removeRule: (id: string) => void;
  updateRule: (rule: Rule) => void;
  previewRuleHighlight: (ruleId: string) => Promise<void>;
}

const IFCContext = createContext<IFCContextType | undefined>(undefined);

export function IFCContextProvider({ children }: { children: ReactNode }) {
  const [loadedModels, setLoadedModels] = useState<LoadedModelData[]>([]);
  const [selectedElement, setSelectedElement] =
    useState<SelectedElementInfo | null>(null);
  const [highlightedElements, setHighlightedElements] = useState<
    SelectedElementInfo[]
  >([]);
  const [elementProperties, setElementPropertiesInternal] = useState<any | null>(null);
  const [availableCategories, setAvailableCategoriesInternal] = useState<
    Record<number, string[]>
  >({});
  const [highlightedClassificationCode, setHighlightedClassificationCode] = useState<string | null>(null);
  const [showAllClassificationColors, setShowAllClassificationColors] = useState<boolean>(false);
  const [previewingRuleId, setPreviewingRuleId] = useState<string | null>(null); // Added state

  // Initialize classifications with a default entry
  const [classifications, setClassifications] = useState<Record<string, any>>({
    DEFAULT_CLASS: {
      id: "DEFAULT_CLASS", // Using code as id for consistency, or generate uuid
      code: "DEFAULT_CLASS",
      name: "Default Classification",
      description: "This is a default classification provided by the system.",
      color: "#4caf50", // A pleasant green color
      elements: [], // Initially no elements assigned
    },
  });
  const [rules, setRules] = useState<Rule[]>([]);
  const [ifcApiInternal, setIfcApiInternal] = useState<IfcAPI | null>(null);

  // Helper to get all elements from a spatial tree structure
  const getAllElementsFromSpatialTreeNodesRecursive = useCallback((nodes: SpatialStructureNode[]): SpatialStructureNode[] => {
    let elements: SpatialStructureNode[] = [];
    for (const node of nodes) {
      elements.push(node);
      if (node.children && node.children.length > 0) {
        elements = elements.concat(getAllElementsFromSpatialTreeNodesRecursive(node.children));
      }
    }
    return elements;
  }, []);

  const matchesAllConditionsCallback = useCallback(async (
    elementNode: SpatialStructureNode,
    conditions: RuleCondition[],
    modelID: number,
    api: IfcAPI // Passed explicitly, not from context state directly in this func
  ): Promise<boolean> => {
    for (const condition of conditions) {
      let elementValue: any;
      const ruleValue = condition.value;
      if (condition.property === "ifcType") {
        elementValue = elementNode.type;
      } else if (condition.property === "name") {
        elementValue = elementNode.Name?.value || elementNode.Name;
        if (elementValue === undefined && elementNode.expressID && api) {
          try {
            const props = await api.GetLine(modelID, elementNode.expressID);
            elementValue = props.Name?.value;
          } catch (e) { console.warn('Error fetching name for ' + elementNode.expressID + ':', e); return false; }
        }
      } else if (condition.property.startsWith("Pset_") && api && api.properties) {
        const [psetName, propName] = condition.property.split(".");
        if (!psetName || !propName) { console.warn("Invalid Pset property format:", condition.property); return false; }
        try {
          const psets = await api.properties.getPropertySets(modelID, elementNode.expressID, true);
          const targetPset = psets.find((pset: any) => pset.Name?.value === psetName);
          if (targetPset) {
            const targetProp = targetPset.HasProperties?.find((prop: any) => prop.Name?.value === propName);
            if (targetProp) {
              elementValue = targetProp.NominalValue?.value !== undefined ? targetProp.NominalValue.value : targetProp.NominalValue;
            }
          }
        } catch (e) { console.warn('Error fetching Pset ' + condition.property + ' for ' + elementNode.expressID + ':', e); /* Continue trying other conditions or rules */ }
      } else { console.warn("Unsupported property:", condition.property); return false; }

      const normElementValue = typeof elementValue === "string" ? elementValue.toLowerCase() : elementValue;
      const normRuleValue = typeof ruleValue === "string" ? ruleValue.toLowerCase() : ruleValue;
      let conditionMet = false;
      switch (condition.operator) {
        case "equals":
          conditionMet = normElementValue === (typeof normElementValue === 'boolean' && typeof normRuleValue === 'string' ? (normRuleValue === 'true') : normRuleValue);
          break;
        case "notEquals":
          conditionMet = normElementValue !== (typeof normElementValue === 'boolean' && typeof normRuleValue === 'string' ? (normRuleValue === 'true') : normRuleValue);
          break;
        case "contains":
          conditionMet = typeof normElementValue === "string" && typeof normRuleValue === "string" && normElementValue.includes(normRuleValue);
          break;
        default: console.warn("Unsupported operator:", condition.operator); return false;
      }
      if (!conditionMet) return false;
    }
    return true;
  }, []);

  const applyAllActiveRules = useCallback(async () => {
    if (!ifcApiInternal) {
      console.log("IFC API not available, skipping rule application that might need it.");
      if (loadedModels.length === 0) {
        const clearedClassifications = { ...classifications };
        for (const code in clearedClassifications) {
          clearedClassifications[code] = { ...clearedClassifications[code], elements: [] };
        }
        setClassifications(clearedClassifications);
      }
      return;
    }
    if (ifcApiInternal && !ifcApiInternal.properties) {
      try {
        ifcApiInternal.properties = new Properties(ifcApiInternal);
      } catch (e) {
        console.error("IFCContext: Failed to initialize ifcApi.properties in applyAllActiveRules", e);
        return;
      }
    }
    console.log("Applying all active rules...");
    const newElementsPerClassification: Record<string, SelectedElementInfo[]> = {};
    const currentClassifications = classifications;
    const currentClassificationCodes = Object.keys(currentClassifications);

    for (const classCode of currentClassificationCodes) {
      newElementsPerClassification[classCode] = [];
    }

    const activeRules = rules.filter(rule => rule.active && currentClassifications[rule.classificationCode]);

    if (loadedModels.filter(m => m.modelID != null && m.spatialTree != null).length === 0) {
      const clearedClassifications = { ...currentClassifications };
      for (const code of currentClassificationCodes) {
        clearedClassifications[code] = { ...clearedClassifications[code], elements: [] };
      }
      setClassifications(clearedClassifications);
      console.log("No models ready, cleared rule-based elements from classifications.");
      return;
    }

    for (const model of loadedModels) {
      if (model.modelID == null || !model.spatialTree) continue;
      const allModelElements = getAllElementsFromSpatialTreeNodesRecursive(model.spatialTree ? [model.spatialTree] : []);
      for (const rule of activeRules) {
        if (!newElementsPerClassification[rule.classificationCode]) {
          continue;
        }
        for (const elementNode of allModelElements) {
          if (elementNode.expressID === undefined) continue;
          try {
            const matches = await matchesAllConditionsCallback(elementNode, rule.conditions, model.modelID, ifcApiInternal);
            if (matches) {
              const elementInfo: SelectedElementInfo = { modelID: model.modelID, expressID: elementNode.expressID };
              if (!newElementsPerClassification[rule.classificationCode].some(el => el.modelID === elementInfo.modelID && el.expressID === elementInfo.expressID)) {
                newElementsPerClassification[rule.classificationCode].push(elementInfo);
              }
            }
          } catch (error) { console.error('Error processing element ' + elementNode.expressID + ' for rule ' + rule.name + ':', error); }
        }
      }
    }
    const updatedClassifications = { ...currentClassifications };
    let changed = false;
    for (const code of currentClassificationCodes) {
      const newElements = newElementsPerClassification[code] || [];
      if (JSON.stringify(updatedClassifications[code].elements) !== JSON.stringify(newElements)) {
        updatedClassifications[code] = { ...updatedClassifications[code], elements: newElements };
        changed = true;
      }
    }
    if (changed) {
      setClassifications(updatedClassifications);
      console.log("Finished applying all active rules. Classifications updated.");
    } else {
      console.log("Finished applying all active rules. No changes to classifications elements.");
    }
  }, [ifcApiInternal, loadedModels, rules, getAllElementsFromSpatialTreeNodesRecursive, matchesAllConditionsCallback]);

  const classificationCodesKey = useMemo(() => Object.keys(classifications).sort().join(','), [classifications]);
  const rulesKey = useMemo(() => JSON.stringify(rules.map(r => ({ id: r.id, active: r.active, conditions: r.conditions, classificationCode: r.classificationCode }))), [rules]);
  const modelsReadyKey = useMemo(() => loadedModels.filter(m => m.modelID !== null && m.spatialTree !== null).length, [loadedModels]);

  useEffect(() => {
    console.log("Main effect for applyAllActiveRules triggered by changes in models, rules, or classification codes.");
    applyAllActiveRules();
  }, [modelsReadyKey, rulesKey, classificationCodesKey, applyAllActiveRules]);

  const previewRuleHighlight = useCallback(async (ruleId: string) => {
    if (!ifcApiInternal) return;

    if (previewingRuleId === ruleId) {
      // Clicking active preview again: toggle off
      setPreviewingRuleId(null);
      setHighlightedClassificationCode(null);
      setHighlightedElements([]);
      console.log('Cleared preview for rule: ' + ruleId);
      return;
    }

    // Activating a new preview or switching
    if (ifcApiInternal && !ifcApiInternal.properties) {
      try {
        ifcApiInternal.properties = new Properties(ifcApiInternal);
      } catch (e) { console.error("Failed to init properties in preview", e); return; }
    }
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) {
      console.warn("Rule not found for preview:", ruleId);
      setPreviewingRuleId(null); // Clear if rule not found
      setHighlightedClassificationCode(null);
      setHighlightedElements([]);
      return;
    }
    const matchingElements: SelectedElementInfo[] = [];
    for (const model of loadedModels) {
      if (model.modelID == null || !model.spatialTree) continue;
      const allModelElements = getAllElementsFromSpatialTreeNodesRecursive(model.spatialTree ? [model.spatialTree] : []);
      for (const elementNode of allModelElements) {
        if (elementNode.expressID === undefined) continue;
        try {
          const matches = await matchesAllConditionsCallback(elementNode, rule.conditions, model.modelID, ifcApiInternal);
          if (matches) {
            matchingElements.push({ modelID: model.modelID, expressID: elementNode.expressID });
          }
        } catch (error) { console.error('Error previewing element ' + elementNode.expressID + ' for rule ' + rule.name + ':', error); }
      }
    }
    setPreviewingRuleId(ruleId); // Set this rule as actively previewing
    setHighlightedClassificationCode(rule.classificationCode);
    setHighlightedElements(matchingElements);
    setShowAllClassificationColors(false);
    console.log('Previewing rule "' + rule.name + '". Found ' + matchingElements.length + ' elements.');
  }, [ifcApiInternal, loadedModels, rules, classifications, getAllElementsFromSpatialTreeNodesRecursive, matchesAllConditionsCallback, previewingRuleId, setHighlightedClassificationCode, setHighlightedElements, setShowAllClassificationColors]); // Added previewingRuleId to deps

  const generateFileId = useCallback(() => `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, []);
  const commonLoadLogic = useCallback((url: string, name: string, fileIdToUse?: string): LoadedModelData => {
    const id = fileIdToUse || generateFileId();
    setSelectedElement(null);
    setElementPropertiesInternal(null);
    setHighlightedElements([]);
    return { id, name, url, modelID: null, spatialTree: null };
  }, [generateFileId, setSelectedElement, setElementPropertiesInternal, setHighlightedElements]);

  const addIFCModel = useCallback(async (url: string, name: string, fileId?: string): Promise<number | null> => {
    setLoadedModels((prev) => [...prev, commonLoadLogic(url, name, fileId)]);
    return null;
  }, [commonLoadLogic]);

  const replaceIFCModel = useCallback(async (url: string, name: string, fileId?: string): Promise<number | null> => {
    setLoadedModels([commonLoadLogic(url, name, fileId)]);
    return null;
  }, [commonLoadLogic]);

  const removeIFCModel = useCallback((id: string) => {
    setLoadedModels((prev) =>
      prev.filter((m) => {
        if (m.id === id && m.modelID !== null && ifcApiInternal) {
          try { ifcApiInternal.CloseModel(m.modelID); } catch (e) { console.error('Error closing model:', e); }
          setAvailableCategoriesInternal((prevCats) => { const newCats = { ...prevCats }; if (m.modelID) delete newCats[m.modelID]; return newCats; });
        }
        return m.id !== id;
      })
    );
    if (selectedElement && loadedModels.find((m) => m.id === id)?.modelID === selectedElement.modelID) {
      setSelectedElement(null);
      setElementPropertiesInternal(null);
    }
  }, [ifcApiInternal, selectedElement, loadedModels, setLoadedModels, setAvailableCategoriesInternal, setSelectedElement, setElementPropertiesInternal]);

  const setModelIDForLoadedModel = useCallback((loadedModelId: string, ifcModelId: number) => {
    setLoadedModels((prev) => prev.map((m) => (m.id === loadedModelId ? { ...m, modelID: ifcModelId } : m)));
  }, [setLoadedModels]);

  const setSpatialTreeForModel = useCallback((modelID: number, tree: SpatialStructureNode | null) => {
    setLoadedModels((prevModels) => prevModels.map((m) => (m.modelID === modelID ? { ...m, spatialTree: tree } : m)));
  }, [setLoadedModels]);

  const selectElement = useCallback((selection: SelectedElementInfo | null) => {
    setSelectedElement(selection);
    setHighlightedElements([]);
    setHighlightedClassificationCode(null);
    setShowAllClassificationColors(false);
    setPreviewingRuleId(null); // Clear active rule preview
    if (!selection) setElementPropertiesInternal(null);
  }, [setSelectedElement, setHighlightedElements, setHighlightedClassificationCode, setShowAllClassificationColors, setElementPropertiesInternal, setPreviewingRuleId]);

  const toggleClassificationHighlight = useCallback((classificationCode: string) => {
    if (highlightedClassificationCode === classificationCode && !previewingRuleId) { // Only toggle off if not a rule preview
      setHighlightedClassificationCode(null);
      setHighlightedElements([]);
      // setPreviewingRuleId(null); // Rule preview is already off or handled by its own toggle
    } else {
      const classification = classifications[classificationCode];
      if (classification && classification.elements) {
        setHighlightedClassificationCode(classificationCode);
        setHighlightedElements(classification.elements);
        setShowAllClassificationColors(false);
        setPreviewingRuleId(null); // Clear rule preview if activating classification highlight
      } else {
        setHighlightedClassificationCode(null);
        setHighlightedElements([]);
        console.warn('Classification ' + classificationCode + ' or its elements not found for highlight.');
      }
    }
  }, [classifications, highlightedClassificationCode, setHighlightedClassificationCode, setHighlightedElements, setShowAllClassificationColors, previewingRuleId, setPreviewingRuleId]);

  const setElementProperties = useCallback((properties: any | null) => {
    setElementPropertiesInternal(properties);
  }, [setElementPropertiesInternal]);

  const setAvailableCategoriesForModel = useCallback((modelID: number, cats: string[]) => {
    setAvailableCategoriesInternal((prev) => ({ ...prev, [modelID]: cats }));
  }, [setAvailableCategoriesInternal]);

  const setIfcApi = useCallback((api: IfcAPI | null) => {
    setIfcApiInternal(api);
  }, [setIfcApiInternal]);

  const toggleShowAllClassificationColors = useCallback(() => {
    setShowAllClassificationColors(prev => {
      const newShowAllState = !prev;
      if (newShowAllState) {
        setHighlightedClassificationCode(null);
        setHighlightedElements([]);
        setPreviewingRuleId(null); // Clear rule preview if showing all colors
      }
      // If turning off showAll, we don't automatically re-enable a specific preview or highlight.
      return newShowAllState;
    });
  }, [setShowAllClassificationColors, setHighlightedClassificationCode, setHighlightedElements, setPreviewingRuleId]);

  const addClassification = useCallback((classificationItem: any) => {
    setClassifications((prev) => ({ ...prev, [classificationItem.code]: classificationItem }));
  }, [setClassifications]);

  const removeClassification = useCallback((code: string) => {
    setClassifications((prev) => { const updated = { ...prev }; delete updated[code]; return updated; });
  }, [setClassifications]);

  const updateClassification = useCallback((code: string, classificationItem: any) => {
    setClassifications((prev) => ({ ...prev, [code]: classificationItem }));
  }, [setClassifications]);

  const addRule = useCallback((ruleItem: Rule) => {
    setRules((prev) => [...prev, ruleItem]);
  }, [setRules]);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, [setRules]);

  const updateRule = useCallback((updatedRuleItem: Rule) => {
    setRules((prev) => prev.map((r) => (r.id === updatedRuleItem.id ? updatedRuleItem : r)));
  }, [setRules]);

  return (
    <IFCContext.Provider
      value={{
        loadedModels,
        selectedElement,
        highlightedElements,
        elementProperties,
        availableCategories,
        classifications,
        rules,
        ifcApi: ifcApiInternal,
        highlightedClassificationCode,
        showAllClassificationColors,
        previewingRuleId,
        replaceIFCModel,
        addIFCModel,
        removeIFCModel,
        setModelIDForLoadedModel,
        setSpatialTreeForModel,
        selectElement,
        toggleClassificationHighlight,
        setElementProperties,
        setAvailableCategoriesForModel,
        setIfcApi,
        toggleShowAllClassificationColors,
        addClassification,
        removeClassification,
        updateClassification,
        addRule,
        removeRule,
        updateRule,
        previewRuleHighlight,
      }}
    >
      {children}
    </IFCContext.Provider>
  );
}

export function useIFCContext() {
  const context = useContext(IFCContext);
  if (context === undefined) {
    throw new Error("useIFCContext must be used within an IFCContextProvider");
  }
  return context;
}
