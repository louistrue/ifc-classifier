"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useDeferredValue,
} from "react";
import {
  useIFCContext,
  SpatialStructureNode,
  LoadedModelData,
  SelectedElementInfo,
} from "@/context/ifc-context";
import {
  ChevronRight,
  ChevronDown,
  Building,
  Landmark,
  Layers as LayersIcon,
  Cuboid,
  HelpCircle,
  FileText,
  XCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
  MousePointer2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useSchemaPreview } from "@/lib/useSchemaPreview";
import { useTranslation, Trans } from "react-i18next";
import { SchemaReader } from "./schema-reader";

// Types for the types view
type ViewMode = 'spatial' | 'types';

type TypeGroup = {
  typeId: number | 'UNDEFINED';
  typeName: string;
  typeData?: any;
  instances: SelectedElementInfo[];
};

type ClassIndex = Map<string, {
  totalCount: number;
  typeGroups: Map<TypeGroup['typeId'], TypeGroup>;
}>;

type RelDefinesByType = {
  relId: number;
  relatingTypeId: number;
  relatedInstanceIds: number[];
};

// Helper function to generate a unique key for a node
const getNodeKey = (
  node: SpatialStructureNode,
  modelID: number | null | undefined,
  isRootModel: boolean = false,
) => {
  if (isRootModel && modelID !== null && modelID !== undefined) {
    return `model-root-${modelID}`;
  }
  if (modelID === null || modelID === undefined)
    return `node-${node.expressID}`;
  return `${modelID}-${node.expressID}`;
};

const gatherDescendantIds = (node: SpatialStructureNode): number[] => {
  let ids: number[] = [node.expressID];
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      ids = ids.concat(gatherDescendantIds(child));
    });
  }
  return ids;
};

interface PathFindingResult {
  pathKeys: string[];
  storeyKey: string | null;
  selectedNodeKey: string | null;
}

