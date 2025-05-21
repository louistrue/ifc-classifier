"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useTranslation } from "react-i18next";

// Helper function to generate a unique key for a node
const getNodeKey = (
  node: SpatialStructureNode,
  modelID: number | null | undefined,
  isRootModel: boolean = false
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
}) => {
  const {
    getNaturalIfcClassName,
    toggleModelVisibility,
    hiddenModelIds,
    hideElements,
    showElements,
    userHiddenElements,
  } = useIFCContext();
  const memoizedChildren = useMemo(() => node.children || [], [node.children]);

  const currentModelIDForNode = isRootModelNode
    ? modelFileInfo.modelID
    : modelFileInfo?.modelID ?? null;
  const nodeKey = getNodeKey(node, currentModelIDForNode, isRootModelNode);
  const isExpanded = expandedNodeKeys.has(nodeKey);

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
    if (!node.type.includes("STOREY") || modelFileInfo.modelID === null) return false;
    return storeyDescendantIds.every((id) =>
      userHiddenElements.some(
        (el) => el.modelID === modelFileInfo.modelID && el.expressID === id
      )
    );
  }, [userHiddenElements, storeyDescendantIds, node.type, modelFileInfo.modelID]);

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
  const naturalNameResult = getNaturalIfcClassName(originalIfcType);
  const naturalIfcName = naturalNameResult?.name ?? "";
  const schemaUrl = naturalNameResult?.schemaUrl ?? "";

  const displayName = isRootModelNode
    ? modelFileInfo.name
    : node.Name || naturalIfcName || `ID: ${node.expressID}`;

  let tooltipPrimaryContent = isRootModelNode
    ? modelFileInfo.name
    : `${naturalIfcName}${node.Name ? ` - ${node.Name}` : ""}`;

  const isSelected =
    !isRootModelNode &&
    modelFileInfo.modelID !== null &&
    selectedElementInfo?.modelID === modelFileInfo.modelID &&
    selectedElementInfo?.expressID === node.expressID;

  return (
    <div
      className="text-sm"
      ref={nodeKey === selectedNodeKeyForScroll ? selectedNodeActualRef : null}
    >
      <div
        className={cn(
          "flex items-center py-1.5 px-2 rounded-md hover:bg-accent group",
          isSelected && "bg-accent text-accent-foreground font-semibold",
          isRootModelNode ? "cursor-default" : "cursor-pointer"
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
              className="flex flex-col gap-1"
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
                <a
                  href={schemaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1 mt-1 pt-1 border-t border-border/30"
                >
                  View Schema <ExternalLink className="w-3 h-3" />
                </a>
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
      {isExpanded && node.children && node.children.length > 0 && (
        <div className={cn(isRootModelNode ? "pl-0" : "pl-0")}>
          {node.children.map((childNode) => (
            <TreeNode
              key={getNodeKey(childNode, modelFileInfo.modelID)}
              node={childNode}
              level={level + 1}
              onSelectNode={onSelectNode}
              selectedElementInfo={selectedElementInfo}
              modelFileInfo={modelFileInfo}
              onAttemptRemoveModel={onAttemptRemoveModel}
              expandedNodeKeys={expandedNodeKeys}
              toggleNodeExpansion={toggleNodeExpansion}
              selectedNodeKeyForScroll={selectedNodeKeyForScroll}
              selectedNodeActualRef={selectedNodeActualRef}
              modelID={modelFileInfo.modelID}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function SpatialTreePanel() {
  const {
    loadedModels,
    selectElement,
    selectedElement,
    ifcApi,
    removeIFCModel,
    getNaturalIfcClassName,
  } = useIFCContext();
  const { t } = useTranslation();
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [modelToRemove, setModelToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [expandedNodeKeys, setExpandedNodeKeys] = useState<Set<string>>(
    new Set()
  );
  const selectedNodeRef = useRef<HTMLDivElement>(null);
  const [selectedNodeKeyForScroll, setSelectedNodeKeyForScroll] = useState<
    string | null
  >(null);

  const toggleNodeExpansion = useCallback((nodeKeyToToggle: string) => {
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

  const findPathToNodeRecursive = useCallback(
    (
      currentNode: SpatialStructureNode,
      targetExpressID: number,
      modelID: number,
      currentPathKeys: string[],
      currentStoreyKey: string | null
    ): PathFindingResult | null => {
      const nodeKey = getNodeKey(currentNode, modelID);
      currentPathKeys.push(nodeKey);

      let newStoreyKey = currentStoreyKey;
      if (currentNode.type.includes("STOREY")) {
        newStoreyKey = nodeKey;
      }

      if (currentNode.expressID === targetExpressID) {
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
            newStoreyKey
          );
          if (result) {
            return result;
          }
        }
      }
      return null;
    },
    []
  );

  useEffect(() => {
    const newCalculatedKeys = new Set<string>();
    let newScrollKey: string | null = null;

    // 1. Default: all model roots are candidates for expansion
    loadedModels.forEach((modelEntry) => {
      if (modelEntry.modelID !== null) {
        newCalculatedKeys.add(
          getNodeKey({} as SpatialStructureNode, modelEntry.modelID, true)
        );
      }
    });

    // 2. If an element is selected, refine expansion (exclusive focus)
    if (
      selectedElement &&
      selectedElement.modelID !== null &&
      loadedModels.length > 0
    ) {
      const targetModelID = selectedElement.modelID;
      const targetExpressID = selectedElement.expressID;
      const model = loadedModels.find((m) => m.modelID === targetModelID);

      if (model && model.spatialTree) {
        const pathResult = findPathToNodeRecursive(
          model.spatialTree,
          targetExpressID,
          targetModelID,
          [],
          null
        );

        if (pathResult) {
          // Exclusive expansion: Start with only model roots of *all* models,
          // then add selected path and its storey.
          const exclusiveKeys = new Set<string>();
          loadedModels.forEach((m) => {
            if (m.modelID !== null) {
              exclusiveKeys.add(
                getNodeKey({} as SpatialStructureNode, m.modelID, true)
              );
            }
          });
          pathResult.pathKeys.forEach((key) => exclusiveKeys.add(key));
          if (pathResult.storeyKey) {
            exclusiveKeys.add(pathResult.storeyKey);
          }
          // Replace newCalculatedKeys with this more specific set
          newCalculatedKeys.clear();
          exclusiveKeys.forEach((k) => newCalculatedKeys.add(k));
          newScrollKey = pathResult.selectedNodeKey;
        }
        // If pathResult is null, newCalculatedKeys still contains all model roots from step 1.
        // newScrollKey remains null.
      }
      // If model or spatialTree doesn't exist, newCalculatedKeys contains all model roots from step 1.
    }
    // If no element is selected, newCalculatedKeys just contains all model roots from step 1.

    setExpandedNodeKeys((currentExpandedKeys) => {
      if (
        newCalculatedKeys.size === currentExpandedKeys.size &&
        Array.from(newCalculatedKeys).every((key) =>
          currentExpandedKeys.has(key)
        )
      ) {
        return currentExpandedKeys;
      }
      return newCalculatedKeys;
    });

    setSelectedNodeKeyForScroll((currentScrollKey) => {
      if (currentScrollKey === newScrollKey) {
        return currentScrollKey;
      }
      return newScrollKey;
    });
  }, [selectedElement, loadedModels, findPathToNodeRecursive]);

  useEffect(() => {
    if (selectedNodeRef.current && selectedNodeKeyForScroll) {
      selectedNodeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedNodeKeyForScroll]);

  const handleNodeSelection = (selection: SelectedElementInfo) => {
    console.log(
      `SpatialTree: Node selected - ModelID: ${selection.modelID}, ExpressID: ${selection.expressID}`
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
        IFC API not yet initialized.
      </div>
    );
  }

  if (loadedModels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-6">
          <div className="flex justify-center mb-4">
            <FileText className="h-12 w-12 text-foreground/30" />
          </div>
          <p className="text-base font-medium text-foreground/80 mb-2">{t('noModelsLoaded')}</p>
          <p className="text-sm text-foreground/60">
            {t('modelViewer.useLoadButton')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-0 space-y-0 h-full overflow-y-auto text-xs">
        {loadedModels.map((modelEntry) => {
          if (!modelEntry.spatialTree && modelEntry.modelID === null) {
            return (
              <div key={modelEntry.id} className="p-2 text-sm text-foreground/80 flex items-center gap-2">
                <span className="animate-pulse block w-2 h-2 bg-foreground/40 rounded-full"></span>
                <span className="text-base font-medium">{modelEntry.name} - Initializing...</span>
              </div>
            );
          }
          if (!modelEntry.spatialTree && modelEntry.modelID !== null) {
            return (
              <div key={modelEntry.id} className="p-2 text-sm text-foreground/80 flex items-center gap-2">
                <span className="animate-pulse block w-2 h-2 bg-foreground/40 rounded-full"></span>
                <span className="text-base font-medium">{modelEntry.name} - Loading structure...</span>
              </div>
            );
          }
          if (modelEntry.spatialTree) {
            const modelRootNodeForTree: SpatialStructureNode = {
              expressID: -1,
              type: "MODEL_FILE",
              Name: modelEntry.name,
              children: [modelEntry.spatialTree],
            };
            const modelRootKey = getNodeKey(
              modelRootNodeForTree,
              modelEntry.modelID,
              true
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
              />
            );
          }
          return null;
        })}
      </div>

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
                  Confirm Removal
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to remove the model &quot;
              <span className="font-semibold text-foreground">
                {modelToRemove.name}
              </span>
              &quot; from the scene? This action cannot be undone.
            </DialogDescription>
            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmRemoveOpen(false)}
                className="sm:w-auto w-full"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmRemove}
                className="sm:w-auto w-full"
              >
                Remove Model
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
