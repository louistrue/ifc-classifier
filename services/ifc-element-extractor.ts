import { IfcAPI } from "web-ifc";

export interface IFCElement {
    expressID: number;
    type: string;
    typeCode: number;
}

/**
 * Extracts ALL elements from an IFC model, not just spatial structure
 */
export class IFCElementExtractor {
    // Cache for extracted elements to avoid re-processing
    // Store a small snapshot (max express ID) to detect model edits and avoid stale data.
    private static elementCache = new Map<string, { elements: IFCElement[]; snapshot?: number }>();
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
     * Get cache key that includes API identity
     */
    private static getCacheKey(ifcApi: IfcAPI, modelID: number): string {
        return `${this.getApiId(ifcApi)}-${modelID}`;
    }

    /**
     * Get all elements from the model - OPTIMIZED FOR SPEED
     */
    static getAllElements(ifcApi: IfcAPI, modelID: number, onProgress?: (percent: number, message: string) => void): IFCElement[] {
        // Check cache first (compare snapshot to detect edits)
        let currentSnapshot: number | undefined;
        try {
            currentSnapshot = typeof ifcApi.GetMaxExpressID === "function"
                ? ifcApi.GetMaxExpressID(modelID)
                : undefined;
        } catch (e) {
            // If we can't get the snapshot, we'll invalidate the cache to be safe
            currentSnapshot = undefined;
        }
        const cacheKey = this.getCacheKey(ifcApi, modelID);
        if (this.elementCache.has(cacheKey)) {
            const cached = this.elementCache.get(cacheKey)!;
            if (currentSnapshot !== undefined && cached.snapshot === currentSnapshot) {
                console.log(`[IFCElementExtractor] Cache hit for model ${modelID} (${cached.elements.length} elements)`);
                return cached.elements;
            }
            // stale or no snapshot — invalidate and continue to recompute
            console.log(`[IFCElementExtractor] Cache invalidated for model ${modelID} (snapshot mismatch: ${cached.snapshot} vs ${currentSnapshot})`);
            this.elementCache.delete(cacheKey);
        }

        const allElements: IFCElement[] = [];
        let allLines: any = null;

        try {
            // Method 1: Use GetAllLines - this should get everything
            allLines = ifcApi.GetAllLines(modelID);
            const totalLines = allLines.size();

            console.log(`[IFCElementExtractor] Processing ${totalLines} lines from model ${modelID}`);

            // Report initial progress
            if (onProgress) {
                onProgress(0, `Loading ${totalLines} elements...`);
            }

            // Add memory safeguard - warn about large models
            if (totalLines > 100000) {
                console.warn(`[IFCElementExtractor] Large model detected (${totalLines} lines). Processing may take time and use significant memory.`);
            }

            // Don't pre-allocate - let array grow dynamically to avoid memory spikes
            let processedCount = 0;
            let validElementCount = 0;
            let errorCount = 0;

            for (let i = 0; i < totalLines; i++) {
                const expressID = allLines.get(i);
                processedCount++;

                try {
                    const element = ifcApi.GetLine(modelID, expressID, false);
                    if (element && element.type) {
                        const typeName = ifcApi.GetNameFromTypeCode(element.type);
                        allElements.push({
                            expressID,
                            type: typeName,
                            typeCode: element.type
                        });
                        validElementCount++;
                    }
                } catch (e) {
                    errorCount++;
                    // Log errors for debugging, but don't spam the console
                    if (errorCount <= 10) {
                        console.warn(`[IFCElementExtractor] Error processing element ${expressID}:`, e);
                        if (errorCount === 10) {
                            console.warn(`[IFCElementExtractor] Suppressing further element processing errors for model ${modelID}`);
                        }
                    }
                }

                // Progress reporting for large models
                if (processedCount % 5000 === 0 || processedCount === totalLines) {
                    const percent = Math.round((processedCount / totalLines) * 100);
                    if (onProgress) {
                        onProgress(percent * 0.8, `${processedCount}/${totalLines}`); // Scale to 80% since rule processing is 20%
                    }
                    // Only log to console for very large models
                    if (totalLines > 50000 && processedCount % 10000 === 0) {
                        console.log(`[IFCElementExtractor] Progress: ${processedCount}/${totalLines} (${percent}%)`);
                    }
                }
            }

            console.log(`[IFCElementExtractor] Completed processing model ${modelID}: ${validElementCount} valid elements, ${errorCount} errors`);

        } catch (e) {
            console.warn(`[IFCElementExtractor] GetAllLines method failed for model ${modelID}:`, e);
            console.log(`[IFCElementExtractor] Falling back to express ID iteration for model ${modelID}`);

            // Fallback: Iterate through express IDs
            try {
                const maxExpressID = ifcApi.GetMaxExpressID(modelID);
                console.log(`[IFCElementExtractor] Fallback: Scanning express IDs 1-${maxExpressID} for model ${modelID}`);

                // Add safeguard for extremely large ID ranges
                if (maxExpressID > 1000000) {
                    console.warn(`[IFCElementExtractor] Very large express ID range detected (${maxExpressID}). This may take significant time.`);
                }

                let fallbackProcessed = 0;
                let fallbackValid = 0;
                let fallbackErrors = 0;

                for (let i = 1; i <= maxExpressID; i++) {
                    fallbackProcessed++;
                    try {
                        const element = ifcApi.GetLine(modelID, i, false);
                        if (element && element.type) {
                            const typeName = ifcApi.GetNameFromTypeCode(element.type);
                            allElements.push({
                                expressID: i,
                                type: typeName,
                                typeCode: element.type
                            });
                            fallbackValid++;
                        }
                    } catch (e) {
                        fallbackErrors++;
                        // Most IDs won't exist, so don't log every miss
                        if (fallbackErrors <= 5) {
                            console.debug(`[IFCElementExtractor] Express ID ${i} not found (expected for sparse ID ranges)`);
                        }
                    }

                    // Progress logging for large fallback operations
                    if (maxExpressID > 100000 && fallbackProcessed % 50000 === 0) {
                        console.log(`[IFCElementExtractor] Fallback progress: ${fallbackProcessed}/${maxExpressID} (${Math.round(fallbackProcessed / maxExpressID * 100)}%)`);
                    }
                }

                console.log(`[IFCElementExtractor] Fallback completed for model ${modelID}: ${fallbackValid} valid elements found, ${fallbackErrors} IDs not found`);
            } catch (fallbackError) {
                console.error(`[IFCElementExtractor] Both GetAllLines and express ID iteration failed for model ${modelID}:`, fallbackError);
                const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                throw new Error(`Failed to extract elements from model ${modelID}: ${errorMessage}`);
            }
        } finally {
            // Clean up resources
            if (allLines && typeof allLines.delete === 'function') {
                try {
                    allLines.delete();
                } catch (cleanupError) {
                    console.warn(`[IFCElementExtractor] Error cleaning up allLines for model ${modelID}:`, cleanupError);
                }
            }
        }

        // Cache the results with snapshot
        let finalSnapshot: number | undefined;
        try {
            finalSnapshot = typeof ifcApi.GetMaxExpressID === "function"
                ? ifcApi.GetMaxExpressID(modelID)
                : undefined;
        } catch (e) {
            // If we can't get the snapshot, cache without it (will always recompute)
            finalSnapshot = undefined;
        }

        this.elementCache.set(cacheKey, {
            elements: allElements,
            snapshot: finalSnapshot
        });

        // Check memory usage after caching
        this.checkMemoryUsage();

        return allElements;
    }

