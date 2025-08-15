import type { IfcAPI } from "web-ifc";

export interface ParsedElementProperties {
    modelID: number;
    expressID: number;
    ifcType: string | null;
    attributes: Record<string, any>;
    propertySets: Record<string, Record<string, any>>;
}

/**
 * Extract simple property value from an IFC property entity
 */
function extractSimplePropertyValue(property: any): any {
    // Handle direct value properties
    if (property.NominalValue?.value !== undefined) {
        return property.NominalValue.value;
    }
    if (property.Value?.value !== undefined) {
        return property.Value.value;
    }

    // Handle list values
    if (property.ListValues && Array.isArray(property.ListValues)) {
        return property.ListValues.map((item: any) =>
            item.value !== undefined ? item.value : item
        );
    }

    // Handle enumeration values
    if (property.EnumerationValues && Array.isArray(property.EnumerationValues)) {
        return property.EnumerationValues.map((item: any) =>
            item.value !== undefined ? item.value : item
        );
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
                const value = extractSimplePropertyValue(property);

                if (value !== null && value !== undefined) {
                    properties[propName] = value;
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
