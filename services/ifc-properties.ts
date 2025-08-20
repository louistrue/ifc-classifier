/**
 * Fixed IFC Properties Extractor
 * 
 * Improvements over legacy extractor:
 * - Handles wrapped array formats { value: T[] } from web-ifc
 * - Supports IFCCOMPLEXPROPERTY with cycle-safe recursive extraction
 * - Better error handling and memory management
 * - Consistent property value extraction across all formats
 */

import type { IfcAPI } from "web-ifc";

export interface ParsedElementProperties {
    modelID: number;
    expressID: number;
    ifcType: string | null;
    attributes: Record<string, any>;
    propertySets: Record<string, Record<string, any>>;
}

/**
 * Helper function to extract array values from web-ifc properties
 * Handles both wrapped format { value: T[] } and direct array format T[]
 */
function extractArrayValue(arrayProperty: any): any[] | null {
    // First check for wrapped format { value: T[] } - most common in web-ifc
    if (arrayProperty?.value && Array.isArray(arrayProperty.value)) {
        return arrayProperty.value.map((item: any) =>
            item.value !== undefined ? item.value : item
        );
    }
    // Fallback for direct array format T[] - for backward compatibility
    if (arrayProperty && Array.isArray(arrayProperty)) {
        return arrayProperty.map((item: any) =>
            item.value !== undefined ? item.value : item
        );
    }
    return null;
}

/**
 * Recursively extract complex property values with cycle detection
 * @param ifcApi IFC API instance
 * @param modelID Model ID
 * @param propertyEntity The property entity to process
 * @param targetObject Target object to store extracted values
 * @param namePrefix Prefix for nested property names
 * @param processedCache Cache of processed property IDs to avoid reprocessing
 * @param recursionPath Set to track current recursion path for cycle detection
 */
async function extractComplexPropertyRecursive(
    ifcApi: IfcAPI,
    modelID: number,
    propertyEntity: any,
    targetObject: Record<string, any>,
    namePrefix: string = "",
    processedCache: Map<number, boolean> = new Map(),
    recursionPath: Set<number> = new Set()
): Promise<void> {
    if (!propertyEntity || !propertyEntity.Name?.value) {
        return;
    }

    const propExpressID = propertyEntity.expressID;
    const propName = propertyEntity.Name.value;
    const fullPropName = namePrefix ? `${namePrefix}.${propName}` : propName;

    // Cycle detection
    if (propExpressID !== undefined) {
        if (recursionPath.has(propExpressID)) {
            targetObject[fullPropName] = "[Cycle Detected]";
            return;
        }
        if (processedCache.has(propExpressID)) {
            return; // Already processed
        }
        recursionPath.add(propExpressID);
    }

    // Get property type
    const propIfcType = typeof propertyEntity.type === "number"
        ? ifcApi.GetNameFromTypeCode(propertyEntity.type)
        : String(propertyEntity.type);

    if (propIfcType === "IFCCOMPLEXPROPERTY") {
        // Handle complex properties recursively
        if (propertyEntity.HasProperties) {
            const propsArray = Array.isArray(propertyEntity.HasProperties)
                ? propertyEntity.HasProperties
                : [propertyEntity.HasProperties];

            for (const subPropRef of propsArray) {
                let subPropertyEntity = null;

                // Handle reference to sub-property (by ID)
                if (subPropRef?.value !== undefined && typeof subPropRef.value === "number") {
                    try {
                        subPropertyEntity = await ifcApi.GetLine(modelID, subPropRef.value, true);
                    } catch (e) {
                        console.warn(`Failed to get sub-property ${subPropRef.value}:`, e);
                        continue;
                    }
                } else if (subPropRef?.expressID !== undefined && subPropRef.Name?.value) {
                    // Handle embedded sub-property object
                    subPropertyEntity = subPropRef;
                }

                if (subPropertyEntity) {
                    await extractComplexPropertyRecursive(
                        ifcApi,
                        modelID,
                        subPropertyEntity,
                        targetObject,
                        fullPropName,
                        processedCache,
                        recursionPath
                    );
                }
            }
        }
    } else {
        // Handle simple property - extract value using existing logic
        const value = extractSimplePropertyValue(propertyEntity);
        if (value !== null && value !== undefined) {
            targetObject[fullPropName] = value;
        }
    }

    // Mark as processed and remove from recursion path
    if (propExpressID !== undefined) {
        processedCache.set(propExpressID, true);
        recursionPath.delete(propExpressID);
    }
}

