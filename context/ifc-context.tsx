"use client";

import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { IfcAPI } from "web-ifc"; // Import IfcAPI type
import { Properties } from "web-ifc"; // Ensure Properties is imported
import { getAllElementProperties, ParsedElementProperties } from "@/services/ifc-properties";
import { IFCElementExtractor } from "@/services/ifc-element-extractor";
import { PropertyCache } from "@/services/property-cache";
import { parseRulesFromExcel } from "@/services/rule-import-service";
import { exportRulesToExcel } from "@/services/rule-export-service";
import { exportClassificationsToExcel } from "@/services/classification-export-service";
import { parseClassificationsFromExcel } from "@/services/classification-import-service";
import { getBufferedConsole, type ConsoleUpdate } from "@/services/buffered-console-service";

// Define interfaces for progress tracking
export interface RuleProgress {
  active: boolean;
  percent: number;
  status: string;
  logs: string[];
  matchCount: number;
}

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
  matchType?: "all" | "any"; // how to combine conditions (AND/OR)
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
  rawBuffer: ArrayBuffer | null; // Raw IFC file buffer
  // Potentially add other per-model states here if needed, like categories, classifications etc.
  // For now, classifications and rules will be global.
}

// Type for selected element, now includes modelID
export interface SelectedElementInfo {
  modelID: number;
  expressID: number;
}

export interface ClassificationItem {
  code: string;
  name: string;
  color: string;
  elements?: SelectedElementInfo[];
}

interface IFCContextType {
  loadedModels: LoadedModelData[]; // Array of loaded models
  selectedElement: SelectedElementInfo | null;
  selectedElements: SelectedElementInfo[];
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
  availableProperties: string[]; // Collected property names for rule building
  setAvailableProperties: (props: string[]) => void;
  baseCoordinationMatrix: number[] | null; // Base matrix for aligning multiple models
  setBaseCoordinationMatrix: (matrix: number[] | null) => void;
  naturalIfcClassNames: Record<
    string,
    { en: string; de: string; schema?: string }
  > | null; // Added schema to type
  getNaturalIfcClassName: (
    ifcClass: string | null,
    lang?: "en" | "de",
  ) => { name: string; schemaUrl?: string }; // Updated return type

  replaceIFCModel: (
    url: string,
    name: string,
    fileId?: string,
  ) => Promise<number | null>; // Returns modelID or null
  addIFCModel: (
    url: string,
    name: string,
    fileId?: string,
  ) => Promise<number | null>; // Returns modelID or null
  removeIFCModel: (id: string) => void; // id is LoadedModelData.id
  setModelIDForLoadedModel: (loadedModelId: string, ifcModelId: number) => void;
  setSpatialTreeForModel: (
    modelID: number,
    tree: SpatialStructureNode | null,
  ) => void;
  setRawBufferForModel: (id: string, buffer: ArrayBuffer) => void; // Keep this one

  selectElement: (selection: SelectedElementInfo | null) => void;
  selectElements: (selection: SelectedElementInfo[]) => void;
  toggleElementSelection: (element: SelectedElementInfo, additive: boolean) => void;
  clearSelection: () => void;
  toggleClassificationHighlight: (classificationCode: string) => void;
  setElementProperties: (properties: any | null) => void;
  setAvailableCategoriesForModel: (
    modelID: number,
    categories: string[],
  ) => void;
  setIfcApi: (api: IfcAPI | null) => void;
  getElementPropertiesCached: (
    modelID: number,
    expressID: number,
  ) => Promise<ParsedElementProperties | null>;
  toggleShowAllClassificationColors: () => void; // Added new toggle function

  // Classification and Rule methods (can remain global or be refactored later if needed per model)
  addClassification: (classification: any) => void;
  removeClassification: (code: string) => void;
  removeAllClassifications: () => void;
  updateClassification: (code: string, classification: any) => void;
  addRule: (rule: Rule) => void;
  removeRule: (id: string) => void;
  updateRule: (rule: Rule) => void;
  previewRuleHighlight: (ruleId: string) => Promise<void>;
  applyRulesManually: () => Promise<void>;

  exportClassificationsAsJson: () => string;
  importClassificationsFromJson: (json: string) => void;
  exportClassificationsAsExcel: () => ArrayBuffer;
  importClassificationsFromExcel: (file: File) => Promise<void>;
  exportRulesAsJson: () => string;
  exportRulesAsExcel: () => ArrayBuffer;
  importRulesFromJson: (json: string) => void;
  importRulesFromExcel: (file: File) => Promise<void>;
  removeAllRules: () => void;

  assignClassificationToElement: (
    classificationCode: string,
    element: SelectedElementInfo,
  ) => void;
  unassignClassificationFromElement: (
    classificationCode: string,
    element: SelectedElementInfo,
  ) => void;
  unassignElementFromAllClassifications: (element: SelectedElementInfo) => void;

  toggleUserHideElement: (element: SelectedElementInfo) => void; // New function
  unhideLastElement: () => void; // New function
  unhideAllElements: () => void; // New function
  hiddenModelIds: string[];
  toggleModelVisibility: (modelId: string) => void;
  hideElements: (elements: SelectedElementInfo[]) => void;
  showElements: (elements: SelectedElementInfo[]) => void;
  getClassificationsForElement: (
    element: SelectedElementInfo | null,
  ) => ClassificationItem[];
  isolateUnclassified: boolean;
  toggleIsolateUnclassified: () => void;
  mapClassificationsFromModel: (
    psetName: string,
    propertyName: string,
  ) => Promise<void>;

  // Rule application progress (for UX feedback)
  ruleProgress: RuleProgress;


}

const IFCContext = createContext<IFCContextType | undefined>(undefined);

