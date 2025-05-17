"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  useIFCContext,
  SpatialStructureNode,
  LoadedModelData,
  SelectedElementInfo,
} from "@/context/ifc-context";
import * as THREE from "three";
import {
  IfcAPI,
  IFCPROJECT,
  IFCSITE,
  IFCBUILDING,
  IFCBUILDINGSTOREY,
  IFCSPACE,
  IFCRELAGGREGATES,
  IFCRELCONTAINEDINSPATIALSTRUCTURE,
  IFCRELDEFINESBYPROPERTIES,
  Properties,
} from "web-ifc"; // Import IfcAPI type and constants

interface IFCModelProps {
  modelData: LoadedModelData;
  outlineLayer: number; // New prop for the outline layer number
}

// Helper function to get properties from an IFC element
async function getElementData(
  ifcApi: IfcAPI,
  modelID: number,
  expressID: number
): Promise<Partial<SpatialStructureNode>> {
  const props = await ifcApi.GetLine(modelID, expressID, true); // Get all properties
  const nodeData: Partial<SpatialStructureNode> = {
    expressID: props.expressID,
    type: ifcApi.GetNameFromTypeCode(props.type) || `TYPE_${props.type}`,
    Name: props.Name?.value,
    GlobalId: props.GlobalId?.value,
    // You can extract more specific properties here if needed
  };
  // Add all properties from the line for debugging or more detailed use if desired
  // for (const key in props) {
  //   if (Object.prototype.hasOwnProperty.call(props, key)) {
  //     // @ts-ignore
  //     nodeData[key] = props[key];
  //   }
  // }
  return nodeData;
}

// Function to recursively build the spatial structure tree
async function buildSpatialTree(
  ifcApi: IfcAPI,
  modelID: number,
  elementID: number,
  parentType?: string
): Promise<SpatialStructureNode | null> {
  const element = await getElementData(ifcApi, modelID, elementID);
  if (!element.type) return null;

  const node: SpatialStructureNode = {
    expressID: elementID,
    type: element.type,
    Name: element.Name,
    GlobalId: element.GlobalId,
    children: [],
    // Include other properties from element if needed
    ...element,
  };

  // 1. Decomposed elements (IfcRelAggregates)
  const relAggregatesIDs = await ifcApi.GetLineIDsWithType(
    modelID,
    IFCRELAGGREGATES
  );
  for (let i = 0; i < relAggregatesIDs.size(); i++) {
    const relAggID = relAggregatesIDs.get(i);
    const relAgg = await ifcApi.GetLine(modelID, relAggID, false);
    if (relAgg.RelatingObject?.value === elementID) {
      const relatedObjects = relAgg.RelatedObjects;
      if (relatedObjects && Array.isArray(relatedObjects)) {
        for (const relatedObject of relatedObjects) {
          const childNode = await buildSpatialTree(
            ifcApi,
            modelID,
            relatedObject.value,
            element.type
          );
          if (childNode) node.children.push(childNode);
        }
      }
    }
  }

  // 2. Contained elements (IfcRelContainedInSpatialStructure)
  // Only for spatial structure elements like Storey, Space, Building, Site
  if (
    element.type === "IFCBUILDINGSTOREY" ||
    element.type === "IFCSPACE" ||
    element.type === "IFCBASICELEMENT" ||
    element.type === "IFCBUILDING" ||
    element.type === "IFCSITE"
  ) {
    const relContainedIDs = await ifcApi.GetLineIDsWithType(
      modelID,
      IFCRELCONTAINEDINSPATIALSTRUCTURE
    );
    for (let i = 0; i < relContainedIDs.size(); i++) {
      const relContID = relContainedIDs.get(i);
      const relCont = await ifcApi.GetLine(modelID, relContID, false);
      if (relCont.RelatingStructure?.value === elementID) {
        const relatedElements = relCont.RelatedElements;
        if (relatedElements && Array.isArray(relatedElements)) {
          for (const relatedElement of relatedElements) {
            // These are typically non-spatial elements (walls, slabs, etc.) or could be spaces in storeys
            // We treat them as children but might not recurse further for their spatial decomposition unless they are IfcSpatialElement themselves
            const childData = await getElementData(
              ifcApi,
              modelID,
              relatedElement.value
            );
            if (childData.type) {
              // If it's a spatial element like IFCSPACE, recurse fully
              if (
                childData.type === "IFCSPACE" ||
                childData.type.includes("SPATIAL")
              ) {
                const childNode = await buildSpatialTree(
                  ifcApi,
                  modelID,
                  relatedElement.value,
                  element.type
                );
                if (childNode) node.children.push(childNode);
              } else {
                // For other elements, create a simpler node without further spatial children search
                node.children.push({
                  expressID: relatedElement.value,
                  type: childData.type,
                  Name: childData.Name,
                  GlobalId: childData.GlobalId,
                  children: [],
                  ...childData,
                });
              }
            }
          }
        }
      }
    }
  }
  return node;
}

async function fetchFullSpatialStructure(
  ifcApi: IfcAPI,
  modelID: number
): Promise<SpatialStructureNode | null> {
  const projectIDs = await ifcApi.GetLineIDsWithType(modelID, IFCPROJECT);
  if (projectIDs.size() === 0) {
    console.error("IFCModel: No IFCPROJECT found in the model.");
    return null;
  }
  const projectID = projectIDs.get(0); // Assume single project
  return buildSpatialTree(ifcApi, modelID, projectID);
}

