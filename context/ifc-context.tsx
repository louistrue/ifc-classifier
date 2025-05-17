"use client";

import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useCallback,
} from "react";
import type { IfcAPI } from "web-ifc"; // Import IfcAPI type

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
  setIfcApi: (api: IfcAPI) => void;
  toggleShowAllClassificationColors: () => void; // Added new toggle function

  // Classification and Rule methods (can remain global or be refactored later if needed per model)
  addClassification: (classification: any) => void;
  removeClassification: (code: string) => void;
  updateClassification: (code: string, classification: any) => void;
  addRule: (rule: Rule) => void;
  removeRule: (id: string) => void;
  updateRule: (rule: Rule) => void;
  applyRule: (id: string) => Promise<void>;
  applyRuleToClassification: (
    ruleId: string,
    classificationCode: string
  ) => void;
  clearHighlights: () => void;
}

const IFCContext = createContext<IFCContextType | undefined>(undefined);

export function IFCContextProvider({ children }: { children: ReactNode }) {
  const [loadedModels, setLoadedModels] = useState<LoadedModelData[]>([]);
  const [selectedElement, setSelectedElement] =
    useState<SelectedElementInfo | null>(null);
  const [highlightedElements, setHighlightedElements] = useState<
    SelectedElementInfo[]
  >([]);
  const [elementProperties, setElementProperties] = useState<any | null>(null);
  const [availableCategories, setAvailableCategories] = useState<
    Record<number, string[]>
  >({});
  const [highlightedClassificationCode, setHighlightedClassificationCode] = useState<string | null>(null);
  const [showAllClassificationColors, setShowAllClassificationColors] = useState<boolean>(false); // Added state

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
  const [ifcApi, setIfcApi] = useState<IfcAPI | null>(null);

  // Helper to get all elements from a spatial tree structure
  const getAllElementsFromSpatialTreeNodes = (
    nodes: SpatialStructureNode[]
  ): SpatialStructureNode[] => {
    let elements: SpatialStructureNode[] = [];
    for (const node of nodes) {
      elements.push(node);
      if (node.children && node.children.length > 0) {
        elements = elements.concat(
          getAllElementsFromSpatialTreeNodes(node.children)
        );
      }
    }
    return elements;
  };

  // Helper to generate a unique ID for loaded files
  const generateFileId = () =>
    `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const commonLoadLogic = (
    url: string,
    name: string,
    fileIdToUse?: string
  ): LoadedModelData => {
    const id = fileIdToUse || generateFileId();
    const newLoadedModelEntry: LoadedModelData = {
      id,
      name,
      url,
      modelID: null, // Will be set by IFCModel after ifcAPI.OpenModel()
      spatialTree: null,
    };
    // Reset selection and properties when a model is added/replaced
    setSelectedElement(null);
    setElementProperties(null);
    setHighlightedElements([]);
    // availableCategories will be reset per model by IFCModel
    return newLoadedModelEntry;
  };

  const replaceIFCModel = useCallback(
    async (
      url: string,
      name: string,
      fileId?: string
    ): Promise<number | null> => {
      // If there are existing models, Close them first if using a single ifcApi instance OpenModel might overwrite
      // However, OpenModel is designed to return unique modelIDs. So, direct replacement is fine.
      // We just need to ensure the old model's resources (like three.js meshes) are cleaned up by the component managing it.
      const newEntry = commonLoadLogic(url, name, fileId);
      setLoadedModels([newEntry]);
      // The actual ifcAPI.OpenModel will happen in IFCModel component and modelID will be set via setModelIDForLoadedModel
      return null; // Placeholder, modelID will be known later
    },
    []
  );

  const addIFCModel = useCallback(
    async (
      url: string,
      name: string,
      fileId?: string
    ): Promise<number | null> => {
      const newEntry = commonLoadLogic(url, name, fileId);
      setLoadedModels((prev) => [...prev, newEntry]);
      return null; // Placeholder, modelID will be known later
    },
    []
  );

  const removeIFCModel = useCallback(
    (id: string) => {
      setLoadedModels((prev) =>
        prev.filter((m) => {
          if (m.id === id && m.modelID !== null && ifcApi) {
            try {
              ifcApi.CloseModel(m.modelID);
              console.log(
                `Context: Closed IFC model ID ${m.modelID} for loaded model ${id}`
              );
            } catch (e) {
              console.error(
                `Context: Error closing IFC model ID ${m.modelID} for ${id}`,
                e
              );
            }
            // Clear categories for the removed model
            setAvailableCategories((prevCats) => {
              const newCats = { ...prevCats };
              if (m.modelID) delete newCats[m.modelID];
              return newCats;
            });
          }
          return m.id !== id;
        })
      );
      // If the removed model contained the selected element, clear selection
      if (
        selectedElement &&
        loadedModels.find((m) => m.id === id)?.modelID ===
        selectedElement.modelID
      ) {
        setSelectedElement(null);
        setElementProperties(null);
      }
    },
    [ifcApi, selectedElement, loadedModels]
  );

  const setModelIDForLoadedModel = useCallback(
    (loadedModelId: string, ifcModelId: number) => {
      setLoadedModels((prev) =>
        prev.map((m) =>
          m.id === loadedModelId ? { ...m, modelID: ifcModelId } : m
        )
      );
    },
    []
  );

  const setSpatialTreeForModel = useCallback(
    (modelID: number, tree: SpatialStructureNode | null) => {
      setLoadedModels((prevModels) =>
        prevModels.map((m) =>
          m.modelID === modelID ? { ...m, spatialTree: tree } : m
        )
      );
    },
    []
  );

  const selectElementAndProperties = useCallback(
    (selection: SelectedElementInfo | null) => {
      setSelectedElement(selection);
      setHighlightedElements([]);
      setHighlightedClassificationCode(null);
      setShowAllClassificationColors(false); // Also turn off global colors on new selection
      if (!selection) {
        setElementProperties(null); // Clear properties if deselected
      }
      // Property fetching will be handled by useEffect in IFCModel.tsx based on selectedElement change.
    },
    []
  );

  const setAvailableCategoriesForModel = useCallback(
    (modelID: number, categories: string[]) => {
      setAvailableCategories((prev) => ({ ...prev, [modelID]: categories }));
    },
    []
  );

  // Classification and Rule functions (can remain global as they are not model-specific for now)
  const addClassification = (classification: any) => {
    setClassifications((prev) => ({
      ...prev,
      [classification.code]: classification,
    }));
  };
  const removeClassification = (code: string) => {
    const updated = { ...classifications };
    delete updated[code];
    setClassifications(updated);
  };
  const updateClassification = (code: string, classification: any) => {
    setClassifications((prev) => ({ ...prev, [code]: classification }));
  };
  const addRule = (rule: Rule) => {
    setRules((prev) => [...prev, rule]);
  };
  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };
  const updateRule = (updatedRule: Rule) => {
    setRules((prev) =>
      prev.map((r) => (r.id === updatedRule.id ? updatedRule : r))
    );
  };
  const applyRule = async (id: string) => {
    if (!ifcApi) {
      console.error("IFC API not available.");
      return;
    }

    const rule = rules.find((r) => r.id === id);
    if (!rule) {
      console.error(`Rule with id ${id} not found.`);
      return;
    }

    const targetClass = classifications[rule.classificationCode];
    if (!targetClass) {
      console.error(
        `Classification with code ${rule.classificationCode} not found.`
      );
      return;
    }

    const newElements: SelectedElementInfo[] = [];

    // Helper function to check if a single element matches all conditions of a rule
    const matchesAllConditions = async (
      elementNode: SpatialStructureNode,
      conditions: RuleCondition[],
      modelID: number,
      api: IfcAPI
    ): Promise<boolean> => {
      for (const condition of conditions) {
        let elementValue: any;
        const ruleValue = condition.value;

        // Get element type from spatial tree if available, otherwise fetch
        if (condition.property === "ifcType") {
          elementValue = elementNode.type; // Already a string like "IFCWALL"
        } else if (condition.property === "name") {
          // Get element name from spatial tree if available, otherwise fetch
          elementValue = elementNode.Name?.value || elementNode.Name; // Name might be direct or in .value
          if (elementValue === undefined && elementNode.expressID) {
            // Fallback to fetching if not in spatial tree node
            try {
              const props = await api.GetLine(modelID, elementNode.expressID);
              elementValue = props.Name?.value;
            } catch (e) {
              console.warn(
                `Error fetching name for ${elementNode.expressID}:`,
                e
              );
              return false; // Cannot evaluate condition
            }
          }
        } else if (condition.property.startsWith("Pset_")) {
          const [psetName, propName] = condition.property.split(".");
          if (!psetName || !propName) {
            console.warn("Invalid Pset property format:", condition.property);
            return false;
          }
          try {
            const psets = await api.properties.getPropertySets(
              modelID,
              elementNode.expressID,
              true // Get related properties
            );
            const targetPset = psets.find(
              (pset: any) => pset.Name?.value === psetName
            );
            if (targetPset) {
              const targetProp = targetPset.HasProperties?.find(
                (prop: any) => prop.Name?.value === propName
              );
              if (targetProp) {
                // Value can be in NominalValue or directly
                elementValue =
                  targetProp.NominalValue?.value !== undefined
                    ? targetProp.NominalValue.value
                    : targetProp.NominalValue; // Handle direct values like numbers/booleans or wrapped
              }
            }
          } catch (e) {
            console.warn(
              `Error fetching Pset ${condition.property} for ${elementNode.expressID}:`,
              e
            );
            // If property not found, it might not match, or it's an error.
            // For now, let's assume it means the condition can't be met if there's an error or it's not found.
            // Depending on strictness, one might want to `return false;` here.
            // If elementValue remains undefined, it won't match most conditions.
          }
        } else {
          // Potentially handle other direct properties from GetLine if needed
          // Or properties from elementNode if they were pre-fetched into spatialTree
          console.warn("Unsupported property:", condition.property);
          return false;
        }

        // Normalize values for comparison (e.g., strings to lowercase for case-insensitive)
        const normElementValue =
          typeof elementValue === "string"
            ? elementValue.toLowerCase()
            : elementValue;
        const normRuleValue =
          typeof ruleValue === "string" ? ruleValue.toLowerCase() : ruleValue;

        let conditionMet = false;
        switch (condition.operator) {
          case "equals":
            // For booleans, "true" (string) should match true (boolean)
            if (typeof normElementValue === 'boolean' && typeof normRuleValue === 'string') {
              conditionMet = normElementValue === (normRuleValue === 'true');
            } else {
              conditionMet = normElementValue === normRuleValue;
            }
            break;
          case "notEquals":
            if (typeof normElementValue === 'boolean' && typeof normRuleValue === 'string') {
              conditionMet = normElementValue !== (normRuleValue === 'true');
            } else {
              conditionMet = normElementValue !== normRuleValue;
            }
            break;
          case "contains":
            if (
              typeof normElementValue === "string" &&
              typeof normRuleValue === "string"
            ) {
              conditionMet = normElementValue.includes(normRuleValue);
            }
            break;
          // Add other operators as needed: greaterThan, lessThan, etc.
          default:
            console.warn("Unsupported operator:", condition.operator);
            return false; // Or throw error
        }

        if (!conditionMet) {
          return false; // If any condition is not met, the rule doesn't apply
        }
      }
      return true; // All conditions met
    };

    for (const model of loadedModels) {
      if (model.modelID == null || !model.spatialTree) {
        console.warn(
          `Skipping model ${model.name} as modelID or spatialTree is not available.`
        );
        continue;
      }

      const allModelElements = getAllElementsFromSpatialTreeNodes([
        model.spatialTree,
      ]);

      for (const elementNode of allModelElements) {
        if (elementNode.expressID === undefined) continue; // Skip nodes without expressID (e.g. project root)

        try {
          const matches = await matchesAllConditions(
            elementNode,
            rule.conditions,
            model.modelID,
            ifcApi
          );
          if (matches) {
            const elementInfo: SelectedElementInfo = {
              modelID: model.modelID,
              expressID: elementNode.expressID,
            };
            // Avoid duplicates
            if (
              !newElements.some(
                (el) =>
                  el.modelID === elementInfo.modelID &&
                  el.expressID === elementInfo.expressID
              )
            ) {
              newElements.push(elementInfo);
            }
          }
        } catch (error) {
          console.error(
            `Error processing element ${elementNode.expressID} in model ${model.modelID}:`,
            error
          );
        }
      }
    }

    updateClassification(rule.classificationCode, {
      ...targetClass,
      elements: newElements,
    });

    console.log(
      `Applied rule "${rule.name}". Found ${newElements.length} elements for classification "${targetClass.name}".`
    );
  };

  const applyRuleToClassification = (
    ruleId: string,
    classificationCode: string
  ) => {
    /* ... global logic ... */
  };

  const clearHighlights = () => {
    setHighlightedElements([]);
  };

  const toggleClassificationHighlight = (classificationCode: string) => {
    if (highlightedClassificationCode === classificationCode) {
      // Toggle off
      setHighlightedClassificationCode(null);
      setHighlightedElements([]);
    } else {
      // Toggle on or switch to this one
      const classification = classifications[classificationCode];
      if (classification && classification.elements) {
        setHighlightedClassificationCode(classificationCode);
        setHighlightedElements(classification.elements);
        setShowAllClassificationColors(false); // Turn off global colors if a single one is activated
      } else {
        setHighlightedClassificationCode(null);
        setHighlightedElements([]);
        console.warn(`Classification ${classificationCode} or its elements not found for highlight.`);
      }
    }
  };

  const toggleShowAllClassificationColors = () => {
    setShowAllClassificationColors(prev => {
      const newShowAllState = !prev;
      if (newShowAllState) {
        // If turning ON global colors, turn OFF single highlight
        setHighlightedClassificationCode(null);
        setHighlightedElements([]);
      }
      return newShowAllState;
    });
  };

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
        ifcApi,
        highlightedClassificationCode,
        showAllClassificationColors,
        replaceIFCModel,
        addIFCModel,
        removeIFCModel,
        setModelIDForLoadedModel,
        setSpatialTreeForModel,
        selectElement: selectElementAndProperties,
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
        applyRule,
        applyRuleToClassification,
        clearHighlights,
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
