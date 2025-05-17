"use client";

import type React from "react";

import {
  useState,
  useRef,
  useEffect,
  Fragment,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { IFCModel } from "@/components/ifc-model";
import { ClassificationPanel } from "@/components/classification-panel";
import { RulePanel } from "@/components/rule-panel";
import { Button } from "@/components/ui/button";
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
  const { selectElement, selectedElement, loadedModels, userHiddenElements } = useIFCContext();

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
        const visibleIntersects = allIntersects.filter(intersect => intersect.object.visible);

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
}

function ViewToolbar({
  onZoomExtents,
  onZoomSelected,
  isElementSelected,
}: ViewToolbarProps) {
  const {
    selectedElement,
    toggleUserHideElement,
    userHiddenElements,
    unhideLastElement,
    unhideAllElements
  } = useIFCContext();

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
          title="Zoom to Extents (E)"
        >
          <Maximize className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomSelected}
          disabled={!isElementSelected}
          title="Zoom to Selected (F)"
        >
          <Focus className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleHideSelected}
          disabled={!selectedElement}
          title={selectedElement ? "Toggle Visibility of Selected (Spacebar)" : "Select an element to toggle visibility"}
        >
          <EyeOff className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={unhideLastElement}
          disabled={userHiddenElements.length === 0}
          title="Unhide Last (Cmd/Ctrl+Z)"
        >
          <Undo2 className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={unhideAllElements}
          disabled={userHiddenElements.length === 0}
          title="Unhide All Elements (Shift+A)"
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
      "w-2 flex items-center justify-center group transition-colors hover:bg-muted/80 active:bg-muted rounded",
      onToggle ? "cursor-col-resize" : "",
      className
    )}
  >
    <div className="relative">
      {/* Resize handle line */}
      <div className="w-0.5 h-8 bg-border group-hover:bg-muted-foreground/60 group-active:bg-muted-foreground/80 rounded-full transition-colors" />

      {/* Toggle button for collapsing/expanding (if provided) */}
      {onToggle && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            "absolute -left-3 top-1/2 -translate-y-1/2 rounded-full w-6 h-6 flex items-center justify-center",
            "bg-background border border-border shadow-sm hover:bg-muted transition-all",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          )}
          title={collapsed ? "Expand panel" : "Collapse panel"}
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
  const { loadedModels, setIfcApi, ifcApi, selectedElement, selectElement, toggleUserHideElement, unhideLastElement, unhideAllElements, userHiddenElements } =
    useIFCContext();
  const [ifcEngineReady, setIfcEngineReady] = useState(false);
  const [webGLContextLost, setWebGLContextLost] = useState(false);

  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  const cameraActionsRef = useRef<CameraActions>(null); // Ref for CameraActionsController

  const SKIP_IFC_INITIALIZATION_FOR_TEST = false;

  const handleZoomExtents = () => {
    console.log("ViewerContent: handleZoomExtents called");
    cameraActionsRef.current?.zoomToExtents();
  };

  const handleZoomSelected = () => {
    console.log("ViewerContent: handleZoomSelected called");
    cameraActionsRef.current?.zoomToSelected(selectedElement);
  };

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
      // This block will not run now
      return;
    }
    // IFC API Initialization logic as before
    if (ifcApi) {
      console.log(
        "ViewerContent: IfcAPI already available, marking engine as ready."
      );
      setIfcEngineReady(true);
      return;
    }
    let didCancel = false;
    const initializeWebIFC = async () => {
      try {
        console.log("ViewerContent: Initializing IfcAPI...");
        const ifcAPIInstance = new IfcAPI();
        console.log(
          "ViewerContent: Setting IfcAPI WASM path (autoInitialize: true)..."
        );
        ifcAPIInstance.SetWasmPath("/wasm/web-ifc/", true);
        console.log("ViewerContent: Calling IfcAPI Init()...");
        await ifcAPIInstance.Init();
        if (!didCancel) {
          console.log("ViewerContent: IfcAPI initialized successfully.");
          // Initialize the Properties helper (important for property sets)
          console.log("ViewerContent: Initializing Properties helper...");
          if (!ifcAPIInstance.properties) {
            ifcAPIInstance.properties = new Properties(ifcAPIInstance);
            console.log("ViewerContent: Properties helper initialized.");
          }
          if (setIfcApi) setIfcApi(ifcAPIInstance);
          setIfcEngineReady(true);
        } else {
          console.log("ViewerContent: IfcAPI initialization cancelled.");
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
      console.log("ViewerContent: Cleanup from IfcAPI initialization effect.");
      didCancel = true;
    };
  }, [ifcApi, setIfcApi]);

  // Re-enable selectedElement logging if desired, or keep it minimal
  useEffect(() => {
    if (selectedElement) {
      console.log("ViewerContent: Selected element changed: ", selectedElement);
    } else {
      console.log("ViewerContent: No element selected / selection cleared.");
    }
  }, [selectedElement]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isTyping) return; // Universal check for typing focus

      switch (event.code) {
        case 'Space':
          if (selectedElement) {
            event.preventDefault();
            toggleUserHideElement(selectedElement);
          }
          break;
        case 'KeyZ':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (userHiddenElements.length > 0) unhideLastElement(); // Check if there's something to unhide
          }
          break;
        case 'KeyE': // E for Zoom to Extents
          event.preventDefault();
          handleZoomExtents();
          break;
        case 'KeyF': // F for Zoom to Selected (Focus)
          if (selectedElement) {
            event.preventDefault();
            handleZoomSelected();
          }
          break;
        case 'KeyA': // A for Unhide All (with Shift)
          if (event.shiftKey) {
            event.preventDefault();
            if (userHiddenElements.length > 0) unhideAllElements(); // Check if there's something to unhide
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedElement,
    toggleUserHideElement,
    unhideLastElement,
    unhideAllElements,
    userHiddenElements, // Dependency for checks
    handleZoomExtents, // Add if it's memoized (useCallback)
    handleZoomSelected // Add if it's memoized (useCallback)
  ]);

  if (!ifcEngineReady && !SKIP_IFC_INITIALIZATION_FOR_TEST) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading WebIFC Engine...</h2>
          <p className="text-muted-foreground">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (webGLContextLost) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center p-8 bg-destructive/20 border border-destructive rounded-lg">
          <h2 className="text-2xl font-bold mb-4 text-destructive-foreground">
            WebGL Context Lost
          </h2>
          <p className="text-destructive-foreground/80 mb-4">
            The 3D rendering context has been lost.
          </p>
          <p className="text-destructive-foreground/80">
            Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full relative overflow-hidden">
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
          marginTop: "4rem"
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
              <h3 className="text-sm font-semibold px-2">Model Explorer</h3>
              <FileUpload isAdding={true} />
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
                    <h3 className="text-sm font-semibold px-2">Properties</h3>
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
            {/* FileUpload prompt when no models (will show over global canvas) */}
            {loadedModels.length === 0 &&
              ifcEngineReady &&
              !SKIP_IFC_INITIALIZATION_FOR_TEST && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 pointer-events-auto">
                  <FileUpload isAdding={false} />
                </div>
              )}
            {/* ViewToolbar (will show over global canvas) */}
            {ifcEngineReady && !webGLContextLost && (
              <ViewToolbar
                onZoomExtents={handleZoomExtents}
                onZoomSelected={handleZoomSelected}
                isElementSelected={!!selectedElement}
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
          <Tabs
            defaultValue="classifications"
            className="flex flex-col h-full shadow-lg bg-gradient-to-l from-[hsl(var(--card))] to-transparent"
          >
            <TabsList className="w-full shrink-0 border-b border-border/50 p-1 bg-[hsl(var(--background))/85] backdrop-blur-sm">
              <TabsTrigger value="classifications" className="flex-1 text-sm py-1.5 px-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-sm">
                <Layers className="w-4 h-4 mr-1.5" />
                Classifications
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex-1 text-sm py-1.5 px-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-sm">
                <Filter className="w-4 h-4 mr-1.5" />
                Rules
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1 text-sm py-1.5 px-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-sm">
                <Settings className="w-4 h-4 mr-1.5" />
                Settings
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="classifications"
              className="p-4 flex-grow overflow-y-auto"
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
              <h3 className="text-lg font-medium">Settings</h3>
              <p className="text-sm text-muted-foreground">
                Settings for the application will go here.
              </p>
            </TabsContent>
          </Tabs>
        </Panel>
      </PanelGroup>
    </div>
  );
}

