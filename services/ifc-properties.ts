export interface ParsedElementProperties {
  modelID: number;
  expressID: number;
  ifcType: string;
  attributes: Record<string, any>;
  propertySets: Record<string, Record<string, any>>;
}

import type { IfcAPI } from "web-ifc";
import { Properties } from "web-ifc";

async function extractPropertyValueRecursive(
  ifcApi: IfcAPI,
  modelID: number,
  propertyEntity: any,
  targetObject: Record<string, any>,
  namePrefix: string = "",
  processedCache: Map<number, any>,
  recursionPath: Set<number>
) {
  if (!propertyEntity || !propertyEntity.Name?.value) return;
  const propExpressID = propertyEntity.expressID;
  if (propExpressID !== undefined) {
    if (recursionPath.has(propExpressID)) {
      targetObject[
        namePrefix ? `${namePrefix}.${propertyEntity.Name.value}` : propertyEntity.Name.value
      ] = "[Cycle Detected]";
      return;
    }
    if (processedCache.has(propExpressID)) return;
    recursionPath.add(propExpressID);
  }

  const propName = propertyEntity.Name.value;
  const fullPropName = namePrefix ? `${namePrefix}.${propName}` : propName;
  const propIfcType =
    typeof propertyEntity.type === "number"
      ? ifcApi.GetNameFromTypeCode(propertyEntity.type)
      : String(propertyEntity.type);

  if (propIfcType === "IFCCOMPLEXPROPERTY") {
    if (propertyEntity.HasProperties && Array.isArray(propertyEntity.HasProperties)) {
      for (const subPropRefOrObject of propertyEntity.HasProperties) {
        let subPropertyEntity = null;
        if (subPropRefOrObject?.value !== undefined && typeof subPropRefOrObject.value === "number") {
          try {
            subPropertyEntity = await ifcApi.GetLine(modelID, subPropRefOrObject.value, true);
          } catch {
            continue;
          }
        } else if (subPropRefOrObject?.expressID !== undefined && subPropRefOrObject.Name?.value) {
          subPropertyEntity = subPropRefOrObject;
        } else {
          continue;
        }
        if (subPropertyEntity) {
          await extractPropertyValueRecursive(
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
    let extractedValue: any = `(Unhandled ${propIfcType})`;
    const unit = propertyEntity.Unit?.value;
    if (propertyEntity.NominalValue?.value !== undefined) {
      extractedValue = propertyEntity.NominalValue.value;
      if (unit) extractedValue = { value: extractedValue, unit };
    } else if (propertyEntity.Value?.value !== undefined) {
      extractedValue = propertyEntity.Value.value;
      if (unit) extractedValue = { value: extractedValue, unit };
    } else if (
      propertyEntity.ListValues?.value !== undefined &&
      Array.isArray(propertyEntity.ListValues.value)
    ) {
      const listVals = propertyEntity.ListValues.value.map((item: any) =>
        item.value !== undefined ? item.value : item
      );
      extractedValue = unit ? { values: listVals, unit } : listVals;
    } else if (
      propertyEntity.EnumerationValues?.value !== undefined &&
      Array.isArray(propertyEntity.EnumerationValues.value)
    ) {
      const enumVals = propertyEntity.EnumerationValues.value.map((item: any) =>
        item.value !== undefined ? item.value : item
      );
      extractedValue = unit ? { values: enumVals, unit } : enumVals;
    } else if (
      propertyEntity.LowerBoundValue?.value !== undefined ||
      propertyEntity.UpperBoundValue?.value !== undefined
    ) {
      extractedValue = {} as any;
      if (propertyEntity.LowerBoundValue?.value !== undefined)
        extractedValue.LowerBound = propertyEntity.LowerBoundValue.value;
      if (propertyEntity.UpperBoundValue?.value !== undefined)
        extractedValue.UpperBound = propertyEntity.UpperBoundValue.value;
      if (unit) extractedValue.Unit = unit;
    } else if (propertyEntity.NominalValue === null) {
      extractedValue = `(${ifcApi.GetNameFromTypeCode(propertyEntity.type as number)})`;
    }
    targetObject[fullPropName] = extractedValue;
  }

  if (propExpressID !== undefined) {
    processedCache.set(propExpressID, true);
    recursionPath.delete(propExpressID);
  }
}

function extractDirectAttributes(
  entity: any,
  targetObject: Record<string, any>,
  excludedKeys: string[] = [
    "expressID",
    "type",
    "GlobalId",
    "OwnerHistory",
    "HasPropertySets",
    "HasProperties",
    "HasAssociations",
    "DefiningValues",
    "RepresentationMaps",
    "IsRelatedWith",
    "RelatesProperties",
    "MaterialLayers",
    "Materials",
    "ApplicableOccurrence",
    "ObjectPlacement",
    "Representation",
  ]
) {
  for (const key in entity) {
    if (Object.prototype.hasOwnProperty.call(entity, key)) {
      if (key.startsWith("_") || excludedKeys.includes(key)) continue;
      const attributeValue = entity[key];
      if (attributeValue === null) {
        targetObject[key] = null;
      } else if (attributeValue?.value !== undefined && typeof attributeValue.type === "number") {
        targetObject[key] = attributeValue.value;
      } else if (typeof attributeValue !== "object") {
        targetObject[key] = attributeValue;
      } else if (attributeValue?.value !== undefined && attributeValue.type === undefined) {
        targetObject[key] = attributeValue.value;
      }
    }
  }
}

export async function getAllElementProperties(
  ifcApi: IfcAPI,
  modelID: number,
  expressID: number
): Promise<ParsedElementProperties> {
  if (!ifcApi.properties) ifcApi.properties = new Properties(ifcApi);

  const elementDataFromServer = await ifcApi.GetLine(modelID, expressID, true);
  const elementType = ifcApi.GetNameFromTypeCode(elementDataFromServer.type);

  const psetsData: Record<string, Record<string, any>> = {};
  psetsData["Element Attributes"] = {};
  for (const key in elementDataFromServer) {
    if (Object.prototype.hasOwnProperty.call(elementDataFromServer, key)) {
      if (key === "expressID" || key === "type") continue;
      const value = elementDataFromServer[key];
      if (typeof value !== "object" || value === null) psetsData["Element Attributes"][key] = value;
      else if (value && value.value !== undefined) psetsData["Element Attributes"][key] = value.value;
    }
  }

  const processApiPset = async (
    psetEntity: any,
    targetPSetData: Record<string, any>,
    name: string
  ) => {
    if (psetEntity.HasProperties && Array.isArray(psetEntity.HasProperties)) {
      const processedCache = new Map<number, any>();
      const recursionPath = new Set<number>();
      for (const propRefOrObject of psetEntity.HasProperties) {
        let propToProcess = null;
        if (propRefOrObject?.value !== undefined && typeof propRefOrObject.value === "number") {
          try {
            propToProcess = await ifcApi.GetLine(modelID, propRefOrObject.value, true);
          } catch {
            continue;
          }
        } else if (propRefOrObject?.expressID !== undefined && propRefOrObject.Name?.value) {
          propToProcess = propRefOrObject;
        } else {
          continue;
        }
        if (propToProcess) {
          await extractPropertyValueRecursive(
            ifcApi,
            modelID,
            propToProcess,
            targetPSetData,
            "",
            processedCache,
            recursionPath
          );
        }
      }
    }
  };

  const instancePsets = await ifcApi.properties.getPropertySets(modelID, expressID, true, false);
  if (instancePsets && instancePsets.length > 0) {
    for (const pset of instancePsets) {
      if (pset && pset.Name?.value && ifcApi.GetNameFromTypeCode(pset.type) === "IFCPROPERTYSET") {
        const psetName = pset.Name.value;
        if (!psetsData[psetName]) psetsData[psetName] = {};
        await processApiPset(pset, psetsData[psetName], psetName);
      }
    }
  }

  const typeObjects = await ifcApi.properties.getTypeProperties(modelID, expressID, true);
  if (typeObjects && typeObjects.length > 0) {
    for (const typeObject of typeObjects) {
      const typeObjectName = typeObject?.Name?.value || `TypeObject_${typeObject.expressID || 0}`;
      const typeAttributesPSetName = `Type Attributes: ${typeObjectName}`;
      if (!psetsData[typeAttributesPSetName]) psetsData[typeAttributesPSetName] = {};
      extractDirectAttributes(typeObject, psetsData[typeAttributesPSetName], ["Name", "Description"]);
      if (Object.keys(psetsData[typeAttributesPSetName]).length === 0)
        delete psetsData[typeAttributesPSetName];

      if (typeObject.HasPropertySets && Array.isArray(typeObject.HasPropertySets)) {
        for (const propDefRefOrObject of typeObject.HasPropertySets) {
          let propDefEntity = null;
          if (propDefRefOrObject?.value !== undefined && typeof propDefRefOrObject.value === "number") {
            try {
              propDefEntity = await ifcApi.GetLine(modelID, propDefRefOrObject.value, true);
            } catch {
              continue;
            }
          } else if (propDefRefOrObject?.expressID !== undefined) {
            propDefEntity = propDefRefOrObject;
          } else {
            continue;
          }

          if (propDefEntity) {
            const propDefEntityType = ifcApi.GetNameFromTypeCode(propDefEntity.type);
            const propDefInstanceName = propDefEntity.Name?.value;
            if (propDefEntityType === "IFCPROPERTYSET") {
              const psetName = propDefInstanceName || "Unnamed PSet";
              const finalPsetName = `${psetName} (from Type: ${typeObjectName})`;
              if (!psetsData[finalPsetName]) psetsData[finalPsetName] = {};
              await processApiPset(propDefEntity, psetsData[finalPsetName], finalPsetName);
            } else if (propDefEntityType) {
              const groupNameSuggestion = propDefInstanceName || propDefEntityType;
              const groupName = `${groupNameSuggestion} (from Type: ${typeObjectName})`;
              if (!psetsData[groupName]) psetsData[groupName] = {};
              extractDirectAttributes(propDefEntity, psetsData[groupName]);
              if (Object.keys(psetsData[groupName]).length === 0) delete psetsData[groupName];
            }
          }
        }
      }
    }
  }

  let materialsAndDefs = await ifcApi.properties.getMaterialsProperties(modelID, expressID, true, true);
  if (!materialsAndDefs || materialsAndDefs.length === 0) {
    const relAssociatesMaterialIDs = await ifcApi.GetLineIDsWithType(modelID, 300348915); // IFCRELASSOCIATESMATERIAL
    const found: any[] = [];
    for (let i = 0; i < relAssociatesMaterialIDs.size(); i++) {
      const relID = relAssociatesMaterialIDs.get(i);
      const rel = await ifcApi.GetLine(modelID, relID, false);
      if (rel.RelatedObjects && Array.isArray(rel.RelatedObjects)) {
        const isElementAssociated = rel.RelatedObjects.some((obj: any) => obj.value === expressID);
        if (isElementAssociated && rel.RelatingMaterial?.value) {
          try {
            const materialEntity = await ifcApi.GetLine(modelID, rel.RelatingMaterial.value, true);
            if (materialEntity) found.push(materialEntity);
          } catch {
            /* ignore */
          }
        }
      }
    }
    if (found.length > 0) materialsAndDefs = found;
  }

  if (materialsAndDefs && materialsAndDefs.length > 0) {
    for (const matDef of materialsAndDefs) {
      const matDefType = ifcApi.GetNameFromTypeCode(matDef.type);
      const matDefNameFromIFC = matDef.Name?.value;
      let groupName = "";
      if (matDefType === "IFCMATERIAL") {
        const materialName = matDefNameFromIFC || `Material_${matDef.expressID}`;
        groupName = `Material: ${materialName}`;
        if (!psetsData[groupName]) psetsData[groupName] = {};
        extractDirectAttributes(matDef, psetsData[groupName], ["Name", "Description"]);
      } else if (matDefType === "IFCMATERIALLAYERSET") {
        const layerSetName = matDefNameFromIFC || `MatLayerSet_${matDef.expressID}`;
        groupName = `LayerSet: ${layerSetName}`;
        if (!psetsData[groupName]) psetsData[groupName] = {};
        if (matDef.TotalThickness?.value !== undefined)
          psetsData[groupName]["TotalThickness"] = matDef.TotalThickness.value;
        if (matDef.MaterialLayers && Array.isArray(matDef.MaterialLayers)) {
          for (const [index, layerEntity] of matDef.MaterialLayers.entries()) {
            psetsData[groupName][`Layer_${index + 1}_Thickness`] = layerEntity.LayerThickness?.value;
            psetsData[groupName][`Layer_${index + 1}_Material`] =
              layerEntity.Material?.Name?.value || layerEntity.Material?.value || "Unknown Material";
          }
        }
        if (
          Object.keys(psetsData[groupName]).length === 0 &&
          !psetsData[groupName]["TotalThickness"]
        )
          delete psetsData[groupName];
        else if (
          Object.keys(psetsData[groupName]).length === 1 &&
          psetsData[groupName]["TotalThickness"] &&
          (!matDef.MaterialLayers || matDef.MaterialLayers.length === 0)
        )
          delete psetsData[groupName];
      } else if (matDefType === "IFCMATERIALPROPERTIES") {
        const psetName = matDefNameFromIFC || "Material Properties";
        groupName = `Material Properties: ${psetName}`;
        if (!psetsData[groupName]) psetsData[groupName] = {};
        await processApiPset(matDef, psetsData[groupName], groupName);
        if (Object.keys(psetsData[groupName]).length === 0) delete psetsData[groupName];
      } else if (matDefType === "IFCMATERIALLIST") {
        const listName = matDefNameFromIFC || `MatList_${matDef.expressID}`;
        groupName = `MaterialList: ${listName}`;
        if (!psetsData[groupName]) psetsData[groupName] = {};
        if (matDef.Materials && Array.isArray(matDef.Materials)) {
          for (const [index, materialRef] of matDef.Materials.entries()) {
            if (materialRef?.value) {
              try {
                const material = await ifcApi.GetLine(modelID, materialRef.value, true);
                psetsData[groupName][`Material_${index + 1}`] =
                  material.Name?.value || `UnnamedMaterial_${material.expressID}`;
              } catch {
                /* ignore */
              }
            }
          }
        }
        if (Object.keys(psetsData[groupName]).length === 0) delete psetsData[groupName];
      } else {
        const groupNameSuggestion = matDefNameFromIFC || matDefType;
        groupName = `MaterialInfo: ${groupNameSuggestion}`;
        if (!psetsData[groupName]) psetsData[groupName] = {};
        extractDirectAttributes(matDef, psetsData[groupName], ["Name", "Description"]);
        if (Object.keys(psetsData[groupName]).length === 0) delete psetsData[groupName];
      }
    }
  }

  return {
    modelID,
    expressID,
    ifcType: elementType,
    attributes: elementDataFromServer,
    propertySets: psetsData,
  };
}
