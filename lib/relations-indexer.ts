export type InverseAttribute =
  | 'IsDecomposedBy'
  | 'Decomposes'
  | 'ContainedInStructure'
  | 'ContainsElements';

type RelationTypeMap = Map<InverseAttribute, Set<number>>;
export type RelationsMap = Map<number, RelationTypeMap>;

import type { IfcAPI } from 'web-ifc';
import { IFCRELAGGREGATES, IFCRELCONTAINEDINSPATIALSTRUCTURE } from 'web-ifc';

export class IfcRelationsIndexer {
  relationMaps: Map<number, RelationsMap> = new Map();

  private addRelation(map: RelationsMap, from: number, attr: InverseAttribute, to: number) {
    let attrMap = map.get(from);
    if (!attrMap) {
      attrMap = new Map();
      map.set(from, attrMap);
    }
    let set = attrMap.get(attr);
    if (!set) {
      set = new Set();
      attrMap.set(attr, set);
    }
    set.add(to);
  }

  async processFromWebIfc(ifcApi: IfcAPI, modelID: number): Promise<RelationsMap> {
    const map: RelationsMap = new Map();

    const relAggIDs = await ifcApi.GetLineIDsWithType(modelID, IFCRELAGGREGATES);
    for (let i = 0; i < relAggIDs.size(); i++) {
      const relID = relAggIDs.get(i);
      const rel = await ifcApi.GetLine(modelID, relID, false);
      const parent = rel.RelatingObject?.value;
      const children = rel.RelatedObjects;
      if (parent !== undefined && children && Array.isArray(children)) {
        for (const child of children) {
          if (child?.value !== undefined) {
            this.addRelation(map, parent, 'IsDecomposedBy', child.value);
            this.addRelation(map, child.value, 'Decomposes', parent);
          }
        }
      }
    }

    const relContIDs = await ifcApi.GetLineIDsWithType(
      modelID,
      IFCRELCONTAINEDINSPATIALSTRUCTURE
    );
    for (let i = 0; i < relContIDs.size(); i++) {
      const relID = relContIDs.get(i);
      const rel = await ifcApi.GetLine(modelID, relID, false);
      const container = rel.RelatingStructure?.value;
      const contained = rel.RelatedElements;
      if (container !== undefined && contained && Array.isArray(contained)) {
        for (const el of contained) {
          if (el?.value !== undefined) {
            this.addRelation(map, container, 'ContainsElements', el.value);
            this.addRelation(map, el.value, 'ContainedInStructure', container);
          }
        }
      }
    }

    this.relationMaps.set(modelID, map);
    return map;
  }

  getEntityRelations(modelID: number, expressID: number, attribute: InverseAttribute): number[] {
    const map = this.relationMaps.get(modelID);
    if (!map) return [];
    const attrMap = map.get(expressID);
    if (!attrMap) return [];
    const set = attrMap.get(attribute);
    if (!set) return [];
    return Array.from(set);
  }

  getEntityChildren(modelID: number, expressID: number, found: Set<number> = new Set()): Set<number> {
    const children = [
      ...this.getEntityRelations(modelID, expressID, 'IsDecomposedBy'),
      ...this.getEntityRelations(modelID, expressID, 'ContainsElements'),
    ];
    for (const child of children) {
      if (!found.has(child)) {
        found.add(child);
        this.getEntityChildren(modelID, child, found);
      }
    }
    return found;
  }
}

