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

async function extractPropertyValue(
  api: IfcAPI,
  modelID: number,
  prop: any,
  visited: Set<number>,
): Promise<any> {
  const unit = prop.Unit?.value;

  if (prop.NominalValue?.value !== undefined) {
    const val = prop.NominalValue.value;
    return unit ? { value: val, unit } : val;
  }
  if (prop.Value?.value !== undefined) {
    const val = prop.Value.value;
    return unit ? { value: val, unit } : val;
  }
  if (prop.ListValues?.value !== undefined && Array.isArray(prop.ListValues.value)) {
    const vals = prop.ListValues.value.map((v: any) => (v?.value !== undefined ? v.value : v));
    return unit ? { values: vals, unit } : vals;
  }
  if (prop.EnumerationValues?.value !== undefined && Array.isArray(prop.EnumerationValues.value)) {
    const vals = prop.EnumerationValues.value.map((v: any) => (v?.value !== undefined ? v.value : v));
    return unit ? { values: vals, unit } : vals;
  }
  if (
    prop.LowerBoundValue?.value !== undefined ||
    prop.UpperBoundValue?.value !== undefined
  ) {
    const result: Record<string, any> = {};
    if (prop.LowerBoundValue?.value !== undefined) {
      result.LowerBound = prop.LowerBoundValue.value;
    }
    if (prop.UpperBoundValue?.value !== undefined) {
      result.UpperBound = prop.UpperBoundValue.value;
    }
    if (unit) result.Unit = unit;
    return result;
  }
  if (prop.NominalValue === null) {
    return `(${api.GetNameFromTypeCode(prop.type as number)})`;
  }

  // Complex property with nested properties
  if (prop.HasProperties && Array.isArray(prop.HasProperties)) {
    const nested: Record<string, any> = {};
    for (const subRef of prop.HasProperties) {
      const id = subRef?.value ?? subRef?.expressID;
      if (!id || visited.has(id)) continue;
      visited.add(id);
      const sub = await api.GetLine(modelID, id, true);
      if (!sub?.Name?.value) continue;
      nested[sub.Name.value] = await extractPropertyValue(api, modelID, sub, visited);
    }
    return nested;
  }

  // fallback: try simple value
  if (prop.value !== undefined) return prop.value;
  return null;
}

async function loadPset(
  api: IfcAPI,
  modelID: number,
  psetEntity: any,
  target: Record<string, any>,
  visited: Set<number>,
) {
  if (psetEntity.HasProperties && Array.isArray(psetEntity.HasProperties)) {
    for (const propRef of psetEntity.HasProperties) {
      const id = propRef?.value ?? propRef?.expressID;
      if (!id || visited.has(id)) continue;
      const prop = await api.GetLine(modelID, id, true);
      if (!prop?.Name?.value) continue;
      visited.add(id);
      const name = prop.Name.value;
      target[name] = await extractPropertyValue(api, modelID, prop, visited);
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
