import { IfcAPI } from "web-ifc";
import { PropertyCache } from "./property-cache";

export interface PropertyIndexEntry {
    expressID: number;
    ifcType?: string;
    name?: string;
    globalId?: string;
    description?: string;
    objectType?: string;
    tag?: string;
    predefinedType?: string;
}

/**
 * High-performance property index for IFC elements
 * Provides O(1) lookups for common properties instead of O(n) searches
 */
export class PropertyIndex {
    private static index = new Map<string, PropertyIndexEntry[]>();
    private static apiIds = new WeakMap<IfcAPI, number>();
    private static nextApiId = 1;

    /**
     * Get stable ID for IfcAPI instance
     */
    private static getApiId(ifcApi: IfcAPI): number {
        if (!this.apiIds.has(ifcApi)) {
            this.apiIds.set(ifcApi, this.nextApiId++);
        }
        return this.apiIds.get(ifcApi)!;
    }

    /**
     * Get cache key for model
     */
    private static getCacheKey(modelID: number, ifcApi?: IfcAPI): string {
        const apiPrefix = ifcApi ? `${this.getApiId(ifcApi)}-` : '';
        return `${apiPrefix}${modelID}`;
    }

    /**
     * Build property index for a model
     * This should be called during model loading to pre-warm the index
     */
    static async buildIndex(
        ifcApi: IfcAPI,
        modelID: number,
        elements: Array<{ expressID: number; type: string; typeCode: number }>,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        const cacheKey = this.getCacheKey(modelID, ifcApi);

        // Check if index already exists
        if (this.index.has(cacheKey)) {
            console.log(`[PropertyIndex] Index already exists for model ${modelID}`);
            return;
        }

        console.log(`[PropertyIndex] Building index for ${elements.length} elements in model ${modelID}`);

        const indexEntries: PropertyIndexEntry[] = [];
        const batchSize = 100; // Process in smaller batches to avoid blocking

        for (let i = 0; i < elements.length; i += batchSize) {
            const batch = elements.slice(i, i + batchSize);
            const expressIDs = batch.map(el => el.expressID);

            try {
                // Use batch property fetching for better performance
                const batchProperties = await PropertyCache.getBatchProperties(ifcApi, modelID, expressIDs);

                for (const [expressID, properties] of batchProperties) {
                    const entry: PropertyIndexEntry = { expressID };

                    // Index the most commonly searched properties
                    if (properties.ifcType) entry.ifcType = properties.ifcType;
                    if (properties.attributes?.Name?.value) entry.name = String(properties.attributes.Name.value);
                    if (properties.attributes?.GlobalId?.value) entry.globalId = String(properties.attributes.GlobalId.value);
                    if (properties.attributes?.Description?.value) entry.description = String(properties.attributes.Description.value);
                    if (properties.attributes?.ObjectType?.value) entry.objectType = String(properties.attributes.ObjectType.value);
                    if (properties.attributes?.Tag?.value) entry.tag = String(properties.attributes.Tag.value);
                    if (properties.attributes?.PredefinedType?.value) entry.predefinedType = String(properties.attributes.PredefinedType.value);

                    indexEntries.push(entry);
                }
            } catch (error) {
                console.warn(`[PropertyIndex] Failed to process batch ${Math.floor(i / batchSize)}:`, error);
                // Continue with other batches even if one fails
            }

            // Progress reporting
            if (onProgress) {
                const progress = Math.round(((i + batch.length) / elements.length) * 100);
                onProgress(progress);
            }
        }

        // Store the index
        this.index.set(cacheKey, indexEntries);
        console.log(`[PropertyIndex] Built index with ${indexEntries.length} entries for model ${modelID}`);
    }

