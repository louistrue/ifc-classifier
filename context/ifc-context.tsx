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
  highlightElements: (elements: SelectedElementInfo[]) => void;
  setElementProperties: (properties: any | null) => void;
  setAvailableCategoriesForModel: (
    modelID: number,
    categories: string[]
  ) => void;
  setIfcApi: (api: IfcAPI) => void;

  // Classification and Rule methods (can remain global or be refactored later if needed per model)
  addClassification: (classification: any) => void;
  removeClassification: (code: string) => void;
  updateClassification: (code: string, classification: any) => void;
  addRule: (rule: Rule) => void;
  removeRule: (id: string) => void;
  updateRule: (rule: Rule) => void;
  applyRule: (id: string) => void;
  applyRuleToClassification: (
    ruleId: string,
    classificationCode: string
  ) => void;
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
  const applyRule = (id: string) => {
    /* ... global logic ... */
  };
  const applyRuleToClassification = (
    ruleId: string,
    classificationCode: string
  ) => {
    /* ... global logic ... */
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
        replaceIFCModel,
        addIFCModel,
        removeIFCModel,
        setModelIDForLoadedModel,
        setSpatialTreeForModel,
        selectElement: selectElementAndProperties,
        highlightElements: setHighlightedElements, // Direct pass-through
        setElementProperties,
        setAvailableCategoriesForModel,
        setIfcApi,
        addClassification,
        removeClassification,
        updateClassification,
        addRule,
        removeRule,
        updateRule,
        applyRule,
        applyRuleToClassification,
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
