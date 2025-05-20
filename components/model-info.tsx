"use client";

import { useIFCContext } from "@/context/ifc-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Info,
  ChevronDown,
  ChevronRight,
  Hash,
  Type,
  Palette,
  Layers,
  Sigma,
  CalendarDays,
  ToggleLeft,
  ALargeSmall,
  List,
  Copy,
  ExternalLink,
} from "lucide-react";
import React, { useState, useMemo } from "react";
import { MaterialSectionDisplay } from "./material-section-display";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Enhanced renderPropertyValue function
const renderPropertyValue = (value: any, keyHint?: string): React.ReactNode => {
  const lowerKeyHint = keyHint?.toLowerCase();

  // Handle new structures with units first
  if (value && typeof value === "object") {
    if (value.value !== undefined && value.unit !== undefined) {
      // Handles { value: X, unit: Y }
      const displayValue = renderPropertyValue(value.value, keyHint); // Recursively render the actual value part
      return (
        <>
          {displayValue}{" "}
          <span className="text-muted-foreground/80">({value.unit})</span>
        </>
      );
    }
    if (Array.isArray(value.values) && value.unit !== undefined) {
      // Handles { values: [...], unit: Y }
      const displayValues = value.values
        .map((v: any) => renderPropertyValue(v, keyHint)) // Recursively render each value in the array
        .join(", ");
      return (
        <>
          {displayValues}{" "}
          <span className="text-muted-foreground/80">({value.unit})</span>
        </>
      );
    }
    // For IFC's typical { type: X, value: Y } structure (already existing)
    if (value.value !== undefined && value.type !== undefined) {
      return renderPropertyValue(value.value, keyHint);
    }
  }

  if (typeof value === "boolean") {
    return value ? (
      <span className="text-green-600 dark:text-green-400">Yes</span>
    ) : (
      <span className="text-red-600 dark:text-red-400">No</span>
    );
  }
  if (typeof value === "number") {
    // Basic number formatting, could be enhanced if units are known
    if (
      lowerKeyHint &&
      (lowerKeyHint.includes("area") ||
        lowerKeyHint.includes("volume") ||
        lowerKeyHint.includes("length") ||
        lowerKeyHint.includes("height") ||
        lowerKeyHint.includes("width") ||
        lowerKeyHint.includes("depth") ||
        lowerKeyHint.includes("pitch"))
    ) {
      return value.toFixed(3); // More precision for geometric props
    }
    return value.toLocaleString(); // Default number formatting
  }
  if (typeof value === "string") {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400 truncate"
          title={value}
        >
          {value}
        </a>
      );
    }
    if (value.length > 50) {
      // Truncate long strings
      return <span title={value}>{`${value.substring(0, 47)}...`}</span>;
    }
    return value;
  }
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">Not set</span>;
  }

  // For arrays, show count or a summary
  if (Array.isArray(value)) {
    if (value.length === 0)
      return <span className="text-muted-foreground italic">Empty list</span>;
    // Check if items are simple enough to join, or if they might be objects from a previous (but not unit-wrapped) step
    if (
      value.length <= 5 && // Allow slightly longer lists if they are simple
      value.every(
        (v) =>
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
      )
    ) {
      return value.map((v) => renderPropertyValue(v, keyHint)).join(", "); // Render each item
    }
    return (
      <span className="text-muted-foreground italic">{`List (${value.length} items)`}</span>
    );
  }

  // Fallback for other complex objects not specifically handled
  if (typeof value === "object") {
    return <span className="text-muted-foreground italic">Complex data</span>;
  }

  return String(value); // Last resort
};

interface PropertyRowProps {
  propKey: string;
  propValue: any;
  icon?: React.ReactNode;
}

