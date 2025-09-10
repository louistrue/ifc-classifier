import type { IfcAPI } from "web-ifc";
// We intentionally avoid using IFCElementExtractor here to allow yielding during enumeration

export interface SelectedElementInfo {
    modelID: number;
    expressID: number;
}

export type IndexKeyKind =
    | "IFC_CLASS"
    | "NAME"
    | "TYPE_NAME"
    | "PSET_COMMON"; // Use compound key for pset/property

export type IndexKey =
    | { kind: "IFC_CLASS" }
    | { kind: "NAME" }
    | { kind: "TYPE_NAME" }
    | { kind: "PSET_COMMON"; psetName: string; propName: string };

type InternalIndex = {
    // Map<IndexBucketKey, Map<ValueKey, Uint32Array>>
    buckets: Map<string, Map<string, Uint32Array>>;
    // Optional helpers for UI
    elementToTypeName: Map<number, string>;
    // Basic stats
    elementCount: number;
    valueCount: number;
    ready: boolean;
};

function makeBucketKey(key: IndexKey): string {
    switch (key.kind) {
        case "IFC_CLASS":
            return "IFC_CLASS";
        case "NAME":
            return "NAME";
        case "TYPE_NAME":
            return "TYPE_NAME";
        case "PSET_COMMON":
            return `PSET_COMMON:${key.psetName}:${key.propName}`;
    }
}

function serializeValueKey(val: unknown): string {
    if (val === null) return "null";
    const t = typeof val;
    if (t === "string") return `s:${(val as string).trim()}`;
    if (t === "number") return `n:${val as number}`;
    if (t === "boolean") return `b:${val ? "1" : "0"}`;
    // Fallback: JSON stringify small values
    try {
        return `j:${JSON.stringify(val)}`;
    } catch {
        return "[unsupported]";
    }
}

function unwrap(val: any): any {
    if (val && typeof val === "object" && "value" in val) return val.value;
    return val;
}

function isCommonPsetName(name: string | undefined): name is string {
    if (!name) return false;
    return /^PSet_.*Common$/i.test(name);
}

function addToBucket(
    index: InternalIndex,
    key: IndexKey,
    value: unknown,
    expressID: number,
): void {
    const bucketKey = makeBucketKey(key);
    const valueKey = serializeValueKey(value);
    if (valueKey === "[unsupported]") return;

    let bucket = index.buckets.get(bucketKey);
    if (!bucket) {
        bucket = new Map();
        index.buckets.set(bucketKey, bucket);
    }

    let arr = bucket.get(valueKey);
    if (!arr) {
        // Start with small JS array, convert to typed array later during finalize
        // We'll temporarily store as a JS array in a hidden property
        // Use a symbol-like convention to avoid confusion
        const tmp = new (Array as any)() as number[];
        (tmp as any).__tmp = true;
        (tmp as any).push(expressID);
        // @ts-expect-error storing temp
        bucket.set(valueKey, tmp);
        index.valueCount++;
    } else {
        // If it's a Uint32Array, we should not be here yet (finalized)
        if ((arr as any).__tmp) {
            // @ts-expect-error tmp push
            (arr as any).push(expressID);
        } else {
            // Convert to dynamic array (shouldn't happen before finalize, safe-guard)
            const list: number[] = Array.from(arr as unknown as Uint32Array);
            list.push(expressID);
            // @ts-expect-error store back as tmp
            bucket.set(valueKey, list as any);
        }
    }
}

function finalizeBuckets(index: InternalIndex): void {
    for (const [bucketKey, valueMap] of index.buckets.entries()) {
        for (const [valKey, list] of valueMap.entries()) {
            if ((list as any).__tmp) {
                const jsList = list as unknown as number[];
                // Deduplicate and sort for stable behavior
                jsList.sort((a, b) => a - b);
                const dedup: number[] = [];
                let last = -1;
                for (const id of jsList) {
                    if (id !== last) {
                        dedup.push(id);
                        last = id;
                    }
                }
                const typed = new Uint32Array(dedup);
                valueMap.set(valKey, typed as unknown as any);
            }
        }
    }
}