    /**
     * Get only building elements (walls, doors, windows, etc.)
     */
    static getBuildingElements(ifcApi: IfcAPI, modelID: number): IFCElement[] {
        const allElements = this.getAllElements(ifcApi, modelID);

        const buildingElements = allElements.filter(element =>
            this.isBuildingElement(element.type)
        );

        console.log(`[IFCElementExtractor] Filtered to ${buildingElements.length} building elements`);

        return buildingElements;
    }

    /**
     * Check if an element type is a building element
     */
    static isBuildingElement(typeName: string): boolean {
        const buildingElementTypes = [
            'IFCWALL',
            'IFCWALLSTANDARDCASE',
            'IFCDOOR',
            'IFCWINDOW',
            'IFCSLAB',
            'IFCCOLUMN',
            'IFCBEAM',
            'IFCSTAIR',
            'IFCSTAIRFLIGHT',
            'IFCROOF',
            'IFCCOVERING',
            'IFCPLATE',
            'IFCMEMBER',
            'IFCRAILING',
            'IFCRAMP',
            'IFCRAMPFLIGHT',
            'IFCCHIMNEY',
            'IFCCURTAINWALL',
            'IFCSHADINGDEVICE',
            'IFCBUILDINGELEMENTPROXY',
            'IFCFOOTING',
            'IFCPILE',
            'IFCCAISSONFOUNDATION',
            'IFCREINFORCINGBAR',
            'IFCREINFORCINGMESH',
            'IFCTENDON',
            'IFCTENDONANCHOR',
            'IFCBEARING'
        ];

        return buildingElementTypes.some(type =>
            typeName.toUpperCase().includes(type)
        );
    }