export function IFCContextProvider({ children }: { children: ReactNode }) {
  const [loadedModels, setLoadedModels] = useState<LoadedModelData[]>([]);
  const [selectedElement, setSelectedElement] =
    useState<SelectedElementInfo | null>(null);
  const [selectedElements, setSelectedElements] = useState<SelectedElementInfo[]>([]);
  const [highlightedElements, setHighlightedElements] = useState<
    SelectedElementInfo[]
  >([]);
  const [elementProperties, setElementPropertiesInternal] = useState<
    any | null
  >(null);
  const [availableCategories, setAvailableCategoriesInternal] = useState<
    Record<number, string[]>
  >({});
  const [highlightedClassificationCode, setHighlightedClassificationCode] =
    useState<string | null>(null);
  const [showAllClassificationColors, setShowAllClassificationColors] =
    useState<boolean>(false);
  const [previewingRuleId, setPreviewingRuleId] = useState<string | null>(null); // Added state
  const [isolateUnclassified, setIsolateUnclassified] = useState<boolean>(false);
  const [isolationHiddenElements, setIsolationHiddenElements] = useState<
    SelectedElementInfo[]
  >([]);
  const [userHiddenElements, setUserHiddenElements] = useState<
    SelectedElementInfo[]
  >([]); // New state
  const [hiddenModelIds, setHiddenModelIds] = useState<string[]>([]);
  const [availableProperties, setAvailablePropertiesInternal] = useState<
    string[]
  >([]);
  const [naturalIfcClassNames, setNaturalIfcClassNames] = useState<Record<
    string,
    { en: string; de: string; schema?: string }
  > | null>(null); // Added schema to state type
  const [baseCoordinationMatrix, setBaseCoordinationMatrix] = useState<
    number[] | null
  >(null);

  // Rule application progress state (for UI feedback)
  const [ruleProgress, setRuleProgress] = useState<RuleProgress>({
    active: false,
    percent: 0,
    status: "",
    logs: [],
    matchCount: 0,
  });

  // Buffered console for performance
  const bufferedConsole = useRef(getBufferedConsole());

  // Subscribe to buffered console updates
  useEffect(() => {
    const unsubscribe = bufferedConsole.current.subscribe((update: ConsoleUpdate) => {
      // Only show as active if we have a meaningful status (rule processing has started)
      const isActive = update.percent < 100 && Boolean(update.status && update.status.trim() !== "");

      setRuleProgress({
        active: isActive,
        percent: update.percent,
        status: update.status,
        logs: update.logs,
        matchCount: update.matchCount || 0,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Initialize classifications with a default entry
  const [classifications, setClassifications] = useState<Record<string, any>>({
    // DEFAULT_CLASS: {
    //   id: "DEFAULT_CLASS", // Using code as id for consistency, or generate uuid
    //   code: "DEFAULT_CLASS",
    //   name: "Default Classification",
    //   description: "This is a default classification provided by the system.",
    //   color: "#4caf50", // A pleasant green color
    //   elements: [], // Initially no elements assigned
    // },
  });
  const [rules, setRules] = useState<Rule[]>([]);
  const [ifcApiInternal, setIfcApiInternal] = useState<IfcAPI | null>(null);
  const elementPropsCache = useRef<Map<number, Map<number, ParsedElementProperties>>>(new Map());

  // Fetch natural IFC class names
  useEffect(() => {
    const fetchNaturalNames = async () => {
      try {
        // Use external version of IFC class data with buildingSMART URLs
        const response = await fetch("/data/natural_ifcclass.json");
        if (!response.ok) {
          throw new Error(
            `Failed to fetch natural_ifcclass.json: ${response.statusText}`,
          );
        }
        const data = await response.json();
        setNaturalIfcClassNames(data);
        console.log("IFCContext: Natural IFC class names loaded with external schema URLs.", data);
      } catch (error) {
        console.error(
          "IFCContext: Error loading natural IFC class names:",
          error,
        );
        setNaturalIfcClassNames({}); // Set to empty object on error to prevent repeated attempts
      }
    };
    fetchNaturalNames();
  }, []); // Fetch only once on mount

  // Helper function to get natural IFC class name and schema URL
  const getNaturalIfcClassName = useCallback(
    (
      ifcClass: string | null,
      lang: "en" | "de" = "en",
    ): { name: string; schemaUrl?: string } => {
      if (!ifcClass) return { name: "Unknown Type", schemaUrl: undefined };

      if (naturalIfcClassNames) {
        // Attempt direct lookup first
        if (naturalIfcClassNames[ifcClass]) {
          return {
            name: naturalIfcClassNames[ifcClass][lang] || ifcClass,
            schemaUrl: naturalIfcClassNames[ifcClass].schema,
          };
        }
        // Fallback for case-insensitive lookup
        const lowerIfcClass = ifcClass.toLowerCase();
        for (const key in naturalIfcClassNames) {
          if (Object.prototype.hasOwnProperty.call(naturalIfcClassNames, key)) {
            if (key.toLowerCase() === lowerIfcClass) {
              return {
                name: naturalIfcClassNames[key][lang] || ifcClass,
                schemaUrl: naturalIfcClassNames[key].schema,
              };
            }
          }
        }
      }

      // Fallback to stripping "Ifc" prefix if no natural name found
      if (ifcClass.toLowerCase().startsWith("ifc")) {
        return { name: ifcClass.substring(3), schemaUrl: undefined };
      }
      // Default to original name if no mapping or prefix stripping applies
      return { name: ifcClass, schemaUrl: undefined };
    },
    [naturalIfcClassNames],
  );

  // Effect to collect and set available properties from all loaded models
  useEffect(() => {
    const fetchAllProperties = async () => {
      if (!ifcApiInternal) return;

      if (!ifcApiInternal.properties) {
        try {
          ifcApiInternal.properties = new Properties(ifcApiInternal);
        } catch (e) {
          console.error(
            "IFCContext: Failed to initialize ifcApi.properties",
            e,
          );
          return;
        }
      }

      const allProps = new Set<string>();
      // Add common/direct properties (instance or type)
      allProps.add("Ifc Class"); // Renamed from ifcType, refers to entity type like IFCWALL
      allProps.add("Name");
      allProps.add("GlobalId");
      allProps.add("Description");
      allProps.add("ObjectType");
      allProps.add("Tag");
      allProps.add("PredefinedType"); // Common for many IfcElementType entities

      for (const model of loadedModels) {
        // Ensure modelID is present and the model is actually open with the current API instance
        if (
          model.modelID === null ||
          !ifcApiInternal ||
          !ifcApiInternal.IsModelOpen(model.modelID)
        ) {
          continue;
        }

        if (ifcApiInternal.properties) {
          // Ensure properties helper is available on the API instance
          try {
            // Get all property set types to find property sets in the model
            const psetTypeCode = ifcApiInternal.GetTypeCodeFromName("IFCPROPERTYSET");
            const psetIds = await ifcApiInternal.GetLineIDsWithType(model.modelID, psetTypeCode);

            // Process each property set
            for (let i = 0; i < psetIds.size(); i++) {
              const psetId = psetIds.get(i);
              try {
                const pset = await ifcApiInternal.GetLine(model.modelID, psetId, true);
                if (pset && pset.Name?.value && pset.HasProperties) {
                  const psetName = pset.Name.value;
                  if (Array.isArray(pset.HasProperties)) {
                    for (const prop of pset.HasProperties) {
                      if (prop.Name?.value) {
                        allProps.add(`${psetName}.${prop.Name.value}`);
                      }
                    }
                  }
                }
              } catch (e) {
                // Skip individual property sets that fail
                console.debug(`Skipping property set ${psetId}:`, e);
              }
            }

            // Also check property sets that are related through IFCRELDEFINESBYPROPERTIES
            try {
              const relDefinesByPropsTypeCode = ifcApiInternal.GetTypeCodeFromName("IFCRELDEFINESBYPROPERTIES");
              const relIds = await ifcApiInternal.GetLineIDsWithType(model.modelID, relDefinesByPropsTypeCode);

              const processedPsets = new Set<number>(); // To avoid processing the same pset multiple times

              for (let i = 0; i < relIds.size(); i++) {
                const relId = relIds.get(i);
                try {
                  const rel = await ifcApiInternal.GetLine(model.modelID, relId, false);

                  if (rel.RelatingPropertyDefinition?.value && !processedPsets.has(rel.RelatingPropertyDefinition.value)) {
                    processedPsets.add(rel.RelatingPropertyDefinition.value);

                    try {
                      const pset = await ifcApiInternal.GetLine(model.modelID, rel.RelatingPropertyDefinition.value, true);
                      if (pset && pset.Name?.value && pset.HasProperties) {
                        const psetName = pset.Name.value;
                        if (Array.isArray(pset.HasProperties)) {
                          for (const prop of pset.HasProperties) {
                            if (prop.Name?.value) {
                              allProps.add(`${psetName}.${prop.Name.value}`);
                            }
                          }
                        }
                      }
                    } catch (e) {
                      console.debug(`Skipping related property set:`, e);
                    }
                  }
                } catch (e) {
                  console.debug(`Skipping relationship ${relId}:`, e);
                }
              }
            } catch (e) {
              console.debug(`Error processing property relationships:`, e);
            }

            // Also get properties from element types
            const elementTypes = [
              "IFCWALLTYPE", "IFCSLABTYPE", "IFCDOORTYPE", "IFCWINDOWTYPE",
              "IFCCOLUMNTYPE", "IFCBEAMTYPE", "IFCPLATETYPE", "IFCMEMBERTYPE",
              "IFCRAILINGTYPE", "IFCSTAIRTYPE", "IFCRAMPTYPE", "IFCROOFTYPE",
              "IFCCURTAINWALLTYPE", "IFCBUILDINGTYPE", "IFCSPACETYPE"
            ];

            for (const typeName of elementTypes) {
              try {
                const typeCode = ifcApiInternal.GetTypeCodeFromName(typeName);
                const typeIds = await ifcApiInternal.GetLineIDsWithType(model.modelID, typeCode);

                for (let i = 0; i < typeIds.size(); i++) {
                  const typeId = typeIds.get(i);
                  try {
                    const typeObj = await ifcApiInternal.GetLine(model.modelID, typeId, true);

                    // Add direct type properties
                    if (typeObj.Name?.value) allProps.add("Name");
                    if (typeObj.GlobalId?.value) allProps.add("GlobalId");
                    if (typeObj.Description?.value) allProps.add("Description");
                    if (typeObj.ObjectType?.value) allProps.add("ObjectType");
                    if (typeObj.Tag?.value) allProps.add("Tag");
                    if (typeObj.PredefinedType?.value) allProps.add("PredefinedType");

                    // Process property sets attached to types
                    if (typeObj.HasPropertySets && Array.isArray(typeObj.HasPropertySets)) {
                      for (const psetRef of typeObj.HasPropertySets) {
                        if (psetRef?.value) {
                          try {
                            const pset = await ifcApiInternal.GetLine(model.modelID, psetRef.value, true);
                            if (pset && pset.Name?.value && pset.HasProperties) {
                              const psetName = pset.Name.value;
                              if (Array.isArray(pset.HasProperties)) {
                                for (const prop of pset.HasProperties) {
                                  if (prop.Name?.value) {
                                    allProps.add(`${psetName}.${prop.Name.value}`);
                                  }
                                }
                              }
                            }
                          } catch (e) {
                            console.debug(`Skipping type property set:`, e);
                          }
                        }
                      }
                    }
                  } catch (e) {
                    console.debug(`Skipping type ${typeId}:`, e);
                  }
                }
              } catch (e) {
                console.debug(`Skipping type ${typeName}:`, e);
              }
            }
          } catch (error) {
            console.error(
              `Error fetching properties for model ${model.modelID}:`,
              error,
            );
          }
        }
      }
      const sortedProps = Array.from(allProps).sort();
      setAvailablePropertiesInternal(sortedProps);
      if (sortedProps.length > 0) {
        console.log(
          "IFCContext: Updated available properties for rule creation:",
          sortedProps,
        );
      }
    };

    fetchAllProperties();
  }, [loadedModels, ifcApiInternal]); // Re-run when models or API instance changes

  // Helper to get all elements from a spatial tree structure
  const getAllElementsFromSpatialTreeNodesRecursive = useCallback(
    (nodes: SpatialStructureNode[]): SpatialStructureNode[] => {
      let elements: SpatialStructureNode[] = [];
      for (const node of nodes) {
        elements.push(node);
        if (node.children && node.children.length > 0) {
          elements = elements.concat(
            getAllElementsFromSpatialTreeNodesRecursive(node.children),
          );
        }
      }
      return elements;
    },
    [],
  );

  const matchesAllConditionsCallback = useCallback(
    async (
      elementNode: SpatialStructureNode,
      conditions: RuleCondition[],
      matchType: "all" | "any",
      modelID: number,
      api: IfcAPI, // Passed explicitly, not from context state directly in this func
    ): Promise<boolean> => {
      if (!api.properties) {
        console.warn(
          "API properties not initialized in matchesAllConditionsCallback",
        );
        return false;
      }

      let itemProps: ParsedElementProperties | null = null; // To store properties fetched for the element

      for (const condition of conditions) {
        let elementValue: any;
        const ruleValue = condition.value;

        if (condition.property === "Ifc Class") {
          elementValue = elementNode.type;
        } else {
          // Fetch all element properties once if not already fetched for this element
          if (itemProps === null && elementNode.expressID) {
            try {
              itemProps = await getAllElementProperties(
                api,
                modelID,
                elementNode.expressID,
              );
            } catch (e) {
              console.warn(
                `Error fetching element properties for ${elementNode.expressID}:`,
                e,
              );
              return false; // If properties can't be fetched, condition can't be reliably checked
            }
          }

          if (!itemProps) {
            // Should not happen if expressID is valid and getAllElementProperties was called
            console.warn(
              `No properties available for ${elementNode.expressID} to check ${condition.property}`,
            );
            return false;
          }

          if (condition.property.includes(".")) {
            // Handle PSet-like properties (e.g., "Pset_WallCommon.Reference", "Material.Density")
            const [psetName, propName] = condition.property.split(".");
            if (!psetName || !propName) {
              console.warn("Invalid Pset property format:", condition.property);
              return false;
            }

            const propertySets = itemProps.propertySets || {};

            // 1) Direct match by exact PSet name
            let candidate: any = propertySets[psetName]?.[propName];

            // 2) If not found, try type-derived PSets (e.g., "Pset_WallCommon (from Type: …)")
            if (candidate === undefined) {
              for (const [groupName, groupProps] of Object.entries(propertySets)) {
                if (
                  groupName === psetName ||
                  groupName.startsWith(psetName + " (from Type:")
                ) {
                  const val = (groupProps as any)?.[propName];
                  if (val !== undefined) {
                    candidate = val;
                    break;
                  }
                }
              }
            }

            // 3) Support generic material groups (Material, LayerSet, MaterialList, etc.)
            if (candidate === undefined) {
              const lowerPset = psetName.toLowerCase();
              const isMaterialGroup =
                lowerPset === "material" ||
                lowerPset === "layerset" ||
                lowerPset === "materiallist" ||
                lowerPset === "material properties" ||
                lowerPset === "materialinfo";
              if (isMaterialGroup) {
                for (const [groupName, groupProps] of Object.entries(propertySets)) {
                  const gLower = groupName.toLowerCase();
                  if (
                    gLower.startsWith("material") ||
                    gLower.startsWith("layerset") ||
                    gLower.startsWith("materiallist") ||
                    gLower.startsWith("material properties") ||
                    gLower.startsWith("materialinfo")
                  ) {
                    const val = (groupProps as any)?.[propName];
                    if (val !== undefined) {
                      candidate = val;
                      console.log(`Found material property ${propName} in ${groupName}: ${val}`);
                      break;
                    }
                  }
                }
              }
            }

            if (candidate !== undefined) {
              elementValue = candidate;
              if (
                typeof elementValue === "object" &&
                elementValue !== null &&
                ("value" in elementValue)
              ) {
                elementValue = (elementValue as any).value;
              }
            }
          } else {
            // Handle direct attributes (e.g., "Name", "GlobalId", "Description")
            // First check the attributes from getAllElementProperties
            const attributes = itemProps.attributes || itemProps.propertySets?.["Element Attributes"];
            if (attributes && attributes[condition.property] !== undefined) {
              elementValue = attributes[condition.property];
              // Handle value objects
              if (typeof elementValue === 'object' && elementValue !== null && 'value' in elementValue) {
                elementValue = elementValue.value;
              }
            } else if (elementNode[condition.property]) {
              // Fallback to spatial tree node properties
              const nodeProp = elementNode[condition.property];
              if (nodeProp?.hasOwnProperty("value")) {
                elementValue = nodeProp.value;
              } else {
                elementValue = nodeProp;
              }
            }
          }
        }

        // Existing normalization and comparison logic
        // Normalize values for comparison
        // For IFC Class, both should already be uppercase, for others use lowercase
        const normElementValue =
          condition.property === "Ifc Class"
            ? (typeof elementValue === "string" ? elementValue.toUpperCase() : elementValue)
            : (typeof elementValue === "string" ? elementValue.toLowerCase() : elementValue);
        const normRuleValue =
          condition.property === "Ifc Class"
            ? (typeof ruleValue === "string" ? ruleValue.toUpperCase() : ruleValue)
            : (typeof ruleValue === "string" ? ruleValue.toLowerCase() : ruleValue);


        let conditionMet = false;

        const convertToBoolean = (val: any): boolean | undefined => {
          if (typeof val === "boolean") return val;
          if (typeof val === "number") {
            if (val === 1) return true;
            if (val === 0) return false;
          }
          if (typeof val === "string") {
            if (["true", "yes", "1"].includes(val)) return true;
            if (["false", "no", "0"].includes(val)) return false;
          }
          return undefined;
        };

        const valFromElement = convertToBoolean(normElementValue);
        const valFromRule = convertToBoolean(normRuleValue); // normRuleValue is effectively always string from UI



        switch (condition.operator) {
          case "equals":
            if (valFromElement !== undefined && valFromRule !== undefined) {
              conditionMet = valFromElement === valFromRule;
            } else if (
              valFromElement !== undefined &&
              valFromRule === undefined
            ) {
              // Element is bool, rule is "cat"
              conditionMet = false;
            } else if (
              valFromElement === undefined &&
              valFromRule !== undefined
            ) {
              // Element is "dog", rule is "true"
              conditionMet = false;
            } else {
              // Both undefined as booleans, e.g. "dog" === "cat"
              conditionMet = normElementValue === normRuleValue;
            }

            break;
          case "notEquals":
            if (valFromElement !== undefined && valFromRule !== undefined) {
              conditionMet = valFromElement !== valFromRule;
            } else if (
              valFromElement !== undefined &&
              valFromRule === undefined
            ) {
              // Element is bool, rule is "cat" -> they are not equal
              conditionMet = true;
            } else if (
              valFromElement === undefined &&
              valFromRule !== undefined
            ) {
              // Element is "dog", rule is "true" -> they are not equal
              conditionMet = true;
            } else {
              // Both undefined as booleans, e.g. "dog" !== "cat"
              conditionMet = normElementValue !== normRuleValue;
            }

            break;
          case "contains":
            conditionMet =
              typeof normElementValue === "string" &&
              typeof normRuleValue === "string" &&
              normElementValue.includes(normRuleValue);

            break;
          case "greaterThan":
            {
              const numElementValue = parseFloat(String(normElementValue));
              const numRuleValue = parseFloat(String(normRuleValue));
              if (!isNaN(numElementValue) && !isNaN(numRuleValue)) {
                conditionMet = numElementValue > numRuleValue;
              } else {
                conditionMet = false;
              }
            }
            break;
          case "lessThan":
            {
              const numElementValue = parseFloat(String(normElementValue));
              const numRuleValue = parseFloat(String(normRuleValue));
              if (!isNaN(numElementValue) && !isNaN(numRuleValue)) {
                conditionMet = numElementValue < numRuleValue;
              } else {
                conditionMet = false;
              }
            }
            break;
          default:
            console.warn("Unsupported operator:", condition.operator);
            return false;
        }
        if (matchType === "all") {
          if (!conditionMet) return false;
        } else {
          if (conditionMet) return true;
        }
      }
      return matchType === "all" ? true : false;
    },
    [],
  );

  // Helper function to yield control back to the main thread
  const yieldToMainThread = () => {
    return new Promise(resolve => setTimeout(resolve, 0));
  };

  const applyAllActiveRules = useCallback(async () => {
    if (!ifcApiInternal) {
      console.log(
        "IFC API not available, skipping rule application that might need it.",
      );
      // Only clear elements if there are no models. Definitions should persist.
      if (loadedModels.length === 0) {
        setClassifications((prevClassifications) => {
          const newCleared = { ...prevClassifications };
          let actuallyClearedSomething = false;
          for (const code in newCleared) {
            if (
              newCleared[code] &&
              newCleared[code].elements &&
              newCleared[code].elements.length > 0
            ) {
              newCleared[code] = { ...newCleared[code], elements: [] };
              actuallyClearedSomething = true;
            }
          }
          if (actuallyClearedSomething) {
            console.log(
              "IFCContext: IFC API not available & no models: Ensured all classification elements are empty.",
            );
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
        console.error(
          "IFCContext: Failed to initialize ifcApi.properties in applyAllActiveRules",
          e,
        );
        return; // Cannot proceed without properties
      }
    }

    console.log("IFCContext: Applying all active rules...");
    // Clear and reset buffered console for new rule processing
    bufferedConsole.current.clear();
    bufferedConsole.current.updateProgress("Initializing...", 0, 0);
    bufferedConsole.current.forceFlush(); // Force immediate display

    // Yield to allow UI to update with initial progress
    await yieldToMainThread();

    // If no models are fully ready (have modelID and spatialTree),
    // just ensure all classification elements are empty and then return.
    if (
      loadedModels.filter((m) => m.modelID != null && m.spatialTree != null)
        .length === 0
    ) {
      setClassifications((prevClassifications) => {
        const newCleared = { ...prevClassifications };
        let actuallyClearedSomething = false;
        for (const code in newCleared) {
          if (
            newCleared[code] &&
            newCleared[code].elements &&
            newCleared[code].elements.length > 0
          ) {
            newCleared[code] = { ...newCleared[code], elements: [] };
            actuallyClearedSomething = true;
          }
        }
        if (actuallyClearedSomething) {
          console.log(
            "IFCContext: No models ready, ensured rule-based elements from classifications are empty.",
          );
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
    const currentClassificationCodes = Object.keys(
      currentClassificationsForProcessing,
    );
    const newElementsPerClassification: Record<string, SelectedElementInfo[]> =
      {};

    for (const classCode of currentClassificationCodes) {
      newElementsPerClassification[classCode] = [];
    }

    const activeRules = rules.filter(
      (rule) =>
        rule.active &&
        currentClassificationsForProcessing[rule.classificationCode],
    );

    // Minimal logging for performance
    console.log(`IFCContext: Applying ${activeRules.length} rules to ${loadedModels.length} models`);
    bufferedConsole.current.updateProgress(
      `${activeRules.length} rules, ${loadedModels.length} models`,
      5
    );
    bufferedConsole.current.forceFlush(); // Ensure immediate visibility

    // Responsive batch rule processing function with progress updates
    const processBatchRules = async (
      activeRules: Rule[],
      elementsByType: Map<string, Array<{ expressID: number; type: string; children: any[] }>>,
      allModelElements: Array<{ expressID: number; type: string; children: any[] }>,
      modelID: number,
      ifcApiInternal: IfcAPI,
      newElementsPerClassification: Record<string, SelectedElementInfo[]>,
      processedModels: number,
      totalModels: number
    ) => {
      // Group rules by their IFC Class conditions for batch processing
      const rulesByType = new Map<string, Rule[]>();
      const rulesWithoutTypeFilter: Rule[] = [];

      for (const rule of activeRules) {
        if (!newElementsPerClassification[rule.classificationCode]) {
          newElementsPerClassification[rule.classificationCode] = [];
        }

        const ifcClassConditions = rule.conditions.filter(c => c.property === "Ifc Class");

        if (ifcClassConditions.length === 0) {
          rulesWithoutTypeFilter.push(rule);
        } else {
          for (const condition of ifcClassConditions) {
            const targetType = String(condition.value).toUpperCase();
            if (!rulesByType.has(targetType)) {
              rulesByType.set(targetType, []);
            }
            rulesByType.get(targetType)!.push(rule);
          }
        }
      }

      // Process rules with type filters (FAST PATH)
      let processedRuleTypes = 0;
      const totalRuleTypes = rulesByType.size;
      let totalProcessed = 0;
      let totalToProcess = 0;

      // Calculate total elements to process for progress
      for (const [targetType, rules] of Array.from(rulesByType.entries())) {
        const candidateElements = elementsByType.get(targetType) || [];
        totalToProcess += candidateElements.length * rules.length;
      }

      for (const [targetType, rules] of Array.from(rulesByType.entries())) {
        const candidateElements = elementsByType.get(targetType) || [];
        processedRuleTypes++;

        // Update progress for this rule type
        const baseProgress = (processedModels / totalModels) * 90;
        const modelProgressRange = (1 / totalModels) * 90;
        const rulePhaseStart = baseProgress + (modelProgressRange * 0.8);
        const rulePhaseRange = modelProgressRange * 0.2;

        bufferedConsole.current.updateProgress(
          `Checking ${candidateElements.length} ${targetType.replace('IFC', 'Ifc')} elements...`,
          Math.round(rulePhaseStart + (rulePhaseRange * (totalProcessed / Math.max(1, totalToProcess))))
        );

        // Yield to allow UI update
        await yieldToMainThread();

        for (const rule of rules) {
          let processedElements = 0;
          for (const elementNode of candidateElements) {
            try {
              // NO LOGGING during processing for maximum performance

              // For simple IFC Class only rules, skip expensive property fetching
              const hasOnlyIfcClassConditions = rule.conditions.every((c: RuleCondition) => c.property === "Ifc Class");

              let matches = false;
              if (hasOnlyIfcClassConditions) {
                // SUPER FAST: Direct type matching without property fetching
                matches = rule.conditions.every((condition: RuleCondition) => {
                  if (condition.property === "Ifc Class") {
                    const elementType = elementNode.type.toUpperCase();
                    const ruleType = String(condition.value).toUpperCase();

                    if (condition.operator === "equals") {
                      return elementType === ruleType;
                    } else if (condition.operator === "contains") {
                      return elementType.includes(ruleType);
                    }
                  }
                  return false;
                });
              } else {
                // SLOWER PATH: Need to fetch properties
                matches = await matchesAllConditionsCallback(
                  elementNode,
                  rule.conditions,
                  rule.matchType ?? "all",
                  modelID,
                  ifcApiInternal,
                );
              }

              if (matches) {
                const elementInfo: SelectedElementInfo = {
                  modelID: modelID,
                  expressID: elementNode.expressID,
                };

                // Quick duplicate check
                const existing = newElementsPerClassification[rule.classificationCode];
                if (!existing.some(el => el.expressID === elementInfo.expressID)) {
                  existing.push(elementInfo);
                }

                // NO LOGGING during processing for maximum performance
              }
            } catch (error) {
              // Silent error handling for performance
            }

            processedElements++;
            totalProcessed++;

            // Update progress and yield more frequently for large sets
            if (processedElements % 1000 === 0 || (candidateElements.length > 10000 && processedElements % 500 === 0)) {
              const baseProgress = (processedModels / totalModels) * 90;
              const modelProgressRange = (1 / totalModels) * 90;
              const rulePhaseStart = baseProgress + (modelProgressRange * 0.8);
              const rulePhaseRange = modelProgressRange * 0.2;

              bufferedConsole.current.updateProgress(
                `Processing ${targetType.replace('IFC', 'Ifc')} (${processedElements}/${candidateElements.length})...`,
                Math.round(rulePhaseStart + (rulePhaseRange * (totalProcessed / Math.max(1, totalToProcess))))
              );
              await yieldToMainThread();
            }
          }
        }
      }

      // Process rules without type filters (slower path)
      for (const rule of rulesWithoutTypeFilter) {
        // Minimal progress update

        await yieldToMainThread();

        let processedElements = 0;
        for (const elementNode of allModelElements) {
          try {
            const matches = await matchesAllConditionsCallback(
              elementNode,
              rule.conditions,
              rule.matchType ?? "all",
              modelID,
              ifcApiInternal,
            );

            if (matches) {
              const elementInfo: SelectedElementInfo = {
                modelID: modelID,
                expressID: elementNode.expressID,
              };

              const existing = newElementsPerClassification[rule.classificationCode];
              if (!existing.some(el => el.expressID === elementInfo.expressID)) {
                existing.push(elementInfo);
              }
            }
          } catch (error) {
            // Silent error handling for performance
          }

          processedElements++;
          // Yield every 25 elements for slower path to keep UI responsive
          if (processedElements % 25 === 0) {
            await yieldToMainThread();
          }
        }
      }
    };

    let processedModels = 0;
    const totalModels = loadedModels.filter((m) => m.modelID != null).length || 1;

    for (const model of loadedModels) {
      if (model.modelID == null) continue;

      // Update progress for model processing - simplified
      const modelProgress = Math.round((processedModels / totalModels) * 90);
      bufferedConsole.current.updateProgress(
        `Model ${processedModels + 1}/${totalModels}`,
        modelProgress
      );

      await yieldToMainThread();

      // OPTIMIZED: Get ALL elements with progress reporting
      const allIfcElements = IFCElementExtractor.getAllElements(
        ifcApiInternal,
        model.modelID,
        (percent: number, message: string) => {
          // IFCElementExtractor already reports 0-80% so no further scaling is applied
          const baseProgress = (processedModels / totalModels) * 90;
          const modelProgressRange = (1 / totalModels) * 90;
          const currentProgress = baseProgress + (modelProgressRange * percent / 100);
          bufferedConsole.current.updateProgress(
            `Loading: ${message}`,
            Math.round(currentProgress)
          );
        }
      );

      // Convert to the expected format (optimized)
      const allModelElements = allIfcElements.map(element => ({
        expressID: element.expressID,
        type: element.type,
        children: [] // Not needed for rule matching
      }));

      // NO LOGGING - just process

      // Group elements by type for faster rule matching
      const elementsByType = new Map<string, typeof allModelElements>();
      for (const element of allModelElements) {
        const typeUpper = element.type.toUpperCase();
        if (!elementsByType.has(typeUpper)) {
          elementsByType.set(typeUpper, []);
        }
        elementsByType.get(typeUpper)!.push(element);
      }

      // Update progress for rule processing phase (80-100% of this model)
      const baseProgress = (processedModels / totalModels) * 90;
      const modelProgressRange = (1 / totalModels) * 90;
      const ruleProcessingStart = baseProgress + (modelProgressRange * 0.8);

      bufferedConsole.current.updateProgress(
        `Applying rules...`,
        Math.round(ruleProcessingStart)
      );

      // ULTRA-FAST: Batch process rules with smart filtering
      await processBatchRules(
        activeRules,
        elementsByType,
        allModelElements,
        model.modelID,
        ifcApiInternal,
        newElementsPerClassification,
        processedModels,
        totalModels
      );

      processedModels += 1;
      const percent = Math.round((processedModels / totalModels) * 90);
      bufferedConsole.current.updateProgress(
        `Model ${processedModels}/${totalModels} complete`,
        percent
      );

      // Yield after each model
      await yieldToMainThread();
    }

    // Final progress update
    bufferedConsole.current.updateProgress("Finalizing...", 95);

    await yieldToMainThread();

    // Update classifications state with new elements, only if changed
    setClassifications((prevClassifications) => {
      const updatedClassifications = { ...prevClassifications };
      let changed = false;
      let totalMatches = 0;

      for (const code of Object.keys(updatedClassifications)) {
        const newElements = newElementsPerClassification[code] || [];
        totalMatches += newElements.length;

        if (
          JSON.stringify(updatedClassifications[code].elements || []) !==
          JSON.stringify(newElements)
        ) {
          updatedClassifications[code] = {
            ...updatedClassifications[code],
            elements: newElements,
          };
          changed = true;
        }
      }

      if (changed) {
        console.log(
          "IFCContext: Finished applying all active rules. Classifications updated.",
        );
        // Show final summary only
        bufferedConsole.current.clear();
        bufferedConsole.current.addLog(`✓ Complete: ${totalMatches} matches found`);
        bufferedConsole.current.updateProgress(
          `${totalMatches} matches`,
          100,
          totalMatches
        );
        bufferedConsole.current.forceFlush();
      } else {
        console.log(
          "IFCContext: Finished applying all active rules. No changes to classifications elements.",
        );
        // Show final summary only
        bufferedConsole.current.clear();
        bufferedConsole.current.addLog("✓ Complete: No matches found");
        bufferedConsole.current.updateProgress(
          "No matches",
          100,
          0
        );
        bufferedConsole.current.forceFlush();
      }
      return updatedClassifications;
    });
  }, [
    ifcApiInternal,
    loadedModels,
    rules,
    getAllElementsFromSpatialTreeNodesRecursive,
    matchesAllConditionsCallback,
  ]);

  const rulesKey = useMemo(
    () =>
      JSON.stringify(
        rules.map((r) => ({
          id: r.id,
          active: r.active,
          conditions: r.conditions,
          classificationCode: r.classificationCode,
        })),
      ),
    [rules],
  );
  const modelsReadyKey = useMemo(
    () =>
      loadedModels.filter((m) => m.modelID !== null && m.spatialTree !== null)
        .length,
    [loadedModels],
  );

  // Only trigger rule application when rules or models change, not when classifications change
  useEffect(() => {
    // Only apply rules automatically if there are active rules
    const hasActiveRules = rules.some(rule => rule.active);
    if (hasActiveRules) {
      console.log(
        "Main effect for applyAllActiveRules triggered by changes in models or rules.",
      );
      applyAllActiveRules();
    } else {
      console.log(
        "No active rules found, skipping automatic rule application.",
      );
      // Clear any existing rule progress if no active rules
      bufferedConsole.current.clear();
    }
  }, [modelsReadyKey, rulesKey, applyAllActiveRules, rules]);

  const previewRuleHighlight = useCallback(
    async (ruleId: string) => {
      if (!ifcApiInternal) return;

      if (previewingRuleId === ruleId) {
        // Clicking active preview again: toggle off
        setPreviewingRuleId(null);
        setHighlightedClassificationCode(null);
        setHighlightedElements([]);
        console.log("Cleared preview for rule: " + ruleId);
        return;
      }

      // Activating a new preview or switching
      if (ifcApiInternal && !ifcApiInternal.properties) {
        try {
          ifcApiInternal.properties = new Properties(ifcApiInternal);
        } catch (e) {
          console.error("Failed to init properties in preview", e);
          return;
        }
      }
      const rule = rules.find((r) => r.id === ruleId);
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
        const allModelElements = getAllElementsFromSpatialTreeNodesRecursive(
          model.spatialTree ? [model.spatialTree] : [],
        );
        for (const elementNode of allModelElements) {
          if (elementNode.expressID === undefined) continue;
          try {
            const matches = await matchesAllConditionsCallback(
              elementNode,
              rule.conditions,
              rule.matchType ?? "all",
              model.modelID,
              ifcApiInternal,
            );
            if (matches) {
              matchingElements.push({
                modelID: model.modelID,
                expressID: elementNode.expressID,
              });
            }
          } catch (error) {
            console.error(
              "Error previewing element " +
              elementNode.expressID +
              " for rule " +
              rule.name +
              ":",
              error,
            );
          }
        }
      }
      setPreviewingRuleId(ruleId); // Set this rule as actively previewing
      setHighlightedClassificationCode(rule.classificationCode);
      setHighlightedElements(matchingElements);
      setShowAllClassificationColors(false);
      console.log(
        'Previewing rule "' +
        rule.name +
        '". Found ' +
        matchingElements.length +
        " elements.",
      );
    },
    [
      ifcApiInternal,
      loadedModels,
      rules,
      getAllElementsFromSpatialTreeNodesRecursive,
      matchesAllConditionsCallback,
      previewingRuleId,
      setHighlightedClassificationCode,
      setHighlightedElements,
      setShowAllClassificationColors,
    ],
  ); // Added previewingRuleId to deps

  const generateFileId = useCallback(
    () => `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    [],
  );
  const commonLoadLogic = useCallback(
    (url: string, name: string, fileIdToUse?: string): LoadedModelData => {
      const id = fileIdToUse || generateFileId();
      setSelectedElement(null);
      setElementPropertiesInternal(null);
      setHighlightedElements([]);
      return {
        id,
        name,
        url,
        modelID: null,
        spatialTree: null,
        rawBuffer: null,
      };
    },
    [
      generateFileId,
      setSelectedElement,
      setElementPropertiesInternal,
      setHighlightedElements,
    ],
  );

  const addIFCModel = useCallback(
    async (
      url: string,
      name: string,
      fileId?: string,
    ): Promise<number | null> => {
      setLoadedModels((prev) => [...prev, commonLoadLogic(url, name, fileId)]);
      return null;
    },
    [commonLoadLogic],
  );

  const replaceIFCModel = useCallback(
    async (
      url: string,
      name: string,
      fileId?: string,
    ): Promise<number | null> => {
      // Clear all element caches when replacing models
      IFCElementExtractor.clearCache();
      PropertyCache.clearCache();
      elementPropsCache.current.clear();
      setLoadedModels([commonLoadLogic(url, name, fileId)]);
      return null;
    },
    [commonLoadLogic],
  );

  const removeIFCModel = useCallback(
    (id: string) => {
      setLoadedModels((prev) => {
        const filtered = prev.filter((m) => {
          if (m.id === id && m.modelID !== null && ifcApiInternal) {
            try {
              ifcApiInternal.CloseModel(m.modelID);
              // Clear element cache for this model to prevent stale data
              IFCElementExtractor.clearCache(m.modelID);
            } catch (e) {
              console.error("Error closing model:", e);
            }
            setAvailableCategoriesInternal((prevCats) => {
              const newCats = { ...prevCats };
              if (m.modelID) delete newCats[m.modelID];
              return newCats;
            });
          }
          return m.id !== id;
        });
        if (filtered.length === 0) {
          setBaseCoordinationMatrix(null);
        }
        return filtered;
      });
      if (
        selectedElement &&
        loadedModels.find((m) => m.id === id)?.modelID ===
        selectedElement.modelID
      ) {
        setSelectedElement(null);
        setElementPropertiesInternal(null);
      }
    },
    [
      ifcApiInternal,
      selectedElement,
      loadedModels,
      setLoadedModels,
      setAvailableCategoriesInternal,
      setSelectedElement,
      setElementPropertiesInternal,
    ],
  );

  const setModelIDForLoadedModel = useCallback(
    (loadedModelId: string, ifcModelId: number) => {
      setLoadedModels((prev) =>
        prev.map((m) =>
          m.id === loadedModelId ? { ...m, modelID: ifcModelId } : m,
        ),
      );
    },
    [setLoadedModels],
  );

  const setSpatialTreeForModel = useCallback(
    (modelID: number, tree: SpatialStructureNode | null) => {
      setLoadedModels((prevModels) =>
        prevModels.map((m) =>
          m.modelID === modelID ? { ...m, spatialTree: tree } : m,
        ),
      );
    },
    [setLoadedModels],
  );

  const setRawBufferForModel = useCallback(
    (id: string, buffer: ArrayBuffer) => {
      setLoadedModels((prevModels) =>
        prevModels.map((m) => (m.id === id ? { ...m, rawBuffer: buffer } : m)),
      );
    },
    [],
  );

  const selectElement = useCallback(
    (selection: SelectedElementInfo | null) => {
      if (selection) {
        setSelectedElements([selection]);
      } else {
        setSelectedElements([]);
      }
      setSelectedElement(selection);
      setHighlightedElements([]);
      setHighlightedClassificationCode(null);
      setShowAllClassificationColors(false);
      setPreviewingRuleId(null); // Clear active rule preview
      if (!selection) {
        setElementPropertiesInternal(null);
      } else {
        setElementPropertiesInternal(null); // Clear old props before new ones are fetched
      }
    },
    [
      setSelectedElement,
      setHighlightedElements,
      setHighlightedClassificationCode,
      setShowAllClassificationColors,
      setElementPropertiesInternal,
      setPreviewingRuleId,
      setSelectedElements,
    ],
  );

  const selectElements = useCallback(
    (selection: SelectedElementInfo[]) => {
      setSelectedElements(selection);
      setSelectedElement(selection.length ? selection[selection.length - 1] : null);
      setHighlightedElements([]);
      setHighlightedClassificationCode(null);
      setShowAllClassificationColors(false);
      setPreviewingRuleId(null);
      setElementPropertiesInternal(null);
    },
    [
      setSelectedElements,
      setSelectedElement,
      setHighlightedElements,
      setHighlightedClassificationCode,
      setShowAllClassificationColors,
      setPreviewingRuleId,
      setElementPropertiesInternal,
    ],
  );

  const clearSelection = useCallback(() => {
    setSelectedElements([]);
    setSelectedElement(null);
    setHighlightedElements([]);
    setHighlightedClassificationCode(null);
    setShowAllClassificationColors(false);
    setPreviewingRuleId(null);
    setElementPropertiesInternal(null);
  }, [
    setSelectedElements,
    setSelectedElement,
    setHighlightedElements,
    setHighlightedClassificationCode,
    setShowAllClassificationColors,
    setPreviewingRuleId,
    setElementPropertiesInternal,
  ]);

  const toggleElementSelection = useCallback(
    (element: SelectedElementInfo, additive: boolean) => {
      setSelectedElements((prev) => {
        let newSelection = prev;
        const exists = prev.some(
          (el) => el.modelID === element.modelID && el.expressID === element.expressID,
        );
        if (additive) {
          if (exists) {
            newSelection = prev.filter(
              (el) => !(el.modelID === element.modelID && el.expressID === element.expressID),
            );
          } else {
            newSelection = [...prev, element];
          }
        } else {
          if (exists && prev.length === 1) {
            newSelection = [];
          } else {
            newSelection = [element];
          }
        }
        setSelectedElement(newSelection.length ? newSelection[newSelection.length - 1] : null);
        setHighlightedElements([]);
        setHighlightedClassificationCode(null);
        setShowAllClassificationColors(false);
        setPreviewingRuleId(null);
        setElementPropertiesInternal(null);
        return newSelection;
      });
    },
    [
      setSelectedElements,
      setSelectedElement,
      setHighlightedElements,
      setHighlightedClassificationCode,
      setShowAllClassificationColors,
      setPreviewingRuleId,
      setElementPropertiesInternal,
    ],
  );

  const toggleClassificationHighlight = useCallback(
    (classificationCode: string) => {
      if (
        highlightedClassificationCode === classificationCode &&
        !previewingRuleId
      ) {
        // Only toggle off if not a rule preview
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
          console.warn(
            "Classification " +
            classificationCode +
            " or its elements not found for highlight.",
          );
        }
      }
    },
    [
      classifications,
      highlightedClassificationCode,
      setHighlightedClassificationCode,
      setHighlightedElements,
      setShowAllClassificationColors,
      previewingRuleId,
      setPreviewingRuleId,
    ],
  );

  const setElementProperties = useCallback(
    (properties: any | null) => {
      setElementPropertiesInternal(properties);
    },
    [setElementPropertiesInternal],
  );

  const setAvailableProperties = useCallback(
    (props: string[]) => {
      setAvailablePropertiesInternal(props);
    },
    [setAvailablePropertiesInternal],
  );

  const setBaseCoordinationMatrixFn = useCallback(
    (matrix: number[] | null) => {
      setBaseCoordinationMatrix(matrix);
    },
    [setBaseCoordinationMatrix],
  );

  const setAvailableCategoriesForModel = useCallback(
    (modelID: number, cats: string[]) => {
      setAvailableCategoriesInternal((prev) => ({ ...prev, [modelID]: cats }));
    },
    [setAvailableCategoriesInternal],
  );

  const setIfcApi = useCallback(
    (api: IfcAPI | null) => {
      setIfcApiInternal(api);
    },
    [setIfcApiInternal],
  );

  const getElementPropertiesCached = useCallback(
    async (modelID: number, expressID: number) => {
      if (!ifcApiInternal) return null;
      let modelMap = elementPropsCache.current.get(modelID);
      if (modelMap && modelMap.has(expressID)) {
        return modelMap.get(expressID)!;
      }
      try {
        const props = await PropertyCache.getProperties(ifcApiInternal, modelID, expressID);
        if (!modelMap) {
          modelMap = new Map();
          elementPropsCache.current.set(modelID, modelMap);
        }
        modelMap.set(expressID, props);
        return props;
      } catch (e) {
        console.warn('Failed to fetch element properties', e);
        return null;
      }
    },
    [ifcApiInternal],
  );

  const showElements = useCallback((elements: SelectedElementInfo[]) => {
    setUserHiddenElements((prev) =>
      prev.filter(
        (el) =>
          !elements.some(
            (e) => e.modelID === el.modelID && e.expressID === el.expressID,
          ),
      ),
    );
  }, []);

  const toggleShowAllClassificationColors = useCallback(() => {
    setShowAllClassificationColors((prev) => {
      const newShowAllState = !prev;
      if (newShowAllState) {
        setHighlightedClassificationCode(null);
        setHighlightedElements([]);
        setPreviewingRuleId(null); // Clear rule preview if showing all colors
        if (isolateUnclassified) {
          setIsolateUnclassified(false);
          if (isolationHiddenElements.length > 0) {
            showElements(isolationHiddenElements);
            setIsolationHiddenElements([]);
          }
        }
      }
      // If turning off showAll, we don't automatically re-enable a specific preview or highlight.
      return newShowAllState;
    });
  }, [
    setShowAllClassificationColors,
    setHighlightedClassificationCode,
    setHighlightedElements,
    setPreviewingRuleId,
    isolateUnclassified,
    isolationHiddenElements,
    showElements,
    setIsolateUnclassified,
    setIsolationHiddenElements,
  ]);

  const addClassification = useCallback(
    (classificationItem: any) => {
      setClassifications((prev) => ({
        ...prev,
        [classificationItem.code]: classificationItem,
      }));
    },
    [setClassifications],
  );

  const removeClassification = useCallback(
    (code: string) => {
      setClassifications((prev) => {
        const updated = { ...prev };
        delete updated[code];
        return updated;
      });
    },
    [setClassifications],
  );

  const removeAllClassifications = useCallback(() => {
    setClassifications({});
  }, [setClassifications]);

  const updateClassification = useCallback(
    (code: string, classificationItem: any) => {
      setClassifications((prev) => ({ ...prev, [code]: classificationItem }));
    },
    [setClassifications],
  );

  const assignClassificationToElement = useCallback(
    (classificationCode: string, element: SelectedElementInfo) => {
      setClassifications((prev) => {
        const current = prev[classificationCode];
        if (!current) return prev;
        const already = current.elements?.some(
          (el: SelectedElementInfo) =>
            el.modelID === element.modelID &&
            el.expressID === element.expressID,
        );
        if (already) return prev;
        const updated = {
          ...prev,
          [classificationCode]: {
            ...current,
            elements: [...(current.elements || []), element],
          },
        };
        return updated;
      });
    },
    [setClassifications],
  );

  const unassignClassificationFromElement = useCallback(
    (classificationCode: string, element: SelectedElementInfo) => {
      setClassifications((prev) => {
        const current = prev[classificationCode];
        if (!current || !current.elements) return prev;
        const newElements = current.elements.filter(
          (el: SelectedElementInfo) =>
            !(
              el.modelID === element.modelID &&
              el.expressID === element.expressID
            ),
        );
        if (newElements.length === current.elements.length) return prev;
        return {
          ...prev,
          [classificationCode]: { ...current, elements: newElements },
        };
      });
    },
    [setClassifications],
  );

  const unassignElementFromAllClassifications = useCallback(
    (element: SelectedElementInfo) => {
      setClassifications((prev) => {
        let changed = false;
        const updated: Record<string, any> = {};
        for (const [code, item] of Object.entries(prev)) {
          if (item.elements) {
            const newEls = item.elements.filter(
              (el: SelectedElementInfo) =>
                !(
                  el.modelID === element.modelID &&
                  el.expressID === element.expressID
                ),
            );
            if (newEls.length !== item.elements.length) {
              changed = true;
              updated[code] = { ...item, elements: newEls };
            } else {
              updated[code] = item;
            }
          } else {
            updated[code] = item;
          }
        }
        return changed ? updated : prev;
      });
    },
    [setClassifications],
  );

  const getClassificationsForElement = useCallback(
    (element: SelectedElementInfo | null): ClassificationItem[] => {
      if (!element) return [];
      const result: ClassificationItem[] = [];
      for (const code in classifications) {
        const item = classifications[code] as ClassificationItem;
        if (
          item.elements?.some(
            (el) =>
              el.modelID === element.modelID &&
              el.expressID === element.expressID,
          )
        ) {
          result.push(item);
        }
      }
      return result;
    },
    [classifications],
  );

  const mapClassificationsFromModel = useCallback(
    async (psetName: string, propertyName: string) => {
      if (!ifcApiInternal) return;
      if (!ifcApiInternal.properties) {
        try {
          ifcApiInternal.properties = new Properties(ifcApiInternal);
        } catch (e) {
          console.error('Failed to init properties', e);
          return;
        }
      }

      const classCodes = Object.keys(classifications);
      const newElements: Record<string, SelectedElementInfo[]> = {};
      classCodes.forEach((c) => (newElements[c] = []));

      for (const model of loadedModels) {
        if (model.modelID == null || !model.spatialTree) continue;
        const elements = getAllElementsFromSpatialTreeNodesRecursive(
          model.spatialTree ? [model.spatialTree] : []
        );
        for (const el of elements) {
          if (el.expressID === undefined) continue;
          const props = await getElementPropertiesCached(
            model.modelID,
            el.expressID
          );
          if (!props) continue;
          let val: any = undefined;
          if (psetName) {
            if (psetName.includes('*')) {
              const regex = new RegExp(
                '^' +
                psetName
                  .split('*')
                  .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                  .join('.*') +
                '$',
                'i',
              );
              for (const key of Object.keys(props.propertySets || {})) {
                if (regex.test(key)) {
                  const v = props.propertySets?.[key]?.[propertyName];
                  if (v !== undefined && v !== null) {
                    val = v;
                    break;
                  }
                }
              }
            } else {
              val = props.propertySets?.[psetName]?.[propertyName];
            }
          } else {
            val = props.propertySets?.['Element Attributes']?.[propertyName];
            if (val === undefined) val = props.attributes?.[propertyName];
          }
          if (val && typeof val === 'object' && 'value' in val) val = val.value;
          if (val === undefined && (el as any)[propertyName] !== undefined) {
            const direct = (el as any)[propertyName];
            val = direct?.value !== undefined ? direct.value : direct;
          }
          if (val === undefined || val === null) continue;
          const code = String(val).trim();
          if (classifications[code]) {
            const info = { modelID: model.modelID, expressID: el.expressID };
            if (
              !newElements[code].some(
                (e) => e.modelID === info.modelID && e.expressID === info.expressID
              )
            ) {
              newElements[code].push(info);
            }
          }
        }
      }

      setClassifications((prev) => {
        const updated = { ...prev };
        let changed = false;
        for (const c of classCodes) {
          const elems = newElements[c] || [];
          if (JSON.stringify(prev[c].elements || []) !== JSON.stringify(elems)) {
            updated[c] = { ...prev[c], elements: elems };
            changed = true;
          }
        }
        if (changed) {
          console.log('IFCContext: classifications mapped from model');
        }
        return updated;
      });
    },
    [
      ifcApiInternal,
      classifications,
      loadedModels,
      getElementPropertiesCached,
      getAllElementsFromSpatialTreeNodesRecursive,
    ]
  );

  const addRule = useCallback(
    (ruleItem: Rule) => {
      setRules((prev) => [...prev, ruleItem]);
    },
    [setRules],
  );

  const removeRule = useCallback(
    (id: string) => {
      setRules((prev) => prev.filter((r) => r.id !== id));
    },
    [setRules],
  );

  const updateRule = useCallback(
    (updatedRuleItem: Rule) => {
      setRules((prev) =>
        prev.map((r) => (r.id === updatedRuleItem.id ? updatedRuleItem : r)),
      );
    },
    [setRules],
  );

  const exportClassificationsAsJson = useCallback((): string => {
    const arr = Object.values(classifications);
    return JSON.stringify(arr, null, 2);
  }, [classifications]);

  const importClassificationsFromJson = useCallback(
    (json: string) => {
      try {
        const parsed = JSON.parse(json) as ClassificationItem[];
        if (!Array.isArray(parsed)) {
          console.error("Classification JSON is not an array");
          return;
        }
        setClassifications((prev) => {
          const updated = { ...prev };
          parsed.forEach((item) => {
            if (item.code) {
              updated[item.code] = { ...item, elements: item.elements || [] };
            }
          });
          return updated;
        });
      } catch (e) {
        console.error("Failed to import classifications", e);
      }
    },
    [setClassifications],
  );

  const exportClassificationsAsExcel = useCallback((): ArrayBuffer => {
    return exportClassificationsToExcel(classifications);
  }, [classifications]);

  const importClassificationsFromExcel = useCallback(
    async (file: File) => {
      try {
        const parsed = await parseClassificationsFromExcel(file);
        setClassifications((prev) => {
          const updated = { ...prev };
          parsed.forEach((item) => {
            if (item.code) {
              updated[item.code] = { ...item, elements: item.elements || [] };
            }
          });
          return updated;
        });
      } catch (e) {
        console.error("Failed to import classifications from Excel", e);
      }
    },
    [setClassifications],
  );

  const exportRulesAsJson = useCallback((): string => {
    return JSON.stringify(rules, null, 2);
  }, [rules]);

  const exportRulesAsExcel = useCallback((): ArrayBuffer => {
    return exportRulesToExcel(rules);
  }, [rules]);

  const importRulesFromJson = useCallback(
    (json: string) => {
      try {
        const parsed = JSON.parse(json) as Rule[];
        if (!Array.isArray(parsed)) {
          console.error("Rules JSON is not an array");
          return;
        }
        setRules(parsed);
      } catch (e) {
        console.error("Failed to import rules", e);
      }
    },
    [setRules],
  );

  const importRulesFromExcel = useCallback(
    async (file: File) => {
      try {
        const parsed = await parseRulesFromExcel(file);
        setRules(parsed);
      } catch (e) {
        console.error("Failed to import rules from Excel", e);
      }
    },
    [setRules],
  );

  const removeAllRules = useCallback(() => {
    setRules([]);
  }, [setRules]);

  const applyRulesManually = useCallback(async () => {
    console.log("IFCContext: Manual rule application triggered");
    await applyAllActiveRules();
  }, [applyAllActiveRules]);



  const toggleUserHideElement = useCallback(
    (elementToToggle: SelectedElementInfo) => {
      console.log(
        "IFCContext: toggleUserHideElement called for",
        elementToToggle,
      );
      setUserHiddenElements((prevHidden) => {
        const isAlreadyHidden = prevHidden.some(
          (el) =>
            el.modelID === elementToToggle.modelID &&
            el.expressID === elementToToggle.expressID,
        );
        if (isAlreadyHidden) {
          console.log(
            "IFCContext: Element was hidden, now showing:",
            elementToToggle,
          );
          return prevHidden.filter(
            (el) =>
              !(
                el.modelID === elementToToggle.modelID &&
                el.expressID === elementToToggle.expressID
              ),
          );
        } else {
          console.log(
            "IFCContext: Element was visible, now hiding:",
            elementToToggle,
          );
          // Check if the element being hidden is the currently selected element
          if (
            selectedElement &&
            selectedElement.modelID === elementToToggle.modelID &&
            selectedElement.expressID === elementToToggle.expressID
          ) {
            console.log(
              "IFCContext: Deselecting element because it is now hidden.",
            );
            setSelectedElement(null); // Deselect
            setElementPropertiesInternal(null); // Clear its properties
          }
          return [...prevHidden, elementToToggle];
        }
      });
    },
    [selectedElement, setSelectedElement, setElementPropertiesInternal],
  );

  const unhideLastElement = useCallback(() => {
    console.log("IFCContext: unhideLastElement called.");
    setUserHiddenElements((prevHidden) => {
      if (prevHidden.length === 0) {
        console.log("IFCContext: No elements to unhide.");
        return prevHidden;
      }
      const newHidden = prevHidden.slice(0, -1); // Remove the last element
      console.log(
        "IFCContext: Unhid last element. Remaining hidden:",
        newHidden.length,
      );
      return newHidden;
    });
  }, []);

  const unhideAllElements = useCallback(() => {
    console.log("IFCContext: unhideAllElements called.");
    setUserHiddenElements([]);
    console.log("IFCContext: All elements unhidden.");
  }, []);

  const toggleModelVisibility = useCallback((modelId: string) => {
    setHiddenModelIds((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId],
    );
  }, []);

  const hideElements = useCallback(
    (elements: SelectedElementInfo[]) => {
      console.log("IFCContext: hideElements called with", elements.length, "elements");

      // DEBUG: Log sample elements
      if (elements.length > 0) {
        console.log("IFCContext: First 3 elements to hide:", elements.slice(0, 3));
      }

      setUserHiddenElements((prev) => {
        console.log("IFCContext: Previous hidden elements count:", prev.length);
        const newHidden = [...prev];
        let addedCount = 0;

        elements.forEach((el) => {
          if (
            !newHidden.some(
              (h) => h.modelID === el.modelID && h.expressID === el.expressID,
            )
          ) {
            if (
              selectedElement &&
              selectedElement.modelID === el.modelID &&
              selectedElement.expressID === el.expressID
            ) {
              console.log("IFCContext: Deselecting element that's being hidden:", el);
              setSelectedElement(null);
              setElementPropertiesInternal(null);
            }
            newHidden.push(el);
            addedCount++;
          }
        });

        console.log(`IFCContext: Added ${addedCount} elements to hidden list. New total:`, newHidden.length);
        return newHidden;
      });
    },
    [selectedElement, setSelectedElement, setElementPropertiesInternal],
  );


  const toggleIsolateUnclassified = useCallback(() => {
    setIsolateUnclassified((prev) => {
      const newState = !prev;
      if (newState) {
        setShowAllClassificationColors(false);
        const allClassified: SelectedElementInfo[] = [];
        Object.values(classifications).forEach((cls: any) => {
          if (cls.elements) allClassified.push(...cls.elements);
        });
        const uniqueMap = new Map<string, SelectedElementInfo>();
        allClassified.forEach((el) => {
          const key = `${el.modelID}-${el.expressID}`;
          if (!uniqueMap.has(key)) uniqueMap.set(key, el);
        });
        const toHide = Array.from(uniqueMap.values()).filter(
          (el) =>
            !userHiddenElements.some(
              (h) => h.modelID === el.modelID && h.expressID === el.expressID,
            ),
        );
        if (toHide.length > 0) hideElements(toHide);
        setIsolationHiddenElements(toHide);
      } else {
        if (isolationHiddenElements.length > 0) {
          showElements(isolationHiddenElements);
        }
        setIsolationHiddenElements([]);
      }
      return newState;
    });
  }, [
    classifications,
    userHiddenElements,
    hideElements,
    showElements,
    isolationHiddenElements,
    setShowAllClassificationColors,
  ]);

  return (
    <IFCContext.Provider
      value={{
        loadedModels,
        selectedElement,
        selectedElements,
        highlightedElements,
        elementProperties,
        availableCategories,
        classifications,
        rules,
        ifcApi: ifcApiInternal,
        highlightedClassificationCode,
        showAllClassificationColors,
        isolateUnclassified,
        previewingRuleId,
        userHiddenElements,
        hiddenModelIds,
        availableProperties,
        replaceIFCModel,
        addIFCModel,
        removeIFCModel,
        setModelIDForLoadedModel,
        setSpatialTreeForModel,
        setRawBufferForModel,
        selectElement,
        selectElements,
        toggleElementSelection,
        clearSelection,
        toggleClassificationHighlight,
        setElementProperties,
        setAvailableCategoriesForModel,
        setAvailableProperties,
        setIfcApi,
        getElementPropertiesCached,
        toggleShowAllClassificationColors,
        toggleIsolateUnclassified,
        baseCoordinationMatrix,
        setBaseCoordinationMatrix: setBaseCoordinationMatrixFn,
        addClassification,
        removeClassification,
        removeAllClassifications,
        updateClassification,
        assignClassificationToElement,
        unassignClassificationFromElement,
        unassignElementFromAllClassifications,
        getClassificationsForElement,
        addRule,
        removeRule,
        updateRule,
        previewRuleHighlight,
        exportClassificationsAsJson,
        exportClassificationsAsExcel,
        importClassificationsFromJson,
        importClassificationsFromExcel,
        exportRulesAsJson,
        exportRulesAsExcel,
        importRulesFromJson,
        importRulesFromExcel,
        removeAllRules,
        applyRulesManually,
        toggleUserHideElement,
        hideElements,
        showElements,
        unhideLastElement,
        unhideAllElements,
        toggleModelVisibility,
        mapClassificationsFromModel,
        naturalIfcClassNames,
        getNaturalIfcClassName,
        ruleProgress,
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
