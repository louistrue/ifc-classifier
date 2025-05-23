"use client";

import type React from "react";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  Fragment,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { IFCModel } from "@/components/ifc-model";
import { ClassificationPanel } from "@/components/classification-panel";
import { RulePanel } from "@/components/rule-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Layers,
  Filter,
  Settings,
  UploadCloud,
  PlusSquare,
  Maximize,
  Focus,
  GripVertical,
  GripHorizontal,
  ChevronsLeft,
  ChevronsRight,
  EyeOff,
  Construction,
  Undo2,
  Layers as LayersIcon,
} from "lucide-react";
import { ModelInfo } from "@/components/model-info";
import {
  useIFCContext,
  LoadedModelData,
  SelectedElementInfo,
  SpatialStructureNode,
} from "@/context/ifc-context";
import { IFCContextProvider } from "@/context/ifc-context";
import { IfcAPI, Properties } from "web-ifc";
import { SpatialTreePanel } from "@/components/spatial-tree-panel";
import { cn } from "@/lib/utils";
import * as THREE from "three";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  ImperativePanelHandle,
} from "react-resizable-panels";
import { useTranslation } from "react-i18next";
// import { EffectComposer, Outline } from "@react-three/postprocessing"; // Comment out post-processing imports

// Define the layer for outlines
const OUTLINE_SELECTION_LAYER = 10;

// Simple spinning box component for testing - keep enabled
function SpinningBox() {
  const meshRef = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="magenta" />{" "}
      {/* Different color for this test */}
    </mesh>
  );
}

// GlobalInteractionHandler - re-enable
function GlobalInteractionHandler() {
  const { scene, camera, gl, raycaster } = useThree();
  const { selectElement, selectedElement, loadedModels, userHiddenElements } =
    useIFCContext();

  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 5; // Pixels

  useEffect(() => {
    if (!gl.domElement || !selectElement) return;
    console.log("GlobalInteractionHandler: Attaching mouse event listeners.");

    const handleMouseDown = (event: MouseEvent) => {
      console.log(
        "GlobalInteractionHandler: Mouse down",
        event.clientX,
        event.clientY
      );
      mouseDownPos.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = (event: MouseEvent) => {
      console.log(
        "GlobalInteractionHandler: Mouse up",
        event.clientX,
        event.clientY
      );
      if (!mouseDownPos.current) {
        console.log(
          "GlobalInteractionHandler: Mouse up without mousedown recorded."
        );
        return;
      }

      const deltaX = Math.abs(event.clientX - mouseDownPos.current.x);
      const deltaY = Math.abs(event.clientY - mouseDownPos.current.y);
      mouseDownPos.current = null;

      if (deltaX < DRAG_THRESHOLD && deltaY < DRAG_THRESHOLD) {
        console.log(
          "GlobalInteractionHandler: Click detected (within drag threshold)."
        );
        const rect = gl.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        console.log(
          "GlobalInteractionHandler: Raycasting with mouse coords:",
          mouse.x,
          mouse.y
        );

        raycaster.setFromCamera(mouse, camera);

        const modelMeshGroups = scene.children.filter(
          (child) =>
            child.name.startsWith("IFCModelGroup_") &&
            child instanceof THREE.Group
        ) as THREE.Group[];

        if (modelMeshGroups.length === 0) {
          console.log(
            "GlobalInteractionHandler: No IFCModelGroup found in scene. Deselecting."
          );
          selectElement(null);
          return;
        }
        console.log(
          `GlobalInteractionHandler: Found ${modelMeshGroups.length} model groups for raycasting.`
        );

        const allIntersects = raycaster.intersectObjects(modelMeshGroups, true);

        // Filter out intersections with non-visible meshes
        const visibleIntersects = allIntersects.filter(
          (intersect) => intersect.object.visible
        );

        console.log(
          `GlobalInteractionHandler: Raycast allIntersects: ${allIntersects.length}, visibleIntersects: ${visibleIntersects.length}`
        );

        if (visibleIntersects.length > 0) {
          const firstIntersect = visibleIntersects[0].object;
          if (
            firstIntersect.userData &&
            firstIntersect.userData.expressID !== undefined &&
            firstIntersect.userData.modelID !== undefined
          ) {
            const clickedModelID = firstIntersect.userData.modelID;
            const clickedExpressID = firstIntersect.userData.expressID;
            const selectionInfo: SelectedElementInfo = {
              modelID: clickedModelID,
              expressID: clickedExpressID,
            };
            console.log(
              "GlobalInteractionHandler: Clicked on element:",
              selectionInfo
            );

            // Check if this element is user-hidden. If so, do not select it.
            // (Though it shouldn't be in visibleIntersects if mesh.visible was set correctly by IFCModel)
            // This is more of a double-check or alternative if direct mesh.visible check fails for some reason.
            // const isClickedElementUserHidden = userHiddenElements.some(
            //   (hiddenEl) => hiddenEl.modelID === clickedModelID && hiddenEl.expressID === clickedExpressID
            // );
            // if (isClickedElementUserHidden) {
            //   console.log("GlobalInteractionHandler: Clicked on a user-hidden element. Deselecting.");
            //   selectElement(null);
            //   return;
            // }

            if (
              selectedElement &&
              selectedElement.modelID === clickedModelID &&
              selectedElement.expressID === clickedExpressID
            ) {
              console.log(
                "GlobalInteractionHandler: Clicked on already selected element. Deselecting."
              );
              selectElement(null);
            } else {
              console.log(
                "GlobalInteractionHandler: Selecting new element:",
                selectionInfo
              );
              selectElement(selectionInfo);
            }
          } else {
            console.log(
              "GlobalInteractionHandler: Clicked on object without valid IFC user data. Deselecting."
            );
            selectElement(null);
          }
        } else {
          console.log(
            "GlobalInteractionHandler: Clicked on empty space. Deselecting."
          );
          selectElement(null);
        }
      } else {
        console.log(
          "GlobalInteractionHandler: Drag detected (exceeded drag threshold). No selection change."
        );
      }
    };

    const canvasElement = gl.domElement;
    canvasElement.addEventListener("mousedown", handleMouseDown);
    canvasElement.addEventListener("mouseup", handleMouseUp);
    console.log("GlobalInteractionHandler: Mouse event listeners attached.");

    return () => {
      console.log("GlobalInteractionHandler: Removing mouse event listeners.");
      canvasElement.removeEventListener("mousedown", handleMouseDown);
      canvasElement.removeEventListener("mouseup", handleMouseUp);
      mouseDownPos.current = null;
    };
  }, [
    gl,
    camera,
    raycaster,
    selectElement,
    selectedElement,
    scene,
    loadedModels,
    userHiddenElements,
    DRAG_THRESHOLD,
  ]);

  return null;
}

// New ViewToolbar Component
interface ViewToolbarProps {
  onZoomExtents: () => void;
  onZoomSelected: () => void;
  isElementSelected: boolean;
  onUnhideAll: () => void;
  onUnhideLast: () => void;
}

function ViewToolbar({
  onZoomExtents,
  onZoomSelected,
  isElementSelected,
  onUnhideAll,
  onUnhideLast,
}: ViewToolbarProps) {
  const {
    selectedElement,
    toggleUserHideElement,
    userHiddenElements,
  } = useIFCContext();

  const { t } = useTranslation();

  const handleHideSelected = () => {
    if (selectedElement) {
      toggleUserHideElement(selectedElement);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-auto">
      <div className="flex items-center gap-2 p-2 bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomExtents}
          title={t('modelViewer.fitToView')}
        >
          <Maximize className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomSelected}
          disabled={!isElementSelected}
          title={t('modelViewer.zoomToSelected')}
        >
          <Focus className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleHideSelected}
          disabled={!selectedElement}
          title={
            selectedElement
              ? t('modelViewer.toggleVisibility')
              : t('modelViewer.selectElementToToggle')
          }
        >
          <EyeOff className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onUnhideLast}
          disabled={userHiddenElements.length === 0}
          title={t('modelViewer.unhideLast')}
        >
          <Undo2 className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onUnhideAll}
          disabled={userHiddenElements.length === 0}
          title={t('modelViewer.unhideAll')}
        >
          <LayersIcon className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