export function IFCModel({ modelData, outlineLayer }: IFCModelProps) {
  const { scene, camera, controls } = useThree(); // Get controls directly
  const ownModelID = useRef<number | null>(null);
  const meshesRef = useRef<THREE.Group | null>(null);

  const {
    ifcApi,
    setSpatialTreeForModel,
    setElementProperties,
    selectedElement,
    highlightedElements,
    highlightedClassificationCode,
    setModelIDForLoadedModel,
    setAvailableCategoriesForModel,
    setAvailableProperties,
    classifications,
    showAllClassificationColors,
    userHiddenElements,
    setRawBufferForModel,
  } = useIFCContext();

  const [isLoading, setIsLoading] = useState(true);
  const [internalApiIdForEffects, setInternalApiIdForEffects] = useState<
    number | null
  >(null);
  const [
    modelMeshesProcessedForInitialView,
    setModelMeshesProcessedForInitialView,
  ] = useState(false);

  // Updated highlightMaterial color
  const highlightMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.5, // Slightly more subtle opacity
      color: 0x00bcd4, // A nice cyan/teal
      depthTest: false,
    });
  }, []);

  // New material for selected elements (simple color change)
  const selectionMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0xffaa00, // Bright orange for selection
      emissive: 0x332200, // Slight emissive quality
      transparent: true,
      opacity: 0.85, // Slightly more opaque than general highlight
      side: THREE.DoubleSide, // Ensure it's visible from all angles
      depthTest: true, // Standard depth testing
    });
  }, []);

  // This will be for the outline effect, selection material itself might not be directly applied for color change
  // const selectionMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, color: 0xffD700, depthTest: false });
  const originalMaterials = useRef<
    Map<number, THREE.Material | THREE.Material[]>
  >(new Map());

  // Clean up effect for the model (remains largely the same)
  useEffect(() => {
    return () => {
      if (ownModelID.current !== null && ifcApi) {
        try {
          console.log(
            `IFCModel (${modelData.id}): Closing model ID:`,
            ownModelID.current
          );
          ifcApi.CloseModel(ownModelID.current);
        } catch (error) {
          console.error(
            `IFCModel (${modelData.id}): Error closing model:`,
            error
          );
        }
      }
      if (meshesRef.current) {
        scene.remove(meshesRef.current);
        meshesRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material))
              child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
        meshesRef.current = null;
      }
      highlightMaterial.dispose();
      selectionMaterial.dispose();
    };
  }, [scene, ifcApi, modelData.id]);

  const createThreeJSGeometry = (ifcGeomData: any) => {
    if (!ifcApi || ownModelID.current === null)
      throw new Error(
        "ifcApi or modelID not available in createThreeJSGeometry"
      );
    const verts = ifcApi.GetVertexArray(
      ifcGeomData.GetVertexData(),
      ifcGeomData.GetVertexDataSize()
    );
    const indices = ifcApi.GetIndexArray(
      ifcGeomData.GetIndexData(),
      ifcGeomData.GetIndexDataSize()
    );
    const bufferGeometry = new THREE.BufferGeometry();
    const numVertices = verts.length / 6;
    const positions = new Float32Array(numVertices * 3);
    const normals = new Float32Array(numVertices * 3);
    for (let i = 0; i < numVertices; i++) {
      const vertexOffset = i * 6;
      const positionOffset = i * 3;
      positions[positionOffset] = verts[vertexOffset];
      positions[positionOffset + 1] = verts[vertexOffset + 1];
      positions[positionOffset + 2] = verts[vertexOffset + 2];
      normals[positionOffset] = verts[vertexOffset + 3];
      normals[positionOffset + 1] = verts[vertexOffset + 4];
      normals[positionOffset + 2] = verts[vertexOffset + 5];
    }
    bufferGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    bufferGeometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    bufferGeometry.setIndex(Array.from(indices));
    return bufferGeometry;
  };

  const createMeshes = () => {
    if (!ifcApi || ownModelID.current === null) return;
    if (meshesRef.current) {
      scene.remove(meshesRef.current);
      meshesRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material))
            child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
    }
    const group = new THREE.Group();
    group.name = `IFCModelGroup_${modelData.id}_${ownModelID.current}`;
    // IMPORTANT: Add this group to a known list or make it identifiable for the global raycaster
    // For now, the global raycaster will intersect scene.children. Ensure this group is added to scene.
    meshesRef.current = group;
    try {
      const flatMeshes = ifcApi.LoadAllGeometry(ownModelID.current);
      for (let i = 0; i < flatMeshes.size(); i++) {
        const flatMesh = flatMeshes.get(i);
        const elementExpressID = flatMesh.expressID;
        const placedGeometries = flatMesh.geometries;
        for (let j = 0; j < placedGeometries.size(); j++) {
          const placedGeometry = placedGeometries.get(j);
          const ifcGeometryData = ifcApi.GetGeometry(
            ownModelID.current,
            placedGeometry.geometryExpressID
          );
          const threeJsGeometry = createThreeJSGeometry(ifcGeometryData);
          const color = placedGeometry.color;
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color.x, color.y, color.z),
            side: THREE.DoubleSide,
            transparent: color.w < 1,
            opacity: color.w,
          });
          const mesh = new THREE.Mesh(threeJsGeometry, material);
          const matrix = placedGeometry.flatTransformation;
          const mat = new THREE.Matrix4();
          mat.fromArray(matrix);
          mesh.applyMatrix4(mat);
          // Ensure userData contains both modelID (API model ID) and expressID
          mesh.userData = {
            expressID: elementExpressID,
            modelID: ownModelID.current,
          };
          group.add(mesh);
        }
      }
      scene.add(group); // Add this model's group to the main scene
    } catch (error) {
      console.error(
        `IFCModel (${modelData.id}): Error creating meshes:`,
        error
      );
    }
  };

  // Load this specific IFC model
  useEffect(() => {
    if (!modelData.url || !ifcApi) {
      if (!ifcApi)
        console.log(`IFCModel (${modelData.id}): Waiting for ifcApi...`);
      return;
    }
    setIsLoading(true);
    setModelMeshesProcessedForInitialView(false); // <<< RESET FLAG FOR NEW MODEL LOAD

    const loadThisModel = async () => {
      try {
        console.log(
          `IFCModel (${modelData.id}): Loading from URL:`,
          modelData.url
        );
        const response = await fetch(modelData.url);
        if (!response.ok)
          throw new Error(`Failed to fetch: ${response.statusText}`);
        const data = await response.arrayBuffer();
        // Store the raw buffer in the context
        if (modelData.id && data) {
          setRawBufferForModel(modelData.id, data.slice(0)); // Use slice(0) to store a copy
        }

        if (meshesRef.current) {
          console.log(
            `IFCModel (${modelData.id}): Disposing old Three.js meshes.`
          );
          scene.remove(meshesRef.current);
          meshesRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
          meshesRef.current = null;
        }
        originalMaterials.current.clear();

        if (ownModelID.current !== null && ifcApi) {
          console.log(
            `IFCModel (${modelData.id}): Closing previous internal model ID in IfcAPI: ${ownModelID.current}`
          );
          ifcApi.CloseModel(ownModelID.current);
          ownModelID.current = null;
        }

        const uint8Array = new Uint8Array(data);
        const settings = { COORDINATE_TO_ORIGIN: true, USE_FAST_BOOLS: true };

        if (!ifcApi) {
          console.error(
            `IFCModel (${modelData.id}): ifcApi not available at OpenModel call.`
          );
          setIsLoading(false);
          return;
        }

        // @ts-ignore
        const newIfcModelID = ifcApi.OpenModel(uint8Array, settings);
        console.log(
          `IFCModel (${modelData.id}): Opened. Internal IFC Model ID:`,
          newIfcModelID
        );
        ownModelID.current = newIfcModelID;
        setModelIDForLoadedModel(modelData.id, newIfcModelID);
        setInternalApiIdForEffects(newIfcModelID);

        createMeshes(); // This populates meshesRef.current
        // Note: setModelMeshesProcessedForInitialView is NOT set here directly,
        // it will be handled by the new useEffect that depends on meshesRef.current becoming available.

        console.log(
          `IFCModel (${modelData.id}): Extracting data for modelID ${newIfcModelID}...`
        );
        const tree = await fetchFullSpatialStructure(ifcApi, newIfcModelID);
        setSpatialTreeForModel(newIfcModelID, tree);
        if (tree)
          console.log(
            `IFCModel (${modelData.id}): Spatial structure extracted.`
          );
        else
          console.log(
            `IFCModel (${modelData.id}): Spatial structure extraction failed or empty.`
          );
        const allTypesResult = ifcApi.GetIfcEntityList(newIfcModelID);
        const allTypesArray: number[] = Array.isArray(allTypesResult)
          ? allTypesResult
          : [];
        setAvailableCategoriesForModel(
          newIfcModelID,
          allTypesArray.map(String)
        );
        console.log(`IFCModel (${modelData.id}): Available categories set.`);
        setIsLoading(false);
      } catch (error) {
        console.error(`IFCModel (${modelData.id}): Error loading:`, error);
        setIsLoading(false);
      }
    };
    loadThisModel();
  }, [
    modelData.url, // Primary trigger for loading a new model
    // Dependencies for functions called inside: ifcApi, scene, setModelIDForLoadedModel, setSpatialTreeForModel, setAvailableCategoriesForModel
    // modelData.id is also used for logging and setModelIDForLoadedModel context
    ifcApi,
    scene,
    modelData.id,
    setModelIDForLoadedModel,
    setSpatialTreeForModel,
    setAvailableCategoriesForModel,
    setInternalApiIdForEffects, // Added setInternalApiIdForEffects
    setRawBufferForModel,
  ]);

  // New useEffect for initial camera positioning
  useEffect(() => {
    // Ensure controls are OrbitControls and camera is PerspectiveCamera for fov access
    if (
      meshesRef.current &&
      internalApiIdForEffects !== null &&
      !modelMeshesProcessedForInitialView &&
      camera instanceof THREE.PerspectiveCamera && // Type check for fov
      controls // Check if controls exist (it should if OrbitControls is makeDefault)
    ) {
      console.log(
        `IFCModel (${modelData.id}): Setting initial camera view for model ID ${internalApiIdForEffects}`
      );

      const bbox = new THREE.Box3().setFromObject(meshesRef.current);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());

      const pCamera = camera as THREE.PerspectiveCamera; // Cast after check
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = pCamera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5;

      // If maxDim is very small or zero, provide a default zoom
      if (cameraZ === 0 || !isFinite(cameraZ)) {
        cameraZ = 10; // Default distance if model is point-like or flat
      }

      pCamera.position.set(
        center.x,
        center.y + size.y * 0.25,
        center.z + cameraZ
      );
      pCamera.lookAt(center);

      // Controls type is OrbitControlsImpl from drei, but we can treat it as having target and update
      (controls as any).target.copy(center);
      (controls as any).update();

      setModelMeshesProcessedForInitialView(true);
    }
  }, [
    internalApiIdForEffects,
    modelMeshesProcessedForInitialView,
    camera,
    controls,
    modelData.id,
  ]); // Use controls from useThree()

  // Highlighting and Classification Effects
  useEffect(() => {
    console.log(
      `IFCModel (${modelData.id}) - Highlighting Effect Triggered. Dependencies:`,
      {
        selectedElement,
        highlightedElementsCount: highlightedElements.length,
        classificationsKeys: Object.keys(classifications),
        internalApiIdForEffects,
        ifcApiAvailable: !!ifcApi,
        meshesRefAvailable: !!meshesRef.current,
      }
    );

    if (!meshesRef.current || internalApiIdForEffects === null || !ifcApi) {
      console.log(
        `IFCModel (${modelData.id}) - Highlighting Effect: Aborting due to missing refs/id/api.`,
        {
          meshesRefAvailable: !!meshesRef.current,
          internalApiIdForEffects,
          ifcApiAvailable: !!ifcApi,
        }
      );
      return;
    }

    const currentModelID = internalApiIdForEffects;
    console.log(
      `IFCModel (${modelData.id}) - Highlighting Effect: currentModelID = ${currentModelID}`
    );

    const selectedExpressIDInThisModel =
      selectedElement?.modelID === currentModelID
        ? selectedElement.expressID
        : null;

    console.log(
      `IFCModel (${modelData.id}) - Highlighting Effect: Calculated selectedExpressIDInThisModel = ${selectedExpressIDInThisModel}`,
      `Selected Element from context:`,
      selectedElement
    );

    const highlightedExpressIDsInThisModel = highlightedElements
      .filter((h) => h.modelID === currentModelID)
      .map((h) => h.expressID);

    meshesRef.current.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.userData.expressID !== undefined &&
        child.userData.modelID === currentModelID
      ) {
        const mesh = child as THREE.Mesh;
        const expressID = mesh.userData.expressID;

        if (!originalMaterials.current.has(expressID)) {
          originalMaterials.current.set(expressID, mesh.material);
        }
        const trueOriginalMaterial = originalMaterials.current.get(expressID)!;
        let targetMaterial: THREE.Material | THREE.Material[] = trueOriginalMaterial;
        let isCurrentlyVisible = true;

        // Step 1: Apply "Show All Classification Colors" if active
        if (showAllClassificationColors) {
          let elementClassificationColor: string | null = null;
          for (const classification of Object.values(classifications as Record<string, any>)) {
            const isInClassification = classification.elements?.some(
              (el: SelectedElementInfo) => el && el.modelID === currentModelID && el.expressID === expressID
            );
            if (isInClassification) {
              elementClassificationColor = classification.color || "#808080";
              break;
            }
          }
          if (elementClassificationColor) {
            let isCorrectMaterial = false;
            if (mesh.material instanceof THREE.MeshStandardMaterial) {
              if (mesh.material.color.getHexString().toLowerCase() === elementClassificationColor.substring(1).toLowerCase() &&
                mesh.material.opacity === 0.9 && mesh.material.transparent) {
                isCorrectMaterial = true;
                targetMaterial = mesh.material; // Use existing material instance
              }
            }
            if (!isCorrectMaterial) {
              targetMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color(elementClassificationColor),
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide,
              });
            }
          } else {
            targetMaterial = trueOriginalMaterial;
          }
        }

        // Step 2: Apply single highlighted classification effects
        if (highlightedClassificationCode) {
          const activeClassification = classifications[highlightedClassificationCode];
          const isElementInActiveClassification = activeClassification?.elements?.some(
            (el: SelectedElementInfo) => el && el.modelID === currentModelID && el.expressID === expressID
          );

          if (isElementInActiveClassification) {
            isCurrentlyVisible = true;
            if (activeClassification && activeClassification.color) {
              let isCorrectMaterial = false;
              if (mesh.material instanceof THREE.MeshStandardMaterial) {
                if (mesh.material.color.getHexString().toLowerCase() === activeClassification.color.substring(1).toLowerCase() &&
                  mesh.material.opacity === 0.7 && mesh.material.transparent) {
                  isCorrectMaterial = true;
                  targetMaterial = mesh.material;
                }
              }
              if (!isCorrectMaterial) {
                targetMaterial = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(activeClassification.color),
                  transparent: true, opacity: 0.7, side: THREE.DoubleSide,
                });
              }
            }
          } else {
            if (activeClassification && activeClassification.elements && activeClassification.elements.length > 0) {
              isCurrentlyVisible = false;
              targetMaterial = trueOriginalMaterial;
            } else {
              isCurrentlyVisible = true;
            }
          }
        }

        // Step 3: Apply User Hidden State (high precedence, but selected can override)
        const isUserExplicitlyHidden = userHiddenElements.some(
          (hiddenEl) => hiddenEl.modelID === currentModelID && hiddenEl.expressID === expressID
        );

        if (isUserExplicitlyHidden) {
          isCurrentlyVisible = false;
        }

        // Step 4: Selected Element (highest priority for visibility and material)
        if (selectedElement && selectedElement.modelID === currentModelID && selectedElement.expressID === expressID) {
          targetMaterial = selectionMaterial;
          isCurrentlyVisible = true;
        }

        mesh.visible = isCurrentlyVisible;

        // Apply the determined targetMaterial, with disposal check
        if (mesh.material !== targetMaterial && isCurrentlyVisible) {
          const oldMaterial = mesh.material as THREE.Material;
          if (oldMaterial !== trueOriginalMaterial && !(Array.isArray(trueOriginalMaterial) && trueOriginalMaterial.includes(oldMaterial)) && !Array.isArray(oldMaterial)) {
            if (typeof oldMaterial.dispose === 'function') oldMaterial.dispose();
          }
          mesh.material = targetMaterial;
        } else if (!isCurrentlyVisible && mesh.material !== trueOriginalMaterial) {
          if (mesh.material !== trueOriginalMaterial) {
            const oldMaterial = mesh.material as THREE.Material;
            if (oldMaterial !== trueOriginalMaterial && !(Array.isArray(trueOriginalMaterial) && trueOriginalMaterial.includes(oldMaterial)) && !Array.isArray(oldMaterial)) {
              if (typeof oldMaterial.dispose === 'function') oldMaterial.dispose();
            }
            mesh.material = trueOriginalMaterial;
          }
        }
      }
    });
  }, [
    selectedElement,
    highlightedElements,
    highlightedClassificationCode,
    classifications,
    showAllClassificationColors,
    internalApiIdForEffects,
    ifcApi,
    highlightMaterial,
    selectionMaterial,
    userHiddenElements,
  ]);

  // Renamed to avoid conflict if a global findMeshByExpressID is ever introduced
  const findMeshByExpressIDLocal = (expressID: number): THREE.Mesh | null => {
    if (!meshesRef.current || ownModelID.current === null) return null;
    let foundMesh = null;
    meshesRef.current.traverse((child) => {
      // Ensure mesh belongs to this specific model instance
      if (
        child instanceof THREE.Mesh &&
        child.userData.expressID === expressID &&
        child.userData.modelID === ownModelID.current
      ) {
        foundMesh = child;
      }
    });
    return foundMesh;
  };

  // Fetch properties effect
  useEffect(() => {
    // Define the async function that will perform the property fetching
    const fetchPropertiesForSelectedElement = async () => {
      if (
        !ifcApi ||
        !selectedElement ||
        internalApiIdForEffects === null ||
        selectedElement.modelID !== internalApiIdForEffects
      ) {
        if (!selectedElement) {
          setElementProperties(null);
        }
        setAvailableProperties([]);
        console.log(
          `IFCModel (${modelData.id}) - Property Fetch (Full Approach): Aborting due to missing selection, API, or modelID mismatch.`,
          {
            selectedElementExists: !!selectedElement,
            ifcApiAvailable: !!ifcApi,
            internalApiIdForEffects,
            modelIDMatch: selectedElement
              ? selectedElement.modelID === internalApiIdForEffects
              : "N/A",
          }
        );
        return;
      }

      const { expressID: currentSelectedExpressID } = selectedElement;
      const currentModelID = internalApiIdForEffects;

      console.time(
        `fetchProps-full-${currentSelectedExpressID}-m${currentModelID}`
      );
      console.log(
        `IFCModel (${modelData.id}): Fetching props for element ${currentSelectedExpressID} in model ${currentModelID} (Full Approach)`
      );

      try {
        // Approach 1: Get basic element data (attributes)
        const elementData = await ifcApi.GetLine(
          currentModelID,
          currentSelectedExpressID,
          true
        );
        const elementType = ifcApi.GetNameFromTypeCode(elementData.type);
        console.log(`Element type: ${elementType}`);

        const psetsData: Record<string, Record<string, any>> = {};

        // Add core element attributes to a dedicated section
        psetsData["Element Attributes"] = {};
        for (const key in elementData) {
          if (Object.prototype.hasOwnProperty.call(elementData, key)) {
            if (key === "expressID" || key === "type") continue; // Already displayed or implicit
            const value = elementData[key];
            if (typeof value !== "object" || value === null) {
              psetsData["Element Attributes"][key] = value;
            } else if (value && value.value !== undefined) {
              psetsData["Element Attributes"][key] = value.value;
            }
          }
        }

        // Ensure Properties API is initialized
        if (!ifcApi.properties) {
          console.log("Initializing Properties API for ifcApi (Full Approach)");
          ifcApi.properties = new Properties(ifcApi);
        }

        // Helper to process properties from a PSet object
        const processApiPset = async (
          pset: any,
          targetPSetData: Record<string, any>,
          psetNameForLogging: string
        ) => {
          console.log(
            `    Helper processApiPset for PSet/Object: ${psetNameForLogging}, HasProperties: ${!!(
              pset.HasProperties && Array.isArray(pset.HasProperties)
            )}`
          );
          if (pset.HasProperties && Array.isArray(pset.HasProperties)) {
            console.log(
              `    [${psetNameForLogging}] Found ${pset.HasProperties.length} items in HasProperties. Iterating...`
            );
            for (const propRefOrObject of pset.HasProperties) {
              console.log(
                `      [${psetNameForLogging}] Processing item from HasProperties:`,
                propRefOrObject
                  ? JSON.parse(JSON.stringify(propRefOrObject))
                  : null
              );
              let propToProcess = null;
              let propExpressIDForLog: string = "N/A";
              if (
                propRefOrObject &&
                propRefOrObject.value !== undefined &&
                typeof propRefOrObject.value === "number"
              ) {
                propExpressIDForLog = String(propRefOrObject.value);
                console.log(
                  `        [${psetNameForLogging}] Item is a Property Reference. Fetching IfcProperty (ID: ${propExpressIDForLog})`
                );
                try {
                  propToProcess = await ifcApi.GetLine(
                    currentModelID,
                    propRefOrObject.value,
                    true
                  );
                } catch (e) {
                  console.warn(
                    `        [${psetNameForLogging}] Error fetching IfcProperty (ID: ${propExpressIDForLog}) by reference:`,
                    e
                  );
                  continue;
                }
              } else if (
                propRefOrObject &&
                propRefOrObject.expressID !== undefined &&
                propRefOrObject.Name?.value
              ) {
                propToProcess = propRefOrObject;
                propExpressIDForLog = String(propToProcess.expressID);
                const propType =
                  typeof propToProcess.type === "number"
                    ? ifcApi.GetNameFromTypeCode(propToProcess.type as number)
                    : String(propToProcess.type);
                console.log(
                  `        [${psetNameForLogging}] Item appears to be an embedded IfcProperty object (ID: ${propExpressIDForLog}, Type: ${propType}). Using it directly.`
                );
              } else {
                console.warn(
                  `      [${psetNameForLogging}] Skipping item in HasProperties - neither a valid reference nor a recognized embedded IfcProperty:`,
                  propRefOrObject
                    ? JSON.parse(JSON.stringify(propRefOrObject))
                    : null
                );
                continue;
              }
              if (propToProcess) {
                console.log(
                  `        [${psetNameForLogging}] IfcProperty object to process (ID: ${propExpressIDForLog}):`,
                  propToProcess
                    ? JSON.parse(JSON.stringify(propToProcess))
                    : null
                );
                if (propToProcess.Name?.value) {
                  let propValue: any = "(Complex value)";
                  if (propToProcess.NominalValue?.value !== undefined)
                    propValue = propToProcess.NominalValue.value;
                  else if (propToProcess.Value?.value !== undefined)
                    propValue = propToProcess.Value.value;
                  else if (
                    typeof propToProcess.EnumerationValues?.value !==
                    "undefined"
                  )
                    propValue = propToProcess.EnumerationValues.value;
                  else if (propToProcess.ListValues?.value !== undefined)
                    propValue = propToProcess.ListValues.value;
                  else if (propToProcess.NominalValue === null) {
                    const typeOfPropType = typeof propToProcess.type;
                    if (typeOfPropType === "number")
                      propValue = `(${ifcApi.GetNameFromTypeCode(
                        propToProcess.type as number
                      )})`;
                    else
                      propValue = propToProcess.type
                        ? `(Type is ${typeOfPropType}: ${String(
                          propToProcess.type
                        )})`
                        : `(Unknown Type)`;
                  }
                  targetPSetData[propToProcess.Name.value] = propValue;
                  console.log(
                    `      [${psetNameForLogging}] Successfully processed Property '${propToProcess.Name.value
                    }': ${JSON.stringify(propValue)}`
                  );
                } else {
                  console.warn(
                    `      [${psetNameForLogging}] Fetched/Embedded IfcProperty (ID: ${propExpressIDForLog}) has no Name.value. Data:`,
                    propToProcess
                      ? JSON.parse(JSON.stringify(propToProcess))
                      : null
                  );
                }
              } else {
                console.warn(
                  `      [${psetNameForLogging}] IfcProperty object for ID ${propExpressIDForLog} was null after fetch/assignment.`
                );
              }
            }
          } else {
            console.log(
              `    [${psetNameForLogging}] No HasProperties array found for this PSet/object. Reading direct attributes (if any that are not standard headers).`
            );
            for (const key in pset) {
              if (Object.prototype.hasOwnProperty.call(pset, key)) {
                if (
                  key === "expressID" ||
                  key === "type" ||
                  key === "GlobalId" ||
                  key === "OwnerHistory" ||
                  key === "Name" ||
                  key === "Description" ||
                  key.startsWith("_") ||
                  key === "HasPropertySets" ||
                  key === "HasProperties"
                )
                  continue;
                const value = pset[key];
                if (
                  value &&
                  typeof value === "object" &&
                  value.value !== undefined
                ) {
                  targetPSetData[key] = value.value;
                  console.log(
                    `      [${psetNameForLogging}] Direct Attribute (from PSet object) '${key}': ${value.value}`
                  );
                } else if (typeof value !== "object" && value !== null) {
                  targetPSetData[key] = value;
                  console.log(
                    `      [${psetNameForLogging}] Direct Attribute (from PSet object) '${key}': ${value}`
                  );
                }
              }
            }
          }
        };

        // Approach 2: Get Property Sets (Instance and optionally Type related via API)
        console.log(
          "Approach 2: Fetching with Properties.getPropertySets()..."
        );
        try {
          const psetsFromApi = await ifcApi.properties.getPropertySets(
            currentModelID,
            currentSelectedExpressID,
            true,
            true
          );
          console.log(
            `  Found ${psetsFromApi?.length || 0
            } PSet definitions via getPropertySets()`
          );
          if (psetsFromApi && psetsFromApi.length > 0) {
            for (const pset of psetsFromApi) {
              if (pset && pset.Name?.value) {
                const psetName = pset.Name.value;
                if (!psetsData[psetName]) psetsData[psetName] = {}; // Initialize if new
                console.log(
                  `  Processing PSet from getPropertySets(): ${psetName}`
                );
                await processApiPset(pset, psetsData[psetName], psetName);
              } else {
                console.warn(
                  "  getPropertySets() returned a PSet without Name.value:",
                  pset
                );
              }
            }
          }
        } catch (e) {
          console.error("Error in Approach 2 (getPropertySets()):", e);
        }

        // Approach 3: Extract property data from IsDefinedBy relationships (Instance-specific PSets)
        console.log(
          "Approach 3: Traversing IsDefinedBy relationships for instance-specific PSets..."
        );
        if (elementData.IsDefinedBy && Array.isArray(elementData.IsDefinedBy)) {
          console.log(
            `  Found ${elementData.IsDefinedBy.length} IsDefinedBy relationships for ${elementType} ID: ${currentSelectedExpressID}`
          );
          // Detailed logging for WALL types
          if (elementType.includes("WALL")) {
            console.log(
              `  Detailed log for ${elementType} (ID: ${currentSelectedExpressID}): Processing ${elementData.IsDefinedBy.length} IsDefinedBy relationships...`
            );
            for (const relRef of elementData.IsDefinedBy) {
              if (!relRef || !relRef.value) {
                console.log(
                  `    ${elementType}: Skipping invalid relRef:`,
                  relRef
                );
                continue;
              }
              console.log(
                `    ${elementType}: Checking IsDefinedBy relation expressID: ${relRef.value}`
              );
              try {
                const relationship = await ifcApi.GetLine(
                  currentModelID,
                  relRef.value,
                  false
                );
                console.log(
                  `    ${elementType}: Relationship object for ${relRef.value}:`,
                  relationship ? JSON.parse(JSON.stringify(relationship)) : null
                );
                if (
                  relationship &&
                  relationship.RelatingPropertyDefinition?.value
                ) {
                  const propDefId =
                    relationship.RelatingPropertyDefinition.value;
                  console.log(
                    `    ${elementType}: Found RelatingPropertyDefinition ID: ${propDefId}`
                  );
                  const propDef = await ifcApi.GetLine(
                    currentModelID,
                    propDefId,
                    false
                  );
                  console.log(
                    `    ${elementType}: PropertyDefinition object for ${propDefId}:`,
                    propDef ? JSON.parse(JSON.stringify(propDef)) : null
                  );
                  if (propDef && propDef.Name?.value) {
                    console.log(
                      `    ${elementType}: Successfully identified PSet Name: ${propDef.Name.value} from IsDefinedBy. General loop will process.`
                    );
                  } else {
                    console.log(
                      `    ${elementType}: Could not get PSet Name from PropertyDefinition ID: ${propDefId}`,
                      propDef
                    );
                  }
                } else {
                  console.log(
                    `    ${elementType}: No RelatingPropertyDefinition found or value missing for relationship ${relRef.value}`,
                    relationship
                  );
                }
              } catch (e) {
                console.error(
                  `    ${elementType}: Error processing IsDefinedBy relation expressID ${relRef.value}:`,
                  e
                );
              }
            }
          }
          // General processing for all IsDefinedBy relationships
          for (const relRef of elementData.IsDefinedBy) {
            try {
              if (!relRef || !relRef.value) continue;
              const relationship = await ifcApi.GetLine(
                currentModelID,
                relRef.value,
                false
              );
              if (
                relationship &&
                relationship.RelatingPropertyDefinition?.value
              ) {
                const psetId = relationship.RelatingPropertyDefinition.value;
                const pset = await ifcApi.GetLine(currentModelID, psetId, true); // Fetch full PSet
                if (pset && pset.Name?.value) {
                  const psetName = pset.Name.value;
                  if (!psetsData[psetName]) psetsData[psetName] = {}; // Initialize if new
                  console.log(
                    `  Processing PSet from IsDefinedBy (instance): ${psetName}`
                  );
                  await processApiPset(pset, psetsData[psetName], psetName);
                }
              }
            } catch (e) {
              console.warn(
                `  Error processing IsDefinedBy relationship ${relRef.value}:`,
                e
              );
            }
          }
        } else {
          console.log(
            `  No IsDefinedBy relationships found for element ${currentSelectedExpressID}.`
          );
        }

        // Approach 4: Get Type Properties specifically
        console.log(
          "Approach 4: Fetching with Properties.getTypeProperties()..."
        );
        try {
          const typeObjects = await ifcApi.properties.getTypeProperties(
            currentModelID,
            currentSelectedExpressID,
            true
          );
          console.log(
            `  Found ${typeObjects?.length || 0
            } Type definitions via getTypeProperties()`
          );
          if (typeObjects && typeObjects.length > 0) {
            let mainTypePsetData = psetsData["Type Properties (General)"]; // More specific name
            if (!mainTypePsetData) {
              mainTypePsetData = {};
              psetsData["Type Properties (General)"] = mainTypePsetData;
            }
            for (const typeObject of typeObjects) {
              const typeObjectName =
                typeObject?.Name?.value ||
                `TypeObject_${typeObjects.indexOf(typeObject)}`;
              console.log(`  Processing Type Object: ${typeObjectName}`);
              if (
                typeObject.HasPropertySets &&
                Array.isArray(typeObject.HasPropertySets)
              ) {
                console.log(
                  `    Type Object ${typeObjectName} has ${typeObject.HasPropertySets.length} PSet references/objects.`
                );
                for (const typePsetRefOrObject of typeObject.HasPropertySets) {
                  console.log(
                    `      Processing item from Type's HasPropertySets:`,
                    typePsetRefOrObject
                      ? JSON.parse(JSON.stringify(typePsetRefOrObject))
                      : null
                  );
                  let psetObjectToProcess = null;
                  let psetExpressIDForLog: string = "N/A";
                  let psetExpressIDToFetch: number | null = null;
                  if (
                    typePsetRefOrObject &&
                    typePsetRefOrObject.value !== undefined &&
                    typeof typePsetRefOrObject.value === "number"
                  ) {
                    psetExpressIDToFetch = typePsetRefOrObject.value;
                    psetExpressIDForLog = String(typePsetRefOrObject.value);
                    console.log(
                      `        Item is a PSet Reference. Fetching PSet with expressID: ${psetExpressIDToFetch} (referenced by Type ${typeObjectName})`
                    );
                    try {
                      if (psetExpressIDToFetch !== null) {
                        psetObjectToProcess = await ifcApi.GetLine(
                          currentModelID,
                          psetExpressIDToFetch,
                          true
                        );
                      } else {
                        console.warn(
                          `        Cannot fetch PSet: psetExpressIDToFetch is null for a reference from Type ${typeObjectName}`
                        );
                      }
                    } catch (e) {
                      console.warn(
                        `        Error fetching PSet (ID: ${psetExpressIDToFetch}) referenced by Type ${typeObjectName}:`,
                        e
                      );
                      continue;
                    }
                  } else if (
                    typePsetRefOrObject &&
                    typePsetRefOrObject.expressID !== undefined &&
                    typeof typePsetRefOrObject.type === "number" &&
                    ifcApi
                      .GetNameFromTypeCode(typePsetRefOrObject.type)
                      .toUpperCase()
                      .includes("PROPERTYSET")
                  ) {
                    psetObjectToProcess = typePsetRefOrObject;
                    psetExpressIDToFetch = psetObjectToProcess.expressID;
                    psetExpressIDForLog = String(psetObjectToProcess.expressID);
                    const typeCode = psetObjectToProcess.type;
                    const typeNameForLog = ifcApi.GetNameFromTypeCode(typeCode);
                    console.log(
                      `        Item appears to be an embedded PSet object (ID: ${psetExpressIDForLog}, Type: ${typeNameForLog}). Using it directly.`
                    );
                  } else {
                    console.warn(
                      `        Skipping item in HasPropertySets from Type ${typeObjectName} - neither a valid reference nor a recognized embedded PSet:`,
                      typePsetRefOrObject
                        ? JSON.parse(JSON.stringify(typePsetRefOrObject))
                        : null
                    );
                    continue;
                  }
                  if (psetObjectToProcess) {
                    if (
                      psetExpressIDForLog === "N/A" &&
                      psetObjectToProcess.expressID
                    )
                      psetExpressIDForLog = String(
                        psetObjectToProcess.expressID
                      );
                    console.log(
                      `        PSet object to process (ID: ${psetExpressIDForLog}):`,
                      psetObjectToProcess
                        ? JSON.parse(JSON.stringify(psetObjectToProcess))
                        : null
                    );
                    if (psetObjectToProcess.Name?.value) {
                      const typePsetName = `${psetObjectToProcess.Name.value} (from Type: ${typeObjectName})`;
                      if (!psetsData[typePsetName])
                        psetsData[typePsetName] = {};
                      console.log(
                        `    Successfully identified PSet from Type: ${typePsetName}. Processing its properties...`
                      );
                      await processApiPset(
                        psetObjectToProcess,
                        psetsData[typePsetName],
                        typePsetName
                      );
                    } else {
                      console.warn(
                        `    Fetched/Embedded PSet (ID: ${psetExpressIDForLog}) from Type ${typeObjectName} has no Name.value. PSet data:`,
                        psetObjectToProcess
                          ? JSON.parse(JSON.stringify(psetObjectToProcess))
                          : null
                      );
                    }
                  } else {
                    const idForLog =
                      psetExpressIDToFetch !== null
                        ? psetExpressIDToFetch
                        : psetExpressIDForLog;
                    console.warn(
                      `    PSet object for ID ${idForLog} (from Type ${typeObjectName}) was null after fetch/assignment.`
                    );
                  }
                }
              } else {
                console.log(
                  `    Type Object ${typeObjectName} has no 'HasPropertySets' array or it's empty.`
                );
              }
              console.log(
                `    Processing direct attributes of Type Object ${typeObjectName} into main 'Type Properties (General)' PSet group.`
              );
              await processApiPset(
                typeObject,
                mainTypePsetData,
                `Direct attributes of ${typeObjectName}`
              );
            }
          }
        } catch (e) {
          console.error("Error in Approach 4 (getTypeProperties()):", e);
        }

        // Approach 5: Get Material Properties specifically
        console.log(
          "Approach 5: Fetching with Properties.getMaterialsProperties()..."
        );
        try {
          const materials = await ifcApi.properties.getMaterialsProperties(
            currentModelID,
            currentSelectedExpressID,
            true,
            true
          );
          console.log(
            `  Found ${materials?.length || 0
            } Material definitions via getMaterialsProperties()`
          );
          if (materials && materials.length > 0) {
            for (const material of materials) {
              if (material && material.Name?.value) {
                const materialPsetName = `Material: ${material.Name.value}`;
                console.log(`  Processing ${materialPsetName}`);
                if (!psetsData[materialPsetName])
                  psetsData[materialPsetName] = {};
                await processApiPset(
                  material,
                  psetsData[materialPsetName],
                  materialPsetName
                );
              }
            }
          }
        } catch (e) {
          console.error("Error in Approach 5 (getMaterialsProperties()):", e);
        }

        // Approach 6: Deep Property Search (if still minimal data)
        console.log("Evaluating for Approach 6 (Deep Search)...");
        const psetKeys = Object.keys(psetsData);
        const foundSpecificPsetsOrData = psetKeys.some(
          (key) =>
            key.startsWith("Pset_") || // Check for actual PSets found by name
            (psetsData[key] &&
              Object.keys(psetsData[key]).length > 0 &&
              key !== "Element Attributes") // Or any other category that got populated
        );

        if (
          !foundSpecificPsetsOrData &&
          psetKeys.includes("Element Attributes")
        ) {
          // Only run if mostly just attributes were found
          console.log(
            "Approach 6: Performing deep property search as direct methods found no specific PSet categories or limited data..."
          );
          try {
            const allPsets = await ifcApi.properties.getPropertySets(
              currentModelID,
              0,
              false
            );
            if (allPsets && allPsets.length > 0) {
              console.log(
                `  Deep Search: Searching through ${allPsets.length} total model property sets for element type ${elementType}`
              );
              for (const pset of allPsets) {
                if (!pset || !pset.Name?.value || psetsData[pset.Name.value])
                  continue; // Skip if no name or already processed
                let isRelevant = false;
                const psetNameUpper = pset.Name.value.toUpperCase();
                const elementTypeClean = elementType
                  .replace("IFC", "")
                  .toUpperCase();
                if (psetNameUpper.includes(elementTypeClean)) {
                  isRelevant = true;
                  console.log(
                    `    Deep Search: Found relevant PSet by type match: ${pset.Name.value}`
                  );
                } else if (
                  (elementType === "IFCSLAB" &&
                    psetNameUpper === "PSET_SLABCOMMON") ||
                  (elementType.includes("WALL") &&
                    psetNameUpper === "PSET_WALLCOMMON")
                ) {
                  isRelevant = true;
                  console.log(
                    `    Deep Search: Found relevant PSet by specific common match: ${pset.Name.value}`
                  );
                }
                if (isRelevant) {
                  if (!psetsData[pset.Name.value])
                    psetsData[pset.Name.value] = {};
                  console.log(
                    `    Deep Search: Processing PSet ${pset.Name.value}`
                  );
                  await processApiPset(
                    pset,
                    psetsData[pset.Name.value],
                    pset.Name.value
                  );
                }
              }
            }
          } catch (e) {
            console.warn("Error during Approach 6 (Deep Search):", e);
          }
        } else {
          console.log(
            "Skipping Approach 6 (Deep Search) as sufficient specific data was likely found by other approaches."
          );
        }

        const allProperties = {
          modelID: currentModelID,
          expressID: currentSelectedExpressID,
          ifcType: elementType,
          attributes: elementData, // This remains the direct attributes from GetLine
          propertySets: psetsData,
        };

        const collectedProps = new Set<string>();
        collectedProps.add("ifcType");
        for (const groupName of Object.keys(psetsData)) {
          const group = psetsData[groupName];
          for (const key in group) {
            if (Object.prototype.hasOwnProperty.call(group, key)) {
              const full = groupName === "Element Attributes" ? key : `${groupName}.${key}`;
              collectedProps.add(full);
            }
          }
        }
        setAvailableProperties(Array.from(collectedProps).sort());

        setElementProperties(allProperties);
        console.log(
          `IFCModel (${modelData.id}): Properties set (Full Approach) for ${currentSelectedExpressID}`,
          allProperties
        );
      } catch (error) {
        console.error(
          `IFCModel (${modelData.id}): Error fetching props (Full Approach) for ${currentSelectedExpressID}:`,
          error
        );
        setElementProperties(null);
        setAvailableProperties([]);
      }
      console.timeEnd(
        `fetchProps-full-${currentSelectedExpressID}-m${currentModelID}`
      );
    };

    fetchPropertiesForSelectedElement();
  }, [
    selectedElement,
    ifcApi,
    internalApiIdForEffects,
    setElementProperties,
    modelData.id,
  ]);

  return isLoading ? (
    <>{/* Optionally return a per-model loader here */}</>
  ) : null;
}