    /**
     * Find elements by property path and value using the index
     */
    static findElementsByProperty(
        ifcApi: IfcAPI,
        modelID: number,
        propertyPath: string[],
        value: any
    ): number[] {
        const cacheKey = this.getCacheKey(modelID, ifcApi);
        const indexEntries = this.index.get(cacheKey);

        if (!indexEntries) {
            console.warn(`[PropertyIndex] No index found for model ${modelID}, falling back to cache`);
            return [];
        }

        // Handle common property paths efficiently
        if (propertyPath.length === 1) {
            const propertyName = propertyPath[0];

            switch (propertyName) {
                case 'ifcType':
                    return indexEntries
                        .filter(entry => entry.ifcType === value)
                        .map(entry => entry.expressID);

                case 'attributes.Name':
                case 'name':
                    return indexEntries
                        .filter(entry => entry.name === value)
                        .map(entry => entry.expressID);

                case 'attributes.GlobalId':
                case 'globalId':
                    return indexEntries
                        .filter(entry => entry.globalId === value)
                        .map(entry => entry.expressID);

                case 'attributes.Description':
                case 'description':
                    return indexEntries
                        .filter(entry => entry.description === value)
                        .map(entry => entry.expressID);

                case 'attributes.ObjectType':
                case 'objectType':
                    return indexEntries
                        .filter(entry => entry.objectType === value)
                        .map(entry => entry.expressID);

                case 'attributes.Tag':
                case 'tag':
                    return indexEntries
                        .filter(entry => entry.tag === value)
                        .map(entry => entry.expressID);

                case 'attributes.PredefinedType':
                case 'predefinedType':
                    return indexEntries
                        .filter(entry => entry.predefinedType === value)
                        .map(entry => entry.expressID);
            }
        }

        // For IFC class searches, we can do early filtering by type
        if (propertyPath.length === 1 && propertyPath[0] === 'ifcType') {
            console.log(`[PropertyIndex] Using optimized IFC type filtering for ${value}`);
            return indexEntries
                .filter(entry => entry.ifcType === value)
                .map(entry => entry.expressID);
        }

        // For other property paths, we need to fall back to cache
        console.log(`[PropertyIndex] Property path ${propertyPath.join('.')} not indexed, using cache fallback`);
        return [];
    }

    /**
     * Get elements by IFC type (optimized early filtering)
     */
    static getElementsByType(
        ifcApi: IfcAPI,
        modelID: number,
        ifcType: string
    ): number[] {
        const cacheKey = this.getCacheKey(modelID, ifcApi);
        const indexEntries = this.index.get(cacheKey);

        if (!indexEntries) {
            return [];
        }

        return indexEntries
            .filter(entry => entry.ifcType === ifcType)
            .map(entry => entry.expressID);
    }

    /**
     * Get all indexed express IDs for a model
     */
    static getAllIndexedExpressIDs(ifcApi: IfcAPI, modelID: number): number[] {
        const cacheKey = this.getCacheKey(modelID, ifcApi);
        const indexEntries = this.index.get(cacheKey);

        if (!indexEntries) {
            return [];
        }

        return indexEntries.map(entry => entry.expressID);
    }

    /**
     * Check if index exists for a model
     */
    static hasIndex(ifcApi: IfcAPI, modelID: number): boolean {
        const cacheKey = this.getCacheKey(modelID, ifcApi);
        return this.index.has(cacheKey);
    }

    /**
     * Clear index for specific model or all models
     */
    static clearIndex(modelID?: number, ifcApi?: IfcAPI): void {
        if (modelID !== undefined || ifcApi !== undefined) {
            const keysToDelete: string[] = [];
            const apiId = ifcApi ? this.getApiId(ifcApi) : null;

            for (const key of Array.from(this.index.keys())) {
                let shouldDelete = false;

                if (ifcApi !== undefined && modelID !== undefined) {
                    shouldDelete = key === `${apiId}-${modelID}`;
                } else if (modelID !== undefined) {
                    shouldDelete = key.includes(`-${modelID}`) || key === modelID.toString();
                } else if (ifcApi !== undefined) {
                    shouldDelete = key.startsWith(`${apiId}-`);
                }

                if (shouldDelete) {
                    keysToDelete.push(key);
                }
            }

            for (const key of keysToDelete) {
                this.index.delete(key);
            }
        } else {
            this.index.clear();
        }
    }

    /**
     * Get index statistics
     */
    static getIndexStats() {
        const stats = {
            indexedModels: this.index.size,
            totalIndexedElements: 0,
            modelDetails: [] as Array<{ modelID: string; elementCount: number }>
        };

        for (const [cacheKey, entries] of this.index.entries()) {
            stats.totalIndexedElements += entries.length;
            stats.modelDetails.push({
                modelID: cacheKey,
                elementCount: entries.length
            });
        }

        return stats;
    }
}