/**
 * Test function to verify complex property extraction (for development/debugging)
 * @internal
 */
function testComplexPropertyExtraction() {
    // Mock complex property structure
    const mockComplexProperty = {
        expressID: 12345,
        type: "IFCCOMPLEXPROPERTY",
        Name: { value: "ComplexMaterial" },
        HasProperties: [
            {
                expressID: 12346,
                type: "IFCPROPERTYSINGLEVALUE",
                Name: { value: "Density" },
                NominalValue: { value: 2400 }
            },
            {
                expressID: 12347,
                type: "IFCCOMPLEXPROPERTY", // Nested complex property
                Name: { value: "Composition" },
                HasProperties: [
                    {
                        expressID: 12348,
                        type: "IFCPROPERTYSINGLEVALUE",
                        Name: { value: "Cement" },
                        NominalValue: { value: 0.3 }
                    }
                ]
            }
        ]
    };

    console.log("Mock complex property structure:", JSON.stringify(mockComplexProperty, null, 2));
    // Expected output should include:
    // - ComplexMaterial.Density: 2400
    // - ComplexMaterial.Composition.Cement: 0.3
}

/**
 * Test function to verify array extraction logic (for development/debugging)
 * @internal
 */
function testArrayExtraction() {
    // Test wrapped format
    const wrappedFormat = {
        ListValues: {
            value: [
                { value: "Item1" },
                { value: "Item2" },
                "DirectItem"
            ]
        }
    };

    // Test direct format
    const directFormat = {
        ListValues: [
            { value: "Item1" },
            { value: "Item2" },
            "DirectItem"
        ]
    };

    console.log("Testing wrapped format:", extractArrayValue(wrappedFormat.ListValues));
    console.log("Testing direct format:", extractArrayValue(directFormat.ListValues));
}

/**
 * Extract simple property value from an IFC property entity
 * Handles various IFC property value formats including wrapped arrays
 */
function extractSimplePropertyValue(property: any): any {
    // Handle direct value properties
    if (property.NominalValue?.value !== undefined) {
        return property.NominalValue.value;
    }
    if (property.Value?.value !== undefined) {
        return property.Value.value;
    }

    // Handle list values (both wrapped { value: T[] } and direct T[] formats)
    const listValues = extractArrayValue(property.ListValues);
    if (listValues !== null) {
        return listValues;
    }

    // Handle enumeration values (both wrapped { value: T[] } and direct T[] formats)
    const enumerationValues = extractArrayValue(property.EnumerationValues);
    if (enumerationValues !== null) {
        return enumerationValues;
    }

    // Handle bounded values
    if (property.LowerBoundValue?.value !== undefined || property.UpperBoundValue?.value !== undefined) {
        const result: any = {};
        if (property.LowerBoundValue?.value !== undefined) {
            result.LowerBound = property.LowerBoundValue.value;
        }
        if (property.UpperBoundValue?.value !== undefined) {
            result.UpperBound = property.UpperBoundValue.value;
        }
        return result;
    }

    return null;
}

/**
 * Process a single property set and extract its properties
 */
