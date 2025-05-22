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
import { parseRulesFromExcel } from "@/services/rule-import-service";
import { exportRulesToExcel } from "@/services/rule-export-service";
import { exportClassificationsToExcel } from "@/services/classification-export-service";
import { parseClassificationsFromExcel } from "@/services/classification-import-service";

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
    ifcClass: string,
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
  toggleClassificationHighlight: (classificationCode: string) => void;
  setElementProperties: (properties: any | null) => void;
  setAvailableCategoriesForModel: (
    modelID: number,
    categories: string[],
  ) => void;
  setIfcApi: (api: IfcAPI | null) => void;
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
  mapClassificationsFromModel: (pset: string, property: string) => Promise<void>;

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
}

const IFCContext = createContext<IFCContextType | undefined>(undefined);

export function IFCContextProvider({ children }: { children: ReactNode }) {
  const [loadedModels, setLoadedModels] = useState<LoadedModelData[]>([]);
  const [selectedElement, setSelectedElement] =
    useState<SelectedElementInfo | null>(null);
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

  // Fetch natural IFC class names
  useEffect(() => {
    const fetchNaturalNames = async () => {
      try {
        const response = await fetch("/data/natural_ifcclass.json");
        if (!response.ok) {
          throw new Error(
            `Failed to fetch natural_ifcclass.json: ${response.statusText}`,
          );
        }
        const data = await response.json();
        setNaturalIfcClassNames(data);
        console.log("IFCContext: Natural IFC class names loaded.", data);
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
      ifcClass: string,
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
      console.log("IFCContext: fetchAllProperties called. API available?", !!ifcApiInternal);
      if (!ifcApiInternal) return;

      let propertiesManager: Properties;
      try {
        propertiesManager = new Properties(ifcApiInternal);
        console.log("IFCContext: fetchAllProperties - Properties manager initialized."); // Simplified log
      } catch (e) {
        console.error(
          "IFCContext: Failed to initialize Properties utility in fetchAllProperties",
          e,
        );
        return;
      }

      const allProps = new Set<string>();
      // Add common/direct properties that we know might exist and are useful for rules
      // These will be simple strings, not PSet.Property format
      allProps.add("Ifc Class");
      allProps.add("Name");
      allProps.add("GlobalId");
      allProps.add("Description");
      allProps.add("ObjectType");
      allProps.add("Tag");
      allProps.add("PredefinedType");
      console.log("IFCContext: fetchAllProperties - Initial direct attributes added:", Array.from(allProps));

      console.log(`IFCContext: fetchAllProperties - Processing ${loadedModels.length} loaded models.`);
      for (const model of loadedModels) {
        console.log(`IFCContext: fetchAllProperties - Processing model: ${model.name}, ID: ${model.id}, modelID: ${model.modelID}`);
        if (
          model.modelID === null ||
          !ifcApiInternal ||
          !ifcApiInternal.IsModelOpen(model.modelID)
        ) {
          console.warn(`IFCContext: fetchAllProperties - Skipping model ${model.name} (modelID: ${model.modelID}, isOpen: ${model.modelID !== null && ifcApiInternal?.IsModelOpen(model.modelID)})`);
          continue;
        }

        console.log(`IFCContext: fetchAllProperties - Model ${model.name} is open. Fetching PSet and Type properties...`);
        try {
          // 1. Get Property Sets (for instances and types)
          const psets = await propertiesManager.getPropertySets(
            model.modelID,
            0,
            true,
            true,
          );
          console.log(`IFCContext: fetchAllProperties - Model ${model.name}: Fetched ${psets.length} Psets. Logging first 5 (if any):`, JSON.parse(JSON.stringify(psets.slice(0, 5))));
          psets.forEach((pset: any) => {
            // Ensure pset has a Name and HasProperties
            if (pset.Name?.value && Array.isArray(pset.HasProperties)) {
              const psetName = pset.Name.value;
              console.log(`IFCContext: fetchAllProperties - Model ${model.name}: Processing PSet '${psetName}' with ${pset.HasProperties.length} properties.`);
              pset.HasProperties.forEach((prop: any) => {
                if (prop.Name?.value) {
                  const combinedName = `${psetName}.${prop.Name.value}`;
                  allProps.add(combinedName);
                  // console.log(`IFCContext: fetchAllProperties - Model ${model.name}: Added PSet property: ${combinedName}`);
                }
              });
            } else {
              // console.log(`IFCContext: fetchAllProperties - Model ${model.name}: Skipping PSet due to missing Name or HasProperties:`, JSON.parse(JSON.stringify(pset)));
            }
          });

          // 2. Get Type Properties (specifically for attributes on types not covered by getPropertySets with includeTypeProperties=true)
          // This part might be largely redundant if getPropertySets with includeTypeProperties=true is comprehensive.
          // We are already adding common direct attributes initially. 
          // The main goal here is to ensure PSet properties are correctly formatted and added.
          // The initial direct attributes (Name, GlobalId, etc.) are already added. 
          // The `getPropertySets` with `includeTypeProperties = true` should cover Psets defined on types.

        } catch (error) {
          console.error(
            `IFCContext: fetchAllProperties - Error fetching PSet/Type properties for model ${model.name} (ID: ${model.modelID}):`,
            error,
          );
        }
      }
      const sortedProps = Array.from(allProps).sort();
      if (sortedProps.length <= 7) { // Check if only the initial direct attributes are present
        console.warn("IFCContext: fetchAllProperties - No PSet properties seem to have been collected. Only direct attributes found:", sortedProps);
      } else {
        console.log(
          "IFCContext: fetchAllProperties - Final collected and sorted properties (including PSets) for rule creation:",
          sortedProps,
        );
      }
      setAvailablePropertiesInternal(sortedProps);
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
      modelID: number,
      api: IfcAPI, // Passed explicitly, not from context state directly in this func
    ): Promise<boolean> => {
      let propertiesManagerForRule: Properties;
      try {
        propertiesManagerForRule = new Properties(api);
      } catch (e) {
        console.warn(
          "Properties utility not initialized in matchesAllConditionsCallback", e
        );
        return false;
      }

      let itemProps: any = null; // To store properties fetched for the element

      for (const condition of conditions) {
        let elementValue: any;
        const ruleValue = condition.value;

        if (condition.property === "Ifc Class") {
          elementValue = elementNode.type;
        } else {
          // Fetch all item properties once if not already fetched for this element
          if (itemProps === null && elementNode.expressID) {
            try {
              itemProps = await propertiesManagerForRule.getItemProperties(
                modelID,
                elementNode.expressID,
                true,
              );
            } catch (e) {
              console.warn(
                `Error fetching item properties for ${elementNode.expressID}:`,
                e,
              );
              return false; // If properties can't be fetched, condition can't be reliably checked
            }
          }

          if (!itemProps) {
            // Should not happen if expressID is valid and getItemProperties was called
            console.warn(
              `No itemProps available for ${elementNode.expressID} to check ${condition.property}`,
            );
            return false;
          }

          if (condition.property.includes(".")) {
            // Handle PSet properties (e.g., "Pset_WallCommon.Reference")
            const [psetName, propName] = condition.property.split(".");
            if (!psetName || !propName) {
              console.warn("Invalid Pset property format:", condition.property);
              return false;
            }

            // Revised PSet lookup
            let psetObject: any = undefined;
            if (itemProps && itemProps[psetName]) {
              psetObject = itemProps[psetName];
            } else if (itemProps && Array.isArray(itemProps.PropertySets)) {
              psetObject = itemProps.PropertySets.find(
                (ps: any) => ps.Name?.value === psetName,
              );
            } else if (itemProps) {
              for (const key in itemProps) {
                if (
                  Object.prototype.hasOwnProperty.call(itemProps, key) &&
                  typeof itemProps[key] === "object" &&
                  itemProps[key] !== null &&
                  itemProps[key].Name?.value === psetName &&
                  itemProps[key].HasProperties // Check if it looks like a PSet
                ) {
                  psetObject = itemProps[key];
                  break;
                }
              }
            }

            // 4. If PSet still not found, try fetching from Type Properties
            if (!psetObject && elementNode.expressID) {
              if (condition.property === "Pset_WallCommon.IsExternal") {
                // Debug for this specific property
                console.log(
                  `[DEBUG RULE TRACE - Type Fetch] Element ID: ${elementNode.expressID}, PSet ${psetName} not in itemProps. Attempting type property fetch.`,
                );
              }
              try {
                const typeObjects = await propertiesManagerForRule.getTypeProperties(
                  modelID,
                  elementNode.expressID,
                  true,
                );
                for (const typeObj of typeObjects) {
                  if (
                    typeObj.HasPropertySets &&
                    Array.isArray(typeObj.HasPropertySets)
                  ) {
                    const foundPsetInType = typeObj.HasPropertySets.find(
                      (ps: any) => ps.Name?.value === psetName,
                    );
                    if (foundPsetInType) {
                      psetObject = foundPsetInType;
                      if (condition.property === "Pset_WallCommon.IsExternal") {
                        console.log(
                          `[DEBUG RULE TRACE - Type Fetch] Element ID: ${elementNode.expressID}, Found PSet ${psetName} in Type Object:`,
                          psetObject
                            ? JSON.parse(JSON.stringify(psetObject))
                            : "undefined",
                        );
                      }
                      break; // Found the PSet in a type object
                    }
                  }
                }
              } catch (e) {
                console.warn(
                  `[RULE ENGINE] Error fetching type properties for ${elementNode.expressID} while looking for PSet ${psetName}:`,
                  e,
                );
              }
            }

            if (psetObject && psetObject.HasProperties) {
              const targetProp = psetObject.HasProperties.find(
                (p: any) => p.Name?.value === propName,
              );
              if (targetProp) {
                elementValue =
                  targetProp.NominalValue?.value !== undefined
                    ? targetProp.NominalValue.value
                    : targetProp.NominalValue;
              }
              // DEBUG LOGGING START
              if (condition.property === "Pset_WallCommon.IsExternal") {
                console.log(
                  `[DEBUG RULE TRACE] Element ID: ${elementNode.expressID}, Property: ${condition.property}`,
                );
                console.log(
                  `[DEBUG RULE TRACE] PSet Object (itemProps["${psetName}"]):`,
                  psetObject
                    ? JSON.parse(JSON.stringify(psetObject))
                    : "undefined",
                );
                console.log(
                  `[DEBUG RULE TRACE] Target Prop (${propName}):`,
                  targetProp
                    ? JSON.parse(JSON.stringify(targetProp))
                    : "undefined",
                );
                console.log(
                  `[DEBUG RULE TRACE] Raw elementValue:`,
                  elementValue,
                  `(type: ${typeof elementValue})`,
                );
              }
              // DEBUG LOGGING END
            } else {
              // Fallback checks if PSet not directly under itemProps[psetName]
              // ... (existing fallback logic) ...
              // DEBUG LOGGING START for fallback path
              if (condition.property === "Pset_WallCommon.IsExternal") {
                console.log(
                  `[DEBUG RULE TRACE - Fallback] Element ID: ${elementNode.expressID}, Property: ${condition.property}`,
                );
                console.log(
                  `[DEBUG RULE TRACE - Fallback] itemProps keys:`,
                  itemProps ? Object.keys(itemProps) : "itemProps undefined",
                );
                console.log(
                  `[DEBUG RULE TRACE - Fallback] PSet Object for ${psetName} was not found directly or lacked HasProperties.`,
                );
              }
              // DEBUG LOGGING END for fallback path
            }
          } else {
            // Handle direct attributes (e.g., "Name", "GlobalId", "Description")
            const directPropValue = itemProps[condition.property];
            if (directPropValue !== undefined) {
              if (directPropValue?.hasOwnProperty("value")) {
                elementValue = directPropValue.value;
              } else {
                elementValue = directPropValue;
              }
            } else if (elementNode[condition.property]) {
              // Fallback to spatial tree node properties if direct attribute not in itemProps
              // (e.g. Name might be on spatial tree node itself)
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
        const normElementValue =
          typeof elementValue === "string"
            ? elementValue.toLowerCase()
            : elementValue;
        const normRuleValue =
          typeof ruleValue === "string" ? ruleValue.toLowerCase() : ruleValue;
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

        // DEBUG LOGGING START (after value processing, before switch)
        if (condition.property === "Pset_WallCommon.IsExternal") {
          console.log(
            `[DEBUG RULE TRACE] normElementValue:`,
            normElementValue,
            `(type: ${typeof normElementValue})`,
          );
          console.log(
            `[DEBUG RULE TRACE] valFromElement (boolean):`,
            valFromElement,
          );
          console.log(
            `[DEBUG RULE TRACE] normRuleValue (user input):`,
            normRuleValue,
          );
          console.log(`[DEBUG RULE TRACE] valFromRule (boolean):`, valFromRule);
        }
        // DEBUG LOGGING END

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
            // DEBUG LOGGING START (inside switch, after conditionMet is set)
            if (condition.property === "Pset_WallCommon.IsExternal") {
              console.log(
                `[DEBUG RULE TRACE] Final conditionMet for ${condition.operator}:`,
                conditionMet,
              );
            }
            // DEBUG LOGGING END
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
            // DEBUG LOGGING START (inside switch, after conditionMet is set)
            if (condition.property === "Pset_WallCommon.IsExternal") {
              console.log(
                `[DEBUG RULE TRACE] Final conditionMet for ${condition.operator}:`,
                conditionMet,
              );
            }
            // DEBUG LOGGING END
            break;
          case "contains":
            conditionMet =
              typeof normElementValue === "string" &&
              typeof normRuleValue === "string" &&
              normElementValue.includes(normRuleValue);
            // DEBUG LOGGING START (inside switch, after conditionMet is set)
            if (condition.property === "Pset_WallCommon.IsExternal") {
              console.log(
                `[DEBUG RULE TRACE] Final conditionMet for ${condition.operator}:`,
                conditionMet,
              );
            }
            // DEBUG LOGGING END
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
        if (!conditionMet) return false;
      }
      return true;
    },
    [],
  );

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
    let propertiesManagerForRuleApp: Properties;
    try {
      propertiesManagerForRuleApp = new Properties(ifcApiInternal);
    } catch (e) {
      console.error(
        "IFCContext: Failed to initialize Properties utility in applyAllActiveRules",
        e,
      );
      return; // Cannot proceed without properties
    }

    console.log("IFCContext: Applying all active rules...");

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

    for (const model of loadedModels) {
      if (model.modelID == null || !model.spatialTree) continue;
      const allModelElements = getAllElementsFromSpatialTreeNodesRecursive(
        model.spatialTree ? [model.spatialTree] : [],
      );
      for (const rule of activeRules) {
        if (!newElementsPerClassification[rule.classificationCode]) {
          // This should not happen if initialized above, but as a safeguard
          newElementsPerClassification[rule.classificationCode] = [];
        }
        for (const elementNode of allModelElements) {
          if (elementNode.expressID === undefined) continue;
          try {
            const matches = await matchesAllConditionsCallback(
              elementNode,
              rule.conditions,
              model.modelID,
              ifcApiInternal,
            );
            if (matches) {
              const elementInfo: SelectedElementInfo = {
                modelID: model.modelID,
                expressID: elementNode.expressID,
              };
              // Ensure no duplicates
              if (
                !newElementsPerClassification[rule.classificationCode].some(
                  (el) =>
                    el.modelID === elementInfo.modelID &&
                    el.expressID === elementInfo.expressID,
                )
              ) {
                newElementsPerClassification[rule.classificationCode].push(
                  elementInfo,
                );
              }
            }
          } catch (error) {
            console.error(
              "IFCContext: Error processing element " +
              elementNode.expressID +
              " for rule " +
              rule.name +
              ":",
              error,
            );
          }
        }
      }
    }

    // Update classifications state with new elements, only if changed
    setClassifications((prevClassifications) => {
      const updatedClassifications = { ...prevClassifications };
      let changed = false;
      for (const code of Object.keys(updatedClassifications)) {
        const newElements = newElementsPerClassification[code] || [];
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
      } else {
        console.log(
          "IFCContext: Finished applying all active rules. No changes to classifications elements.",
        );
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

  const classificationCodesKey = useMemo(
    () => Object.keys(classifications).sort().join(","),
    [classifications],
  );
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

  useEffect(() => {
    console.log(
      "Main effect for applyAllActiveRules triggered by changes in models, rules, or classification codes.",
    );
    applyAllActiveRules();
  }, [modelsReadyKey, rulesKey, classificationCodesKey, applyAllActiveRules]);

  const previewRuleHighlight = useCallback(
    async (ruleId: string) => {
      if (!ifcApiInternal) return;

      let propertiesManagerForPreview: Properties;
      try {
        propertiesManagerForPreview = new Properties(ifcApiInternal);
      } catch (e) {
        console.error("Failed to init Properties utility in previewRuleHighlight", e);
        return;
      }

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
    },
    [
      setSelectedElement,
      setHighlightedElements,
      setHighlightedClassificationCode,
      setShowAllClassificationColors,
      setElementPropertiesInternal,
      setPreviewingRuleId,
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

  const toggleShowAllClassificationColors = useCallback(() => {
    setShowAllClassificationColors((prev) => {
      const newShowAllState = !prev;
      if (newShowAllState) {
        setHighlightedClassificationCode(null);
        setHighlightedElements([]);
        setPreviewingRuleId(null); // Clear rule preview if showing all colors
      }
      // If turning off showAll, we don't automatically re-enable a specific preview or highlight.
      return newShowAllState;
    });
  }, [
    setShowAllClassificationColors,
    setHighlightedClassificationCode,
    setHighlightedElements,
    setPreviewingRuleId,
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

  const mapClassificationsFromModel = useCallback(
    async (pset: string, property: string) => {
      console.log(`IFCContext: mapClassificationsFromModel called with PSet='${pset}', Property='${property}'`);
      if (!ifcApiInternal) {
        console.error("IFCContext: mapClassificationsFromModel - IFC API not available.");
        return;
      }

      let propertiesManagerForMapping: Properties;
      try {
        propertiesManagerForMapping = new Properties(ifcApiInternal);
        console.log("IFCContext: mapClassificationsFromModel - Properties manager initialized.");
      } catch (e) {
        console.error(
          "IFCContext: Failed to init Properties utility in mapClassificationsFromModel",
          e,
        );
        return;
      }

      const newElementsPerClassification: Record<string, SelectedElementInfo[]> = {};
      for (const code in classifications) {
        newElementsPerClassification[code] = []; // Initialize even if no mapping occurs for this code
      }
      console.log("IFCContext: mapClassificationsFromModel - Initialized newElementsPerClassification:", Object.keys(newElementsPerClassification));

      const fetchValue = async (
        modelID: number,
        expressID: number,
      ): Promise<any> => {
        console.log(`IFCContext: mapClassificationsFromModel.fetchValue - Fetching for modelID: ${modelID}, expressID: ${expressID}`);
        let itemProps: any = null;
        try {
          itemProps = await propertiesManagerForMapping.getItemProperties(
            modelID,
            expressID,
            true,
          );
          console.log(`IFCContext: mapClassificationsFromModel.fetchValue - itemProps for ${expressID}:`, JSON.parse(JSON.stringify(itemProps)));
        } catch (e) {
          console.error(`IFCContext: mapClassificationsFromModel.fetchValue - Error getting itemProps for ${expressID}:`, e);
          return null;
        }

        if (pset) { // pset will be the PSet name string
          console.log(`IFCContext: mapClassificationsFromModel.fetchValue - Looking for PSet: '${pset}' and Property: '${property}'`);
          let psetObject: any = undefined;

          // Attempt to find PSet directly by its name in itemProps
          if (itemProps[pset]) {
            psetObject = itemProps[pset];
            console.log(`IFCContext: mapClassificationsFromModel.fetchValue - Found PSet '${pset}' directly in itemProps.`);
          } else if (Array.isArray(itemProps.PropertySets)) {
            psetObject = itemProps.PropertySets.find(
              (ps: any) => ps.Name?.value === pset,
            );
            if (psetObject) console.log(`IFCContext: mapClassificationsFromModel.fetchValue - Found PSet '${pset}' in itemProps.PropertySets.`);
          } else {
            // Fallback: Iterate keys if structure is different
            for (const key in itemProps) {
              if (
                Object.prototype.hasOwnProperty.call(itemProps, key) &&
                typeof itemProps[key] === "object" &&
                itemProps[key] !== null &&
                itemProps[key].Name?.value === pset && // Check Name.value if PSet object
                itemProps[key].HasProperties // Ensure it's a PSet-like object
              ) {
                psetObject = itemProps[key];
                console.log(`IFCContext: mapClassificationsFromModel.fetchValue - Found PSet '${pset}' by iterating itemProps keys.`);
                break;
              }
            }
          }

          if (!psetObject) {
            console.log(`IFCContext: mapClassificationsFromModel.fetchValue - PSet '${pset}' not found in direct properties. Trying Type Properties for element ${expressID}.`);
            try {
              const typeObjects = await propertiesManagerForMapping.getTypeProperties(
                modelID,
                expressID,
                true,
              );
              for (const typeObj of typeObjects) {
                if (typeObj.HasPropertySets && Array.isArray(typeObj.HasPropertySets)) {
                  const found = typeObj.HasPropertySets.find(
                    (ps: any) => ps.Name?.value === pset,
                  );
                  if (found) {
                    psetObject = found;
                    console.log(`IFCContext: mapClassificationsFromModel.fetchValue - Found PSet '${pset}' in Type Properties.`);
                    break;
                  }
                }
              }
            } catch (e) {
              console.error(`IFCContext: mapClassificationsFromModel.fetchValue - Error fetching type properties for PSet lookup on ${expressID}:`, e);
            }
          }

          if (psetObject && psetObject.HasProperties) {
            console.log(`IFCContext: mapClassificationsFromModel.fetchValue - PSet '${pset}' has properties. Looking for property '${property}'. Properties:`, JSON.parse(JSON.stringify(psetObject.HasProperties)));
            const propObj = psetObject.HasProperties.find(
              (p: any) => p.Name?.value === property,
            );
            if (propObj) {
              console.log(`IFCContext: mapClassificationsFromModel.fetchValue - Found property '${property}':`, JSON.parse(JSON.stringify(propObj)));
              if (propObj.NominalValue?.value !== undefined) return propObj.NominalValue.value;
              if (propObj.NominalValue !== undefined) return propObj.NominalValue;
              // Web-ifc-viewer uses NominalValue, but web-ifc might use Value directly for some IfcPropertySingleValue types
              if (propObj.Value?.value !== undefined) return propObj.Value.value;
              if (propObj.Value !== undefined) return propObj.Value;
              console.warn(`IFCContext: mapClassificationsFromModel.fetchValue - Property '${property}' found, but NominalValue/Value is undefined.`);
              return null; // Or some other indicator of value not found
            } else {
              console.warn(`IFCContext: mapClassificationsFromModel.fetchValue - Property '${property}' not found in PSet '${pset}'.`);
            }
          } else {
            console.warn(`IFCContext: mapClassificationsFromModel.fetchValue - PSet '${pset}' not found or has no properties.`);
          }
        } else { // No PSet, direct property lookup (e.g., Name, GlobalId)
          console.log(`IFCContext: mapClassificationsFromModel.fetchValue - Looking for direct property: '${property}'`);
          const directPropValue = itemProps[property];
          if (directPropValue !== undefined) {
            if (directPropValue?.value !== undefined) return directPropValue.value;
            return directPropValue;
          }
          console.warn(`IFCContext: mapClassificationsFromModel.fetchValue - Direct property '${property}' not found.`);
        }
        return null;
      };

      console.log(`IFCContext: mapClassificationsFromModel - Iterating ${loadedModels.length} models.`);
      for (const model of loadedModels) {
        console.log(`IFCContext: mapClassificationsFromModel - Processing model ${model.name} (ID: ${model.modelID})`);
        if (!model.modelID || !model.spatialTree) {
          console.warn(`IFCContext: mapClassificationsFromModel - Skipping model ${model.name}, missing modelID or spatialTree.`);
          continue;
        }
        const allElements = getAllElementsFromSpatialTreeNodesRecursive([
          model.spatialTree,
        ]);
        console.log(`IFCContext: mapClassificationsFromModel - Model ${model.name} has ${allElements.length} elements in spatial tree.`);
        for (const node of allElements) {
          if (node.expressID === undefined) continue;
          const val = await fetchValue(model.modelID, node.expressID);
          if (val === null || val === undefined) {
            // console.log(`IFCContext: mapClassificationsFromModel - No value found for element ${node.expressID} with PSet '${pset}', Property '${property}'`);
            continue;
          }
          const raw = String(val);
          console.log(`IFCContext: mapClassificationsFromModel - Element ${node.expressID}, Raw value for mapping: '${raw}'`);
          const codes = raw.split(/[,;]+/).map((c) => c.trim()).filter((c) => c);
          for (const code of codes) {
            if (newElementsPerClassification[code]) {
              const arr = newElementsPerClassification[code];
              if (!arr.some((el) => el.modelID === model.modelID && el.expressID === node.expressID)) {
                arr.push({ modelID: model.modelID, expressID: node.expressID });
                console.log(`IFCContext: mapClassificationsFromModel - Mapped element ${node.expressID} to classification code '${code}'`);
              }
            } else {
              // console.log(`IFCContext: mapClassificationsFromModel - Classification code '${code}' from model not in current classifications list. Cannot map element ${node.expressID}.`);
            }
          }
        }
      }

      console.log("IFCContext: mapClassificationsFromModel - Final newElementsPerClassification before set state:", JSON.parse(JSON.stringify(newElementsPerClassification)));
      setClassifications((prev) => {
        const updated = { ...prev };
        let changesMade = false;
        for (const code in updated) {
          const newEls = newElementsPerClassification[code] || []; // Default to empty array if code had no new mappings
          // Compare if elements actually changed to avoid unnecessary re-renders
          if (JSON.stringify(updated[code].elements || []) !== JSON.stringify(newEls)) {
            updated[code] = { ...updated[code], elements: newEls };
            changesMade = true;
          }
        }
        if (changesMade) {
          console.log("IFCContext: mapClassificationsFromModel - Classifications updated with mapped elements.");
        } else {
          console.log("IFCContext: mapClassificationsFromModel - No changes to classification elements after mapping.");
        }
        return updated;
      });
    },
    [
      ifcApiInternal,
      classifications,
      loadedModels,
      getAllElementsFromSpatialTreeNodesRecursive,
    ],
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
        hiddenModelIds,
        availableProperties,
        replaceIFCModel,
        addIFCModel,
        removeIFCModel,
        setModelIDForLoadedModel,
        setSpatialTreeForModel,
        setRawBufferForModel,
        selectElement,
        toggleClassificationHighlight,
        setElementProperties,
        setAvailableCategoriesForModel,
        setAvailableProperties,
        setIfcApi,
        toggleShowAllClassificationColors,
        baseCoordinationMatrix,
        setBaseCoordinationMatrix: setBaseCoordinationMatrixFn,
        addClassification,
        removeClassification,
        removeAllClassifications,
        updateClassification,
        mapClassificationsFromModel,
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
        toggleUserHideElement,
        hideElements,
        showElements,
        unhideLastElement,
        unhideAllElements,
        toggleModelVisibility,
        naturalIfcClassNames,
        getNaturalIfcClassName,
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
