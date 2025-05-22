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
  Box,
  Tag,
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
          typeof v === "boolean",
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
  copyValue?: string;
}

const PropertyRow: React.FC<PropertyRowProps> = ({
  propKey,
  propValue,
  icon,
  copyValue,
}) => {
  const handleCopy = () => {
    if (copyValue !== undefined) navigator.clipboard.writeText(copyValue);
  };
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 items-start py-1.5 border-b border-border/50 last:border-b-0">
      <div className="flex items-center text-muted-foreground text-xs font-medium">
        {icon && <span className="mr-1.5 opacity-80">{icon}</span>}
        <span className="truncate" title={propKey}>
          {propKey}:
        </span>
      </div>
      <div
        className="text-xs truncate text-right font-medium flex items-center justify-end gap-1"
        title={
          typeof propValue === "string" || typeof propValue === "number"
            ? String(propValue)
            : undefined
        }
      >
        {renderPropertyValue(propValue, propKey)}
        {copyValue !== undefined && (
          <button onClick={handleCopy} className="opacity-60 hover:opacity-100">
            <Copy className="w-3 h-3" />
          </button>
        )}
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
        isSubSection ? "ml-2 pl-2 border-l-2 border-border/30 mb-1" : "mb-1",
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full text-sm font-semibold text-left hover:bg-muted/60 focus:outline-none rounded-md transition-colors duration-150 group",
          isSubSection ? "py-1.5 px-1.5" : "py-2.5 px-2",
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
            isSubSection ? "pt-0.5 pb-1 pr-1" : "pt-1 pb-2 px-2",
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
    getClassificationsForElement,
  } = useIFCContext();
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("de") ? "de" : "en";
  const ifcTypeValue = elementProperties?.ifcType ?? "";
  const naturalIfcInfo = useMemo(
    () => getNaturalIfcClassName(ifcTypeValue, lang),
    [getNaturalIfcClassName, ifcTypeValue, lang],
  );

  const elementClassifications = useMemo(
    () => getClassificationsForElement(selectedElement),
    [getClassificationsForElement, selectedElement],
  );

  // Always compute processedProps, but handle null case
  const processedProps = useMemo(() => {
    if (!elementProperties) {
      return {
        attributes: {},
        propertySets: {},
        typeSets: {},
        materialSets: {},
      };
    }

    const { attributes, propertySets } = elementProperties;
    const displayableAttributes: Record<string, any> = {};
    const instanceSets: Record<string, any> = {};
    const typeSets: Record<string, any> = {};
    const materialSets: Record<string, any> = {};

    // Extract direct attributes
    if (attributes) {
      for (const key in attributes) {
        if (Object.prototype.hasOwnProperty.call(attributes, key)) {
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
          ) {
            continue;
          }
          if (key.startsWith("_")) continue;

          const value = attributes[key];
          if (
            (typeof value !== "object" || value === null ||
              (value.value !== undefined && value.type !== undefined)) &&
            value !== null &&
            value !== undefined &&
            value !== ""
          ) {
            displayableAttributes[key] = value;
          }
        }
      }
    }

    if (propertySets) {
      for (const [psetName, props] of Object.entries(propertySets)) {
        const filtered: Record<string, any> = {};
        if (props && typeof props === "object") {
          for (const [k, v] of Object.entries(props)) {
            if (v !== null && v !== undefined && v !== "") {
              filtered[k] = v;
            }
          }
        }
        if (Object.keys(filtered).length === 0) continue;

        const lower = psetName.toLowerCase();
        if (
          lower.startsWith("material") ||
          lower.startsWith("layerset") ||
          lower.startsWith("materiallist") ||
          lower.startsWith("material properties") ||
          lower.startsWith("materialinfo")
        ) {
          materialSets[psetName] = filtered;
        } else if (
          psetName.startsWith("Type Attributes:") ||
          psetName.includes("(from Type:")
        ) {
          typeSets[psetName] = filtered;
        } else {
          instanceSets[psetName] = filtered;
        }
      }
    }

    return {
      attributes: displayableAttributes,
      propertySets: instanceSets,
      typeSets,
      materialSets,
    };
  }, [elementProperties]);

  // Skip showing the "no models" message in the properties panel since it's already shown in the tree panel
  // Only show messages for "no selection" and "loading"

  // Empty state for no selection
  if (!selectedElement) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-6">
          <div className="flex justify-center mb-4">
            <Box className="h-8 w-8 text-foreground/30" />
          </div>
          <p className="text-base font-medium text-foreground/80 mb-2">
            {t("properties")}
          </p>
          <p className="text-sm text-foreground/60">
            {t("clickElementToView")}
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!elementProperties) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-6">
          <div className="flex justify-center mb-4">
            <Construction className="h-8 w-8 text-foreground/30 animate-pulse" />
          </div>
          <p className="text-base font-medium text-foreground/80">
            {t("messages.loading")}
          </p>
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

  const {
    attributes: displayableAttributes,
    propertySets,
    typeSets,
    materialSets,
  } = processedProps;

  // Render the detailed property information
  return (
    <div className="space-y-2">
      {/* Basic information section */}
      <CollapsibleSection
        title={t("sections.basicInformation")}
        defaultOpen={true}
        icon={<Info className="w-4 h-4" />}
      >
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 items-start py-1.5 border-b border-border/50 last:border-b-0 cursor-default">
                <div className="flex items-center text-muted-foreground text-xs font-medium">
                  <Box className="w-3.5 h-3.5 mr-1.5 opacity-80" />
                  <span>{t('IFC Class')}:</span>
                </div>
                <div className="text-xs truncate text-right font-medium">
                  {ifcType}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" align="start" className="flex flex-col gap-1 z-50">
              <p className="font-medium">
                {naturalIfcInfo.name || ifcType}
              </p>
              {naturalIfcInfo.schemaUrl && (
                <a
                  href={naturalIfcInfo.schemaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1 mt-1 pt-1 border-t border-border/30"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Schema <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
            propValue={
              rawAttributes.Description.value || rawAttributes.Description
            }
            icon={<Info className="w-3.5 h-3.5" />}
          />
        )}
        {rawAttributes.ObjectType && (
          <PropertyRow
            propKey="Object Type"
            propValue={
              rawAttributes.ObjectType.value || rawAttributes.ObjectType
            }
            icon={<Info className="w-3.5 h-3.5" />}
          />
        )}
        <PropertyRow
          propKey="Express ID"
          propValue={`${expressID}`}
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
            copyValue={rawAttributes.GlobalId.value || rawAttributes.GlobalId}
          />
        )}
        {Object.entries(displayableAttributes).map(([key, value]) => (
          <PropertyRow
            key={key}
            propKey={key}
            propValue={value}
            icon={getPropertyIcon(key)}
          />
        ))}
      </CollapsibleSection>

      {elementClassifications.length > 0 && (
        <CollapsibleSection
          title={t("sections.classifications")}
          defaultOpen={true}
          icon={<Tag className="w-4 h-4" />}
          propertyCount={elementClassifications.length}
          countUnitSingular={t("classifications.classificationSingular")}
          countUnitPlural={t("classifications.classificationPlural")}
        >
          {elementClassifications.map((cls) => (
            <div key={cls.code} className="flex items-center gap-2 py-0.5">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cls.color }}
              />
              <span className="text-xs">
                {cls.name} ({cls.code})
              </span>
            </div>
          ))}
        </CollapsibleSection>
      )}


      {/* Materials section */}
      {materialSets && Object.keys(materialSets).length > 0 && (
        <CollapsibleSection
          title="Materials"
          defaultOpen={true}
          icon={<Palette className="w-4 h-4" />}
          propertyCount={Object.keys(materialSets).length}
          countUnitSingular="set"
          countUnitPlural="sets"
        >
          <MaterialSectionDisplay
            materialPropertyGroups={Object.entries(materialSets).map(
              ([name, props]) => ({
                setName: name,
                properties: props,
                isLayerSet: name.toLowerCase().startsWith("layerset"),
              }),
            )}
          />
        </CollapsibleSection>
      )}

      {/* Property Sets section */}
      {propertySets && Object.keys(propertySets).length > 0 && (
        <CollapsibleSection
          title={t("sections.propertySets")}
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
              propertyCount={
                props && typeof props === "object"
                  ? Object.keys(props).length
                  : 0
              }
              isSubSection={true}
            >
              {props && typeof props === "object"
                ? Object.entries(props as Record<string, any>).map(
                    ([propName, propValue]) => (
                      <PropertyRow
                        key={propName}
                        propKey={propName}
                        propValue={propValue}
                        icon={getPropertyIcon(propName)}
                      />
                    ),
                  )
                : null}
            </CollapsibleSection>
          ))}
        </CollapsibleSection>
      )}

      {/* Type information section */}
      {typeSets && Object.keys(typeSets).length > 0 && (
        <CollapsibleSection
          title="Type Information"
          defaultOpen={false}
          icon={<ALargeSmall className="w-4 h-4" />}
          propertyCount={Object.keys(typeSets).length}
          countUnitSingular="set"
          countUnitPlural="sets"
        >
          {Object.entries(typeSets).map(([psetName, props]) => (
            <CollapsibleSection
              key={psetName}
              title={psetName}
              defaultOpen={false}
              icon={getPropertyIcon(psetName)}
              propertyCount={Object.keys(props).length}
              isSubSection={true}
            >
              {Object.entries(props).map(([propName, propValue]) => (
                <PropertyRow
                  key={propName}
                  propKey={propName}
                  propValue={propValue}
                  icon={getPropertyIcon(propName)}
                />
              ))}
            </CollapsibleSection>
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}
