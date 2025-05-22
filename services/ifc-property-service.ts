import { IfcAPI, Properties, IFCRELASSOCIATESMATERIAL } from "web-ifc";

export interface ElementProperties {
  modelID: number;
  expressID: number;
  ifcType: string;
  attributes: Record<string, any>;
  propertySets: Record<string, Record<string, any>>;
}

const cache: Map<number, Map<number, ElementProperties>> = new Map();
const MAX_MODELS_IN_CACHE = 10;
const MAX_CACHE_ENTRIES = 1000;

async function ensureProps(api: IfcAPI) {
  if (!api.properties) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – web-ifc does not declare .properties
    api.properties = new Properties(api);
  }
}

async function extractPropertyValueRecursive(
  api: IfcAPI,
  modelID: number,
  propertyEntity: any,
  targetObject: Record<string, any>,
  namePrefix = "",
  processedCache: Map<number, any>,
  recursionPath: Set<number>,
) {
  if (!propertyEntity || !propertyEntity.Name?.value) return;

  const propExpressID = propertyEntity.expressID;

  if (propExpressID !== undefined) {
    if (recursionPath.has(propExpressID)) {
      targetObject[
        namePrefix
          ? `${namePrefix}.${propertyEntity.Name.value}`
          : propertyEntity.Name.value
      ] = "[Cycle Detected]";
      return;
    }
    if (processedCache.has(propExpressID)) {
      return;
    }
    recursionPath.add(propExpressID);
  }

  const propName = propertyEntity.Name.value;
  const fullPropName = namePrefix ? `${namePrefix}.${propName}` : propName;
  const propIfcType =
    typeof propertyEntity.type === "number"
      ? api.GetNameFromTypeCode(propertyEntity.type)
      : String(propertyEntity.type);

  if (propIfcType === "IFCCOMPLEXPROPERTY") {
    if (propertyEntity.HasProperties && Array.isArray(propertyEntity.HasProperties)) {
      for (const subPropRef of propertyEntity.HasProperties) {
        let subEntity: any = null;
        if (subPropRef?.value !== undefined && typeof subPropRef.value === "number") {
          try {
            subEntity = await api.GetLine(modelID, subPropRef.value, true);
          } catch {
            continue;
          }
        } else if (subPropRef?.expressID !== undefined) {
          subEntity = subPropRef;
        }
        if (subEntity) {
          await extractPropertyValueRecursive(
            api,
            modelID,
            subEntity,
            targetObject,
            fullPropName,
            processedCache,
            recursionPath,
          );
        }
      }
    }
  } else {
    let extractedValue: any = `(Unhandled ${propIfcType})`;
    const unit = propertyEntity.Unit?.value;

    if (propertyEntity.NominalValue?.value !== undefined) {
      extractedValue = propertyEntity.NominalValue.value;
    } else if (propertyEntity.Value?.value !== undefined) {
      extractedValue = propertyEntity.Value.value;
    } else if (
      propertyEntity.ListValues?.value !== undefined &&
      Array.isArray(propertyEntity.ListValues.value)
    ) {
      extractedValue = propertyEntity.ListValues.value.map((i: any) =>
        i.value !== undefined ? i.value : i,
      );
    } else if (
      propertyEntity.EnumerationValues?.value !== undefined &&
      Array.isArray(propertyEntity.EnumerationValues.value)
    ) {
      extractedValue = propertyEntity.EnumerationValues.value.map((i: any) =>
        i.value !== undefined ? i.value : i,
      );
    } else if (
      propertyEntity.LowerBoundValue?.value !== undefined ||
      propertyEntity.UpperBoundValue?.value !== undefined
    ) {
      extractedValue = {} as Record<string, any>;
      if (propertyEntity.LowerBoundValue?.value !== undefined)
        extractedValue.LowerBound = propertyEntity.LowerBoundValue.value;
      if (propertyEntity.UpperBoundValue?.value !== undefined)
        extractedValue.UpperBound = propertyEntity.UpperBoundValue.value;
    } else if (propertyEntity.NominalValue === null) {
      extractedValue = `(${propIfcType})`;
    }

    if (unit) {
      if (typeof extractedValue === "object" && !Array.isArray(extractedValue)) {
        extractedValue.Unit = unit;
      } else {
        extractedValue = { value: extractedValue, unit };
      }
    }

    targetObject[fullPropName] = extractedValue;
  }

  if (propExpressID !== undefined) {
    processedCache.set(propExpressID, true);
    recursionPath.delete(propExpressID);
  }
}

async function loadPset(
  api: IfcAPI,
  modelID: number,
  psetEntity: any,
  target: Record<string, any>,
  visited: Set<number>,
) {
  if (psetEntity.HasProperties && Array.isArray(psetEntity.HasProperties)) {
    const processedCache = new Map<number, any>();
    for (const propRef of psetEntity.HasProperties) {
      const id = propRef?.value ?? propRef?.expressID;
      if (!id || visited.has(id)) continue;
      let prop: any = null;
      try {
        prop = await api.GetLine(modelID, id, true);
      } catch {
        continue;
      }
      if (!prop?.Name?.value) continue;
      visited.add(id);
      const recursionPath = new Set<number>();
      await extractPropertyValueRecursive(
        api,
        modelID,
        prop,
        target,
        "",
        processedCache,
        recursionPath,
      );
    }
  }
}

