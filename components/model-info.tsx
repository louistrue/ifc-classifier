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
  Construction,
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
import { useTranslation } from "react-i18next";

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
        className="text-xs truncate text-right font-medium"
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
  const { t } = useTranslation();

  // Always compute processedProps, but handle null case
  const processedProps = useMemo(() => {
    if (!elementProperties) {
      return { attributes: {}, propertySets: {} };
    }

    const { attributes, propertySets } = elementProperties;
    const displayableAttributes: Record<string, any> = {};

    // Extract direct attributes
    if (attributes) {
      for (const key in attributes) {
        if (Object.prototype.hasOwnProperty.call(attributes, key)) {
          // Filter out already displayed common headers
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

  // Skip showing the "no models" message in the properties panel since it's already shown in the tree panel
  // Only show messages for "no selection" and "loading"

  // Empty state for no selection
  if (!selectedElement) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-4">
          <div className="flex justify-center">
            <Construction className="h-10 w-10 text-foreground/40 mb-2" />
          </div>
          <p className="font-normal text-foreground/70">{t('clickElementToView')}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!elementProperties) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-4">
          <div className="flex justify-center">
            <Construction className="h-10 w-10 text-foreground/40 mb-2" />
          </div>
          <p className="font-normal text-foreground/70">{t('messages.loading')}</p>
        </div>
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

  const { attributes: displayableAttributes, propertySets } = processedProps;

  // Render the detailed property information
  return (
    <div className="space-y-2">
      {/* Basic information section */}
      <CollapsibleSection
        title={t('sections.basicInformation')}
        defaultOpen={true}
        icon={<Info className="w-4 h-4" />}
      >
        <PropertyRow
          propKey="Type"
          propValue={ifcType}
          icon={<Type className="w-3.5 h-3.5" />}
        />
        {rawAttributes.Name && (
          <PropertyRow
            propKey="Name"
            propValue={rawAttributes.Name.value || rawAttributes.Name}
            icon={<Info className="w-3.5 h-3.5" />}
          />
        )}
        {rawAttributes.Description && (
          <PropertyRow
            propKey="Description"
            propValue={rawAttributes.Description.value || rawAttributes.Description}
            icon={<Info className="w-3.5 h-3.5" />}
          />
        )}
        {rawAttributes.ObjectType && (
          <PropertyRow
            propKey="Object Type"
            propValue={rawAttributes.ObjectType.value || rawAttributes.ObjectType}
            icon={<Info className="w-3.5 h-3.5" />}
          />
        )}
        <PropertyRow
          propKey="Express ID"
          propValue={expressID}
          icon={<Hash className="w-3.5 h-3.5" />}
        />
        <PropertyRow
          propKey="Model"
          propValue={modelDisplayName}
          icon={<Info className="w-3.5 h-3.5" />}
        />
        {rawAttributes.GlobalId && (
          <PropertyRow
            propKey="Global ID"
            propValue={rawAttributes.GlobalId.value || rawAttributes.GlobalId}
            icon={<Hash className="w-3.5 h-3.5" />}
          />
        )}
      </CollapsibleSection>

      {/* Direct attributes section */}
      {Object.keys(displayableAttributes).length > 0 && (
        <CollapsibleSection
          title={t('sections.attributes')}
          defaultOpen={true}
          icon={<Type className="w-4 h-4" />}
          propertyCount={Object.keys(displayableAttributes).length}
          countUnitSingular="attribute"
          countUnitPlural="attributes"
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

      {/* Property Sets section */}
      {propertySets && Object.keys(propertySets).length > 0 && (
        <CollapsibleSection
          title={t('sections.propertySets')}
          defaultOpen={true}
          icon={<Layers className="w-4 h-4" />}
          propertyCount={Object.keys(propertySets).length}
          countUnitSingular="set"
          countUnitPlural="sets"
        >
          {Object.entries(propertySets).map(([psetName, props]) => (
            <CollapsibleSection
              key={psetName}
              title={psetName}
              defaultOpen={false}
              icon={getPropertyIcon(psetName)}
              propertyCount={props && typeof props === 'object' ? Object.keys(props).length : 0}
              isSubSection={true}
            >
              {props && typeof props === 'object' ?
                Object.entries(props as Record<string, any>).map(([propName, propValue]) => (
                  <PropertyRow
                    key={propName}
                    propKey={propName}
                    propValue={propValue}
                    icon={getPropertyIcon(propName)}
                  />
                ))
                : null
              }
            </CollapsibleSection>
          ))}
        </CollapsibleSection>
      )}

      {/* Materials section (if present in property sets) */}
      {propertySets &&
        propertySets.Material &&
        propertySets.MaterialList && (
          <MaterialSectionDisplay
            materialPropertyGroups={[
              {
                setName: "Material",
                properties: propertySets.Material,
                isLayerSet: false
              },
              {
                setName: "Material List",
                properties: propertySets.MaterialList,
                isLayerSet: true
              }
            ]}
          />
        )}
    </div>
  );
}