    /**
     * Get statistics about element types
     */
    static getTypeStatistics(elements: IFCElement[]) {
        const typeCount: Record<string, number> = {};
        let buildingElements = 0;
        let spatialElements = 0;
        let otherElements = 0;

        elements.forEach(element => {
            typeCount[element.type] = (typeCount[element.type] || 0) + 1;

            if (this.isBuildingElement(element.type)) {
                buildingElements++;
            } else if (this.isSpatialElement(element.type)) {
                spatialElements++;
            } else {
                otherElements++;
            }
        });

        return {
            typeCount,
            buildingElements,
            spatialElements,
            otherElements
        };
    }

    /**
     * Check if an element type is a spatial element
     */
    static isSpatialElement(typeName: string): boolean {
        const spatialTypes = [
            'IFCPROJECT',
            'IFCSITE',
            'IFCBUILDING',
            'IFCBUILDINGSTOREY',
            'IFCSPACE',
            'IFCZONE'
        ];

        return spatialTypes.includes(typeName.toUpperCase());
    }

    /**
     * Clear cache for a specific model or all models, optionally scoped to specific IfcAPI instance
     * @param modelID Optional model ID to clear. If not provided, clears all cached models.
     * @param ifcApi Optional IfcAPI instance to scope the clearing to.
     */
    static clearCache(modelID?: number, ifcApi?: IfcAPI) {
        if (modelID !== undefined || ifcApi !== undefined) {
            const keysToDelete: string[] = [];
            const apiId = ifcApi ? this.getApiId(ifcApi) : null;

            for (const key of Array.from(this.elementCache.keys())) {
                let shouldDelete = false;

                if (apiId !== null) {
                    // If ifcApi is provided, only delete keys with matching API prefix
                    const expectedPrefix = modelID !== undefined ? `${apiId}-${modelID}` : `${apiId}-`;
                    shouldDelete = key.startsWith(expectedPrefix);
                } else if (modelID !== undefined) {
                    // If only modelID is provided, delete keys that match the model
                    // This includes both prefixed and non-prefixed keys (for backward compatibility)
                    shouldDelete = key.includes(`-${modelID}`) || key === modelID.toString();
                } else {
                    // If only ifcApi is provided, delete all keys with that API prefix
                    shouldDelete = key.startsWith(`${apiId}-`);
                }

                if (shouldDelete) {
                    keysToDelete.push(key);
                }
            }

            for (const key of keysToDelete) {
                this.elementCache.delete(key);
            }
        } else {
            this.elementCache.clear();
        }
    }

    /**
     * Get cache statistics for debugging and monitoring
     * @returns Object with cache size and model IDs
     */
    static getCacheStats() {
        const cacheKeys = Array.from(this.elementCache.keys());
        const totalElements = Array.from(this.elementCache.values())
            .reduce((sum, cached) => sum + cached.elements.length, 0);

        return {
            cachedModels: this.elementCache.size,
            cacheKeys,
            totalCachedElements: totalElements,
            estimatedMemoryMB: this.estimateCacheMemoryUsage(),
            cacheEntries: Array.from(this.elementCache.entries()).map(([cacheKey, cached]) => ({
                cacheKey,
                elementCount: cached.elements.length,
                hasSnapshot: cached.snapshot !== undefined,
                snapshot: cached.snapshot,
                estimatedSizeMB: this.estimateElementArrayMemory(cached.elements)
            }))
        };
    }

    /**
     * Estimate memory usage of cached elements (rough approximation)
     * @returns Estimated memory usage in MB
     */
    private static estimateCacheMemoryUsage(): number {
        let totalSize = 0;
        const cacheValues = Array.from(this.elementCache.values());
        for (const cached of cacheValues) {
            totalSize += this.estimateElementArrayMemory(cached.elements);
        }
        return totalSize;
    }

    /**
     * Estimate memory usage of an element array
     * @param elements Array of IFC elements
     * @returns Estimated size in MB
     */
    private static estimateElementArrayMemory(elements: IFCElement[]): number {
        if (elements.length === 0) return 0;

        // Rough estimation: each element has expressID (8 bytes), type string (~20 chars avg), typeCode (8 bytes)
        // Plus JavaScript object overhead (~50 bytes per object)
        const avgElementSize = 8 + 20 + 8 + 50; // ~86 bytes per element
        const totalBytes = elements.length * avgElementSize;
        return totalBytes / (1024 * 1024); // Convert to MB
    }

    /**
     * Check if cache is using excessive memory and warn if needed
     */
    static checkMemoryUsage(): void {
        const stats = this.getCacheStats();
        const memoryMB = stats.estimatedMemoryMB;

        if (memoryMB > 100) {
            console.warn(`[IFCElementExtractor] High memory usage detected: ~${memoryMB.toFixed(1)}MB cached across ${stats.cachedModels} models`);

            if (memoryMB > 500) {
                console.error(`[IFCElementExtractor] Critical memory usage: ~${memoryMB.toFixed(1)}MB. Consider clearing cache or processing fewer models simultaneously.`);
            }
        }
    }
}