async function processPropertySet(
    ifcApi: IfcAPI,
    modelID: number,
    pset: any
): Promise<Record<string, any>> {
    const properties: Record<string, any> = {};



    // For regular property sets (IFCPROPERTYSET)
    if (pset.HasProperties) {
        const propsArray = Array.isArray(pset.HasProperties) ? pset.HasProperties : [pset.HasProperties];
        for (const propRef of propsArray) {

            let property = null;

            // Handle reference to property (by ID)
            if (propRef?.value !== undefined && typeof propRef.value === "number") {
                try {
                    property = await ifcApi.GetLine(modelID, propRef.value, true);

                } catch (e) {
                    console.warn(`Failed to get property ${propRef.value}:`, e);
                    continue;
                }
            } else if (propRef && typeof propRef === 'object' && propRef.Name?.value) {
                // Handle embedded property object
                property = propRef;

            }

            if (property && property.Name?.value) {
                const propName = property.Name.value;

                // Check if this is a complex property
                const propIfcType = typeof property.type === "number"
                    ? ifcApi.GetNameFromTypeCode(property.type)
                    : String(property.type);

                if (propIfcType === "IFCCOMPLEXPROPERTY") {
                    // Use recursive extraction for complex properties
                    const processedCache = new Map<number, boolean>();
                    const recursionPath = new Set<number>();
                    await extractComplexPropertyRecursive(
                        ifcApi,
                        modelID,
                        property,
                        properties,
                        "", // No prefix for top-level properties
                        processedCache,
                        recursionPath
                    );
                } else {
                    // Use simple extraction for regular properties
                    const value = extractSimplePropertyValue(property);
                    if (value !== null && value !== undefined) {
                        properties[propName] = value;
                    }
                }
            }
        }
    }

    // For element quantities (IFCELEMENTQUANTITY)
    if (pset.Quantities) {
        const quantitiesArray = Array.isArray(pset.Quantities) ? pset.Quantities : [pset.Quantities];
        for (const quantityRef of quantitiesArray) {

            let quantity = null;

            if (quantityRef?.value !== undefined && typeof quantityRef.value === "number") {
                try {
                    quantity = await ifcApi.GetLine(modelID, quantityRef.value, true);

                } catch (e) {
                    console.warn(`Failed to get quantity ${quantityRef.value}:`, e);
                    continue;
                }
            } else if (quantityRef && typeof quantityRef === 'object' && quantityRef.Name?.value) {
                quantity = quantityRef;

            }

            if (quantity && quantity.Name?.value) {
                const quantityName = quantity.Name.value;
                let value = null;
                let unit = quantity.Unit?.value || "";

                // Extract quantity values based on type
                if (quantity.LengthValue?.value !== undefined) {
                    value = { value: quantity.LengthValue.value, unit: unit || "m" };
                } else if (quantity.AreaValue?.value !== undefined) {
                    value = { value: quantity.AreaValue.value, unit: unit || "m²" };
                } else if (quantity.VolumeValue?.value !== undefined) {
                    value = { value: quantity.VolumeValue.value, unit: unit || "m³" };
                } else if (quantity.CountValue?.value !== undefined) {
                    value = quantity.CountValue.value;
                } else if (quantity.WeightValue?.value !== undefined) {
                    value = { value: quantity.WeightValue.value, unit: unit || "kg" };
                } else if (quantity.TimeValue?.value !== undefined) {
                    value = { value: quantity.TimeValue.value, unit: unit || "s" };
                }

                if (value !== null && value !== undefined) {
                    properties[quantityName] = value;
                }
            }
        }
    }


    return properties;
}

/**
 * Get all properties for an element
 */