// Re-enable full FileUpload
interface FileUploadProps {
  isAdding?: boolean;
}
function FileUpload({ isAdding = false }: FileUploadProps) {
  const { replaceIFCModel, addIFCModel } = useIFCContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      if (isAdding) addIFCModel(url, file.name);
      else replaceIFCModel(url, file.name);
    }
  };

  const buttonStyle = isAdding ? "h-8 w-8" : "";
  const buttonContent = isAdding ? (
    <PlusSquare className="w-4 h-4" />
  ) : (
    <>
      <UploadCloud className="w-4 h-4 mr-2" /> Load IFC File
    </>
  );
  const buttonTitle = isAdding
    ? "Add another IFC model"
    : "Load initial IFC model";

  if (isAdding) {
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
          onClick={() => fileInputRef.current?.click()}
          title={buttonTitle}
          className={buttonStyle}
        >
          {buttonContent}
        </Button>
      </>
    );
  }

  // Restore original styling for the initial load prompt
  return (
    <div className="text-center p-8 bg-muted/50 rounded-lg backdrop-blur-sm">
      <h2 className="text-2xl font-bold mb-4">IFC Model Viewer</h2>
      <p className="mb-6 text-muted-foreground">
        Upload an IFC file to get started
      </p>
      <input
        type="file"
        accept=".ifc"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <Button onClick={() => fileInputRef.current?.click()} title={buttonTitle}>
        {buttonContent}
      </Button>
    </div>
  );
}

export default function IFCViewer() {
  return (
    <IFCContextProvider>
      <ViewerContent />
    </IFCContextProvider>
  );
}
