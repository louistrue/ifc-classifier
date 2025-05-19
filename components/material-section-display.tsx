"use client";

import React from "react";
import {
  Palette,
  Hash,
  Layers,
  Info,
  Sigma,
  HelpCircle,
  Thermometer,
  Ruler,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MaterialProperty {
  key: string;
  value: any;
  originalKey: string; // To store the raw key like Layer_1_MaterialName
}

interface MaterialLayer {
  layerNumber: number;
  identifier?: string; // Original name from IfcMaterialLayer.Name
  materialName?: string;
  thickness?: number;
  category?: string;
  priority?: number;
  isVentilated?: boolean;
  // Add other potential layer-specific direct properties here
  additionalProps: MaterialProperty[];
}

interface MaterialSectionDisplayProps {
  materialPropertyGroups: Array<{
    setName: string; // e.g., "LayerSet: MatLayerSet_284", "Material: Concrete"
    properties: Record<string, any>;
    isLayerSet: boolean; // To quickly identify layer sets for potential specific rendering
  }>;
}

// Helper to get an icon for a specific property key
const getMaterialPropertyIcon = (key: string): React.ReactNode => {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes("thickness")) return <Ruler className="w-3.5 h-3.5" />;
  if (lowerKey.includes("category")) return <Layers className="w-3.5 h-3.5" />;
  if (lowerKey.includes("priority")) return <Hash className="w-3.5 h-3.5" />;
  if (lowerKey.includes("ventilated")) return <Info className="w-3.5 h-3.5" />; // Could be a fan icon
  if (lowerKey.includes("thermal") || lowerKey.includes("conductivity"))
    return <Thermometer className="w-3.5 h-3.5" />;
  if (lowerKey.includes("density")) return <Sigma className="w-3.5 h-3.5" />;
  return <Info className="w-3.5 h-3.5" />;
};