interface TreeNodeProps {
  node: SpatialStructureNode;
  level: number;
  onSelectNode: (selection: SelectedElementInfo) => void;
  selectedElementInfo: SelectedElementInfo | null;
  isRootModelNode?: boolean;
  modelFileInfo?: { id: string; name: string; modelID: number | null };
  onAttemptRemoveModel?: (modelId: string, modelName: string) => void;
  expandedNodeKeys: Set<string>;
  toggleNodeExpansion: (nodeKey: string) => void;
  selectedNodeKeyForScroll: string | null;
  selectedNodeActualRef: React.RefObject<HTMLDivElement> | null;
  modelID: number | null;
  t: (key: string, options?: any) => string;
  searchQuery: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  onSelectNode,
  selectedElementInfo,
  isRootModelNode = false,
  modelFileInfo = { id: "unknown", name: "Model", modelID: null },
  onAttemptRemoveModel,
  expandedNodeKeys,
  toggleNodeExpansion,
  selectedNodeKeyForScroll,
  selectedNodeActualRef,
  modelID,
  t,
  searchQuery,
}) => {
  const {
    getNaturalIfcClassName,
    toggleModelVisibility,
    hiddenModelIds,
    hideElements,
    showElements,
    userHiddenElements,
  } = useIFCContext();
  const { i18n } = useTranslation();
  const lang = i18n.language === "de" ? "de" : "en";
  const memoizedChildren = useMemo(() => node.children || [], [node.children]);

  const [schemaReaderOpen, setSchemaReaderOpen] = useState(false);

  const currentModelIDForNode = isRootModelNode
    ? modelFileInfo.modelID
    : (modelFileInfo?.modelID ?? null);
  const nodeKey = getNodeKey(node, currentModelIDForNode, isRootModelNode);
  const isExpanded = expandedNodeKeys.has(nodeKey);

  // Check if this node should be scrolled to
  const shouldScrollToThisNode = selectedNodeKeyForScroll === nodeKey;

  // Debug logging for ref attachment
  useEffect(() => {
    if (shouldScrollToThisNode) {
      console.log(`Ref should be attached to node: ${nodeKey}, expressID: ${node.expressID}, type: ${node.type}`);
    }
  }, [shouldScrollToThisNode, nodeKey, node.expressID, node.type]);

  const isModelHidden = isRootModelNode
    ? hiddenModelIds.includes(modelFileInfo.id)
    : false;

  const storeyDescendantIds = useMemo(() => {
    if (node.type.includes("STOREY")) {
      return gatherDescendantIds(node);
    }
    return [] as number[];
  }, [node]);

  const isStoreyHidden = useMemo(() => {
    if (!node.type.includes("STOREY") || modelFileInfo.modelID === null)
      return false;
    return storeyDescendantIds.every((id) =>
      userHiddenElements.some(
        (el) => el.modelID === modelFileInfo.modelID && el.expressID === id,
      ),
    );
  }, [
    userHiddenElements,
    storeyDescendantIds,
    node.type,
    modelFileInfo.modelID,
  ]);

  const getIcon = (type: string) => {
    if (isRootModelNode)
      return <FileText className="w-4 h-4 mr-2 text-sky-500" />;
    if (type.includes("PROJECT"))
      return <Landmark className="w-4 h-4 mr-2 text-purple-500" />;
    if (type.includes("SITE"))
      return <Landmark className="w-4 h-4 mr-2 text-orange-500" />;
    if (type.includes("BUILDING"))
      return <Building className="w-4 h-4 mr-2 text-blue-500" />;
    if (type.includes("STOREY"))
      return <LayersIcon className="w-4 h-4 mr-2 text-green-500" />;
    if (
      type.includes("ELEMENT") ||
      type.includes("PROXY") ||
      type.includes("WALL") ||
      type.includes("SLAB") ||
      type.includes("BEAM") ||
      type.includes("COLUMN") ||
      type.includes("SPACE")
    ) {
      return <Cuboid className="w-4 h-4 mr-2 text-gray-500" />;
    }
    return <HelpCircle className="w-4 h-4 mr-2 text-gray-400" />;
  };

  const handleToggleExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNodeExpansion(nodeKey);
  };

  const handleSelect = () => {
    if (isRootModelNode || modelFileInfo.modelID === null) return;

    if (
      node.type.includes("ELEMENT") ||
      node.type.includes("PROXY") ||
      node.children.length === 0 ||
      node.type.includes("SPACE") ||
      node.type.includes("STOREY") ||
      node.type.includes("BUILDING") ||
      node.type.includes("SITE") ||
      node.type.includes("PROJECT")
    ) {
      onSelectNode({
        modelID: modelFileInfo.modelID,
        expressID: node.expressID,
      });
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAttemptRemoveModel && modelFileInfo) {
      onAttemptRemoveModel(modelFileInfo.id, modelFileInfo.name);
    }
  };

  const handleToggleModelVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (modelFileInfo) {
      toggleModelVisibility(modelFileInfo.id);
    }
  };

  const handleToggleStoreyVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (modelFileInfo.modelID === null || !node.type.includes("STOREY")) return;

    const elements = storeyDescendantIds.map((id) => ({
      modelID: modelFileInfo.modelID as number,
      expressID: id,
    }));

    if (isStoreyHidden) {
      showElements(elements);
    } else {
      hideElements(elements);
    }
  };

  const originalIfcType = node.type;
  const naturalNameResult = getNaturalIfcClassName(originalIfcType, lang);
  const naturalIfcName = naturalNameResult?.name ?? "";
  const schemaUrl = naturalNameResult?.schemaUrl ?? "";
  const { preview: schemaPreview, loading: schemaLoading, error: schemaError } = useSchemaPreview(schemaUrl);

  const openSchemaReader = () => {
    if (schemaUrl) {
      setSchemaReaderOpen(true);
    }
  };

  const displayName = isRootModelNode
    ? modelFileInfo.name
    : node.Name || naturalIfcName || `ID: ${node.expressID}`;

  const lowerQuery = searchQuery.toLowerCase();
  const matchesSearch =
    searchQuery &&
    (displayName.toLowerCase().includes(lowerQuery) ||
      originalIfcType.toLowerCase().includes(lowerQuery) ||
      String(node.expressID).includes(lowerQuery));

  let tooltipPrimaryContent = isRootModelNode
    ? modelFileInfo.name
    : `${naturalIfcName}${node.Name ? ` - ${node.Name}` : ""}`;

  const isSelected =
    !isRootModelNode &&
    modelFileInfo.modelID !== null &&
    selectedElementInfo?.modelID === modelFileInfo.modelID &&
    selectedElementInfo?.expressID === node.expressID;

  return (
    <>
      <div
        ref={shouldScrollToThisNode ? selectedNodeActualRef : null}
        className={cn(
          "flex items-center py-1.5 px-2 rounded-md hover:bg-accent group",
          isSelected && "bg-accent text-accent-foreground font-semibold",
          !isSelected && matchesSearch && "bg-primary/10",
          isRootModelNode ? "cursor-default" : "cursor-pointer",
        )}
        style={{
          paddingLeft: `${level * 1.25 + (isRootModelNode ? 0.25 : 0.5)}rem`,
        }}
        onClick={handleSelect}
      >
        {node.children && node.children.length > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 mr-1"
            onClick={handleToggleExpansion}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        ) : (
          <span className="w-6 h-6 mr-1"></span>
        )}
        {getIcon(originalIfcType)}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate flex-grow">{displayName}</span>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="start"
              className="flex flex-col gap-1 max-w-sm"
            >
              <p>{tooltipPrimaryContent}</p>
              {!isRootModelNode && (
                <p className="text-xs text-muted-foreground">
                  (IFC Class: {originalIfcType})
                </p>
              )}
              {node.expressID !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Express ID: {node.expressID}
                </p>
              )}
              {!isRootModelNode && schemaUrl && (
                <>
                  {schemaLoading && (
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                      Loading schema preview...
                    </p>
                  )}
                  {schemaError && (
                    <p className="text-xs text-red-400 pt-1 border-t border-border/30">
                      {schemaError}
                    </p>
                  )}
                  {schemaPreview && !schemaLoading && !schemaError && (
                    <div className="text-xs text-muted-foreground pt-1 border-t border-border/30 space-y-1">
                      {schemaPreview.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                      <div
                        className="mt-2 p-2 bg-primary/5 rounded border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={openSchemaReader}
                      >
                        <div className="flex items-center gap-1 text-primary text-xs font-medium">
                          <MousePointer2 className="w-3 h-3" />
                          Click to explore full documentation
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1 mt-1">
                    <a
                      href={schemaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {t('viewSchema')} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {!memoizedChildren.length && <div className="w-4 mr-1 flex-shrink-0" />}
        {isRootModelNode && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title={isModelHidden ? t('modelViewer.showModel', { name: modelFileInfo.name }) : t('modelViewer.hideModel', { name: modelFileInfo.name })}
            onClick={handleToggleModelVisibility}
          >
            {isModelHidden ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
        )}
        {isRootModelNode && onAttemptRemoveModel && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title={t('modelViewer.removeModel', { name: modelFileInfo.name })}
            onClick={handleRemoveClick}
          >
            <XCircle className="w-4 h-4 text-destructive" />
          </Button>
        )}
        {!isRootModelNode && node.type.includes("STOREY") && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title={isStoreyHidden ? t('modelViewer.showStorey') : t('modelViewer.hideStorey')}
            onClick={handleToggleStoreyVisibility}
          >
            {isStoreyHidden ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {isExpanded && memoizedChildren.map((child, index) => (
        <TreeNode
          key={getNodeKey(child, modelID)}
          node={child}
          level={level + 1}
          onSelectNode={onSelectNode}
          selectedElementInfo={selectedElementInfo}
          isRootModelNode={false}
          modelFileInfo={modelFileInfo}
          onAttemptRemoveModel={onAttemptRemoveModel}
          expandedNodeKeys={expandedNodeKeys}
          toggleNodeExpansion={toggleNodeExpansion}
          selectedNodeKeyForScroll={selectedNodeKeyForScroll}
          selectedNodeActualRef={selectedNodeActualRef}
          modelID={modelID}
          t={t}
          searchQuery={searchQuery}
        />
      ))}

      <SchemaReader
        isOpen={schemaReaderOpen}
        onClose={() => setSchemaReaderOpen(false)}
        schemaUrl={schemaUrl}
        ifcClassName={naturalIfcName || originalIfcType}
        initialPreview={schemaPreview || undefined}
      />
    </>
  );
};

// TypesTreePanel component for the types view
interface TypesTreePanelProps {
  loadedModels: LoadedModelData[];
  ifcApi: any;
  selectElement: (selection: SelectedElementInfo) => void;
  selectedElement: SelectedElementInfo | null;
  getNaturalIfcClassName: (type: string, lang?: "de" | "en") => { name: string; schemaUrl?: string } | null;
  hideElements: (elements: SelectedElementInfo[]) => void;
  showElements: (elements: SelectedElementInfo[]) => void;
  searchQuery: string;
  expandedNodeKeys: Set<string>;
  toggleNodeExpansion: (key: string) => void;
  selectedNodeRef: React.RefObject<HTMLDivElement>;
  selectedNodeKeyForScroll: string | null;
  setSelectedNodeKeyForScroll: (key: string | null) => void;
  isUserBrowsingTree: boolean;
  isNewSelection: (current: SelectedElementInfo | null, previous: SelectedElementInfo | null) => boolean;
  lastSelectedElement: SelectedElementInfo | null;
  setLastSelectedElement: (element: SelectedElementInfo | null) => void;
  t: (key: string, options?: any) => string;
  lang: string;
}

function TypesTreePanel({
  loadedModels,
  ifcApi,
  selectElement,
  selectedElement,
  getNaturalIfcClassName,
  hideElements,
  showElements,
  searchQuery,
  expandedNodeKeys,
  toggleNodeExpansion,
  selectedNodeRef,
  selectedNodeKeyForScroll,
  setSelectedNodeKeyForScroll,
  isUserBrowsingTree,
  isNewSelection,
  lastSelectedElement,
  setLastSelectedElement,
  t,
  lang,
}: TypesTreePanelProps) {
  // Power user mode state with localStorage persistence
  const [showClassesWithoutTypes, setShowClassesWithoutTypes] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('typesViewPowerUser');
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('typesViewPowerUser', showClassesWithoutTypes.toString());
  }, [showClassesWithoutTypes]);

  // Cache for RelDefinesByType relationships per model
  const relDefinesByTypeCache = useRef<Map<number, RelDefinesByType[]>>(new Map());

  // Cache for class to instances mapping per model
  const classToInstancesCache = useRef<Map<number, Map<string, SelectedElementInfo[]>>>(new Map());

  // Build RelDefinesByType relationships for a model
  const buildRelDefinesByType = useCallback(async (modelID: number): Promise<RelDefinesByType[]> => {
    if (relDefinesByTypeCache.current.has(modelID)) {
      return relDefinesByTypeCache.current.get(modelID)!;
    }

    if (!ifcApi) return [];

    try {
      const relDefinesByTypeCode = ifcApi.GetTypeCodeFromName('IFCRELDEFINESBYTYPE');
      const relIds = await ifcApi.GetLineIDsWithType(modelID, relDefinesByTypeCode);
      const relationships: RelDefinesByType[] = [];

      for (let i = 0; i < relIds.size(); i++) {
        const relId = relIds.get(i);
        try {
          const rel = await ifcApi.GetLine(modelID, relId, false);
          const relatingTypeId = rel.RelatingType?.value || rel.RelatingType?.expressID || rel.RelatingType;
          const relatedObjects = rel.RelatedObjects;

          if (relatingTypeId && relatedObjects && Array.isArray(relatedObjects)) {
            const relatedInstanceIds = relatedObjects
              .map((obj: any) => obj?.value || obj?.expressID || obj)
              .filter((id: any) => typeof id === 'number');

            if (relatedInstanceIds.length > 0) {
              relationships.push({
                relId,
                relatingTypeId,
                relatedInstanceIds,
              });
            }
          }
        } catch (error) {
          console.warn(`Error processing RelDefinesByType ${relId}:`, error);
        }
      }

      relDefinesByTypeCache.current.set(modelID, relationships);
      return relationships;
    } catch (error) {
      console.error(`Error building RelDefinesByType for model ${modelID}:`, error);
      return [];
    }
  }, [ifcApi]);

  // Build class index for a model
  const buildClassIndex = useCallback(async (modelID: number): Promise<ClassIndex> => {
    if (!ifcApi) return new Map();

    const classIndex: ClassIndex = new Map();
    const relDefinesByType = await buildRelDefinesByType(modelID);

    // Create a map of instance ID to type ID
    const instanceToTypeMap = new Map<number, number>();
    for (const rel of relDefinesByType) {
      for (const instanceId of rel.relatedInstanceIds) {
        instanceToTypeMap.set(instanceId, rel.relatingTypeId);
      }
    }

    try {
      // Get all entity types in the model
      const allTypes = ifcApi.GetIfcEntityList(modelID);

      for (const typeCode of allTypes) {
        const typeName = ifcApi.GetNameFromTypeCode(typeCode);
        if (!typeName || typeName.startsWith('IFC_') || typeName === 'IFCROOT') continue;

        try {
          const instanceIds = await ifcApi.GetLineIDsWithType(modelID, typeCode);
          if (instanceIds.size() === 0) continue;

          const instances: SelectedElementInfo[] = [];
          for (let i = 0; i < instanceIds.size(); i++) {
            instances.push({ modelID, expressID: instanceIds.get(i) });
          }

          // Group instances by type
          const typeGroups = new Map<TypeGroup['typeId'], TypeGroup>();
          const undefinedInstances: SelectedElementInfo[] = [];

          for (const instance of instances) {
            const typeId = instanceToTypeMap.get(instance.expressID);
            if (typeId) {
              if (!typeGroups.has(typeId)) {
                // Fetch type data
                try {
                  const typeData = await ifcApi.GetLine(modelID, typeId, false);
                  const typeName = typeData.Name?.value || typeData.ObjectType?.value || `Type ${typeId}`;
                  typeGroups.set(typeId, {
                    typeId,
                    typeName,
                    typeData,
                    instances: [],
                  });
                } catch (error) {
                  console.warn(`Error fetching type data for ${typeId}:`, error);
                  typeGroups.set(typeId, {
                    typeId,
                    typeName: `Type ${typeId}`,
                    instances: [],
                  });
                }
              }
              typeGroups.get(typeId)!.instances.push(instance);
            } else {
              undefinedInstances.push(instance);
            }
          }

          // Add undefined group if there are instances without types
          if (undefinedInstances.length > 0) {
            typeGroups.set('UNDEFINED', {
              typeId: 'UNDEFINED',
              typeName: t('modelViewer.types.noTypeGroup', { defaultValue: '(No Type)' }),
              instances: undefinedInstances,
            });
          }

          if (typeGroups.size > 0) {
            classIndex.set(typeName, {
              totalCount: instances.length,
              typeGroups,
            });
          }
        } catch (error) {
          console.warn(`Error processing class ${typeName}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error building class index for model ${modelID}:`, error);
    }

    return classIndex;
  }, [ifcApi, buildRelDefinesByType, t]);

  // Memoized class indexes per model
  const [classIndexes, setClassIndexes] = useState<Map<number, ClassIndex>>(new Map());

  // Build class indexes when models change
  useEffect(() => {
    const buildIndexes = async () => {
      const newIndexes = new Map<number, ClassIndex>();

      for (const model of loadedModels) {
        if (model.modelID !== null) {
          const index = await buildClassIndex(model.modelID);
          newIndexes.set(model.modelID, index);
        }
      }

      setClassIndexes(newIndexes);
    };

    if (loadedModels.length > 0 && ifcApi) {
      buildIndexes();
    }
  }, [loadedModels, ifcApi, buildClassIndex]);

  // Helper function to check if a class has actual types (not just UNDEFINED)
  const hasActualTypes = useCallback((classData: { totalCount: number; typeGroups: Map<TypeGroup['typeId'], TypeGroup> }) => {
    // If there's only one type group and it's UNDEFINED, then it has no actual types
    if (classData.typeGroups.size === 1 && classData.typeGroups.has('UNDEFINED')) {
      return false;
    }
    // If there are multiple type groups or the single group is not UNDEFINED, it has actual types
    return classData.typeGroups.size > 1 || !classData.typeGroups.has('UNDEFINED');
  }, []);

  // Filter classes based on search query and power user mode
  const filteredModels = useMemo(() => {
    const baseModels = loadedModels.map(model => {
      const classIndex = classIndexes.get(model.modelID!) || new Map();
      let filteredIndex: ClassIndex = new Map();
      const matchedKeys = new Set<string>();

      // Apply power user filtering first
      if (!showClassesWithoutTypes) {
        // Filter out classes that only have UNDEFINED type groups
        for (const [className, classData] of Array.from(classIndex.entries())) {
          if (hasActualTypes(classData)) {
            filteredIndex.set(className, classData);
          }
        }
      } else {
        filteredIndex = new Map(classIndex);
      }

      // Apply search filtering if there's a query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchFilteredIndex: ClassIndex = new Map();

        for (const [className, classData] of Array.from(filteredIndex.entries())) {
          const naturalResult = getNaturalIfcClassName(className, lang as "de" | "en");
          const naturalName = naturalResult?.name || '';

          if (
            className.toLowerCase().includes(query) ||
            naturalName.toLowerCase().includes(query)
          ) {
            searchFilteredIndex.set(className, classData);
            matchedKeys.add(`${model.modelID}-class-${className}`);
          }
        }
        filteredIndex = searchFilteredIndex;
      }

      return {
        model,
        classIndex: filteredIndex,
        matchedKeys,
      };
    });

    return baseModels;
  }, [loadedModels, classIndexes, searchQuery, getNaturalIfcClassName, lang, showClassesWithoutTypes, hasActualTypes]);

  // Find path to an instance in the types view
  const findPathToInstanceInTypes = useCallback((targetModelID: number, targetExpressID: number): string | null => {
    const classIndex = classIndexes.get(targetModelID);
    if (!classIndex) return null;

    // Search through all classes and type groups to find the target instance
    for (const [className, classData] of Array.from(classIndex.entries())) {
      for (const [typeId, typeGroup] of Array.from(classData.typeGroups.entries())) {
        const foundInstance = typeGroup.instances.find(
          (instance: SelectedElementInfo) => instance.modelID === targetModelID && instance.expressID === targetExpressID
        );

        if (foundInstance) {
          // Return the instance key for scrolling
          return `${targetModelID}-instance-${targetExpressID}`;
        }
      }
    }

    return null;
  }, [classIndexes]);

  // Expand path to show an instance in the types view
  const expandPathToInstance = useCallback((targetModelID: number, targetExpressID: number) => {
    const classIndex = classIndexes.get(targetModelID);
    if (!classIndex) return;

    // Search through all classes and type groups to find the target instance
    for (const [className, classData] of Array.from(classIndex.entries())) {
      for (const [typeId, typeGroup] of Array.from(classData.typeGroups.entries())) {
        const foundInstance = typeGroup.instances.find(
          (instance: SelectedElementInfo) => instance.modelID === targetModelID && instance.expressID === targetExpressID
        );

        if (foundInstance) {
          // Expand the class and type nodes to show the instance
          const classKey = `${targetModelID}-class-${className}`;
          const typeKey = `${targetModelID}-type-${typeId}`;

          // Add both keys to expanded nodes
          const newExpandedKeys = new Set(expandedNodeKeys);
          newExpandedKeys.add(classKey);
          newExpandedKeys.add(typeKey);

          // Update expanded keys if they changed
          if (newExpandedKeys.size !== expandedNodeKeys.size ||
            !Array.from(newExpandedKeys).every(key => expandedNodeKeys.has(key))) {
            // We need to call the toggleNodeExpansion for each key that's not already expanded
            if (!expandedNodeKeys.has(classKey)) {
              toggleNodeExpansion(classKey);
            }
            if (!expandedNodeKeys.has(typeKey)) {
              toggleNodeExpansion(typeKey);
            }
          }

          return;
        }
      }
    }
  }, [classIndexes, expandedNodeKeys, toggleNodeExpansion]);

  // Handle selection changes - expand path to selected element in types view
  useEffect(() => {
    // Check if this is a new selection
    const isActuallyNewSelection = isNewSelection(selectedElement, lastSelectedElement);

    // Update last selected element
    setLastSelectedElement(selectedElement);

    if (selectedElement && selectedElement.modelID !== null) {
      const targetModelID = selectedElement.modelID;
      const targetExpressID = selectedElement.expressID;

      // Find and expand path to the selected instance
      expandPathToInstance(targetModelID, targetExpressID);

      // Set scroll target only if it's a new selection and user isn't browsing
      const instanceKey = findPathToInstanceInTypes(targetModelID, targetExpressID);
      if (instanceKey && isActuallyNewSelection && !isUserBrowsingTree) {
        setSelectedNodeKeyForScroll(instanceKey);
        console.log(`Types view: Setting scroll target to: ${instanceKey}`);
      } else if (instanceKey) {
        console.log(`Types view: Skipping auto-scroll - user browsing: ${isUserBrowsingTree}, new selection: ${isActuallyNewSelection}`);
      }
    } else {
      setSelectedNodeKeyForScroll(null);
    }
  }, [selectedElement, expandPathToInstance, findPathToInstanceInTypes, setSelectedNodeKeyForScroll, isNewSelection, lastSelectedElement, setLastSelectedElement, isUserBrowsingTree]);

  // Render a class node
  const renderClassNode = (
    model: LoadedModelData,
    className: string,
    classData: { totalCount: number; typeGroups: Map<TypeGroup['typeId'], TypeGroup> }
  ) => {
    const classKey = `${model.modelID}-class-${className}`;
    const isExpanded = expandedNodeKeys.has(classKey);
    const naturalResult = getNaturalIfcClassName(className, lang as "de" | "en");
    const naturalName = naturalResult?.name || className;

    return (
      <div key={classKey}>
        <div
          className="flex items-center py-1.5 px-2 rounded-md hover:bg-accent group cursor-pointer"
          style={{ paddingLeft: '1rem' }}
          onClick={() => toggleNodeExpansion(classKey)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 mr-1"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
          <Cuboid className="w-4 h-4 mr-2 text-blue-500" />
          <span className="truncate flex-grow">{naturalName}</span>
          <Badge variant="secondary" className="ml-2">
            {classData.totalCount}
          </Badge>
        </div>

        {isExpanded && (
          <div>
            {Array.from(classData.typeGroups.values()).map(typeGroup =>
              renderTypeNode(model, typeGroup)
            )}
          </div>
        )}
      </div>
    );
  };

  // Render a type node
  const renderTypeNode = (model: LoadedModelData, typeGroup: TypeGroup) => {
    const typeKey = `${model.modelID}-type-${typeGroup.typeId}`;
    const isExpanded = expandedNodeKeys.has(typeKey);

    return (
      <div key={typeKey}>
        <div
          className="flex items-center py-1.5 px-2 rounded-md hover:bg-accent group cursor-pointer"
          style={{ paddingLeft: '2.5rem' }}
          onClick={() => toggleNodeExpansion(typeKey)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 mr-1"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
          <LayersIcon className="w-4 h-4 mr-2 text-green-500" />
          <span className="truncate flex-grow">{typeGroup.typeName}</span>
          <Badge variant="secondary" className="ml-2">
            {typeGroup.instances.length}
          </Badge>
        </div>

        {isExpanded && (
          <div>
            {typeGroup.instances.map(instance =>
              renderInstanceNode(model, instance)
            )}
          </div>
        )}
      </div>
    );
  };

  // Render an instance node
  const renderInstanceNode = (model: LoadedModelData, instance: SelectedElementInfo) => {
    const instanceKey = `${model.modelID}-instance-${instance.expressID}`;
    const isSelected = selectedElement?.modelID === instance.modelID &&
      selectedElement?.expressID === instance.expressID;
    const shouldScrollToThisNode = selectedNodeKeyForScroll === instanceKey;

    return (
      <div
        key={instanceKey}
        ref={shouldScrollToThisNode ? selectedNodeRef : null}
        className={cn(
          "flex items-center py-1.5 px-2 rounded-md hover:bg-accent group cursor-pointer",
          isSelected && "bg-accent text-accent-foreground font-semibold"
        )}
        style={{ paddingLeft: '4rem' }}
        onClick={() => selectElement(instance)}
      >
        <span className="w-6 h-6 mr-1"></span>
        <Cuboid className="w-4 h-4 mr-2 text-gray-500" />
        <span className="truncate flex-grow">
          {`Element ${instance.expressID}`}
        </span>
      </div>
    );
  };

  if (!ifcApi) {
    return (
      <div className="p-4 text-sm text-muted-foreground h-full flex items-center justify-center">
        {t('apiNotReady')}
      </div>
    );
  }

  if (loadedModels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-6">
          <div className="flex justify-center mb-4">
            <FileText className="h-8 w-8 text-foreground/30" />
          </div>
          <p className="text-base font-medium text-foreground/80 mb-2">
            {t("noModelsLoaded")}
          </p>
          <p className="text-sm text-foreground/60">
            {t("modelViewer.useLoadButton")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Power User Toggle Header */}
      <div className="px-2 py-1 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {t('modelViewer.types.powerUser', { defaultValue: 'Power User' })}
            </span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showClassesWithoutTypes}
                    onCheckedChange={setShowClassesWithoutTypes}
                    className="scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs">
                  {showClassesWithoutTypes
                    ? t('modelViewer.types.powerUserOn', { defaultValue: 'Showing all IFC classes including those without type definitions' })
                    : t('modelViewer.types.powerUserOff', { defaultValue: 'Hiding classes that only contain instances without type definitions' })
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex-1 p-0 space-y-0 overflow-y-auto text-xs">
        {filteredModels.map(({ model, classIndex }) => {
          if (!classIndex || classIndex.size === 0) {
            return (
              <div
                key={model.id}
                className="p-2 text-sm text-foreground/80 flex items-center gap-2"
              >
                <span className="animate-pulse block w-2 h-2 bg-foreground/40 rounded-full"></span>
                <span className="text-base font-medium">
                  {t('modelLoadingStructure', { name: model.name })}
                </span>
              </div>
            );
          }

          // Model root node
          return (
            <div key={model.id}>
              <div
                className="flex items-center py-1.5 px-2 rounded-md hover:bg-accent group cursor-default"
                style={{ paddingLeft: '0.25rem' }}
              >
                <FileText className="w-4 h-4 mr-2 text-sky-500" />
                <span className="truncate flex-grow font-medium">{model.name}</span>
                <Badge variant="outline" className="ml-2">
                  {Array.from(classIndex.values()).reduce((sum, data) => sum + data.totalCount, 0)}
                </Badge>
              </div>

              {Array.from(classIndex.entries()).map(([className, classData]) =>
                renderClassNode(model, className, classData)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SpatialTreePanel() {
  const {
    loadedModels,
    selectElement,
    selectedElement,
    ifcApi,
    removeIFCModel,
    getNaturalIfcClassName,
    hideElements,
    showElements,
  } = useIFCContext();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "de" ? "de" : "en";

  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('spatialTreeViewMode');
      return (saved as ViewMode) || 'spatial';
    }
    return 'spatial';
  });

  useEffect(() => {
    localStorage.setItem('spatialTreeViewMode', viewMode);
  }, [viewMode]);

  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [modelToRemove, setModelToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [expandedNodeKeys, setExpandedNodeKeys] = useState<Set<string>>(
    new Set(),
  );
  const selectedNodeRef = useRef<HTMLDivElement>(null);
  const [selectedNodeKeyForScroll, setSelectedNodeKeyForScroll] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Track user interaction to prevent auto-scroll during tree browsing
  const [isUserBrowsingTree, setIsUserBrowsingTree] = useState(false);
  const [lastSelectedElement, setLastSelectedElement] = useState<SelectedElementInfo | null>(null);
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current);
      }
    };
  }, []);

  const toggleNodeExpansion = useCallback((nodeKeyToToggle: string) => {
    // Mark that user is actively browsing the tree
    setIsUserBrowsingTree(true);

    // Clear any existing timeout
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }

    // Reset browsing state after 2 seconds of no interaction
    userInteractionTimeoutRef.current = setTimeout(() => {
      setIsUserBrowsingTree(false);
    }, 2000);

    setExpandedNodeKeys((prevKeys) => {
      const newKeys = new Set(prevKeys);
      if (newKeys.has(nodeKeyToToggle)) {
        newKeys.delete(nodeKeyToToggle);
      } else {
        newKeys.add(nodeKeyToToggle);
      }
      return newKeys;
    });
  }, []);

  // Check if this is a new selection (from 3D interaction) vs just a re-render
  const isNewSelection = useCallback((current: SelectedElementInfo | null, previous: SelectedElementInfo | null): boolean => {
    if (!current && !previous) return false;
    if (!current || !previous) return true;
    return current.modelID !== previous.modelID || current.expressID !== previous.expressID;
  }, []);

  const findPathToNodeRecursive = useCallback(
    (
      currentNode: SpatialStructureNode,
      targetExpressID: number,
      modelID: number,
      currentPathKeys: string[],
      currentStoreyKey: string | null,
    ): PathFindingResult | null => {
      const nodeKey = getNodeKey(currentNode, modelID);
      currentPathKeys.push(nodeKey);

      let newStoreyKey = currentStoreyKey;
      if (currentNode.type.includes("STOREY")) {
        newStoreyKey = nodeKey;
      }

      if (currentNode.expressID === targetExpressID) {
        console.log(`Found target node: expressID=${targetExpressID}, nodeKey=${nodeKey}, path:`, currentPathKeys);
        return {
          pathKeys: [...currentPathKeys],
          storeyKey: newStoreyKey,
          selectedNodeKey: nodeKey,
        };
      }

      if (currentNode.children) {
        for (const child of currentNode.children) {
          const result = findPathToNodeRecursive(
            child,
            targetExpressID,
            modelID,
            [...currentPathKeys],
            newStoreyKey,
          );
          if (result) {
            return result;
          }
        }
      }
      return null;
    },
    [],
  );

  const filterTree = useCallback(
    (
      node: SpatialStructureNode,
      query: string,
      modelId: number | null,
      keys: Set<string>,
    ): SpatialStructureNode | null => {
      const norm = query.toLowerCase();
      const naturalResult = getNaturalIfcClassName(node.type, lang);
      const natural =
        naturalResult && naturalResult.name
          ? naturalResult.name.toLowerCase()
          : "";
      const name = (node.Name || "").toLowerCase();
      const expressIdString = String(node.expressID);
      const matches =
        name.includes(norm) ||
        natural.includes(norm) ||
        node.type.toLowerCase().includes(norm) ||
        expressIdString.includes(norm);
      const filteredChildren: SpatialStructureNode[] = [];
      node.children?.forEach((child) => {
        const res = filterTree(child, query, modelId, keys);
        if (res) filteredChildren.push(res);
      });
      if (matches || filteredChildren.length > 0) {
        if (modelId !== null) {
          keys.add(getNodeKey(node, modelId));
        }
        return { ...node, children: filteredChildren };
      }
      return null;
    },
    [getNaturalIfcClassName, lang],
  );

  const filteredModels = useMemo(() => {
    if (!deferredSearchQuery.trim()) {
      return loadedModels.map((m) => ({
        ...m,
        filteredTree: m.spatialTree,
        matchedKeys: new Set<string>(),
      }));
    }
    return loadedModels.map((m) => {
      if (!m.spatialTree || m.modelID === null)
        return { ...m, filteredTree: null, matchedKeys: new Set<string>() };
      const keys = new Set<string>();
      const tree = filterTree(
        m.spatialTree,
        deferredSearchQuery,
        m.modelID,
        keys,
      );
      return { ...m, filteredTree: tree, matchedKeys: keys };
    });
  }, [loadedModels, deferredSearchQuery, filterTree]);

  useEffect(() => {
    // Only handle spatial tree selection when in spatial view mode
    if (viewMode !== 'spatial') return;

    // Check if this is a new selection
    const isActuallyNewSelection = isNewSelection(selectedElement, lastSelectedElement);

    // Update last selected element
    setLastSelectedElement(selectedElement);

    const newCalculatedKeys = new Set<string>();
    let newScrollKey: string | null = null;

    loadedModels.forEach((modelEntry) => {
      if (modelEntry.modelID !== null) {
        newCalculatedKeys.add(
          getNodeKey({} as SpatialStructureNode, modelEntry.modelID, true),
        );
      }
    });

    if (deferredSearchQuery.trim()) {
      // During search, expand matched keys but don't scroll to any specific element
      filteredModels.forEach((m) => {
        if (m.modelID !== null && m.filteredTree) {
          m.matchedKeys.forEach((k: string) => newCalculatedKeys.add(k));
        }
      });
      newScrollKey = null; // Don't scroll during search
    } else if (
      selectedElement &&
      selectedElement.modelID !== null &&
      loadedModels.length > 0
    ) {
      const targetModelID = selectedElement.modelID;
      const targetExpressID = selectedElement.expressID;
      const model = loadedModels.find((m) => m.modelID === targetModelID);

      if (model && model.spatialTree) {
        console.log(`Finding path to element: modelID=${targetModelID}, expressID=${targetExpressID}`);
        const pathResult = findPathToNodeRecursive(
          model.spatialTree,
          targetExpressID,
          targetModelID,
          [],
          null,
        );

        if (pathResult) {
          console.log(`Path found, expanding keys:`, pathResult.pathKeys);
          const exclusiveKeys = new Set<string>();
          loadedModels.forEach((m) => {
            if (m.modelID !== null) {
              exclusiveKeys.add(
                getNodeKey({} as SpatialStructureNode, m.modelID, true),
              );
            }
          });
          pathResult.pathKeys.forEach((key) => exclusiveKeys.add(key));
          if (pathResult.storeyKey) {
            exclusiveKeys.add(pathResult.storeyKey);
          }
          newCalculatedKeys.clear();
          exclusiveKeys.forEach((k) => newCalculatedKeys.add(k));

          // Only set scroll target if it's a new selection and user isn't browsing
          if (isActuallyNewSelection && !isUserBrowsingTree) {
            newScrollKey = pathResult.selectedNodeKey;
            console.log(`Setting scroll target to: ${newScrollKey}`);
          } else {
            console.log(`Skipping auto-scroll - user browsing: ${isUserBrowsingTree}, new selection: ${isActuallyNewSelection}`);
          }
        } else {
          console.log(`No path found for element: modelID=${targetModelID}, expressID=${targetExpressID}`);
        }
      }
    }

    setExpandedNodeKeys((currentExpandedKeys) => {
      if (
        newCalculatedKeys.size === currentExpandedKeys.size &&
        Array.from(newCalculatedKeys).every((key) =>
          currentExpandedKeys.has(key),
        )
      ) {
        return currentExpandedKeys;
      }
      return newCalculatedKeys;
    });

    setSelectedNodeKeyForScroll(newScrollKey);
  }, [
    selectedElement,
    loadedModels,
    findPathToNodeRecursive,
    filteredModels,
    deferredSearchQuery,
    viewMode,
    isNewSelection,
    lastSelectedElement,
    isUserBrowsingTree,
  ]);

  useEffect(() => {
    if (selectedNodeKeyForScroll) {
      console.log(`Attempting to scroll to node with key: ${selectedNodeKeyForScroll}`);

      const attemptScroll = (retryCount = 0) => {
        if (selectedNodeRef.current) {
          console.log(`Scrolling to element:`, selectedNodeRef.current);
          selectedNodeRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center", // This centers the element vertically
            inline: "nearest"
          });
        } else if (retryCount < 5) {
          console.log(`Ref not available, retrying scroll in 100ms (attempt ${retryCount + 1})`);
          setTimeout(() => attemptScroll(retryCount + 1), 100);
        } else {
          console.log(`Failed to scroll after 5 attempts for: ${selectedNodeKeyForScroll}`);
        }
      };

      // Initial delay to ensure DOM has been updated after expansion
      const scrollTimeout = setTimeout(() => attemptScroll(), 200);

      return () => clearTimeout(scrollTimeout);
    }
  }, [selectedNodeKeyForScroll, expandedNodeKeys]);

  const handleNodeSelection = (selection: SelectedElementInfo) => {
    console.log(
      `SpatialTree: Node selected - ModelID: ${selection.modelID}, ExpressID: ${selection.expressID}`,
    );
    selectElement(selection);
  };

  const handleAttemptRemoveModel = (modelId: string, modelName: string) => {
    setModelToRemove({ id: modelId, name: modelName });
    setIsConfirmRemoveOpen(true);
  };

  const confirmRemove = () => {
    if (modelToRemove) {
      removeIFCModel(modelToRemove.id);
    }
    setIsConfirmRemoveOpen(false);
    setModelToRemove(null);
  };

  if (!ifcApi) {
    return (
      <div className="p-4 text-sm text-muted-foreground h-full flex items-center justify-center">
        {t('apiNotReady')}
      </div>
    );
  }

  if (loadedModels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-6">
          <div className="flex justify-center mb-4">
            <FileText className="h-8 w-8 text-foreground/30" />
          </div>
          <p className="text-base font-medium text-foreground/80 mb-2">
            {t("noModelsLoaded")}
          </p>
          <p className="text-sm text-foreground/60">
            {t("modelViewer.useLoadButton")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* View Switcher Tabs */}
      <div className="p-2 border-b">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="spatial">{t('modelViewer.view.spatial', { defaultValue: 'Spatial' })}</TabsTrigger>
            <TabsTrigger value="types">{t('modelViewer.view.types', { defaultValue: 'Types' })}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search Input */}
      <div className="p-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={viewMode === 'spatial'
            ? t("modelViewer.searchTreePlaceholder")
            : t("modelViewer.searchTypesPlaceholder", { defaultValue: "Search types and instances..." })
          }
          className="mb-2"
        />
      </div>

      {/* Content Area */}
      {viewMode === 'spatial' ? (
        <div className="flex-1 p-0 space-y-0 overflow-y-auto text-xs">
          {filteredModels.map((modelEntry) => {
            if (!modelEntry.spatialTree && modelEntry.modelID === null) {
              return (
                <div
                  key={modelEntry.id}
                  className="p-2 text-sm text-foreground/80 flex items-center gap-2"
                >
                  <span className="animate-pulse block w-2 h-2 bg-foreground/40 rounded-full"></span>
                  <span className="text-base font-medium">
                    {t('modelInitializing', { name: modelEntry.name })}
                  </span>
                </div>
              );
            }
            if (!modelEntry.spatialTree && modelEntry.modelID !== null) {
              return (
                <div
                  key={modelEntry.id}
                  className="p-2 text-sm text-foreground/80 flex items-center gap-2"
                >
                  <span className="animate-pulse block w-2 h-2 bg-foreground/40 rounded-full"></span>
                  <span className="text-base font-medium">
                    {t('modelLoadingStructure', { name: modelEntry.name })}
                  </span>
                </div>
              );
            }
            const treeToRender = deferredSearchQuery.trim()
              ? modelEntry.filteredTree
              : modelEntry.spatialTree;
            if (treeToRender) {
              const modelRootNodeForTree: SpatialStructureNode = {
                expressID: -1,
                type: "MODEL_FILE",
                Name: modelEntry.name,
                children: [treeToRender],
              };
              const modelRootKey = getNodeKey(
                modelRootNodeForTree,
                modelEntry.modelID,
                true,
              );
              return (
                <TreeNode
                  key={modelRootKey}
                  node={modelRootNodeForTree}
                  level={0}
                  onSelectNode={handleNodeSelection}
                  selectedElementInfo={selectedElement}
                  isRootModelNode={true}
                  modelFileInfo={{
                    id: modelEntry.id,
                    name: modelEntry.name,
                    modelID: modelEntry.modelID,
                  }}
                  onAttemptRemoveModel={handleAttemptRemoveModel}
                  expandedNodeKeys={expandedNodeKeys}
                  toggleNodeExpansion={toggleNodeExpansion}
                  selectedNodeKeyForScroll={selectedNodeKeyForScroll}
                  selectedNodeActualRef={selectedNodeRef}
                  modelID={modelEntry.modelID}
                  t={t}
                  searchQuery={searchQuery}
                />
              );
            }
            return null;
          })}
        </div>
      ) : (
        <TypesTreePanel
          loadedModels={loadedModels}
          ifcApi={ifcApi}
          selectElement={selectElement}
          selectedElement={selectedElement}
          getNaturalIfcClassName={getNaturalIfcClassName}
          hideElements={hideElements}
          showElements={showElements}
          searchQuery={deferredSearchQuery}
          expandedNodeKeys={expandedNodeKeys}
          toggleNodeExpansion={toggleNodeExpansion}
          selectedNodeRef={selectedNodeRef}
          selectedNodeKeyForScroll={selectedNodeKeyForScroll}
          setSelectedNodeKeyForScroll={setSelectedNodeKeyForScroll}
          isUserBrowsingTree={isUserBrowsingTree}
          isNewSelection={isNewSelection}
          lastSelectedElement={lastSelectedElement}
          setLastSelectedElement={setLastSelectedElement}
          t={t}
          lang={lang}
        />
      )}

      {modelToRemove && (
        <Dialog
          open={isConfirmRemoveOpen}
          onOpenChange={setIsConfirmRemoveOpen}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <DialogTitle className="text-lg font-medium">
                  {t("models.confirmRemoval")}
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              <Trans
                t={t}
                i18nKey="models.confirmRemoveModel"
                values={{ name: modelToRemove.name }}
                components={{ name: <span className="font-semibold text-foreground" /> }}
              />
            </DialogDescription>
            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmRemoveOpen(false)}
                className="sm:w-auto w-full"
              >
                {t("buttons.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmRemove}
                className="sm:w-auto w-full"
              >
                {t("buttons.removeModel", { name: modelToRemove.name })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
