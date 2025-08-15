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
    private static elementCache = new Map<number, IFCElement[]>();

    /**
     * Get all elements from the model - OPTIMIZED FOR SPEED
     */
    static getAllElements(ifcApi: IfcAPI, modelID: number): IFCElement[] {
        // Check cache first
        if (this.elementCache.has(modelID)) {
            return this.elementCache.get(modelID)!;
        }

        const allElements: IFCElement[] = [];

        try {
            // Method 1: Use GetAllLines - this should get everything
            const allLines = ifcApi.GetAllLines(modelID);
            const totalLines = allLines.size();

            // Pre-allocate array for better performance
            allElements.length = totalLines;
            let validElementCount = 0;

            for (let i = 0; i < totalLines; i++) {
                const expressID = allLines.get(i);
                try {
                    const element = ifcApi.GetLine(modelID, expressID, false);
                    if (element && element.type) {
                        const typeName = ifcApi.GetNameFromTypeCode(element.type);
                        allElements[validElementCount++] = {
                            expressID,
                            type: typeName,
                            typeCode: element.type
                        };
                    }
                } catch (e) {
                    // Skip invalid elements silently for speed
                }
            }

            // Trim array to actual size
            allElements.length = validElementCount;

        } catch (e) {
            // Fallback: Iterate through express IDs
            try {
                const maxExpressID = ifcApi.GetMaxExpressID(modelID);

                for (let i = 1; i <= maxExpressID; i++) {
                    try {
                        const element = ifcApi.GetLine(modelID, i, false);
                        if (element && element.type) {
                            const typeName = ifcApi.GetNameFromTypeCode(element.type);
                            allElements.push({
                                expressID: i,
                                type: typeName,
                                typeCode: element.type
                            });
                        }
                    } catch (e) {
                        // Element doesn't exist at this ID, continue
                    }
                }
            } catch (e) {
                console.error(`[IFCElementExtractor] Both methods failed:`, e);
            }
        }

        // Cache the results
        this.elementCache.set(modelID, allElements);

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
     * Clear cache for a specific model or all models
     */
    static clearCache(modelID?: number) {
        if (modelID !== undefined) {
            this.elementCache.delete(modelID);
        } else {
            this.elementCache.clear();
        }
    }
}