const renderSimplePropertyValue = (value: any): React.ReactNode => {
  if (typeof value === "boolean") {
    return value ? (
      <span className="text-green-500">Yes</span>
    ) : (
      <span className="text-red-500">No</span>
    );
  }
  if (typeof value === "number") {
    // Could add more specific formatting if units are known
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return String(value);
};

export const MaterialSectionDisplay: React.FC<MaterialSectionDisplayProps> = ({
  materialPropertyGroups,
}) => {
  if (!materialPropertyGroups || materialPropertyGroups.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic px-1">
        No material information available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {materialPropertyGroups.map((group, index) => {
        const { setName, properties, isLayerSet } = group;

        // --- Handler for IfcMaterialLayerSet ---
        if (isLayerSet) {
          // Use the pre-calculated boolean
          const totalThickness = properties["TotalThickness"];
          const layers: MaterialLayer[] = [];
          const parsedLayerNumbers: Set<number> = new Set();
          const layerDataTemp: Record<
            number,
            Partial<MaterialLayer> & { additionalPropsRaw: Record<string, any> }
          > = {};

          for (const key in properties) {
            if (key.startsWith("Layer_")) {
              const parts = key.split("_");
              if (parts.length >= 2) {
                const layerNum = parseInt(parts[1], 10);
                if (!isNaN(layerNum)) {
                  parsedLayerNumbers.add(layerNum);
                  if (!layerDataTemp[layerNum]) {
                    layerDataTemp[layerNum] = {
                      layerNumber: layerNum,
                      additionalPropsRaw: {},
                    };
                  }
                  const attributeName = parts.slice(2).join("_");
                  if (attributeName === "Identifier")
                    layerDataTemp[layerNum]!.identifier = properties[key];
                  else if (attributeName === "MaterialName")
                    layerDataTemp[layerNum]!.materialName = properties[key];
                  else if (attributeName === "Thickness")
                    layerDataTemp[layerNum]!.thickness = parseFloat(
                      properties[key]
                    );
                  else if (attributeName === "Category")
                    layerDataTemp[layerNum]!.category = properties[key];
                  else if (attributeName === "Priority")
                    layerDataTemp[layerNum]!.priority = parseInt(
                      properties[key],
                      10
                    );
                  else if (attributeName === "IsVentilated")
                    layerDataTemp[layerNum]!.isVentilated = properties[key];
                  else
                    layerDataTemp[layerNum]!.additionalPropsRaw[attributeName] =
                      properties[key];
                }
              }
            }
          }

          Array.from(parsedLayerNumbers)
            .sort((a, b) => a - b)
            .forEach((num) => {
              const data = layerDataTemp[num];
              if (data) {
                const additionalPropsFormatted: MaterialProperty[] = [];
                for (const rawKey in data.additionalPropsRaw) {
                  additionalPropsFormatted.push({
                    key: rawKey.replace(/^./, (str) => str.toUpperCase()),
                    value: data.additionalPropsRaw[rawKey],
                    originalKey: `Layer_${num}_${rawKey}`,
                  });
                }
                layers.push({
                  layerNumber: data.layerNumber!,
                  identifier: data.identifier,
                  materialName: data.materialName,
                  thickness: data.thickness,
                  category: data.category,
                  priority: data.priority,
                  isVentilated: data.isVentilated,
                  additionalProps: additionalPropsFormatted,
                });
              }
            });

          // Extract the specific LayerSet name for its sub-header
          const layerSetSpecificName = setName
            .substring(setName.indexOf(":") + 1)
            .trim()
            .replace(/^\s+|\s+$/g, "")
            .replace(/^./, (str) => str.toUpperCase());

          return (
            <div
              key={`${setName}-${index}`}
              className="space-y-2 mb-3 pb-2 border-b border-border/30 last:border-b-0"
            >
              <h4 className="text-xs font-semibold text-muted-foreground pl-1 mb-1.5">
                {layerSetSpecificName || "Layer Set Details"}
              </h4>
              {totalThickness !== undefined && (
                <div className="flex justify-between items-center text-sm px-2 py-1 bg-muted/60 rounded-md mb-2">
                  <span className="font-medium text-foreground/90">
                    Total Thickness:
                  </span>
                  <span className="font-semibold text-foreground">
                    {renderSimplePropertyValue(totalThickness)}
                  </span>
                </div>
              )}
              {layers.length > 0 ? (
                <div className="space-y-2">
                  {layers.map((layer) => (
                    <TooltipProvider
                      key={`layer-${layer.layerNumber}-${setName}`}
                      delayDuration={100}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2.5 border border-border/50 rounded-lg shadow-sm bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-150 ease-in-out cursor-default">
                            {/* Layer Header: Identifier/Material Name and Thickness Badge */}
                            <div className="flex justify-between items-center mb-1.5">
                              <span
                                className="text-sm font-semibold text-primary-foreground bg-primary/90 px-2 py-0.5 rounded-full truncate leading-tight"
                                title={
                                  layer.identifier ||
                                  layer.materialName ||
                                  `Layer ${layer.layerNumber}`
                                }
                              >
                                {layer.identifier ||
                                  layer.materialName ||
                                  `Layer ${layer.layerNumber}`}
                              </span>
                              {layer.thickness !== undefined && (
                                <Badge
                                  variant="outline"
                                  className="text-xs font-mono border-primary/50 text-primary/90 bg-primary/10 py-0.5"
                                >
                                  {renderSimplePropertyValue(layer.thickness)}
                                </Badge>
                              )}
                            </div>

                            {/* Detailed Properties Grid */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pl-1 mt-2">
                              {/* Explicitly show Material Name if identifier was used as main title and they differ */}
                              {layer.identifier &&
                                layer.identifier !== layer.materialName &&
                                layer.materialName && (
                                  <React.Fragment>
                                    <div className="flex items-center text-muted-foreground">
                                      <Palette className="w-3.5 h-3.5 mr-1.5 opacity-80" />{" "}
                                      Material:
                                    </div>
                                    <div
                                      className="text-right text-foreground/90 truncate"
                                      title={layer.materialName}
                                    >
                                      {layer.materialName}
                                    </div>
                                  </React.Fragment>
                                )}
                              {layer.category && (
                                <React.Fragment>
                                  <div className="flex items-center text-muted-foreground">
                                    <Layers className="w-3.5 h-3.5 mr-1.5 opacity-80" />{" "}
                                    Category:
                                  </div>
                                  <div
                                    className="text-right text-foreground/90 truncate"
                                    title={layer.category}
                                  >
                                    {layer.category}
                                  </div>
                                </React.Fragment>
                              )}
                              {layer.priority !== undefined && (
                                <React.Fragment>
                                  <div className="flex items-center text-muted-foreground">
                                    <Hash className="w-3.5 h-3.5 mr-1.5 opacity-80" />{" "}
                                    Priority:
                                  </div>
                                  <div className="text-right text-foreground/90 truncate">
                                    {layer.priority}
                                  </div>
                                </React.Fragment>
                              )}
                              {layer.isVentilated !== undefined && (
                                <React.Fragment>
                                  <div className="flex items-center text-muted-foreground">
                                    <Info className="w-3.5 h-3.5 mr-1.5 opacity-80" />{" "}
                                    Ventilated:
                                  </div>
                                  <div className="text-right text-foreground/90 truncate">
                                    {renderSimplePropertyValue(
                                      layer.isVentilated
                                    )}
                                  </div>
                                </React.Fragment>
                              )}
                              {/* Render other layer specific properties that were not hardcoded */}
                              {layer.additionalProps.map((prop) => (
                                <React.Fragment key={prop.originalKey}>
                                  <div className="flex items-center text-muted-foreground">
                                    {getMaterialPropertyIcon(prop.key)}
                                    <span className="ml-1.5 truncate">
                                      {prop.key}:
                                    </span>
                                  </div>
                                  <div
                                    className="text-right text-foreground/90 truncate"
                                    title={String(prop.value)}
                                  >
                                    {renderSimplePropertyValue(prop.value)}
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        </TooltipTrigger>
                        {/* Tooltip content remains largely the same, but ensure it reflects the primary display fields */}
                        <TooltipContent
                          side="bottom"
                          align="start"
                          className="bg-popover text-popover-foreground text-xs p-2.5 rounded-md shadow-lg max-w-xs"
                        >
                          <p className="font-bold text-sm mb-1.5 border-b pb-1 border-border/50">
                            {layer.identifier ||
                              layer.materialName ||
                              `Layer ${layer.layerNumber}`}
                            {layer.thickness !== undefined ? (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                ({renderSimplePropertyValue(layer.thickness)})
                              </span>
                            ) : (
                              ""
                            )}
                          </p>
                          {layer.materialName && (
                            <p>
                              <span className="font-medium">Material:</span>{" "}
                              {layer.materialName}
                            </p>
                          )}
                          {layer.category && (
                            <p>
                              <span className="font-medium">Category:</span>{" "}
                              {layer.category}
                            </p>
                          )}
                          {layer.priority !== undefined && (
                            <p>
                              <span className="font-medium">Priority:</span>{" "}
                              {layer.priority}
                            </p>
                          )}
                          {layer.isVentilated !== undefined && (
                            <p>
                              <span className="font-medium">Ventilated:</span>{" "}
                              {renderSimplePropertyValue(layer.isVentilated)}
                            </p>
                          )}
                          {layer.additionalProps.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-border/30"></div>
                          )}
                          {layer.additionalProps.map((prop) => (
                            <p key={`tooltip-${prop.originalKey}`}>
                              <span className="font-medium">{prop.key}:</span>{" "}
                              {renderSimplePropertyValue(prop.value)}
                            </p>
                          ))}
                          {!layer.materialName &&
                            !layer.category &&
                            layer.priority === undefined &&
                            layer.isVentilated === undefined &&
                            layer.additionalProps.length === 0 && (
                              <p className="italic text-muted-foreground">
                                No additional details.
                              </p>
                            )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic px-1">
                  No layers defined in this set.
                </div>
              )}
            </div>
          );
        } else {
          // --- Handler for IfcMaterial, IfcMaterialProperties, IfcMaterialList, and other MaterialInfo ---
          const genericProps: MaterialProperty[] = Object.entries(
            properties
          ).map(([key, value]) => ({
            key: key.replace(/^./, (str) => str.toUpperCase()),
            value,
            originalKey: key,
          }));

          if (genericProps.length === 0) {
            return (
              <div
                key={`${setName}-${index}`}
                className="text-xs text-muted-foreground italic px-1 mb-2 pb-2 border-b border-border/30 last:border-b-0"
              >
                No properties found for this material aspect ({setName}).
              </div>
            );
          }

          // Extract and format the specific material aspect name for its sub-header
          const materialAspectName = setName
            .substring(setName.indexOf(":") + 1)
            .trim()
            .replace(/^\s+|\s+$/g, "")
            .replace(/^./, (str) => str.toUpperCase());

          return (
            <div
              key={`${setName}-${index}`}
              className="mb-3 pb-2 border-b border-border/30 last:border-b-0"
            >
              <h4 className="text-xs font-semibold text-muted-foreground pl-1 mb-1">
                {materialAspectName || "Material Details"}
              </h4>
              <div className="space-y-0.5">
                {genericProps.map((prop) => (
                  <div
                    key={prop.originalKey}
                    className="grid grid-cols-[auto_1fr] gap-x-2 items-start py-1 text-xs"
                    title={`${prop.key}: ${
                      typeof prop.value === "string" ||
                      typeof prop.value === "number"
                        ? prop.value
                        : "Complex Value"
                    }`}
                  >
                    <div className="flex items-center text-muted-foreground font-medium">
                      {getMaterialPropertyIcon(prop.key)}
                      <span className="ml-1.5 truncate">{prop.key}:</span>
                    </div>
                    <div className="text-right truncate text-foreground/90">
                      {renderSimplePropertyValue(prop.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};