function getApiIdFactory() {
    const apiIds = new WeakMap<IfcAPI, number>();
    let nextApiId = 1;
    return (ifcApi: IfcAPI) => {
        if (!apiIds.has(ifcApi)) apiIds.set(ifcApi, nextApiId++);
        return apiIds.get(ifcApi)!;
    };
}

const getApiId = getApiIdFactory();

// Index storage: Map<apiKey, Map<modelID, InternalIndex>>
const apiToModelIndex = new Map<number, Map<number, InternalIndex>>();

async function yieldToMainThread(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

export const SelectionIndex = {
    isReady(ifcApi: IfcAPI, modelID: number): boolean {
        const apiKey = getApiId(ifcApi);
        return apiToModelIndex.get(apiKey)?.get(modelID)?.ready === true;
    },

    async build(
        ifcApi: IfcAPI,
        modelID: number,
        onProgress?: (percent: number, message?: string) => void,
    ): Promise<void> {
        const apiKey = getApiId(ifcApi);
        let modelMap = apiToModelIndex.get(apiKey);
        if (!modelMap) {
            modelMap = new Map();
            apiToModelIndex.set(apiKey, modelMap);
        }
        if (modelMap.get(modelID)?.ready) return; // Already built

        const index: InternalIndex = {
            buckets: new Map(),
            elementToTypeName: new Map(),
            elementCount: 0,
            valueCount: 0,
            ready: false,
        };
        modelMap.set(modelID, index);

        // Step 1 + 2 combined: Enumerate elements with yielding and index IFC_CLASS + NAME
        let allExpressIds: number[] = [];
        try {
            // Prefer GetAllLines for performance
            const allLines = ifcApi.GetAllLines(modelID);
            const total = allLines.size();
            index.elementCount = total;
            if (onProgress) onProgress(5, `Indexing ${total} elements`);

            const batchSize = 1000;
            for (let i = 0; i < total; i++) {
                const expressID = allLines.get(i);
                allExpressIds.push(expressID);
                try {
                    const line = await ifcApi.GetLine(modelID, expressID, false);
                    const typeName = typeof line?.type === "number" ? ifcApi.GetNameFromTypeCode(line.type) : String(line?.type || "");
                    if (typeName) addToBucket(index, { kind: "IFC_CLASS" }, typeName, expressID);
                    const name = unwrap(line?.Name);
                    if (name !== undefined && name !== null && name !== "") {
                        addToBucket(index, { kind: "NAME" }, name, expressID);
                    }
                } catch {
                    // skip
                }

                if ((i + 1) % batchSize === 0) {
                    if (onProgress) onProgress(10 + Math.round(((i + 1) / total) * 20), "Indexing IfcClass/Name");
                    await yieldToMainThread();
                }
            }

            // Cleanup
            if (allLines && typeof (allLines as any).delete === 'function') {
                try { (allLines as any).delete(); } catch { }
            }
        } catch {
            // Fallback: iterate by max express id range if GetAllLines fails
            try {
                const maxId = ifcApi.GetMaxExpressID(modelID);
                index.elementCount = maxId;
                if (onProgress) onProgress(5, `Indexing up to ${maxId} IDs`);
                const batchSize = 1000;
                for (let i = 1; i <= maxId; i++) {
                    allExpressIds.push(i);
                    try {
                        const line = await ifcApi.GetLine(modelID, i, false);
                        if (!line || !line.type) continue;
                        const typeName = typeof line.type === "number" ? ifcApi.GetNameFromTypeCode(line.type) : String(line.type);
                        if (typeName) addToBucket(index, { kind: "IFC_CLASS" }, typeName, i);
                        const name = unwrap(line?.Name);
                        if (name !== undefined && name !== null && name !== "") {
                            addToBucket(index, { kind: "NAME" }, name, i);
                        }
                    } catch {
                        // ignore missing ids
                    }
                    if (i % batchSize === 0) {
                        if (onProgress) onProgress(10 + Math.round((i / maxId) * 20), "Indexing IfcClass/Name");
                        await yieldToMainThread();
                    }
                }
            } catch {
                // Give up on enumeration gracefully
                allExpressIds = [];
            }
        }

        // Step 3: Build type data once per element (deduped)
        const elementToTypeId = new Map<number, number>();
        const uniqueTypeIds = new Set<number>();
        const typeChunk = 300;
        if (ifcApi.properties && ifcApi.properties.getTypeProperties && allExpressIds.length) {
            for (let i = 0; i < allExpressIds.length; i += typeChunk) {
                const chunk = allExpressIds.slice(i, i + typeChunk);
                await Promise.all(
                    chunk.map(async (expressID) => {
                        try {
                            const typeObjs = await ifcApi.properties.getTypeProperties(modelID, expressID, false);
                            if (Array.isArray(typeObjs) && typeObjs.length > 0) {
                                const typeObj = typeObjs[0];
                                const typeId: number | undefined = typeObj?.expressID ?? (typeObj?.value as number | undefined);
                                if (typeof typeId === "number") {
                                    elementToTypeId.set(expressID, typeId);
                                    uniqueTypeIds.add(typeId);
                                }
                            }
                        } catch {
                            // ignore
                        }
                    }),
                );
                if (onProgress) onProgress(35 + Math.round((i / allExpressIds.length) * 10), "Discovering types");
                await yieldToMainThread();
            }
        }

        // Step 4: Fetch each unique type once; index TYPE_NAME and PSet_*Common from type
        const typeIdToName = new Map<number, string>();
        const typeIds = Array.from(uniqueTypeIds.values());
        const typeInfoChunk = 100;
        for (let i = 0; i < typeIds.length; i += typeInfoChunk) {
            const chunk = typeIds.slice(i, i + typeInfoChunk);
            await Promise.all(
                chunk.map(async (typeId) => {
                    try {
                        const typeObj = await ifcApi.GetLine(modelID, typeId, true);
                        const typeName = unwrap(typeObj?.Name);
                        if (typeName !== undefined && typeName !== null && typeName !== "") {
                            typeIdToName.set(typeId, typeName);
                        }

                        // Index PSet_*Common from type if available
                        if (Array.isArray(typeObj?.HasPropertySets)) {
                            for (const psetRef of typeObj.HasPropertySets) {
                                const psetId = unwrap(psetRef);
                                if (typeof psetId !== "number") continue;
                                try {
                                    const pset = await ifcApi.GetLine(modelID, psetId, true);
                                    const psetName = unwrap(pset?.Name);
                                    if (!isCommonPsetName(psetName)) continue;

                                    // Extract properties from IFCPROPERTYSET
                                    if (pset?.HasProperties) {
                                        const propsArray = Array.isArray(pset.HasProperties) ? pset.HasProperties : [pset.HasProperties];
                                        for (const propRef of propsArray) {
                                            let propLine: any = null;
                                            const propId = unwrap(propRef);
                                            if (typeof propId === "number") {
                                                try {
                                                    propLine = await ifcApi.GetLine(modelID, propId, true);
                                                } catch {
                                                    propLine = null;
                                                }
                                            } else if (propRef && typeof propRef === "object" && propRef.Name) {
                                                propLine = propRef;
                                            }
                                            if (!propLine?.Name) continue;
                                            const propName = unwrap(propLine.Name);
                                            const val = unwrap(propLine.NominalValue) ?? unwrap(propLine.Value);
                                            if (val === undefined || val === null || val === "") continue;

                                            // We cannot add elements yet because this is type-level. We'll attach later by elements with this typeId.
                                            // So stash under a temporary map per typeId.
                                            // We'll reuse typeIdToName and a separate map typeId -> Map<psetName, Map<propName, value>>
                                        }
                                    }
                                } catch {
                                    // ignore single pset failure
                                }
                            }
                        }
                    } catch {
                        // ignore
                    }
                }),
            );
            if (onProgress) onProgress(45 + Math.round((i / Math.max(1, typeIds.length)) * 10), "Reading type data");
            await yieldToMainThread();
        }

        // Step 4b: Build lightweight map of typeId -> PSet_*Common simple properties
        // Re-fetch with limited scope (done sequentially to control memory)
        const typeCommonProps = new Map<number, Map<string, Map<string, unknown>>>();
        for (let i = 0; i < typeIds.length; i++) {
            const typeId = typeIds[i];
            try {
                const typeObj = await ifcApi.GetLine(modelID, typeId, true);
                if (Array.isArray(typeObj?.HasPropertySets)) {
                    for (const psetRef of typeObj.HasPropertySets) {
                        const psetId = unwrap(psetRef);
                        if (typeof psetId !== "number") continue;
                        try {
                            const pset = await ifcApi.GetLine(modelID, psetId, true);
                            const psetName = unwrap(pset?.Name);
                            if (!isCommonPsetName(psetName)) continue;
                            if (!typeCommonProps.has(typeId)) typeCommonProps.set(typeId, new Map());
                            const psetMap = typeCommonProps.get(typeId)!;
                            if (!psetMap.has(psetName)) psetMap.set(psetName, new Map());
                            const propMap = psetMap.get(psetName)!;
                            if (pset?.HasProperties) {
                                const propsArray = Array.isArray(pset.HasProperties) ? pset.HasProperties : [pset.HasProperties];
                                for (const propRef of propsArray) {
                                    let propLine: any = null;
                                    const propId = unwrap(propRef);
                                    if (typeof propId === "number") {
                                        try {
                                            propLine = await ifcApi.GetLine(modelID, propId, true);
                                        } catch {
                                            propLine = null;
                                        }
                                    } else if (propRef && typeof propRef === "object" && propRef.Name) {
                                        propLine = propRef;
                                    }
                                    if (!propLine?.Name) continue;
                                    const propName = unwrap(propLine.Name);
                                    const val = unwrap(propLine.NominalValue) ?? unwrap(propLine.Value);
                                    if (val === undefined || val === null || val === "") continue;
                                    propMap.set(String(propName), val);
                                }
                            }
                        } catch {
                            // ignore pset failure
                        }
                    }
                }
            } catch {
                // ignore type failure
            }
            if (i % 50 === 0) {
                if (onProgress) onProgress(55 + Math.round((i / Math.max(1, typeIds.length)) * 10), "Indexing type common sets");
                await yieldToMainThread();
            }
        }

        // Step 5: Attach type-derived data to each element
        for (let i = 0; i < allExpressIds.length; i++) {
            const expressID = allExpressIds[i];
            const typeId = elementToTypeId.get(expressID);
            if (typeId !== undefined) {
                const typeName = typeIdToName.get(typeId);
                if (typeName !== undefined) {
                    addToBucket(index, { kind: "TYPE_NAME" }, typeName, expressID);
                    index.elementToTypeName.set(expressID, String(typeName));
                }
                const psetMap = typeCommonProps.get(typeId);
                if (psetMap) {
                    for (const [psetName, propMap] of psetMap.entries()) {
                        for (const [propName, propVal] of propMap.entries()) {
                            addToBucket(index, { kind: "PSET_COMMON", psetName, propName }, propVal, expressID);
                        }
                    }
                }
            }
            if (i % 1000 === 0) await yieldToMainThread();
        }

        // Step 6: Instance-level PSet_*Common
        if (ifcApi.properties && ifcApi.properties.getPropertySets && allExpressIds.length) {
            const instChunk = 200;
            for (let i = 0; i < allExpressIds.length; i += instChunk) {
                const chunk = allExpressIds.slice(i, i + instChunk);
                await Promise.all(
                    chunk.map(async (expressID) => {
                        try {
                            const psets = await ifcApi.properties.getPropertySets(modelID, expressID, true, false);
                            if (Array.isArray(psets)) {
                                for (const pset of psets) {
                                    const psetName = unwrap(pset?.Name);
                                    if (!isCommonPsetName(psetName)) continue;
                                    if (pset?.HasProperties) {
                                        const propsArray = Array.isArray(pset.HasProperties) ? pset.HasProperties : [pset.HasProperties];
                                        for (const propRef of propsArray) {
                                            let propLine: any = null;
                                            const propId = unwrap(propRef);
                                            if (typeof propId === "number") {
                                                try {
                                                    propLine = await ifcApi.GetLine(modelID, propId, true);
                                                } catch {
                                                    propLine = null;
                                                }
                                            } else if (propRef && typeof propRef === "object" && propRef.Name) {
                                                propLine = propRef;
                                            }
                                            if (!propLine?.Name) continue;
                                            const propName = unwrap(propLine.Name);
                                            const val = unwrap(propLine.NominalValue) ?? unwrap(propLine.Value);
                                            if (val === undefined || val === null || val === "") continue;
                                            addToBucket(index, { kind: "PSET_COMMON", psetName, propName }, val, expressID);
                                        }
                                    }
                                }
                            }
                        } catch {
                            // ignore element failure
                        }
                    }),
                );
                if (onProgress) onProgress(70 + Math.round((i / allExpressIds.length) * 20), "Indexing instance common sets");
                await yieldToMainThread();
            }
        }

        // Finalize buckets (dedupe + convert to typed arrays)
        finalizeBuckets(index);
        index.ready = true;
        if (onProgress) onProgress(100, "Index ready");
    },

    query(
        ifcApi: IfcAPI,
        modelID: number,
        key: IndexKey,
        value: unknown,
    ): SelectedElementInfo[] {
        const apiKey = getApiId(ifcApi);
        const index = apiToModelIndex.get(apiKey)?.get(modelID);
        if (!index || !index.ready) return [];
        const bucketKey = makeBucketKey(key);
        const valueKey = serializeValueKey(value);
        const typed = index.buckets.get(bucketKey)?.get(valueKey) as Uint32Array | undefined;
        if (!typed || typed.length === 0) return [];
        const out: SelectedElementInfo[] = new Array(typed.length);
        for (let i = 0; i < typed.length; i++) {
            out[i] = { modelID, expressID: typed[i] };
        }
        return out;
    },

    clear(ifcApi?: IfcAPI, modelID?: number): void {
        if (!ifcApi && modelID === undefined) {
            apiToModelIndex.clear();
            return;
        }
        if (ifcApi) {
            const apiKey = getApiId(ifcApi);
            if (modelID !== undefined) {
                apiToModelIndex.get(apiKey)?.delete(modelID);
            } else {
                apiToModelIndex.delete(apiKey);
            }
            return;
        }
        // If only modelID provided (rare), clear all api maps of that modelID
        if (modelID !== undefined) {
            for (const modelMap of apiToModelIndex.values()) {
                modelMap.delete(modelID);
            }
        }
    },

    getTypeNameForElement(ifcApi: IfcAPI, modelID: number, expressID: number): string | null {
        const apiKey = getApiId(ifcApi);
        const index = apiToModelIndex.get(apiKey)?.get(modelID);
        if (!index || !index.ready) return null;
        return index.elementToTypeName.get(expressID) ?? null;
    },

    getStats(ifcApi: IfcAPI, modelID: number) {
        const apiKey = getApiId(ifcApi);
        const index = apiToModelIndex.get(apiKey)?.get(modelID);
        if (!index) return null;
        let totalEntries = 0;
        for (const m of index.buckets.values()) totalEntries += m.size;
        return {
            ready: index.ready,
            elementCount: index.elementCount,
            valueCount: index.valueCount,
            bucketKinds: Array.from(index.buckets.keys()).slice(0, 5),
            totalBucketKinds: index.buckets.size,
            totalEntries,
        };
    },
};


