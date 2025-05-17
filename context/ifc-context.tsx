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
  userHiddenElements: SelectedElementInfo[]; // New state for user-hidden elements

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

  toggleUserHideElement: (element: SelectedElementInfo) => void; // New function
  unhideLastElement: () => void; // New function
  unhideAllElements: () => void; // New function
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
  const [userHiddenElements, setUserHiddenElements] = useState<SelectedElementInfo[]>([]); // New state

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
      // Only clear elements if there are no models. Definitions should persist.
      if (loadedModels.length === 0) {
        setClassifications(prevClassifications => {
          const newCleared = { ...prevClassifications };
          let actuallyClearedSomething = false;
          for (const code in newCleared) {
            if (newCleared[code] && newCleared[code].elements && newCleared[code].elements.length > 0) {
              newCleared[code] = { ...newCleared[code], elements: [] };
              actuallyClearedSomething = true;
            }
          }
          if (actuallyClearedSomething) {
            console.log("IFCContext: IFC API not available & no models: Ensured all classification elements are empty.");
          }
          return newCleared;
        });
      }
      return;
    }

    // Ensure properties are initialized if API is available
    if (ifcApiInternal && !ifcApiInternal.properties) {
      try {
        ifcApiInternal.properties = new Properties(ifcApiInternal);
      } catch (e) {
        console.error("IFCContext: Failed to initialize ifcApi.properties in applyAllActiveRules", e);
        return; // Cannot proceed without properties
      }
    }

    console.log("IFCContext: Applying all active rules...");

    // If no models are fully ready (have modelID and spatialTree), 
    // just ensure all classification elements are empty and then return.
    if (loadedModels.filter(m => m.modelID != null && m.spatialTree != null).length === 0) {
      setClassifications(prevClassifications => {
        const newCleared = { ...prevClassifications };
        let actuallyClearedSomething = false;
        for (const code in newCleared) {
          if (newCleared[code] && newCleared[code].elements && newCleared[code].elements.length > 0) {
            newCleared[code] = { ...newCleared[code], elements: [] };
            actuallyClearedSomething = true;
          }
        }
        if (actuallyClearedSomething) {
          console.log("IFCContext: No models ready, ensured rule-based elements from classifications are empty.");
        }
        // else {
        //      console.log("IFCContext: No models ready, classifications elements were already empty or no classifications.");
        // }
        return newCleared;
      });
      return;
    }

    // Proceed with rule application if models are ready
    const currentClassificationsForProcessing = classifications;
    const currentClassificationCodes = Object.keys(currentClassificationsForProcessing);
    const newElementsPerClassification: Record<string, SelectedElementInfo[]> = {};

    for (const classCode of currentClassificationCodes) {
      newElementsPerClassification[classCode] = [];
    }

    const activeRules = rules.filter(rule => rule.active && currentClassificationsForProcessing[rule.classificationCode]);

    for (const model of loadedModels) {
      if (model.modelID == null || !model.spatialTree) continue;
      const allModelElements = getAllElementsFromSpatialTreeNodesRecursive(model.spatialTree ? [model.spatialTree] : []);
      for (const rule of activeRules) {
        if (!newElementsPerClassification[rule.classificationCode]) {
          // This should not happen if initialized above, but as a safeguard
          newElementsPerClassification[rule.classificationCode] = [];
        }
        for (const elementNode of allModelElements) {
          if (elementNode.expressID === undefined) continue;
          try {
            const matches = await matchesAllConditionsCallback(elementNode, rule.conditions, model.modelID, ifcApiInternal);
            if (matches) {
              const elementInfo: SelectedElementInfo = { modelID: model.modelID, expressID: elementNode.expressID };
              // Ensure no duplicates
              if (!newElementsPerClassification[rule.classificationCode].some(el => el.modelID === elementInfo.modelID && el.expressID === elementInfo.expressID)) {
                newElementsPerClassification[rule.classificationCode].push(elementInfo);
              }
            }
          } catch (error) {
            console.error('IFCContext: Error processing element ' + elementNode.expressID + ' for rule ' + rule.name + ':', error);
          }
        }
      }
    }

    // Update classifications state with new elements, only if changed
    setClassifications(prevClassifications => {
      const updatedClassifications = { ...prevClassifications };
      let changed = false;
      for (const code of Object.keys(updatedClassifications)) {
        const newElements = newElementsPerClassification[code] || [];
        if (JSON.stringify(updatedClassifications[code].elements || []) !== JSON.stringify(newElements)) {
          updatedClassifications[code] = { ...updatedClassifications[code], elements: newElements };
          changed = true;
        }
      }
      if (changed) {
        console.log("IFCContext: Finished applying all active rules. Classifications updated.");
      } else {
        console.log("IFCContext: Finished applying all active rules. No changes to classifications elements.");
      }
      return updatedClassifications;
    });

  }, [
    ifcApiInternal,
    loadedModels,
    rules,
    getAllElementsFromSpatialTreeNodesRecursive,
    matchesAllConditionsCallback
  ]);

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
  }, [ifcApiInternal, loadedModels, rules, getAllElementsFromSpatialTreeNodesRecursive, matchesAllConditionsCallback, previewingRuleId, setHighlightedClassificationCode, setHighlightedElements, setShowAllClassificationColors]); // Added previewingRuleId to deps

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
    if (!selection) {
      setElementPropertiesInternal(null);
    } else {
      // Properties will be fetched by IFCModel's useEffect based on selectedElement change
      // So, we don't necessarily need to set them to null here if a new selection is made.
      // However, if the old selectedElement was different, its props should be cleared.
      // For simplicity, if we are selecting something new (or null), clear old props.
      setElementPropertiesInternal(null); // Clear old props before new ones are fetched
    }
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

  const toggleUserHideElement = useCallback((elementToToggle: SelectedElementInfo) => {
    console.log("IFCContext: toggleUserHideElement called for", elementToToggle);
    setUserHiddenElements((prevHidden) => {
      const isAlreadyHidden = prevHidden.some(
        (el) => el.modelID === elementToToggle.modelID && el.expressID === elementToToggle.expressID
      );
      if (isAlreadyHidden) {
        console.log("IFCContext: Element was hidden, now showing:", elementToToggle);
        return prevHidden.filter(
          (el) => !(el.modelID === elementToToggle.modelID && el.expressID === elementToToggle.expressID)
        );
      } else {
        console.log("IFCContext: Element was visible, now hiding:", elementToToggle);
        // Check if the element being hidden is the currently selected element
        if (selectedElement &&
          selectedElement.modelID === elementToToggle.modelID &&
          selectedElement.expressID === elementToToggle.expressID) {
          console.log("IFCContext: Deselecting element because it is now hidden.");
          setSelectedElement(null); // Deselect
          setElementPropertiesInternal(null); // Clear its properties
        }
        return [...prevHidden, elementToToggle];
      }
    });
  }, [selectedElement, setSelectedElement, setElementPropertiesInternal]);

  const unhideLastElement = useCallback(() => {
    console.log("IFCContext: unhideLastElement called.");
    setUserHiddenElements((prevHidden) => {
      if (prevHidden.length === 0) {
        console.log("IFCContext: No elements to unhide.");
        return prevHidden;
      }
      const newHidden = prevHidden.slice(0, -1); // Remove the last element
      console.log("IFCContext: Unhid last element. Remaining hidden:", newHidden.length);
      return newHidden;
    });
  }, []);

  const unhideAllElements = useCallback(() => {
    console.log("IFCContext: unhideAllElements called.");
    setUserHiddenElements([]);
    console.log("IFCContext: All elements unhidden.");
  }, []);

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
        userHiddenElements,
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
        toggleUserHideElement,
        unhideLastElement,
        unhideAllElements,
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
