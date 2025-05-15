"use client";

import { useIFCContext } from "@/context/ifc-context";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import React, { useState, useMemo } from "react";

// Enhanced renderPropertyValue function
const renderPropertyValue = (value: any, keyHint?: string): React.ReactNode => {
  const lowerKeyHint = keyHint?.toLowerCase();

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
  if (
    value &&
    typeof value === "object" &&
    value.value !== undefined &&
    value.type !== undefined
  ) {
    // For IFC's typical { type: X, value: Y } structure
    // We can be smarter here based on value.type if it's an IFC defined type ID
    return renderPropertyValue(value.value, keyHint);
  }
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">Not set</span>;
  }

  // For arrays, show count or a summary
  if (Array.isArray(value)) {
    if (value.length === 0)
      return <span className="text-muted-foreground italic">Empty list</span>;
    if (
      value.length <= 3 &&
      value.every((v) => typeof v === "string" || typeof v === "number")
    ) {
      return value.join(", ");
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
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = false,
  icon,
  propertyCount,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0 mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-2.5 px-2 text-sm font-semibold text-left hover:bg-muted/60 focus:outline-none rounded-md transition-colors duration-150 group"
      >
        <div className="flex items-center">
          {icon && (
            <span className="mr-2 opacity-90 text-primary/80 group-hover:text-primary">
              {icon}
            </span>
          )}
          <span>{title}</span>
          {propertyCount !== undefined && (
            <Badge variant="secondary" className="ml-2 text-xs font-normal">
              {propertyCount} {propertyCount === 1 ? "prop" : "props"}
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
        <div className="pt-1 pb-2 px-2 text-xs space-y-0">{children}</div>
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
  const { selectedElement, elementProperties, loadedModels } = useIFCContext();

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

  // Sort property sets: Element Attributes first, then Type Properties, then Materials, then others alphabetically
  const sortedPSetKeys = Object.keys(propertySets || {}).sort((a, b) => {
    if (a === "Element Attributes") return -1;
    if (b === "Element Attributes") return 1;
    if (a.includes("Type Properties")) return -1;
    if (b.includes("Type Properties")) return 1;
    if (a.startsWith("Material:")) return -1;
    if (b.startsWith("Material:")) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="bg-card h-full flex flex-col text-sm rounded-lg border border-border shadow-sm">
      {/* Header Section */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h3
            className="font-semibold text-base truncate text-foreground"
            title={ifcType}
          >
            {ifcType || "Element Details"}
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

        {/* Display Property Sets */}
        {sortedPSetKeys.length > 0
          ? sortedPSetKeys.map((setName) => {
              if (setName === "Element Attributes") return null; // Already handled
              const props = (propertySets as Record<string, any>)[setName];
              const propCount = Object.keys(props || {}).length;
              if (propCount === 0) return null; // Don't render empty Psets

              // Clean up PSet name for display (e.g., remove "(from Type...)" for title)
              const displaySetName = setName.replace(/ \(from Type:.*?\)/, "");
              const isTypePset = setName.includes("(from Type:");
              const isMaterialPset = setName.startsWith("Material:");
              let sectionIcon = getPropertyIcon(displaySetName);
              if (isTypePset && !isMaterialPset)
                sectionIcon = <ALargeSmall className="w-4 h-4" />;
              if (isMaterialPset) sectionIcon = <Palette className="w-4 h-4" />;

              // Default open for common psets
              const commonPsetsToOpen = [
                "pset_wallcommon",
                "pset_slabcommon",
                "pset_doorcommon",
                "pset_windowcommon",
              ];
              const defaultOpen = commonPsetsToOpen.includes(
                displaySetName.toLowerCase()
              );

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
