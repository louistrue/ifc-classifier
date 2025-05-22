import { IfcAPI, Properties, IFCRELASSOCIATESMATERIAL } from "web-ifc";

export interface ElementProperties {
  modelID: number;
  expressID: number;
  ifcType: string;
  attributes: Record<string, any>;
  propertySets: Record<string, Record<string, any>>;
}

const cache: Map<number, Map<number, ElementProperties>> = new Map();

async function ensureProps(api: IfcAPI) {
  if (!api.properties) api.properties = new Properties(api);
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
      if (!id) continue;
      if (visited.has(id)) continue;
      const prop = await api.GetLine(modelID, id, true);
      if (!prop || !prop.Name?.value) continue;
      visited.add(id);
      const name = prop.Name.value;
      if (prop.NominalValue?.value !== undefined) {
        target[name] = prop.NominalValue.value;
      } else if (prop.HasProperties) {
        const sub: Record<string, any> = {};
        await loadPset(api, modelID, prop, sub, visited);
        target[name] = sub;
      }
    }
  }
}

export async function getElementProperties(
  api: IfcAPI,
  modelID: number,
  expressID: number,
): Promise<ElementProperties> {
  let mCache = cache.get(modelID);
  if (mCache?.has(expressID)) return mCache.get(expressID)!;

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
          if (pset && pset.Name?.value) {
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
          // If pset itself failed, we might not have a name yet, store error under a generic key or skip
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
  if (mats) {
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
  if (!mCache) {
    mCache = new Map();
    cache.set(modelID, mCache);
  }
  mCache.set(expressID, result);
  return result;
}

export function clearElementPropertiesCache(modelID?: number) {
  if (modelID === undefined) cache.clear();
  else cache.delete(modelID);
}