export async function getAllElementProperties(
    ifcApi: IfcAPI,
    modelID: number,
    expressID: number
): Promise<ParsedElementProperties> {
    // Get the element data
    const element = await ifcApi.GetLine(modelID, expressID, true);
    const elementType = ifcApi.GetNameFromTypeCode(element.type);

    // Initialize property sets
    const propertySets: Record<string, Record<string, any>> = {};

    // Add element attributes
    propertySets["Element Attributes"] = {};
    for (const key in element) {
        if (Object.prototype.hasOwnProperty.call(element, key)) {
            if (key === "expressID" || key === "type") continue;
            const value = element[key];
            if (typeof value !== "object" || value === null) {
                propertySets["Element Attributes"][key] = value;
            } else if (value && value.value !== undefined) {
                propertySets["Element Attributes"][key] = value.value;
            }
        }
    }

    // Get instance property sets
    try {
        const instancePsets = await ifcApi.properties.getPropertySets(modelID, expressID, true, false);


        if (instancePsets && Array.isArray(instancePsets)) {
            for (const pset of instancePsets) {
                if (pset && pset.Name?.value) {
                    const psetName = pset.Name.value;
                    const psetType = ifcApi.GetNameFromTypeCode(pset.type);


                    // Only process IFCPROPERTYSET and IFCELEMENTQUANTITY (case-insensitive)
                    const upperType = psetType?.toUpperCase();
                    if (upperType === "IFCPROPERTYSET" || upperType === "IFCELEMENTQUANTITY") {
                        const properties = await processPropertySet(ifcApi, modelID, pset);
                        if (Object.keys(properties).length > 0) {
                            propertySets[psetName] = properties;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Failed to get property sets:", e);
    }

    // Get type property sets
    try {
        const typeObjects = await ifcApi.properties.getTypeProperties(modelID, expressID, true);


        if (typeObjects && Array.isArray(typeObjects)) {
            for (const typeObject of typeObjects) {
                if (typeObject) {
                    const typeName = typeObject.Name?.value || `Type_${typeObject.expressID}`;

                    // Add type attributes
                    const typeAttrName = `Type Attributes: ${typeName}`;
                    propertySets[typeAttrName] = {};
                    for (const key in typeObject) {
                        if (["expressID", "type", "HasPropertySets", "Name", "Description"].includes(key)) continue;
                        const value = typeObject[key];
                        if (value !== null && value !== undefined) {
                            if (typeof value !== "object") {
                                propertySets[typeAttrName][key] = value;
                            } else if (value.value !== undefined) {
                                propertySets[typeAttrName][key] = value.value;
                            }
                        }
                    }
                    if (Object.keys(propertySets[typeAttrName]).length === 0) {
                        delete propertySets[typeAttrName];
                    }

                    // Process type property sets
                    if (typeObject.HasPropertySets && Array.isArray(typeObject.HasPropertySets)) {
                        for (const psetRef of typeObject.HasPropertySets) {
                            let pset = null;

                            if (psetRef?.value !== undefined && typeof psetRef.value === "number") {
                                try {
                                    pset = await ifcApi.GetLine(modelID, psetRef.value, true);
                                } catch (e) {
                                    continue;
                                }
                            } else if (psetRef && typeof psetRef === 'object' && psetRef.Name?.value) {
                                pset = psetRef;
                            }

                            if (pset && pset.Name?.value) {
                                const psetName = `${pset.Name.value} (from Type: ${typeName})`;
                                const psetType = ifcApi.GetNameFromTypeCode(pset.type);
                                const upperType = psetType?.toUpperCase();

                                if (upperType === "IFCPROPERTYSET" || upperType === "IFCELEMENTQUANTITY") {
                                    const properties = await processPropertySet(ifcApi, modelID, pset);
                                    if (Object.keys(properties).length > 0) {
                                        propertySets[psetName] = properties;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Failed to get type properties:", e);
    }

    // Get material properties
    try {
        const materials = await ifcApi.properties.getMaterialsProperties(modelID, expressID, true, true);


        if (materials && Array.isArray(materials)) {
            for (const material of materials) {
                if (material) {
                    const materialType = ifcApi.GetNameFromTypeCode(material.type);
                    const materialName = material.Name?.value || `Material_${material.expressID}`;
                    const upperMaterialType = materialType?.toUpperCase();

                    if (upperMaterialType === "IFCMATERIAL") {
                        const groupName = `Material: ${materialName}`;
                        propertySets[groupName] = {};
                        for (const key in material) {
                            if (["expressID", "type", "Name"].includes(key)) continue;
                            const value = material[key];
                            if (value !== null && value !== undefined) {
                                if (typeof value !== "object") {
                                    propertySets[groupName][key] = value;
                                } else if (value.value !== undefined) {
                                    propertySets[groupName][key] = value.value;
                                }
                            }
                        }
                        if (Object.keys(propertySets[groupName]).length === 0) {
                            delete propertySets[groupName];
                        }
                    } else if (upperMaterialType === "IFCMATERIALLAYERSET") {
                        const groupName = `LayerSet: ${materialName}`;
                        propertySets[groupName] = {};

                        if (material.TotalThickness?.value !== undefined) {
                            propertySets[groupName]["TotalThickness"] = material.TotalThickness.value;
                        }

                        if (material.MaterialLayers && Array.isArray(material.MaterialLayers)) {
                            for (let i = 0; i < material.MaterialLayers.length; i++) {
                                const layer = material.MaterialLayers[i];
                                propertySets[groupName][`Layer_${i + 1}_Thickness`] = layer.LayerThickness?.value;
                                propertySets[groupName][`Layer_${i + 1}_Material`] =
                                    layer.Material?.Name?.value || layer.Material?.value || "Unknown";
                            }
                        }

                        if (Object.keys(propertySets[groupName]).length === 0) {
                            delete propertySets[groupName];
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Failed to get material properties:", e);
    }



    return {
        modelID,
        expressID,
        ifcType: elementType,
        attributes: element,
        propertySets
    };
}