// Define the interface for the actions exposed by CameraActionsController
export interface CameraActions {
  zoomToExtents: () => void;
  zoomToSelected: (selection: SelectedElementInfo | null) => void;
}

// Simple component to capture the scene for external reference
const SceneCapture = ({ onSceneCapture }: { onSceneCapture: (scene: THREE.Scene) => void }) => {
  const { scene } = useThree();

  useEffect(() => {
    console.log("SceneCapture: Capturing scene");
    onSceneCapture(scene);
  }, [scene, onSceneCapture]);

  return null;
};

// Update OrbitControls target to the selected element's center without moving the camera
const OrbitTargetController = () => {
  const { scene, controls } = useThree();
  const { selectedElement } = useIFCContext();

  useEffect(() => {
    if (!controls) return;

    if (selectedElement) {
      let selectedMesh: THREE.Object3D | null = null;
      scene.traverse((obj) => {
        if (selectedMesh) return;
        if (
          obj instanceof THREE.Mesh &&
          obj.userData.modelID === selectedElement.modelID &&
          obj.userData.expressID === selectedElement.expressID
        ) {
          selectedMesh = obj;
        }
      });

      if (selectedMesh) {
        const bbox = new THREE.Box3().setFromObject(selectedMesh);
        const center = bbox.getCenter(new THREE.Vector3());
        (controls as any).target.copy(center);
        (controls as any).update();
      }
    } else {
      const modelGroups = scene.children.filter(
        (child) =>
          child.name.startsWith("IFCModelGroup_") && child instanceof THREE.Group
      ) as THREE.Group[];

      if (modelGroups.length > 0) {
        const overallBbox = new THREE.Box3();
        modelGroups.forEach((group, idx) => {
          idx === 0 ? overallBbox.setFromObject(group) : overallBbox.expandByObject(group);
        });
        if (!overallBbox.isEmpty()) {
          const center = overallBbox.getCenter(new THREE.Vector3());
          (controls as any).target.copy(center);
          (controls as any).update();
        }
      }
    }
  }, [selectedElement, scene, controls]);

  return null;
};

// CameraActionsController Component (child of Canvas)
const CameraActionsController = forwardRef<CameraActions, {}>((props, ref) => {
  const { scene, camera, controls, clock } = useThree();

  const animationRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
  } | null>(null);

  const startAnimation = (
    endPos: THREE.Vector3,
    endTarget: THREE.Vector3,
    duration = 0.75 // seconds
  ) => {
    if (!controls || !camera) return;
    animationRef.current = {
      active: true,
      startTime: clock.getElapsedTime(),
      duration,
      startPos: camera.position.clone(),
      endPos,
      startTarget: (controls as any).target.clone(),
      endTarget,
    };
  };

  useFrame(() => {
    if (!animationRef.current?.active || !controls || !camera) {
      return;
    }

    const anim = animationRef.current;
    const elapsedTime = clock.getElapsedTime() - anim.startTime;
    let progress = Math.min(elapsedTime / anim.duration, 1);

    // Ease-out cubic easing function: t => 1 - pow(1 - t, 3)
    progress = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(anim.startPos, anim.endPos, progress);
    (controls as any).target.lerpVectors(
      anim.startTarget,
      anim.endTarget,
      progress
    );
    camera.lookAt((controls as any).target); // Keep camera looking at the interpolated target
    (controls as any).update();

    if (progress >= 1) {
      animationRef.current.active = false;
      // Ensure final state is set precisely
      camera.position.copy(anim.endPos);
      (controls as any).target.copy(anim.endTarget);
      camera.lookAt((controls as any).target);
      (controls as any).update();
    }
  });

  useImperativeHandle(ref, () => ({
    zoomToExtents: () => {
      console.log(
        "CameraActionsController: zoomToExtents called for animation"
      );
      const modelGroups = scene.children.filter(
        (child) =>
          child.name.startsWith("IFCModelGroup_") &&
          child instanceof THREE.Group
      ) as THREE.Group[];

      if (modelGroups.length === 0) return;

      const overallBbox = new THREE.Box3();
      modelGroups.forEach((group, index) => {
        index === 0
          ? overallBbox.setFromObject(group)
          : overallBbox.expandByObject(group);
      });

      if (overallBbox.isEmpty()) {
        if (controls as any) (controls as any).reset?.();
        return;
      }

      const center = overallBbox.getCenter(new THREE.Vector3());
      const sphere = overallBbox.getBoundingSphere(new THREE.Sphere());
      const radius = sphere.radius;

      if (camera instanceof THREE.PerspectiveCamera) {
        const pCamera = camera as THREE.PerspectiveCamera;
        const fov = pCamera.fov * (Math.PI / 180);
        const aspect = pCamera.aspect;

        // Calculate distance to fit the bounding sphere
        let distance = radius / Math.sin(fov / 2); // Basic distance to fit sphere based on vertical FOV

        // Adjust if aspect ratio makes horizontal fit tighter
        const effectiveRadiusForHorizontalFit =
          radius / Math.sin(Math.atan(Math.tan(fov / 2) * aspect));
        distance = Math.max(distance, effectiveRadiusForHorizontalFit);

        distance *= 1.1; // Add a small padding (10% zoom out)
        if (distance === 0 || !isFinite(distance) || distance < 0.1)
          distance = 10; // Fallback for tiny/flat models

        // New camera position: directly back from the center along the current camera Z-axis (if possible)
        // or a default front/above if current view is awkward.
        const currentCamDir = new THREE.Vector3();
        pCamera.getWorldDirection(currentCamDir);

        let newCamPos: THREE.Vector3;
        // If looking nearly straight down/up or from very side, use a default front-iso angle
        if (
          Math.abs(currentCamDir.y) > 0.9 ||
          Math.abs(currentCamDir.dot(new THREE.Vector3(0, 0, 1))) < 0.1
        ) {
          newCamPos = new THREE.Vector3(
            center.x + distance * 0.707,
            center.y + distance * 0.707,
            center.z + distance * 0.707
          );
        } else {
          newCamPos = center
            .clone()
            .add(currentCamDir.multiplyScalar(-distance));
        }

        startAnimation(newCamPos, center.clone());
        console.log(
          "CameraActionsController: Zoom to extents (fit sphere) animation started."
        );
      } else {
        console.warn(
          "CameraActionsController: Camera is not PerspectiveCamera for zoomToExtents."
        );
      }
    },
    zoomToSelected: (selection: SelectedElementInfo | null) => {
      console.log(
        "CameraActionsController: zoomToSelected called with",
        selection
      );
      if (!selection || !(camera instanceof THREE.PerspectiveCamera)) return;

      let selectedMesh: THREE.Mesh | null = null;
      scene.traverse((object) => {
        if (selectedMesh) return;
        if (
          object instanceof THREE.Mesh &&
          object.userData.modelID === selection.modelID &&
          object.userData.expressID === selection.expressID
        ) {
          selectedMesh = object;
        }
      });

      if (!selectedMesh) return;

      const bbox = new THREE.Box3().setFromObject(selectedMesh);
      const center = bbox.getCenter(new THREE.Vector3());
      const sphere = bbox.getBoundingSphere(new THREE.Sphere());
      const radius = sphere.radius;

      const pCamera = camera as THREE.PerspectiveCamera;
      const fov = pCamera.fov * (Math.PI / 180);
      const aspect = pCamera.aspect;

      let distance = radius / Math.sin(fov / 2);
      const effectiveRadiusForHorizontalFit =
        radius / Math.sin(Math.atan(Math.tan(fov / 2) * aspect));
      distance = Math.max(distance, effectiveRadiusForHorizontalFit);

      distance *= 1.5; // Add a bit more padding for single selected objects
      if (distance === 0 || !isFinite(distance) || distance < 0.1) distance = 5; // Fallback
      if (distance < pCamera.near * 2) distance = pCamera.near * 2 + radius; // Ensure it's not too close to near plane

      const currentCamDir = new THREE.Vector3();
      pCamera.getWorldDirection(currentCamDir);
      const newCamPos = center
        .clone()
        .add(currentCamDir.multiplyScalar(-distance));

      startAnimation(newCamPos, center.clone());
      console.log(
        "CameraActionsController: Zoom to selected (fit sphere) animation started."
      );
    },
  }));

  return null;
});
CameraActionsController.displayName = "CameraActionsController";