const PropertyRow: React.FC<PropertyRowProps> = ({
  propKey,
  propValue,
  icon,
}) => {
  // Improved key rendering - attempt to make it more readable
  const formattedKey = propKey
    .replace(/([A-Z])/g, " $1") // Add space before capitals
    .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 items-start py-1.5 border-b border-border/50 last:border-b-0">
      <div className="flex items-center text-muted-foreground text-xs font-medium">
        {icon && <span className="mr-1.5 opacity-80">{icon}</span>}
        <span className="truncate" title={propKey}>
          {formattedKey}:
        </span>
      </div>
      <div
        className="text-xs truncate text-right"
        title={
          typeof propValue === "string" || typeof propValue === "number"
            ? String(propValue)
            : undefined
        }
      >
        {renderPropertyValue(propValue, propKey)}
      </div>
    </div>
  );
};

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  propertyCount?: number;
  isSubSection?: boolean;
  countUnitSingular?: string;
  countUnitPlural?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = false,
  icon,
  propertyCount,
  isSubSection = false,
  countUnitSingular,
  countUnitPlural,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "border-b border-border last:border-b-0",
        isSubSection ? "ml-2 pl-2 border-l-2 border-border/30 mb-1" : "mb-1"
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full text-sm font-semibold text-left hover:bg-muted/60 focus:outline-none rounded-md transition-colors duration-150 group",
          isSubSection ? "py-1.5 px-1.5" : "py-2.5 px-2"
        )}
      >
        <div className="flex items-center">
          {icon && (
            <span className="mr-2 opacity-90 text-primary/80 group-hover:text-primary">
              {icon}
            </span>
          )}
          <span>{title}</span>
          {propertyCount !== undefined && propertyCount > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs font-normal">
              {propertyCount}{" "}
              {propertyCount === 1
                ? countUnitSingular || "prop"
                : countUnitPlural || "props"}
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-transform duration-200" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-transform duration-200" />
        )}
      </button>
      {isOpen && (
        <div
          className={cn(
            "text-xs space-y-0",
            isSubSection ? "pt-0.5 pb-1 pr-1" : "pt-1 pb-2 px-2"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
};

// Function to get an icon based on PSet name or property key
const getPropertyIcon = (name: string): React.ReactNode => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("pset")) return <Layers className="w-3.5 h-3.5" />;
  if (lowerName.includes("attribute")) return <Type className="w-3.5 h-3.5" />;
  if (lowerName.includes("material"))
    return <Palette className="w-3.5 h-3.5" />;
  if (lowerName.includes("type"))
    return <ALargeSmall className="w-3.5 h-3.5" />;
  if (
    lowerName.includes("id") ||
    lowerName.includes("tag") ||
    lowerName.includes("guid")
  )
    return <Hash className="w-3.5 h-3.5" />;
  if (lowerName.includes("date"))
    return <CalendarDays className="w-3.5 h-3.5" />;
  if (
    lowerName.includes("bool") ||
    lowerName.startsWith("is") ||
    lowerName.startsWith("has")
  )
    return <ToggleLeft className="w-3.5 h-3.5" />;
  if (
    lowerName.includes("area") ||
    lowerName.includes("volume") ||
    lowerName.includes("length") ||
    lowerName.includes("height") ||
    lowerName.includes("width") ||
    lowerName.includes("pitch")
  )
    return <Sigma className="w-3.5 h-3.5" />;
  if (lowerName.includes("list") || lowerName.includes("array"))
    return <List className="w-3.5 h-3.5" />;
  return <Info className="w-3.5 h-3.5" />;
};

export function ModelInfo() {
  const {
    selectedElement,
    elementProperties,
    loadedModels,
    getNaturalIfcClassName,
  } = useIFCContext();

  // Memoize processed properties to avoid re-computation on every render
  const processedProps = useMemo(() => {
    if (!elementProperties) return null;

    const { attributes, propertySets } = elementProperties;
    const displayableAttributes: Record<string, any> = {};

    // Extract direct attributes, excluding complex ones already handled by PSet logic or specific rendering
    if (attributes) {
      for (const key in attributes) {
        if (Object.prototype.hasOwnProperty.call(attributes, key)) {
          // Filter out already displayed common headers, or complex objects better handled by PSets
          if (
            [
              "expressID",
              "type",
              "GlobalId",
              "OwnerHistory",
              "Name",
              "Description",
              "ObjectType",
            ].includes(key)
          )
            continue;
          if (key.startsWith("_")) continue; // Internal web-ifc props

          const value = attributes[key];
          if (
            typeof value !== "object" ||
            value === null ||
            (value.value !== undefined && value.type !== undefined)
          ) {
            displayableAttributes[key] = value;
          }
        }
      }
    }
    return { attributes: displayableAttributes, propertySets };
  }, [elementProperties]);

  if (!selectedElement || !elementProperties) {
    const message =
      selectedElement && !elementProperties
        ? "Fetching properties..."
        : !selectedElement
        ? "Click on an element or tree node to view properties."
        : "No properties available for this element.";
    return (
      <div className="bg-card p-4 rounded-lg shadow h-full flex flex-col justify-center items-center text-center border border-border">
        <Info className="w-10 h-10 mb-3 text-muted-foreground/60" />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    );
  }

  const {
    modelID,
    expressID,
    ifcType,
    attributes: rawAttributes,
  } = elementProperties;
  const currentModel = loadedModels.find((m) => m.modelID === modelID);
  const modelDisplayName = currentModel?.name || `Model (ID: ${modelID})`;

  const { attributes: displayableAttributes, propertySets } =
    processedProps || { attributes: {}, propertySets: {} };

  const materialPropertyGroups: Array<{
    setName: string;
    properties: Record<string, any>;
    isLayerSet: boolean;
  }> = [];
  const otherPropertySets: Record<string, any> = {};

  // New structure to group type information
  interface TypeInfoGroup {
    typeName: string; // The actual IfcWallType.Name, IfcWindowType.Name etc.
    typeObjectName: string; // The full original key like "Type Attributes: Basic Wall: Holz..."
    directAttributes: Record<string, any>;
    propertySetsFromType: Array<{
      setName: string;
      properties: Record<string, any>;
    }>;
  }
  const typeInformationGroups: Record<string, TypeInfoGroup> = {}; // Keyed by typeObjectName for initial grouping

  console.log(
    "Available PSet Names from elementProperties:",
    Object.keys(propertySets || {})
  ); // Log all incoming PSet names

  for (const setName in propertySets) {
    if (Object.prototype.hasOwnProperty.call(propertySets, setName)) {
      const props = propertySets[setName];
      // Log each PSet name and the number of properties it contains before categorization
      console.log(
        `Processing PSet: '${setName}', Property Count: ${
          props ? Object.keys(props).length : 0
        }`
      );

      if (props && Object.keys(props).length > 0) {
        const lowerSetName = setName.toLowerCase();
        if (
          lowerSetName.startsWith("material:") ||
          lowerSetName.startsWith("material properties:") ||
          lowerSetName.startsWith("layerset:") ||
          lowerSetName.startsWith("materiallist:") ||
          lowerSetName.startsWith("materialinfo:")
        ) {
          console.log(`  -> Identified as Material Group: '${setName}'`); // Log when identified
          materialPropertyGroups.push({
            setName,
            properties: props,
            isLayerSet: lowerSetName.startsWith("layerset:"),
          });
        } else if (lowerSetName.startsWith("type attributes:")) {
          const typeNameForGroup = setName
            .substring("Type Attributes:".length)
            .trim();
          if (!typeInformationGroups[setName]) {
            typeInformationGroups[setName] = {
              typeName: typeNameForGroup,
              typeObjectName: setName,
              directAttributes: {},
              propertySetsFromType: [],
            };
          }
          typeInformationGroups[setName].directAttributes = props;
        } else if (setName.includes("(from Type:")) {
          // Keep original case for .includes as it might be part of a formatted string
          // ... (psets from type logic)
          const typeNameInPset = setName
            .substring(
              setName.indexOf("(from Type:") + "(from Type:".length,
              setName.lastIndexOf(")")
            )
            .trim();
          let foundGroup = false;
          for (const key in typeInformationGroups) {
            if (typeInformationGroups[key].typeName === typeNameInPset) {
              typeInformationGroups[key].propertySetsFromType.push({
                setName,
                properties: props,
              });
              foundGroup = true;
              break;
            }
          }
          if (!foundGroup) {
            otherPropertySets[setName] = props;
          }
        } else if (lowerSetName !== "element attributes") {
          otherPropertySets[setName] = props;
        }
      }
    }
  }
  console.log(
    "Final materialPropertyGroups found:",
    materialPropertyGroups.length,
    materialPropertyGroups
  );

  materialPropertyGroups.sort((a, b) => {
    if (a.isLayerSet && !b.isLayerSet) return -1;
    if (!a.isLayerSet && b.isLayerSet) return 1;
    return a.setName.localeCompare(b.setName);
  });

  // Convert typeInformationGroups object to an array for rendering and sort it
  const sortedTypeInfoGroups = Object.values(typeInformationGroups).sort(
    (a, b) => a.typeName.localeCompare(b.typeName)
  );

  const sortedOtherPSetKeys = Object.keys(otherPropertySets || {}).sort(
    (a, b) => {
      // Type properties are now handled in typeInformationGroups, so this sort is simpler
      return a.localeCompare(b);
    }
  );

  return (
    <div className="bg-card h-full flex flex-col text-sm rounded-lg border border-border shadow-sm">
      {/* Header Section */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-base truncate text-foreground">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    {getNaturalIfcClassName(ifcType || "Element").name ||
                      "Element Details"}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex flex-col gap-1">
                  <p>
                    <span className="font-semibold">IFC Class:</span>{" "}
                    {ifcType || "N/A"}
                  </p>
                  {getNaturalIfcClassName(ifcType || "Element").schemaUrl && (
                    <a
                      href={
                        getNaturalIfcClassName(ifcType || "Element").schemaUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      View Schema <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
          <Badge variant="secondary" className="font-mono text-xs">
            ID: {expressID}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {rawAttributes?.Name?.value && (
            <div className="flex items-center">
              <Type className="w-3 h-3 mr-1.5 opacity-70" />
              <span className="truncate" title={rawAttributes.Name.value}>
                {rawAttributes.Name.value}
              </span>
            </div>
          )}
          <div className="flex items-center">
            <ALargeSmall className="w-3 h-3 mr-1.5 opacity-70" />
            <span
              className="truncate"
              title={rawAttributes?.ObjectType?.value || "N/A"}
            >
              Type: {rawAttributes?.ObjectType?.value || ifcType}
            </span>
          </div>
          <div className="flex items-center">
            <Layers className="w-3 h-3 mr-1.5 opacity-70" />
            <span className="truncate" title={modelDisplayName}>
              Model: {modelDisplayName}
            </span>
          </div>
          {rawAttributes?.GlobalId?.value && (
            <div className="flex items-center">
              <Hash className="w-3 h-3 mr-1.5 opacity-70" />
              <span
                className="truncate"
                title={rawAttributes.GlobalId.value}
              >
                GUID: {rawAttributes.GlobalId.value}
              </span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          rawAttributes.GlobalId.value
                        )
                      }
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy IFC GUID</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>

      {/* Properties Scrollable Area */}
      <div className="flex-grow overflow-y-auto p-2 space-y-1">
        {/* Display Element Attributes First if they exist (moved from PSet loop) */}
        {Object.keys(displayableAttributes).length > 0 && (
          <CollapsibleSection
            title="Attributes"
            defaultOpen={true}
            icon={<Type className="w-4 h-4" />}
            propertyCount={Object.keys(displayableAttributes).length}
          >
            {Object.entries(displayableAttributes).map(([key, value]) => (
              <PropertyRow
                key={key}
                propKey={key}
                propValue={value}
                icon={getPropertyIcon(key)}
              />
            ))}
          </CollapsibleSection>
        )}

        {/* Display Material Sections Consolidated */}
        {materialPropertyGroups.length > 0 &&
          (() => {
            let title: string;
            let badgeCount: number;
            let unitSingular: string;
            let unitPlural: string;

            if (materialPropertyGroups.length === 1) {
              const singleGroup = materialPropertyGroups[0];
              if (singleGroup.isLayerSet) {
                // Title for a single LayerSet
                if (singleGroup.setName.startsWith("LayerSet: ")) {
                  title = singleGroup.setName.substring("LayerSet: ".length);
                } else if (singleGroup.setName.startsWith("MatLayerSet_")) {
                  title = "Material Layers";
                } else {
                  title = singleGroup.setName || "Material Layers"; // Fallback to name or generic
                }
                if (!title || title.trim() === "") title = "Material Layers";

                // Count actual layers for the badge
                const layerSetProps = singleGroup.properties;
                const layerIndexes = new Set<string>();
                for (const key in layerSetProps) {
                  const match = key.match(/^Layer_(\d+)_/);
                  if (match && match[1]) {
                    layerIndexes.add(match[1]);
                  }
                }
                badgeCount = layerIndexes.size > 0 ? layerIndexes.size : 1; // Min 1 if LayerSet exists
                unitSingular = "layer";
                unitPlural = "layers";
              } else {
                // Single, non-layerset material group
                if (singleGroup.setName.startsWith("Material: ")) {
                  title = singleGroup.setName.substring("Material: ".length);
                } else if (
                  singleGroup.setName.startsWith("Material Properties: ")
                ) {
                  title = singleGroup.setName.substring(
                    "Material Properties: ".length
                  );
                } else if (singleGroup.setName.startsWith("MaterialInfo: ")) {
                  title = singleGroup.setName.substring(
                    "MaterialInfo: ".length
                  );
                } else if (singleGroup.setName.startsWith("MaterialList: ")) {
                  title = singleGroup.setName.substring(
                    "MaterialList: ".length
                  );
                } else {
                  title = singleGroup.setName;
                }
                if (!title || title.trim() === "") title = "Material";
                badgeCount = 1;
                unitSingular = "material";
                unitPlural = "materials";
              }
            } else {
              // Multiple material groups
              title = "Materials";
              badgeCount = materialPropertyGroups.length; // Count of groups
              unitSingular = "item"; // Generic unit for mixed groups
              unitPlural = "items";
            }

            return (
              <CollapsibleSection
                key="materials-consolidated"
                title={title}
                defaultOpen={false}
                icon={<Palette className="w-4 h-4" />}
                propertyCount={badgeCount}
                countUnitSingular={unitSingular}
                countUnitPlural={unitPlural}
              >
                <MaterialSectionDisplay
                  materialPropertyGroups={materialPropertyGroups}
                />
              </CollapsibleSection>
            );
          })()}

        {/* Display Consolidated Type Information Sections */}
        {sortedTypeInfoGroups.map((typeGroup) => {
          const directAttrCount = Object.keys(
            typeGroup.directAttributes
          ).length;
          const psetsFromTypeCount = typeGroup.propertySetsFromType.reduce(
            (acc, ps) => acc + Object.keys(ps.properties).length,
            0
          );
          const totalTypePropsCount = directAttrCount + psetsFromTypeCount;

          if (totalTypePropsCount === 0) return null;

          // Format the main type group title
          let typeGroupDisplayTitle = typeGroup.typeName
            .replace(/^\s+|\s+$/g, "")
            .replace(/ :/g, ":")
            .replace(/:([^\s])/g, ": $1")
            .replace(/^./, (str) => str.toUpperCase());

          return (
            <CollapsibleSection
              key={typeGroup.typeObjectName} // Use original key for stability
              title={`Type: ${typeGroupDisplayTitle}`}
              defaultOpen={false} // Type sections closed by default for now
              icon={<ALargeSmall className="w-4 h-4" />}
              propertyCount={totalTypePropsCount}
            >
              {/* Sub-section for Direct Type Attributes */}
              {directAttrCount > 0 && (
                <CollapsibleSection
                  key={`${typeGroup.typeObjectName}-directAttributes`}
                  title="Direct Attributes"
                  defaultOpen={true} // Open direct attributes by default within the type group
                  icon={<Info className="w-3.5 h-3.5" />} // Generic info icon for this sub-group
                  propertyCount={directAttrCount}
                  isSubSection={true}
                >
                  {Object.entries(typeGroup.directAttributes).map(
                    ([key, value]) => (
                      <PropertyRow
                        key={key}
                        propKey={key}
                        propValue={value}
                        icon={getPropertyIcon(key)} // Use existing icon logic for these rows
                      />
                    )
                  )}
                </CollapsibleSection>
              )}

              {/* Sub-sections for PSets from this Type */}
              {typeGroup.propertySetsFromType
                .sort((a, b) => a.setName.localeCompare(b.setName))
                .map((typePset) => {
                  const typePsetPropCount = Object.keys(
                    typePset.properties
                  ).length;
                  if (typePsetPropCount === 0) return null;

                  // Clean up PSet name for display (remove (from Type...) and format)
                  let psetDisplayName = typePset.setName.replace(
                    / \(from Type:.*?\)/,
                    ""
                  );
                  psetDisplayName = psetDisplayName
                    .replace(/^\s+|\s+$/g, "")
                    .replace(/ :/g, ":")
                    .replace(/:([^\s])/g, ": $1")
                    .replace(/^./, (str) => str.toUpperCase());

                  return (
                    <CollapsibleSection
                      key={typePset.setName}
                      title={psetDisplayName}
                      defaultOpen={false} // PSets within type group closed by default
                      icon={getPropertyIcon(psetDisplayName)} // Use PSet specific icon
                      propertyCount={typePsetPropCount}
                      isSubSection={true}
                    >
                      {Object.entries(typePset.properties).map(
                        ([key, value]) => (
                          <PropertyRow
                            key={key}
                            propKey={key}
                            propValue={value}
                            icon={getPropertyIcon(key)}
                          />
                        )
                      )}
                    </CollapsibleSection>
                  );
                })}
            </CollapsibleSection>
          );
        })}

        {/* Display Other Property Sets */}
        {sortedOtherPSetKeys.length > 0
          ? sortedOtherPSetKeys.map((setName) => {
              const props = otherPropertySets[setName];
              const propCount = Object.keys(props || {}).length;
              if (propCount === 0) return null;

              let displaySetName = setName.replace(/ \(from Type:.*?\)/, "");
              displaySetName = displaySetName
                .replace(/^\s+|\s+$/g, "")
                .replace(/ :/g, ":")
                .replace(/:([^\s])/g, ": $1")
                .replace(/^./, (str) => str.toUpperCase());

              const isTypePset =
                setName.includes("(from Type:") ||
                setName.startsWith("Type Attributes:");
              const isMaterialPset =
                setName.startsWith("Material:") ||
                setName.startsWith("Material Properties:") ||
                setName.startsWith("LayerSet:") ||
                setName.startsWith("MaterialList:") ||
                setName.startsWith("MaterialInfo:");

              let sectionIcon = getPropertyIcon(displaySetName); // Get a default icon based on formatted name

              if (isMaterialPset) sectionIcon = <Palette className="w-4 h-4" />;
              else if (isTypePset)
                sectionIcon = <ALargeSmall className="w-4 h-4" />;

              // Default open for common psets
              const commonPsetsToOpen = [
                "pset_wallcommon",
                "pset_slabcommon",
                "pset_doorcommon",
                "pset_windowcommon",
              ];
              const defaultOpen = commonPsetsToOpen.includes(
                displaySetName.toLowerCase().replace(/ /g, "") // also remove spaces for matching
              );

              // Default rendering for other Psets
              return (
                <CollapsibleSection
                  key={setName}
                  title={displaySetName}
                  defaultOpen={
                    defaultOpen || setName === "Type Properties (General)"
                  }
                  icon={sectionIcon}
                  propertyCount={propCount}
                >
                  {Object.entries(props as Record<string, any>).map(
                    ([propName, propValue]) => (
                      <PropertyRow
                        key={propName}
                        propKey={propName}
                        propValue={propValue}
                        icon={getPropertyIcon(propName)}
                      />
                    )
                  )}
                </CollapsibleSection>
              );
            })
          : Object.keys(displayableAttributes).length === 0 && (
              <div className="px-2 py-4 text-muted-foreground text-center text-xs">
                No properties or attributes found for this element.
              </div>
            )}
      </div>
    </div>
  );
}
