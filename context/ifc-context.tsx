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
  naturalIfcClassNames: Record<
    string,
    { en: string; de: string; schema?: string }
  > | null; // Added schema to type
  getNaturalIfcClassName: (
    ifcClass: string,
    lang?: "en" | "de"
  ) => { name: string; schemaUrl?: string }; // Updated return type

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
  setRawBufferForModel: (id: string, buffer: ArrayBuffer) => void; // Keep this one

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
  removeAllClassifications: () => void;
  updateClassification: (code: string, classification: any) => void;
  addRule: (rule: Rule) => void;
  removeRule: (id: string) => void;
  updateRule: (rule: Rule) => void;
  previewRuleHighlight: (ruleId: string) => Promise<void>;

  exportClassificationsAsJson: () => string;
  importClassificationsFromJson: (json: string) => void;

  assignClassificationToElement: (
    classificationCode: string,
    element: SelectedElementInfo
  ) => void;
  unassignClassificationFromElement: (
    classificationCode: string,
    element: SelectedElementInfo
  ) => void;
  unassignElementFromAllClassifications: (element: SelectedElementInfo) => void;

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
  const [availableProperties, setAvailablePropertiesInternal] = useState<
    string[]
  >([]);
  const [naturalIfcClassNames, setNaturalIfcClassNames] = useState<Record<
    string,
    { en: string; de: string; schema?: string }
  > | null>(null); // Added schema to state type

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
            `Failed to fetch natural_ifcclass.json: ${response.statusText}`
          );
        }
        const data = await response.json();
        setNaturalIfcClassNames(data);
        console.log("IFCContext: Natural IFC class names loaded.", data);
      } catch (error) {
        console.error(
          "IFCContext: Error loading natural IFC class names:",
          error
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
      lang: "en" | "de" = "en"
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
    [naturalIfcClassNames]
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
            e
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
            // 1. Get Property Sets (including those from types)
            const psets = await ifcApiInternal.properties.getPropertySets(
              model.modelID,
              0, // Get for all elements/types in the model
              true, // Recursive
              true // Include type properties
            );
            psets.forEach((pset: any) => {
              if (pset.Name?.value && pset.HasProperties) {
                const psetName = pset.Name.value;
                pset.HasProperties.forEach((prop: any) => {
                  if (prop.Name?.value) {
                    allProps.add(`${psetName}.${prop.Name.value}`);
                  }
                });
              }
            });

            // 2. Get Type Properties (for attributes not in Psets on types)
            const typeObjects =
              await ifcApiInternal.properties.getTypeProperties(
                model.modelID,
                0, // Get all type objects
                true // Recursive for their properties
              );
            typeObjects.forEach((typeObj: any) => {
              // Add direct properties of the type object itself if they are simple
              // (e.g. if ObjectType, Tag are directly on the type)
              // This might be duplicative of the initial set but ensures capture.
              if (typeObj.Name?.value) allProps.add("Name"); // Name of the type
              if (typeObj.GlobalId?.value) allProps.add("GlobalId");
              if (typeObj.Description?.value) allProps.add("Description");
              if (typeObj.ObjectType?.value) allProps.add("ObjectType");
              if (typeObj.Tag?.value) allProps.add("Tag");
              if (typeObj.PredefinedType?.value) allProps.add("PredefinedType");

              // If type objects themselves have property sets (common for IfcElementType)
              if (typeObj.HasPropertySets) {
                typeObj.HasPropertySets.forEach((pset: any) => {
                  if (pset.Name?.value && pset.HasProperties) {
                    const psetName = pset.Name.value;
                    pset.HasProperties.forEach((prop: any) => {
                      if (prop.Name?.value) {
                        // To distinguish from instance psets, could prefix, but web-ifc might already handle this
                        // by returning them via getPropertySets with includeTypeProperties=true.
                        // For now, just add them; duplicates are handled by the Set.
                        allProps.add(`${psetName}.${prop.Name.value}`);
                      }
                    });
                  }
                });
              }
            });
          } catch (error) {
            console.error(
              `Error fetching properties for model ${model.modelID}:`,
              error
            );
          }
        }
      }
      const sortedProps = Array.from(allProps).sort();
      setAvailablePropertiesInternal(sortedProps);
      if (sortedProps.length > 0) {
        console.log(
          "IFCContext: Updated available properties for rule creation:",
          sortedProps
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
            getAllElementsFromSpatialTreeNodesRecursive(node.children)
          );
        }
      }
      return elements;
    },
    []
  );

  const matchesAllConditionsCallback = useCallback(
    async (
      elementNode: SpatialStructureNode,
      conditions: RuleCondition[],
      modelID: number,
      api: IfcAPI // Passed explicitly, not from context state directly in this func
    ): Promise<boolean> => {
      if (!api.properties) {
        console.warn(
          "API properties not initialized in matchesAllConditionsCallback"
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
              itemProps = await api.properties.getItemProperties(
                modelID,
                elementNode.expressID,
                true
              );
            } catch (e) {
              console.warn(
                `Error fetching item properties for ${elementNode.expressID}:`,
                e
              );
              return false; // If properties can't be fetched, condition can't be reliably checked
            }
          }

          if (!itemProps) {
            // Should not happen if expressID is valid and getItemProperties was called
            console.warn(
              `No itemProps available for ${elementNode.expressID} to check ${condition.property}`
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
                (ps: any) => ps.Name?.value === psetName
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
                  `[DEBUG RULE TRACE - Type Fetch] Element ID: ${elementNode.expressID}, PSet ${psetName} not in itemProps. Attempting type property fetch.`
                );
              }
              try {
                const typeObjects = await api.properties.getTypeProperties(
                  modelID,
                  elementNode.expressID,
                  true
                );
                for (const typeObj of typeObjects) {
                  if (
                    typeObj.HasPropertySets &&
                    Array.isArray(typeObj.HasPropertySets)
                  ) {
                    const foundPsetInType = typeObj.HasPropertySets.find(
                      (ps: any) => ps.Name?.value === psetName
                    );
                    if (foundPsetInType) {
                      psetObject = foundPsetInType;
                      if (condition.property === "Pset_WallCommon.IsExternal") {
                        console.log(
                          `[DEBUG RULE TRACE - Type Fetch] Element ID: ${elementNode.expressID}, Found PSet ${psetName} in Type Object:`,
                          psetObject
                            ? JSON.parse(JSON.stringify(psetObject))
                            : "undefined"
                        );
                      }
                      break; // Found the PSet in a type object
                    }
                  }
                }
              } catch (e) {
                console.warn(
                  `[RULE ENGINE] Error fetching type properties for ${elementNode.expressID} while looking for PSet ${psetName}:`,
                  e
                );
              }
            }

            if (psetObject && psetObject.HasProperties) {
              const targetProp = psetObject.HasProperties.find(
                (p: any) => p.Name?.value === propName
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
                  `[DEBUG RULE TRACE] Element ID: ${elementNode.expressID}, Property: ${condition.property}`
                );
                console.log(
                  `[DEBUG RULE TRACE] PSet Object (itemProps["${psetName}"]):`,
                  psetObject
                    ? JSON.parse(JSON.stringify(psetObject))
                    : "undefined"
                );
                console.log(
                  `[DEBUG RULE TRACE] Target Prop (${propName}):`,
                  targetProp
                    ? JSON.parse(JSON.stringify(targetProp))
                    : "undefined"
                );
                console.log(
                  `[DEBUG RULE TRACE] Raw elementValue:`,
                  elementValue,
                  `(type: ${typeof elementValue})`
                );
              }
              // DEBUG LOGGING END
            } else {
              // Fallback checks if PSet not directly under itemProps[psetName]
              // ... (existing fallback logic) ...
              // DEBUG LOGGING START for fallback path
              if (condition.property === "Pset_WallCommon.IsExternal") {
                console.log(
                  `[DEBUG RULE TRACE - Fallback] Element ID: ${elementNode.expressID}, Property: ${condition.property}`
                );
                console.log(
                  `[DEBUG RULE TRACE - Fallback] itemProps keys:`,
                  itemProps ? Object.keys(itemProps) : "itemProps undefined"
                );
                console.log(
                  `[DEBUG RULE TRACE - Fallback] PSet Object for ${psetName} was not found directly or lacked HasProperties.`
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
            `(type: ${typeof normElementValue})`
          );
          console.log(
            `[DEBUG RULE TRACE] valFromElement (boolean):`,
            valFromElement
          );
          console.log(
            `[DEBUG RULE TRACE] normRuleValue (user input):`,
            normRuleValue
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
                conditionMet
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
                conditionMet
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
                conditionMet
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
    []
  );

  const applyAllActiveRules = useCallback(async () => {
    if (!ifcApiInternal) {
      console.log(
        "IFC API not available, skipping rule application that might need it."
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
              "IFCContext: IFC API not available & no models: Ensured all classification elements are empty."
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
          e
        );
        return; // Cannot proceed without properties
      }
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
            "IFCContext: No models ready, ensured rule-based elements from classifications are empty."
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
      currentClassificationsForProcessing
    );
    const newElementsPerClassification: Record<string, SelectedElementInfo[]> =
      {};

    for (const classCode of currentClassificationCodes) {
      newElementsPerClassification[classCode] = [];
    }

    const activeRules = rules.filter(
      (rule) =>
        rule.active &&
        currentClassificationsForProcessing[rule.classificationCode]
    );

    for (const model of loadedModels) {
      if (model.modelID == null || !model.spatialTree) continue;
      const allModelElements = getAllElementsFromSpatialTreeNodesRecursive(
        model.spatialTree ? [model.spatialTree] : []
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
              ifcApiInternal
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
                    el.expressID === elementInfo.expressID
                )
              ) {
                newElementsPerClassification[rule.classificationCode].push(
                  elementInfo
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
              error
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
          "IFCContext: Finished applying all active rules. Classifications updated."
        );
      } else {
        console.log(
          "IFCContext: Finished applying all active rules. No changes to classifications elements."
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
    [classifications]
  );
  const rulesKey = useMemo(
    () =>
      JSON.stringify(
        rules.map((r) => ({
          id: r.id,
          active: r.active,
          conditions: r.conditions,
          classificationCode: r.classificationCode,
        }))
      ),
    [rules]
  );
  const modelsReadyKey = useMemo(
    () =>
      loadedModels.filter((m) => m.modelID !== null && m.spatialTree !== null)
        .length,
    [loadedModels]
  );

  useEffect(() => {
    console.log(
      "Main effect for applyAllActiveRules triggered by changes in models, rules, or classification codes."
    );
    applyAllActiveRules();
  }, [modelsReadyKey, rulesKey, classificationCodesKey, applyAllActiveRules]);

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
          model.spatialTree ? [model.spatialTree] : []
        );
        for (const elementNode of allModelElements) {
          if (elementNode.expressID === undefined) continue;
          try {
            const matches = await matchesAllConditionsCallback(
              elementNode,
              rule.conditions,
              model.modelID,
              ifcApiInternal
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
              error
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
          " elements."
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
    ]
  ); // Added previewingRuleId to deps

  const generateFileId = useCallback(
    () => `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    []
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
    ]
  );

  const addIFCModel = useCallback(
    async (
      url: string,
      name: string,
      fileId?: string
    ): Promise<number | null> => {
      setLoadedModels((prev) => [...prev, commonLoadLogic(url, name, fileId)]);
      return null;
    },
    [commonLoadLogic]
  );

  const replaceIFCModel = useCallback(
    async (
      url: string,
      name: string,
      fileId?: string
    ): Promise<number | null> => {
      setLoadedModels([commonLoadLogic(url, name, fileId)]);
      return null;
    },
    [commonLoadLogic]
  );

  const removeIFCModel = useCallback(
    (id: string) => {
      setLoadedModels((prev) =>
        prev.filter((m) => {
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
        })
      );
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
    ]
  );

  const setModelIDForLoadedModel = useCallback(
    (loadedModelId: string, ifcModelId: number) => {
      setLoadedModels((prev) =>
        prev.map((m) =>
          m.id === loadedModelId ? { ...m, modelID: ifcModelId } : m
        )
      );
    },
    [setLoadedModels]
  );

  const setSpatialTreeForModel = useCallback(
    (modelID: number, tree: SpatialStructureNode | null) => {
      setLoadedModels((prevModels) =>
        prevModels.map((m) =>
          m.modelID === modelID ? { ...m, spatialTree: tree } : m
        )
      );
    },
    [setLoadedModels]
  );

  const setRawBufferForModel = useCallback(
    (id: string, buffer: ArrayBuffer) => {
      setLoadedModels((prevModels) =>
        prevModels.map((m) => (m.id === id ? { ...m, rawBuffer: buffer } : m))
      );
    },
    []
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
    ]
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
              " or its elements not found for highlight."
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
    ]
  );

  const setElementProperties = useCallback(
    (properties: any | null) => {
      setElementPropertiesInternal(properties);
    },
    [setElementPropertiesInternal]
  );

  const setAvailableProperties = useCallback(
    (props: string[]) => {
      setAvailablePropertiesInternal(props);
    },
    [setAvailablePropertiesInternal]
  );

  const setAvailableCategoriesForModel = useCallback(
    (modelID: number, cats: string[]) => {
      setAvailableCategoriesInternal((prev) => ({ ...prev, [modelID]: cats }));
    },
    [setAvailableCategoriesInternal]
  );

  const setIfcApi = useCallback(
    (api: IfcAPI | null) => {
      setIfcApiInternal(api);
    },
    [setIfcApiInternal]
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
    [setClassifications]
  );

  const removeClassification = useCallback(
    (code: string) => {
      setClassifications((prev) => {
        const updated = { ...prev };
        delete updated[code];
        return updated;
      });
    },
    [setClassifications]
  );

  const removeAllClassifications = useCallback(() => {
    setClassifications({});
  }, [setClassifications]);

  const updateClassification = useCallback(
    (code: string, classificationItem: any) => {
      setClassifications((prev) => ({ ...prev, [code]: classificationItem }));
    },
    [setClassifications]
  );

  const assignClassificationToElement = useCallback(
    (classificationCode: string, element: SelectedElementInfo) => {
      setClassifications((prev) => {
        const current = prev[classificationCode];
        if (!current) return prev;
        const already = current.elements?.some(
          (el: SelectedElementInfo) =>
            el.modelID === element.modelID && el.expressID === element.expressID
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
    [setClassifications]
  );

  const unassignClassificationFromElement = useCallback(
    (classificationCode: string, element: SelectedElementInfo) => {
      setClassifications((prev) => {
        const current = prev[classificationCode];
        if (!current || !current.elements) return prev;
        const newElements = current.elements.filter(
          (el: SelectedElementInfo) =>
            !(el.modelID === element.modelID && el.expressID === element.expressID)
        );
        if (newElements.length === current.elements.length) return prev;
        return {
          ...prev,
          [classificationCode]: { ...current, elements: newElements },
        };
      });
    },
    [setClassifications]
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
                !(el.modelID === element.modelID && el.expressID === element.expressID)
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
    [setClassifications]
  );

  const addRule = useCallback(
    (ruleItem: Rule) => {
      setRules((prev) => [...prev, ruleItem]);
    },
    [setRules]
  );

  const removeRule = useCallback(
    (id: string) => {
      setRules((prev) => prev.filter((r) => r.id !== id));
    },
    [setRules]
  );

  const updateRule = useCallback(
    (updatedRuleItem: Rule) => {
      setRules((prev) =>
        prev.map((r) => (r.id === updatedRuleItem.id ? updatedRuleItem : r))
      );
    },
    [setRules]
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
    [setClassifications]
  );

  const toggleUserHideElement = useCallback(
    (elementToToggle: SelectedElementInfo) => {
      console.log(
        "IFCContext: toggleUserHideElement called for",
        elementToToggle
      );
      setUserHiddenElements((prevHidden) => {
        const isAlreadyHidden = prevHidden.some(
          (el) =>
            el.modelID === elementToToggle.modelID &&
            el.expressID === elementToToggle.expressID
        );
        if (isAlreadyHidden) {
          console.log(
            "IFCContext: Element was hidden, now showing:",
            elementToToggle
          );
          return prevHidden.filter(
            (el) =>
              !(
                el.modelID === elementToToggle.modelID &&
                el.expressID === elementToToggle.expressID
              )
          );
        } else {
          console.log(
            "IFCContext: Element was visible, now hiding:",
            elementToToggle
          );
          // Check if the element being hidden is the currently selected element
          if (
            selectedElement &&
            selectedElement.modelID === elementToToggle.modelID &&
            selectedElement.expressID === elementToToggle.expressID
          ) {
            console.log(
              "IFCContext: Deselecting element because it is now hidden."
            );
            setSelectedElement(null); // Deselect
            setElementPropertiesInternal(null); // Clear its properties
          }
          return [...prevHidden, elementToToggle];
        }
      });
    },
    [selectedElement, setSelectedElement, setElementPropertiesInternal]
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
        newHidden.length
      );
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
        addClassification,
        removeClassification,
        removeAllClassifications,
        updateClassification,
        assignClassificationToElement,
        unassignClassificationFromElement,
        unassignElementFromAllClassifications,
        addRule,
        removeRule,
        updateRule,
        previewRuleHighlight,
        exportClassificationsAsJson,
        importClassificationsFromJson,
        toggleUserHideElement,
        unhideLastElement,
        unhideAllElements,
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