// Responsive Tabs Component
function ResponsiveTabs({ onSettingsChanged }: { onSettingsChanged: () => void }) {
  const { t } = useTranslation();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [displayMode, setDisplayMode] = useState<'full' | 'textOnly' | 'iconOnly'>('full');

  const updateDisplayMode = useCallback((width: number) => {
    // Thresholds for responsive behavior - more aggressive switching
    if (width < 200) {
      setDisplayMode('iconOnly');
    } else if (width < 300) {
      setDisplayMode('textOnly');
    } else {
      setDisplayMode('full');
    }
  }, []);

  useLayoutEffect(() => {
    const tabsElement = tabsRef.current;
    if (!tabsElement) return;

    // Get initial measurement immediately
    const initialWidth = tabsElement.getBoundingClientRect().width;
    if (initialWidth > 0) {
      updateDisplayMode(initialWidth);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        updateDisplayMode(width);
      }
    });

    resizeObserver.observe(tabsElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateDisplayMode]);

  return (
    <Tabs
      defaultValue="classifications"
      className="flex flex-col h-full shadow-lg bg-gradient-to-l from-[hsl(var(--card))] to-transparent"
      ref={tabsRef}
    >
      <TabsList className="w-full shrink-0 border-b border-border/50 p-1 bg-[hsl(var(--background))/85] backdrop-blur-sm">
        <TabsTrigger
          value="classifications"
          className="flex-1 text-sm py-1.5 px-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-sm flex items-center justify-center"
          title={displayMode === 'iconOnly' ? t('navigation.classificationsTab') : undefined}
        >
          {displayMode !== 'textOnly' && (
            <Layers className={`w-4 h-4 ${displayMode === 'full' ? 'mr-1.5' : ''}`} />
          )}
          {displayMode !== 'iconOnly' && (
            <span className={displayMode === 'textOnly' ? 'truncate' : ''}>
              {t('navigation.classificationsTab')}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="rules"
          className="flex-1 text-sm py-1.5 px-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-sm flex items-center justify-center"
          title={displayMode === 'iconOnly' ? t('rulesPanel') : undefined}
        >
          {displayMode !== 'textOnly' && (
            <Filter className={`w-4 h-4 ${displayMode === 'full' ? 'mr-1.5' : ''}`} />
          )}
          {displayMode !== 'iconOnly' && (
            <span className={displayMode === 'textOnly' ? 'truncate' : ''}>
              {t('rulesPanel')}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          className="flex-1 text-sm py-1.5 px-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-sm flex items-center justify-center"
          title={displayMode === 'iconOnly' ? t('settingsPanel') : undefined}
        >
          {displayMode !== 'textOnly' && (
            <Settings className={`w-4 h-4 ${displayMode === 'full' ? 'mr-1.5' : ''}`} />
          )}
          {displayMode !== 'iconOnly' && (
            <span className={displayMode === 'textOnly' ? 'truncate' : ''}>
              {t('settingsPanel')}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="classifications"
        className="p-2 flex-grow overflow-y-auto"
      >
        <ClassificationPanel />
      </TabsContent>
      <TabsContent
        value="rules"
        className="p-4 flex-grow overflow-y-auto"
      >
        <RulePanel />
      </TabsContent>
      <TabsContent
        value="settings"
        className="p-4 flex-grow overflow-y-auto"
      >
        <SettingsPanel onSettingsChanged={onSettingsChanged} />
      </TabsContent>
    </Tabs>
  );
}

// Custom resize handle component that looks like an elegant grabber
const ResizeHandleHorizontal = ({
  className,
  collapsed = false,
  onToggle,
  isLeftSide = false,
}: {
  className?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  isLeftSide?: boolean;
}) => (
  <PanelResizeHandle
    className={cn(
      "w-2 flex items-center justify-center group transition-colors hover:bg-muted/80 active:bg-muted rounded cursor-col-resize",
      className
    )}
  >
    <div className="relative h-full w-full flex items-center justify-center">
      {/* Resize handle line */}
      <div className="w-0.5 h-8 bg-border group-hover:bg-muted-foreground/60 group-active:bg-muted-foreground/80 rounded-full transition-colors" />

      {/* Toggle button for collapsing/expanding (if provided) */}
      {onToggle && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 flex items-center justify-center",
            "w-8 h-10 rounded-md cursor-pointer group/button",
            "hover:bg-muted/50 active:bg-muted/70",
            // Switch button side based on collapsed state to ensure visibility
            isLeftSide
              ? collapsed
                ? "left-full" // If left panel is collapsed, button is to the RIGHT of handle
                : "right-full" // If left panel is expanded, button is to the LEFT of handle
              : collapsed
                ? "right-full" // If right panel is collapsed, button is to the LEFT of handle
                : "left-full" // If right panel is expanded, button is to the RIGHT of handle
          )}
          title={collapsed ? "Expand panel" : "Collapse panel"}
        >
          <button
            className={cn(
              "rounded-full w-6 h-6 flex items-center justify-center",
              "bg-background border border-border shadow-sm group-hover/button:bg-muted group-hover/button:ring-2 group-hover/button:ring-ring transition-all",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            )}
          >
            {isLeftSide ? (
              collapsed ? (
                <ChevronsRight className="w-3 h-3" />
              ) : (
                <ChevronsLeft className="w-3 h-3" />
              )
            ) : collapsed ? (
              <ChevronsLeft className="w-3 h-3" />
            ) : (
              <ChevronsRight className="w-3 h-3" />
            )}
          </button>
        </div>
      )}
    </div>
  </PanelResizeHandle>
);

// Vertical resize handle
const ResizeHandleVertical = ({ className }: { className?: string }) => (
  <PanelResizeHandle
    className={cn(
      "h-2 flex items-center justify-center group transition-colors hover:bg-muted/80 active:bg-muted rounded cursor-row-resize",
      className
    )}
  >
    <div className="h-0.5 w-8 bg-border group-hover:bg-muted-foreground/60 group-active:bg-muted-foreground/80 rounded-full transition-colors" />
  </PanelResizeHandle>
);

function ViewerContent() {
  const {
    loadedModels,
    setIfcApi,
    ifcApi,
    selectedElement,
    selectElement,
    toggleUserHideElement,
    unhideLastElement,
    unhideAllElements,
    hideElements,
    showElements,
    userHiddenElements,
    getElementPropertiesCached,
    addIFCModel,
  } = useIFCContext();
  const { t } = useTranslation();
  const [ifcEngineReady, setIfcEngineReady] = useState(false);
  const [webGLContextLost, setWebGLContextLost] = useState(false);
  const [canvasSearch, setCanvasSearch] = useState("");
  const [confirmedSearch, setConfirmedSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ active: false, percent: 0, status: '' });
  const [isSearchRunning, setIsSearchRunning] = useState(false);
  const searchHiddenRef = useRef<SelectedElementInfo[]>([]);
  const scene = useRef<THREE.Scene | null>(null);

  const gatherAllElements = useCallback((root: SpatialStructureNode | null) => {
    const items: SpatialStructureNode[] = [];
    if (!root) return items;
    const stack = [root];
    while (stack.length) {
      const node = stack.pop()!;
      items.push(node);
      if (node.children) stack.push(...node.children);
    }
    return items;
  }, []);

  // Capture scene from Canvas for use in filtering
  const captureScene = useCallback((threeScene: THREE.Scene) => {
    scene.current = threeScene;
  }, []);

  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  const cameraActionsRef = useRef<CameraActions>(null);

  const SKIP_IFC_INITIALIZATION_FOR_TEST = false;

  // State to trigger re-render of FileUpload when settings change
  const [settingsVersion, setSettingsVersion] = useState(0);
  const handleSettingsChanged = useCallback(() => {
    setSettingsVersion(v => v + 1);
  }, []);

  const handleZoomExtents = useCallback(() => {
    console.log("ViewerContent: handleZoomExtents called");
    cameraActionsRef.current?.zoomToExtents();
  }, []);

  const handleZoomSelected = useCallback(() => {
    console.log("ViewerContent: handleZoomSelected called");
    cameraActionsRef.current?.zoomToSelected(selectedElement);
  }, [selectedElement]);

  const toggleLeftPanel = () => {
    if (leftPanelRef.current) {
      if (leftPanelRef.current.getSize() > 0) {
        leftPanelRef.current.collapse();
      } else {
        leftPanelRef.current.expand();
      }
    }
  };

  const toggleRightPanel = () => {
    if (rightPanelRef.current) {
      if (rightPanelRef.current.getSize() > 0) {
        rightPanelRef.current.collapse();
      } else {
        rightPanelRef.current.expand();
      }
    }
  };

  // Use state to track panel collapsed status for proper icon rendering
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Reset search progress when search is cleared
  useEffect(() => {
    if (!confirmedSearch) {
      setSearchProgress({ active: false, percent: 0, status: '' });
      setIsSearchRunning(false);
    }
  }, [confirmedSearch]);

  // Handle search submission
  const handleSearchSubmit = useCallback((searchTerm: string) => {
    console.log("Search submitted:", searchTerm);
    setConfirmedSearch(searchTerm);
    // Only trigger search if there's an actual query
    if (searchTerm.trim()) {
      setIsSearchRunning(true);
    }
  }, []);

  // Cancel search
  const handleCancelSearch = useCallback(() => {
    setIsSearchRunning(false);
    setSearchProgress({ active: false, percent: 0, status: 'Search cancelled' });
    // Clear the progress indicator after a short delay
    setTimeout(() => {
      setSearchProgress({ active: false, percent: 0, status: '' });
    }, 1500);
  }, []);

  // DEBUG: Log userHiddenElements when it changes
  useEffect(() => {
    console.log("userHiddenElements changed:", userHiddenElements.length, userHiddenElements.slice(0, 5));
  }, [userHiddenElements]);

  // Apply search filtering on 3D elements - now depends on isSearchRunning instead of confirmedSearch
  useEffect(() => {
    if (!ifcApi || !isSearchRunning) return;

    let cancelled = false;

    const toRegex = (q: string) => {
      const pattern = q.replace(/\*/g, ".*");
      try {
        return new RegExp(pattern, "i");
      } catch {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(escaped, "i");
      }
    };

    // Helper function to recursively search for regex matches in an object/array
    const recursiveSearch = (data: any, regexInstance: RegExp, searchKeys: boolean = false): boolean => {
      if (data === null || data === undefined) return false;

      // Test stringified value for primitive types
      if (typeof data === 'string') return regexInstance.test(data.toLowerCase());
      if (typeof data === 'number' || typeof data === 'boolean') return regexInstance.test(String(data).toLowerCase());

      if (Array.isArray(data)) {
        for (const item of data) {
          if (recursiveSearch(item, regexInstance, searchKeys)) return true;
        }
        return false;
      }

      if (typeof data === 'object') {
        // Handle IFC.js specific structures like { value: X } or { NominalValue: { value: Y } } etc.
        if (data.hasOwnProperty('value')) {
          if (recursiveSearch(data.value, regexInstance, false)) return true;
        }
        if (data.hasOwnProperty('NominalValue')) {
          if (recursiveSearch(data.NominalValue, regexInstance, false)) return true;
        }
        if (data.hasOwnProperty('wrappedValue')) {
          if (recursiveSearch(data.wrappedValue, regexInstance, false)) return true;
        }

        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (searchKeys && regexInstance.test(key.toLowerCase())) return true;
            if (recursiveSearch(data[key], regexInstance, searchKeys)) return true;
          }
        }
        return false;
      }
      return false;
    };

    const applyFilter = async () => {
      // unhide previous search-hidden elements
      if (searchHiddenRef.current.length > 0) {
        console.log("Showing previously hidden elements:", searchHiddenRef.current.length);
        showElements(searchHiddenRef.current);
        searchHiddenRef.current = [];
      }

      const query = confirmedSearch.trim();
      console.log("Applying filter with query:", query); // Log query
      if (!query) {
        // If query is cleared, ensure all meshes that might have been directly hidden by previous search iteration are visible
        // (unless they are in userHiddenElements for other reasons)
        // The showElements(searchHiddenRef.current) above handles elements previously hidden *by search*.
        // No further action needed here if query is empty, as userHiddenElements is the source of truth.
        setSearchProgress({ active: false, percent: 0, status: '' });
        setIsSearchRunning(false);
        return;
      }

      // Set search in progress
      setSearchProgress({ active: true, percent: 0, status: 'Preparing search...' });

      const regex = toRegex(query);
      console.log("Search regex:", regex.source);
      const toHide: SelectedElementInfo[] = [];

      // Log loaded models info
      console.log("Loaded models:", loadedModels.length, loadedModels.map(m => ({
        id: m.id,
        name: m.name,
        modelID: m.modelID,
        hasSpatialTree: !!m.spatialTree
      })));

      // Collect all meshes to check if spatial tree nodes have corresponding meshes
      const availableMeshIds: Record<number, Set<number>> = {};
      const allMeshes: Record<number, Record<number, THREE.Mesh>> = {};

      // Scan scene for meshes
      scene.current?.traverse((object) => {
        if (object instanceof THREE.Mesh &&
          object.userData &&
          object.userData.expressID !== undefined &&
          object.userData.modelID !== undefined) {
          const modelID = object.userData.modelID;
          const expressID = object.userData.expressID;

          if (!availableMeshIds[modelID]) {
            availableMeshIds[modelID] = new Set();
            allMeshes[modelID] = {};
          }
          availableMeshIds[modelID].add(expressID);
          allMeshes[modelID][expressID] = object;
        }
      });

      if (Object.keys(availableMeshIds).length === 0) {
        console.log("WARNING: No meshes found in the scene with IFC data!");
      } else {
        console.log("Available mesh expressIDs by model:", Object.entries(availableMeshIds).map(
          ([modelID, ids]) => `Model ${modelID}: ${ids.size} meshes`
        ));
      }

      for (const model of loadedModels) {
        if (model.modelID === null || model.modelID === undefined || !model.spatialTree) {
          console.log(`Model ${model.id} (${model.name}) skipped - modelID: ${model.modelID}, hasSpatialTree: ${!!model.spatialTree}`);
          continue;
        }

        // Log spatial tree root information
        console.log(`Spatial tree root for model ${model.id}:`, {
          rootExpressID: model.spatialTree.expressID,
          rootType: model.spatialTree.type,
          rootName: model.spatialTree.Name,
          childrenCount: model.spatialTree.children?.length || 0
        });

        const nodes = gatherAllElements(model.spatialTree);
        console.log(`Model ${model.id} (${model.name}): Processing ${nodes.length} nodes for filtering.`);

        // Check how many nodes in spatial tree have actual meshes
        const modelMeshes = availableMeshIds[model.modelID] || new Set();
        const nodesWithMeshes = nodes.filter(node =>
          node.expressID !== undefined && modelMeshes.has(node.expressID)
        );

        console.log(`Model ${model.id}: ${nodes.length} tree nodes, ${nodesWithMeshes.length} have corresponding meshes`);

        // Sample logging some actual node data
        if (nodes.length > 0) {
          console.log(`Sample node data (first node):`, {
            expressID: nodes[0].expressID,
            type: nodes[0].type,
            name: nodes[0].Name,
            hasMesh: nodes[0].expressID !== undefined && modelMeshes.has(nodes[0].expressID)
          });
        }

        let matchCount = 0;
        let noMatchCount = 0;
        const processedExpressIDsFromSpatialTree = new Set<number>();
        let errorCount = 0;

        // Helper function to process a node with property fetching
        const processNode = async (node: any): Promise<{ match: boolean; expressID: number }> => {
          // Skip nodes without a valid expressID or if the model is invalid
          if (typeof node.expressID !== 'number' || isNaN(node.expressID) || model.modelID === null || model.modelID === undefined) {
            return { match: false, expressID: -1 };
          }

          const expressID = node.expressID;
          processedExpressIDsFromSpatialTree.add(expressID);

          let match = false;
          // 1. Quick check on node's direct, readily available properties
          if (node.Name && node.Name.value && typeof node.Name.value === 'string' && regex.test(node.Name.value.toLowerCase())) {
            match = true;
          } else if (node.type && regex.test(node.type.toLowerCase())) { // node.type is string
            match = true;
          } else if (node.GlobalId && node.GlobalId.value && typeof node.GlobalId.value === 'string' && regex.test(node.GlobalId.value.toLowerCase())) {
            match = true;
          }

          // 2. If no quick match, fetch all properties and do a recursive search
          if (!match) {
            try {
              const props = await getElementPropertiesCached(model.modelID as number, expressID);
              if (props && recursiveSearch(props, regex, true)) {
                match = true;
              }
            } catch (err) {
              errorCount++;
              if (errorCount <= 3) {
                console.warn(`Error fetching props for ${model.modelID}-${expressID}:`, err);
              }
            }
          }

          return { match, expressID };
        };

        // Split nodes into batches for concurrent processing
        const batchSize = 20; // Number of concurrent operations
        const nodesToProcess = nodes.filter(node => node.expressID !== undefined);
        const results: { match: boolean; expressID: number }[] = [];

        // Maximum number of matches to find before stopping search
        const MAX_MATCHES = 1000;
        let hasReachedMaxMatches = false;

        // Process nodes in batches
        for (let i = 0; i < nodesToProcess.length; i += batchSize) {
          if (cancelled || hasReachedMaxMatches) break;

          const currentBatch = nodesToProcess.slice(i, i + batchSize);
          const batchPromises = currentBatch.map(node => processNode(node));

          // Wait for the current batch to complete
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);

          // Check if we've found enough matches
          const matchCount = results.filter(r => r.match).length;
          if (matchCount >= MAX_MATCHES) {
            console.log(`Found ${matchCount} matches, stopping search early`);
            setSearchProgress({ active: true, percent: 100, status: `Found ${matchCount} matches (stopped early)` });
            hasReachedMaxMatches = true;
          }

          // Provide visual feedback during processing for large models
          // Update progress more frequently
          if (i % 20 === 0 || i + batchSize >= nodesToProcess.length) {
            const percentComplete = Math.round((i / nodesToProcess.length) * 100);
            console.log(`Processed ${i}/${nodesToProcess.length} nodes (${percentComplete}%)...`);

            // Update progress state for UI
            setSearchProgress({
              active: true,
              percent: percentComplete,
              status: `Searching... ${i}/${nodesToProcess.length} elements (${matchCount} matches found)`
            });

            // Update UI to show progress (non-blocking)
            if (i % 100 === 0) {
              // Process partial results to show immediate visual feedback
              const partialResults = results.filter(r => !r.match && r.expressID !== -1)
                .map(r => ({ modelID: model.modelID as number, expressID: r.expressID }));

              if (partialResults.length > 0) {
                // Apply visibility changes for partial results
                for (const result of partialResults) {
                  if (allMeshes[result.modelID]?.[result.expressID]) {
                    const meshToHide = allMeshes[result.modelID][result.expressID];
                    meshToHide.visible = false;
                  }
                }
              }

              // Use setTimeout to avoid blocking UI
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
        }

        // Process the results
        for (const result of results) {
          if (result.expressID === -1) continue;

          if (result.match) {
            matchCount++;
          } else {
            noMatchCount++;
            toHide.push({ modelID: model.modelID, expressID: result.expressID });

            if (allMeshes[model.modelID]?.[result.expressID]) {
              const meshToHide = allMeshes[model.modelID][result.expressID];
              meshToHide.visible = false;
            }
          }
        }

        // Handle meshes that are in the scene but not found in the spatial tree
        const modelMeshesMap = allMeshes[model.modelID];
        if (query && modelMeshesMap) { // query is confirmedSearch.trim()
          for (const expressIDStr in modelMeshesMap) {
            const expressID = parseInt(expressIDStr, 10);
            if (!processedExpressIDsFromSpatialTree.has(expressID)) {
              // This mesh element was not found in the spatial tree.
              // If a search is active, it should be hidden because it can't be "matched" via properties.
              toHide.push({ modelID: model.modelID, expressID: expressID });
              const meshToHide = modelMeshesMap[expressID];
              if (meshToHide) {
                meshToHide.visible = false; // Direct hide for immediate feedback
              }
              noMatchCount++; // Consider it a non-match for accounting
            }
          }
        }
        console.log(`Filter results for model ${model.id}: ${matchCount} matches, ${noMatchCount} non-matches (to hide, incl. non-spatial), ${errorCount} errors`);
      }

      console.log(`Filter identified ${toHide.length} elements to hide overall.`);

      if (!cancelled && toHide.length > 0) {
        console.log("Calling hideElements with", toHide.length, "elements");
        hideElements(toHide);
        searchHiddenRef.current = toHide;

        // Force render update of THREE scene
        scene.current?.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.matrixWorldNeedsUpdate = true;
          }
        });
      }

      // Set search completed
      setSearchProgress({
        active: false,
        percent: 100,
        status: `Search complete: ${toHide.length} elements hidden`
      });
      setIsSearchRunning(false);

      // Clear status after a delay
      setTimeout(() => {
        setSearchProgress(prev => {
          if (prev.percent === 100) { // Only clear if it's still showing the completed state
            return { active: false, percent: 0, status: '' };
          }
          return prev;
        });
      }, 5000); // Longer delay to ensure user sees result
    };

    applyFilter();

    return () => {
      cancelled = true;
    };
  }, [confirmedSearch, loadedModels, ifcApi, hideElements, showElements, gatherAllElements, scene, isSearchRunning, getElementPropertiesCached]);

  // Update collapse state when panels change
  useEffect(() => {
    const checkPanelState = () => {
      if (leftPanelRef.current) {
        setLeftPanelCollapsed(leftPanelRef.current.getSize() === 0);
      }
      if (rightPanelRef.current) {
        setRightPanelCollapsed(rightPanelRef.current.getSize() === 0);
      }
    };

    // Set initial state
    checkPanelState();

    // Create MutationObserver to watch for size attribute changes
    const observer = new MutationObserver(checkPanelState);

    // Start observing
    const leftPanelElement = leftPanelRef.current
      ? document.getElementById(leftPanelRef.current.getId())
      : null;
    const rightPanelElement = rightPanelRef.current
      ? document.getElementById(rightPanelRef.current.getId())
      : null;

    if (leftPanelElement) {
      observer.observe(leftPanelElement, { attributes: true });
    }
    if (rightPanelElement) {
      observer.observe(rightPanelElement, { attributes: true });
    }

    return () => {
      observer.disconnect();
    };
  }, [ifcEngineReady]); // Only run once after panels are rendered

  // Combined toggle function that also updates state
  const handleToggleLeftPanel = () => {
    toggleLeftPanel();
    setLeftPanelCollapsed(!leftPanelCollapsed);
  };

  const handleToggleRightPanel = () => {
    toggleRightPanel();
    setRightPanelCollapsed(!rightPanelCollapsed);
  };

  useEffect(() => {
    if (SKIP_IFC_INITIALIZATION_FOR_TEST) {
      return;
    }
    if (ifcApi) {
      setIfcEngineReady(true);
      return;
    }
    let didCancel = false;
    const initializeWebIFC = async () => {
      try {
        const ifcAPIInstance = new IfcAPI();
        ifcAPIInstance.SetWasmPath("/wasm/web-ifc/", true);
        await ifcAPIInstance.Init();
        if (!didCancel) {
          if (!ifcAPIInstance.properties) {
            ifcAPIInstance.properties = new Properties(ifcAPIInstance);
          }
          if (setIfcApi) setIfcApi(ifcAPIInstance);
          setIfcEngineReady(true);
        }
      } catch (error) {
        if (!didCancel) {
          console.error("ViewerContent: Error initializing WebIFC:", error);
          setIfcEngineReady(false);
        }
      }
    };
    initializeWebIFC();
    return () => {
      didCancel = true;
    };
  }, [ifcApi, setIfcApi, SKIP_IFC_INITIALIZATION_FOR_TEST]);

  const [hasAutoLoadedModels, setHasAutoLoadedModels] = useState(false);

  useEffect(() => {
    if (!ifcEngineReady || hasAutoLoadedModels || loadedModels.length > 0)
      return;
    try {
      const stored = localStorage.getItem("appSettings");
      if (!stored) return;
      const { modelUrls, alwaysLoad } = JSON.parse(stored);
      if (!alwaysLoad || !Array.isArray(modelUrls)) return;
      modelUrls.forEach((m: any) => addIFCModel(m.url, m.name));
      setHasAutoLoadedModels(true);
    } catch (err) {
      console.error("Failed to autoload models", err);
    }
  }, [ifcEngineReady, hasAutoLoadedModels, loadedModels, addIFCModel]);

  // Re-enable selectedElement logging if desired, or keep it minimal
  useEffect(() => {
    if (selectedElement) {
      console.log("ViewerContent: Selected element changed: ", selectedElement);
    } else {
      console.log("ViewerContent: No element selected / selection cleared.");
    }
  }, [selectedElement]);

  const customUnhideAllElements = useCallback(() => {
    unhideAllElements();
    setCanvasSearch("");
    setConfirmedSearch("");
  }, [unhideAllElements]);

  const customUnhideLastElement = useCallback(() => {
    unhideLastElement();
    setCanvasSearch("");
    setConfirmedSearch("");
  }, [unhideLastElement]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTyping) return; // Universal check for typing focus

      switch (event.code) {
        case "Space":
          if (selectedElement) {
            event.preventDefault();
            toggleUserHideElement(selectedElement);
          }
          break;
        case "KeyZ":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (userHiddenElements.length > 0) {
              customUnhideLastElement();
            }
          }
          break;
        case "KeyE": // E for Zoom to Extents
          event.preventDefault();
          handleZoomExtents();
          break;
        case "KeyF": // F for Zoom to Selected (Focus)
          if (selectedElement) {
            event.preventDefault();
            handleZoomSelected();
          }
          break;
        case "KeyA": // A for Unhide All (with Shift)
          if (event.shiftKey) {
            event.preventDefault();
            if (userHiddenElements.length > 0) {
              customUnhideAllElements();
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedElement,
    toggleUserHideElement,
    unhideLastElement,
    unhideAllElements,
    userHiddenElements, // Dependency for checks
    handleZoomExtents, // Add if it's memoized (useCallback)
    handleZoomSelected, // Add if it's memoized (useCallback)
    customUnhideAllElements,
    customUnhideLastElement,
  ]);

  // Add a direct effect to apply userHiddenElements visibility
  useEffect(() => {
    if (!scene.current) return;

    console.log("Direct visibility effect: Processing userHiddenElements", userHiddenElements.length);

    // Track which elements should be hidden
    const hiddenElements = new Map<number, Set<number>>();

    // Build lookup map of elements to hide
    userHiddenElements.forEach(element => {
      if (!hiddenElements.has(element.modelID)) {
        hiddenElements.set(element.modelID, new Set());
      }
      hiddenElements.get(element.modelID)?.add(element.expressID);
    });

    // Traverse the scene and update visibility
    let appliedHideCount = 0;
    scene.current.traverse(object => {
      if (object instanceof THREE.Mesh &&
        object.userData &&
        object.userData.expressID !== undefined &&
        object.userData.modelID !== undefined) {

        const modelID = object.userData.modelID;
        const expressID = object.userData.expressID;

        if (hiddenElements.has(modelID) && hiddenElements.get(modelID)?.has(expressID)) {
          if (object.visible) {
            object.visible = false;
            appliedHideCount++;
          }
        }
      }
    });

    console.log(`Direct visibility effect: Applied visibility=false to ${appliedHideCount} meshes`);
  }, [userHiddenElements, scene]);

  if (!ifcEngineReady && !SKIP_IFC_INITIALIZATION_FOR_TEST) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{t('loadingWebIFCEngine')}</h2>
          <p className="text-muted-foreground">{t('pleaseWaitMoment')}</p>
        </div>
      </div>
    );
  }

  if (webGLContextLost) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center p-8 bg-destructive/20 border border-destructive rounded-lg">
          <h2 className="text-2xl font-bold mb-4 text-destructive-foreground">
            {t('webglContextLost')}
          </h2>
          <p className="text-destructive-foreground/80 mb-4">
            {t('webglContextLostMessage')}
          </p>
          <p className="text-destructive-foreground/80">
            {t('refreshPage')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full relative overflow-hidden"
      style={{ isolation: 'isolate' }}
    >
      {/* Canvas moved here, absolutely positioned, z-index 0 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
        }}
      >
        {ifcEngineReady && !webGLContextLost && (
          <Canvas
            onCreated={({ gl }) => {
              console.log("R3F Canvas with IFCModel: onCreated called.");
              const context = gl.getContext();
              if (!context) {
                console.error(
                  "R3F Canvas with IFCModel: Failed to get WebGL context."
                );
                setWebGLContextLost(true);
                return;
              }
              console.log(
                "R3F Canvas with IFCModel: Context attributes:",
                context.getContextAttributes()
              );
              console.log(
                "R3F Canvas with IFCModel: Is context lost initially?",
                context.isContextLost()
              );
              if (context.isContextLost()) {
                console.error(
                  "R3F Canvas with IFCModel: Context is lost immediately in onCreated."
                );
                setWebGLContextLost(true);
              }
              if (gl.domElement) {
                gl.domElement.addEventListener(
                  "webglcontextlost",
                  (event) => {
                    event.preventDefault();
                    console.error(
                      "R3F Canvas with IFCModel: WebGL context lost! (event listener)"
                    );
                    setWebGLContextLost(true);
                  },
                  false
                );
                gl.domElement.addEventListener(
                  "webglcontextcreationerror",
                  (event) => {
                    const webglEvent = event as WebGLContextEvent;
                    console.error(
                      "R3F Canvas with IFCModel: WebGL context CREATION ERROR!",
                      "Status:",
                      webglEvent.statusMessage || "No status message."
                    );
                    setWebGLContextLost(true);
                  },
                  false
                );
              } else {
                console.error(
                  "R3F Canvas with IFCModel: gl.domElement not available."
                );
                setWebGLContextLost(true);
              }
            }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <Environment preset="city" />
            <OrbitControls makeDefault enableDamping={false} />
            <GlobalInteractionHandler />
            <SceneCapture onSceneCapture={captureScene} />
            <OrbitTargetController />
            {loadedModels.map((modelEntry) => (
              <IFCModel
                key={modelEntry.id}
                modelData={modelEntry}
                outlineLayer={OUTLINE_SELECTION_LAYER}
              />
            ))}
            <CameraActionsController ref={cameraActionsRef} />
          </Canvas>
        )}
      </div>

      {/* PanelGroup on top, z-index 1 */}
      <PanelGroup
        direction="horizontal"
        autoSaveId="ifc-viewer-layout"
        style={{
          zIndex: 1,
          position: "relative",
          pointerEvents: "none",
          height: "calc(100% - 4rem)",
          marginTop: "4rem",
        }}
      >
        {/* Left sidebar */}
        <Panel
          id="left-sidebar"
          ref={leftPanelRef}
          defaultSize={25}
          minSize={15}
          maxSize={40}
          collapsible
          className="bg-transparent pointer-events-auto" // MODIFIED: Panel itself is transparent
        >
          {/* Inner div has the gradient */}
          <div className="h-full flex flex-col shadow-lg bg-gradient-to-r from-[hsl(var(--card))]">
            <div className="p-2 border-b flex justify-between items-center shrink-0">
              <h3 className="text-sm font-semibold px-2">{t('modelExplorer')}</h3>
              <FileUpload key={`file-upload-sidebar-${settingsVersion}`} isAdding={true} />
            </div>

            {/* Vertical panel group for model tree and properties */}
            <PanelGroup direction="vertical" className="flex-grow">
              <Panel id="spatial-tree" defaultSize={70} minSize={30}>
                <div className="h-full overflow-y-auto">
                  <SpatialTreePanel />
                </div>
              </Panel>

              <ResizeHandleVertical />

              <Panel id="properties-panel" defaultSize={30} minSize={20}>
                <div className="h-full flex flex-col">
                  <div className="p-1 border-b">
                    <h3 className="text-sm font-semibold px-2">{t('properties')}</h3>
                  </div>
                  <div className="p-2 overflow-y-auto flex-grow">
                    <ModelInfo />
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </div>
        </Panel>

        <ResizeHandleHorizontal
          onToggle={handleToggleLeftPanel}
          collapsed={leftPanelCollapsed}
          isLeftSide={true}
          className="pointer-events-auto"
        />

        {/* Main content area - Canvas is NO LONGER here */}
        <Panel
          id="main-content"
          defaultSize={50}
          className="bg-transparent pointer-events-none"
        >
          <div className="relative h-full bg-transparent pointer-events-none">
            {/* Search Bar - Top Right */}
            {ifcEngineReady && !webGLContextLost && (
              <div className="absolute top-4 right-4 z-20 pointer-events-auto">
                <div className="flex items-center gap-2 p-1 bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          value={canvasSearch}
                          onFocus={() => setIsSearchFocused(true)}
                          onBlur={() => setIsSearchFocused(false)}
                          onChange={(e) => {
                            const newSearch = e.target.value;
                            setCanvasSearch(newSearch);
                            if (newSearch.trim() === "") {
                              setConfirmedSearch("");

                              // Reset view when search term is cleared
                              if (searchHiddenRef.current.length > 0) {
                                showElements(searchHiddenRef.current);
                                searchHiddenRef.current = [];
                              }
                              setSearchProgress({ active: false, percent: 0, status: '' });
                              setIsSearchRunning(false);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchSubmit(canvasSearch);
                            }
                          }}
                          placeholder={isSearchFocused ? t('modelViewer.searchCanvasPlaceholder') : "Search..."}
                          className={`h-8 text-xs transition-all duration-300 ease-in-out rounded-md ${isSearchFocused
                            ? 'w-48 px-3'
                            : 'w-24 px-2 text-[11px]'
                            }`}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        align="end"
                        className="max-w-xs p-3 bg-popover text-popover-foreground shadow-md rounded-md z-50 flex flex-col gap-1"
                      >
                        <p className="font-medium">
                          Filter elements by properties
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supports wildcard <code className="p-0.5 bg-muted rounded-sm">*</code> and regular expressions (regex).
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Learn more about <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">regex</a> or test on <a href="https://regex101.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">regex101.com</a>.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {isSearchRunning ? (
                    <Button
                      variant="ghost"
                      onClick={handleCancelSearch}
                      title="Cancel search"
                      className="transition-all duration-300 ease-in-out flex items-center justify-center rounded-md h-8 w-8"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6L6 18"></path>
                        <path d="M6 6l12 12"></path>
                      </svg>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => handleSearchSubmit(canvasSearch)}
                      title={t('modelViewer.search')}
                      className={`transition-all duration-300 ease-in-out flex items-center justify-center rounded-md ${isSearchFocused ? 'h-8 w-8' : 'h-7 w-7 p-0.5' // Adjusted padding for collapsed state
                        }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16" // Base width
                        height="16" // Base height
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-all duration-300 ease-in-out ${ // Apply scale transform
                          isSearchFocused ? 'scale-100' : 'scale-[0.80]' // Scale down when collapsed
                          }`}
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    </Button>
                  )}
                </div>

                {/* Search Progress Indicator */}
                {searchProgress.active && (
                  <div className="mt-2 p-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg text-xs w-full">
                    <div className="mb-1 flex justify-between font-medium">
                      <span>{searchProgress.status}</span>
                      <span>{searchProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300 ease-in-out"
                        style={{ width: `${searchProgress.percent}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Show status message even after search is complete */}
                {!searchProgress.active && searchProgress.status && (
                  <div className="mt-2 p-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg text-xs w-full">
                    <div className="text-center font-medium">
                      {searchProgress.status}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FileUpload prompt when no models (will show over global canvas) */}
            {loadedModels.length === 0 &&
              ifcEngineReady &&
              !SKIP_IFC_INITIALIZATION_FOR_TEST && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 pointer-events-auto">
                  <FileUpload key={`file-upload-main-${settingsVersion}`} isAdding={false} />
                </div>
              )}
            {/* ViewToolbar (will show over global canvas) */}
            {ifcEngineReady && !webGLContextLost && (
              <ViewToolbar
                onZoomExtents={handleZoomExtents}
                onZoomSelected={handleZoomSelected}
                isElementSelected={!!selectedElement}
                onUnhideAll={customUnhideAllElements}
                onUnhideLast={customUnhideLastElement}
              />
            )}
          </div>
        </Panel>

        <ResizeHandleHorizontal
          onToggle={handleToggleRightPanel}
          collapsed={rightPanelCollapsed}
          isLeftSide={false}
          className="pointer-events-auto"
        />

        {/* Right sidebar */}
        <Panel
          id="right-sidebar"
          ref={rightPanelRef}
          defaultSize={25}
          minSize={15}
          maxSize={40}
          collapsible
          className="bg-transparent pointer-events-auto"
        >
          <ResponsiveTabs onSettingsChanged={handleSettingsChanged} />
        </Panel>
      </PanelGroup>
    </div>
  );
}

// Re-enable full FileUpload
interface ModelSource {
  name: string;
  url: string;
}
interface FileUploadProps {
  isAdding?: boolean;
}
function FileUpload({ isAdding = false }: FileUploadProps) {
  const { replaceIFCModel, addIFCModel } = useIFCContext();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [demoModels, setDemoModels] = useState<ModelSource[]>([]);
  const [savedModels, setSavedModels] = useState<ModelSource[]>([]);

  useEffect(() => {
    const fetchDemo = async () => {
      try {
        const res = await fetch("/data/demo_models.json");
        if (res.ok) setDemoModels(await res.json());
      } catch (err) {
        console.error("Failed to load demo models", err);
      }
    };
    fetchDemo();
    const stored = localStorage.getItem("appSettings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedModels(parsed.modelUrls || []);
      } catch (e) {
        console.error("Failed to parse stored model urls", e);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      if (isAdding) addIFCModel(url, file.name);
      else replaceIFCModel(url, file.name);
    }
  };

  const handleLoadModel = (model: ModelSource) => {
    if (isAdding) addIFCModel(model.url, model.name);
    else replaceIFCModel(model.url, model.name);
  };

  const buttonStyle = isAdding ? "h-8 w-8" : "";
  const commonButtonContent = isAdding ? (
    <PlusSquare className="w-4 h-4" />
  ) : (
    <>
      <UploadCloud className="w-4 h-4 mr-2" /> {t('loadIFCFile')}
    </>
  );
  const commonButtonTitle = isAdding
    ? t('addAnotherModel')
    : t('loadInitialModel');

  const hasSavedModels = savedModels.length > 0;
  const savedModelUrls = new Set(savedModels.map(m => m.url));
  const uniqueDemoModels = demoModels.filter(dm => !savedModelUrls.has(dm.url));
  const hasUniqueDemoModels = uniqueDemoModels.length > 0;

  if (isAdding) {
    // Sidebar "Add" button
    if (hasSavedModels) {
      // If there are user-saved models, show a dropdown.
      const addButton = (
        <Button
          variant="ghost"
          size="icon"
          // No onClick here; DropdownMenuTrigger handles opening.
          title={commonButtonTitle}
          className={buttonStyle}
        >
          {commonButtonContent}
        </Button>
      );
      const addMenu = (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{addButton}</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
              {t('loadIFCFile')}
            </DropdownMenuItem>
            {/* hasSavedModels is true here */}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">{t('myModels')}</DropdownMenuLabel>
            {savedModels.map((m) => (
              <DropdownMenuItem key={m.url} onSelect={() => handleLoadModel(m)}>
                {m.name}
              </DropdownMenuItem>
            ))}
            {hasUniqueDemoModels && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">{t('demoModels')}</DropdownMenuLabel>
                {uniqueDemoModels.map((m) => (
                  <DropdownMenuItem key={m.url} onSelect={() => handleLoadModel(m)}>
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
      return (
        <>
          <input
            type="file"
            accept=".ifc"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          {addMenu}
        </>
      );
    } else {
      // No user-saved models: direct file upload button for sidebar.
      return (
        <>
          <input
            type="file"
            accept=".ifc"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()} // Direct action
            title={commonButtonTitle}
            className={buttonStyle}
          >
            {commonButtonContent}
          </Button>
        </>
      );
    }
  } else {
    // Main canvas prompt (isAdding=false)
    if (hasSavedModels) {
      // USER has configured models: use the dropdown menu
      const mainPromptButton = (
        <Button
          variant="default"
          size="default"
          // No onClick here; DropdownMenuTrigger handles opening.
          title={commonButtonTitle}
        >
          {commonButtonContent}
        </Button>
      );
      const mainPromptMenu = (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{mainPromptButton}</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
              {t('loadIFCFile')}
            </DropdownMenuItem>
            {/* hasSavedModels is true here */}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">{t('myModels')}</DropdownMenuLabel>
            {savedModels.map((m) => (
              <DropdownMenuItem key={m.url} onSelect={() => handleLoadModel(m)}>
                {m.name}
              </DropdownMenuItem>
            ))}
            {hasUniqueDemoModels && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">{t('demoModels')}</DropdownMenuLabel>
                {uniqueDemoModels.map((m) => (
                  <DropdownMenuItem key={m.url} onSelect={() => handleLoadModel(m)}>
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
      return (
        <div className="text-center p-8">
          <div className="flex justify-center mb-4">
            <UploadCloud className="h-12 w-12 text-foreground/30" />
          </div>
          <p className="text-base font-medium text-foreground/80 mb-2">{t('ifcModelViewer')}</p>
          <p className="text-sm text-foreground/60 mb-6">
            {t('uploadIFCFile')}
          </p>
          <input
            type="file"
            accept=".ifc"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          {mainPromptMenu || (
            <Button
              variant="default"
              size="default"
              onClick={() => fileInputRef.current?.click()}
              title={commonButtonTitle}
            >
              {commonButtonContent}
            </Button>
          )}
        </div>
      );
    } else {
      // No USER configured models: simple direct upload button
      return (
        <div className="text-center p-8">
          <div className="flex justify-center mb-4">
            <UploadCloud className="h-12 w-12 text-foreground/30" />
          </div>
          <p className="text-base font-medium text-foreground/80 mb-2">{t('ifcModelViewer')}</p>
          <p className="text-sm text-foreground/60 mb-6">
            {t('uploadIFCFile')}
          </p>
          <input
            type="file"
            accept=".ifc"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <Button
            variant="default"
            size="default"
            onClick={() => fileInputRef.current?.click()} // Direct action
            title={commonButtonTitle}
          >
            {commonButtonContent}
          </Button>
        </div>
      );
    }
  }
}

export default function IFCViewer() {
  return (
    <IFCContextProvider>
      <ViewerContent />
    </IFCContextProvider>
  );
}
