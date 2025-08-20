import { IfcAPI } from "web-ifc";
import { getAllElementProperties, ParsedElementProperties } from "./ifc-properties";

/**
 * High-performance property cache for IFC elements
 */
export class PropertyCache {
    private static cache = new Map<string, ParsedElementProperties>();
    private static pendingRequests = new Map<string, Promise<ParsedElementProperties>>();
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
     * Get cached key for element
     */
    private static getCacheKey(modelID: number, expressID: number, ifcApi?: IfcAPI): string {
        const apiPrefix = ifcApi ? `${this.getApiId(ifcApi)}-` : '';
        return `${apiPrefix}${modelID}-${expressID}`;
    }

    /**
     * Get properties with caching and deduplication
     */
    static async getProperties(
        ifcApi: IfcAPI,
        modelID: number,
        expressID: number
    ): Promise<ParsedElementProperties> {
        const cacheKey = this.getCacheKey(modelID, expressID, ifcApi);

        // Return cached result if available
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        // Return pending request if already in progress
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey)!;
        }

        // Create new request
        const request = getAllElementProperties(ifcApi, modelID, expressID);
        this.pendingRequests.set(cacheKey, request);

        try {
            const properties = await request;
            this.cache.set(cacheKey, properties);
            this.pendingRequests.delete(cacheKey);
            return properties;
        } catch (error) {
            this.pendingRequests.delete(cacheKey);
            throw error;
        }
    }

    /**
     * Batch get properties for multiple elements
     */
    static async getBatchProperties(
        ifcApi: IfcAPI,
        modelID: number,
        expressIDs: number[]
    ): Promise<Map<number, ParsedElementProperties>> {
        const results = new Map<number, ParsedElementProperties>();
        const uncachedIDs: number[] = [];

        // Check cache first
        for (const expressID of expressIDs) {
            const cacheKey = this.getCacheKey(modelID, expressID, ifcApi);
            if (this.cache.has(cacheKey)) {
                results.set(expressID, this.cache.get(cacheKey)!);
            } else {
                uncachedIDs.push(expressID);
            }
        }

        // Fetch uncached properties in parallel
        if (uncachedIDs.length > 0) {
            const promises = uncachedIDs.map(async (expressID) => {
                try {
                    const properties = await this.getProperties(ifcApi, modelID, expressID);
                    return { expressID, properties };
                } catch (error) {
                    console.warn(`Failed to get properties for element ${expressID}:`, error);
                    return null;
                }
            });

            const batchResults = await Promise.all(promises);

            for (const result of batchResults) {
                if (result) {
                    results.set(result.expressID, result.properties);
                }
            }
        }

        return results;
    }

    /**
     * Pre-warm cache for specific property types
     */
    static async preWarmCache(
        ifcApi: IfcAPI,
        modelID: number,
        elements: Array<{ expressID: number; type: string }>,
        requiredProperties: string[]
    ): Promise<void> {
        // Only pre-warm for elements that might need property checks
        const elementsNeedingProperties = elements.filter(el => {
            // Check if any required properties are property-based (not just "Ifc Class")
            return requiredProperties.some(prop =>
                prop !== "Ifc Class" &&
                prop !== "GlobalId" &&
                prop !== "Name" &&
                prop !== "Description"
            );
        });

        if (elementsNeedingProperties.length === 0) return;

        // Batch process in chunks to avoid overwhelming the system
        const chunkSize = 50;
        for (let i = 0; i < elementsNeedingProperties.length; i += chunkSize) {
            const chunk = elementsNeedingProperties.slice(i, i + chunkSize);
            const expressIDs = chunk.map(el => el.expressID);

            try {
                await this.getBatchProperties(ifcApi, modelID, expressIDs);
            } catch (error) {
                console.warn(`Failed to pre-warm cache for chunk starting at ${i}:`, error);
            }
        }
    }

    /**
     * Clear cache for specific model or all models, optionally scoped to specific IfcAPI instance
     */
    static clearCache(modelID?: number, ifcApi?: IfcAPI): void {
        if (modelID !== undefined || ifcApi !== undefined) {
            const keysToDelete: string[] = [];
            const apiId = ifcApi ? this.getApiId(ifcApi) : null;

            for (const key of Array.from(this.cache.keys())) {
                let shouldDelete = false;

                if (apiId !== null) {
                    // If ifcApi is provided, only delete keys with matching API prefix
                    const expectedPrefix = modelID !== undefined ? `${apiId}-${modelID}-` : `${apiId}-`;
                    shouldDelete = key.startsWith(expectedPrefix);
                } else if (modelID !== undefined) {
                    // If only modelID is provided, delete keys that match the model
                    // This includes both prefixed and non-prefixed keys
                    shouldDelete = key.includes(`-${modelID}-`) || key.startsWith(`${modelID}-`);
                } else {
                    // If only ifcApi is provided, delete all keys with that API prefix
                    shouldDelete = key.startsWith(`${apiId}-`);
                }

                if (shouldDelete) {
                    keysToDelete.push(key);
                }
            }

            for (const key of keysToDelete) {
                this.cache.delete(key);
            }

            // Clear matching pending requests
            const pendingKeysToDelete: string[] = [];
            for (const key of Array.from(this.pendingRequests.keys())) {
                let shouldDelete = false;

                if (apiId !== null) {
                    const expectedPrefix = modelID !== undefined ? `${apiId}-${modelID}-` : `${apiId}-`;
                    shouldDelete = key.startsWith(expectedPrefix);
                } else if (modelID !== undefined) {
                    shouldDelete = key.includes(`-${modelID}-`) || key.startsWith(`${modelID}-`);
                } else {
                    shouldDelete = key.startsWith(`${apiId}-`);
                }

                if (shouldDelete) {
                    pendingKeysToDelete.push(key);
                }
            }

            for (const key of pendingKeysToDelete) {
                this.pendingRequests.delete(key);
            }
        } else {
            this.cache.clear();
            this.pendingRequests.clear();
        }
    }

    /**
     * Get cache statistics
     */
    static getCacheStats() {
        return {
            cacheSize: this.cache.size,
            pendingRequests: this.pendingRequests.size
        };
    }
}