export async function getElementProperties(
  api: IfcAPI,
  modelID: number,
  expressID: number,
): Promise<ElementProperties> {
  let mCache = cache.get(modelID);

  if (mCache) {
    cache.delete(modelID);
    cache.set(modelID, mCache);

    if (mCache.has(expressID)) {
      const cachedResult = mCache.get(expressID)!;
      mCache.delete(expressID);
      mCache.set(expressID, cachedResult);
      return cachedResult;
    }
  } else {
    if (cache.size >= MAX_MODELS_IN_CACHE && MAX_MODELS_IN_CACHE > 0) {
      const oldestModelID = cache.keys().next().value;
      if (oldestModelID !== undefined) {
        cache.delete(oldestModelID);
      }
    }
    mCache = new Map<number, ElementProperties>();
    cache.set(modelID, mCache);
  }

  await ensureProps(api);

  let attributes: Record<string, any> = {};
  let ifcType: string = "Unknown";

  try {
    attributes = await api.GetLine(modelID, expressID, true);
    ifcType = api.GetNameFromTypeCode(attributes.type);
  } catch (error) {
    console.error(
      `Error fetching attributes for modelID: ${modelID}, expressID: ${expressID}`,
      error,
    );
    attributes = { error: "Failed to load attributes" };
  }

  const propertySets: Record<string, Record<string, any>> = {};
  let psets: any[] = [];
  try {
    psets = await api.properties.getPropertySets(modelID, expressID, true, true);
  } catch (error) {
    console.error(
      `Error fetching property sets for modelID: ${modelID}, expressID: ${expressID}`,
      error,
    );
  }

  for (const pset of psets ?? []) {
    if (pset.Name?.value) {
      const name = pset.Name.value;
      propertySets[name] = {};
      const visited = new Set<number>();
      try {
        visited.add(pset.expressID);
        await loadPset(api, modelID, pset, propertySets[name], visited);
      } catch (error) {
        console.error(
          `Error loading pset ${name} for modelID: ${modelID}, expressID: ${expressID}`,
          error,
        );
        propertySets[name] = { error: "Failed to load pset" };
      }
    }
  }

  let typePsets: any[] = [];
  try {
    typePsets = await api.properties.getTypeProperties(modelID, expressID, true);
  } catch (error) {
    console.error(
      `Error fetching type properties for modelID: ${modelID}, expressID: ${expressID}`,
      error,
    );
  }

  for (const t of typePsets ?? []) {
    const tName = t.Name?.value || `Type_${t.expressID}`;
    const key = `Type Attributes: ${tName}`;
    propertySets[key] = {};
    for (const k in t) {
      if (k === "type" || k === "expressID" || k.startsWith("_")) continue;
      const v = t[k];
      if (typeof v !== "object" || v === null) propertySets[key][k] = v;
      else if (v.value !== undefined) propertySets[key][k] = v.value;
    }
    if (t.HasPropertySets) {
      for (const ps of t.HasPropertySets) {
        const id = ps?.value ?? ps?.expressID;
        if (!id) continue;
        try {
          const pset = await api.GetLine(modelID, id, true);
          if (pset?.Name?.value) {
            const name = `${pset.Name.value} (from Type: ${tName})`;
            propertySets[name] = {};
            const visited = new Set<number>();
            visited.add(pset.expressID);
            await loadPset(api, modelID, pset, propertySets[name], visited);
          }
        } catch (error) {
          console.error(
            `Error loading pset from type for modelID: ${modelID}, expressID: ${expressID}, pset ID: ${id}`,
            error,
          );
          const errorKey = `Error_TypePset_${id}`;
          propertySets[errorKey] = { error: "Failed to load pset from type" };
        }
      }
    }
  }

  let mats: any[] = [];
  try {
    mats = await api.properties.getMaterialsProperties(modelID, expressID, true, true);
  } catch (error) {
    console.error(
      `Error fetching material properties for modelID: ${modelID}, expressID: ${expressID}`,
      error,
    );
  }

  if (!mats || mats.length === 0) {
    try {
      const relIds = await api.GetLineIDsWithType(modelID, IFCRELASSOCIATESMATERIAL);
      for (let i = 0; i < relIds.size(); i++) {
        const rel = await api.GetLine(modelID, relIds.get(i), false);
        if (rel.RelatedObjects?.some((o: any) => o.value === expressID) && rel.RelatingMaterial?.value) {
          const mat = await api.GetLine(modelID, rel.RelatingMaterial.value, true);
          mats = mats || [];
          mats.push(mat);
        }
      }
    } catch (error) {
      console.error(
        `Error fetching related materials for modelID: ${modelID}, expressID: ${expressID}`,
        error,
      );
    }
  }
  if (mats?.length) {
    for (const m of mats) {
      const name = m.Name?.value || `Material_${m.expressID}`;
      const key = `Material: ${name}`;
      propertySets[key] = {};
      for (const k in m) {
        if (k === "type" || k === "expressID" || k.startsWith("_")) continue;
        const v = m[k];
        if (typeof v !== "object" || v === null) propertySets[key][k] = v;
        else if (v.value !== undefined) propertySets[key][k] = v.value;
      }
    }
  }

  const result: ElementProperties = { modelID, expressID, ifcType, attributes, propertySets };
  mCache.delete(expressID);

  if (mCache.size >= MAX_CACHE_ENTRIES && MAX_CACHE_ENTRIES > 0) {
    const oldestExpressID = mCache.keys().next().value;
    if (oldestExpressID !== undefined) {
      mCache.delete(oldestExpressID);
    }
  }
  mCache.set(expressID, result);

  return result;
}

export function clearElementPropertiesCache(modelID?: number) {
  if (modelID === undefined) cache.clear();
  else cache.delete(modelID);
}
