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

// New helper function to recursively extract property values, handling complex properties (Restored)
async function extractPropertyValueRecursive(
  ifcApi: IfcAPI,
  modelID: number,
  propertyEntity: any, // This is an IfcProperty (Simple, Complex, etc.)
  targetObject: Record<string, any>,
  namePrefix: string = "",
  logContext: string, // For detailed logging, pass psetName or similar
  processedCache: Map<number, any>,
  recursionPath: Set<number>
) {
  if (!propertyEntity || !propertyEntity.Name?.value) {
    // console.warn(
    //   `[${logContext}] Skipping property in extractPropertyValueRecursive: No entity or Name.value. Entity:`,
    //   propertyEntity ? JSON.parse(JSON.stringify(propertyEntity)) : null
    // );
    return;
  }

  const propExpressID = propertyEntity.expressID;

  if (propExpressID !== undefined) {
    if (recursionPath.has(propExpressID)) {
      console.warn(
        `[${logContext}] Cycle detected for property expressID: ${propExpressID}. Prefix: ${namePrefix}, Name: ${propertyEntity.Name.value}`
      );
      targetObject[
        namePrefix
          ? `${namePrefix}.${propertyEntity.Name.value}`
          : propertyEntity.Name.value
      ] = "[Cycle Detected]";
      return;
    }
    if (processedCache.has(propExpressID)) {
      // If a property structure was already processed, reuse it.
      // This is more relevant if properties can be shared across different PSets or complex props.
      // For now, we'll assume if it's in cache, its specific value within the current parent was handled.
      // A more sophisticated cache might store the *resolved value* for a given parent context.
      // For simplicity, if seen, we assume it's been handled at its first encounter for this recursive path.
      // This primarily prevents re-processing of the same IfcProperty object if it appears multiple times
      // *within the same higher-level PSet processing operation*.
      // The value might need to be added to targetObject based on the cache,
      // but the current structure adds directly to targetObject upon resolution.
      // Let's add a log to see if this cache hit is useful or needs refinement.
      console.log(
        `[${logContext}] Cache hit for property expressID: ${propExpressID}. Prefix: ${namePrefix}, Name: ${propertyEntity.Name.value}. Value was:`,
        processedCache.get(propExpressID)
      );
      // If we cache the final resolved value, we could assign it here:
      // targetObject[namePrefix ? `${namePrefix}.${propertyEntity.Name.value}` : propertyEntity.Name.value] = processedCache.get(propExpressID);
      // However, the current logic adds to targetObject at the end of processing.
      // The main benefit here is avoiding re-parsing the *structure* of the cached property.
      // For now, let's return to avoid re-processing, assuming the first processing populated targetObject correctly.
      return;
    }
    recursionPath.add(propExpressID);
  }

  const propName = propertyEntity.Name.value;
  const fullPropName = namePrefix ? `${namePrefix}.${propName}` : propName;
  const propIfcType =
    typeof propertyEntity.type === "number"
      ? ifcApi.GetNameFromTypeCode(propertyEntity.type)
      : String(propertyEntity.type);

  if (propIfcType === "IFCCOMPLEXPROPERTY") {
    if (
      propertyEntity.HasProperties &&
      Array.isArray(propertyEntity.HasProperties)
    ) {
      for (const subPropRefOrObject of propertyEntity.HasProperties) {
        let subPropertyEntity = null;
        let subPropIdForLog = "N/A (embedded)";
        if (
          subPropRefOrObject?.value !== undefined &&
          typeof subPropRefOrObject.value === "number"
        ) {
          subPropIdForLog = String(subPropRefOrObject.value);
          try {
            subPropertyEntity = await ifcApi.GetLine(
              modelID,
              subPropRefOrObject.value,
              true
            );
          } catch (e) {
            console.warn(
              `      [${logContext}] Error fetching sub-property (ID: ${subPropIdForLog}) for complex property '${fullPropName}':`,
              e
            );
            continue;
          }
        } else if (
          subPropRefOrObject?.expressID !== undefined &&
          subPropRefOrObject.Name?.value
        ) {
          subPropertyEntity = subPropRefOrObject;
          subPropIdForLog =
            subPropRefOrObject.expressID !== undefined
              ? String(subPropRefOrObject.expressID)
              : "N/A (embedded no expressID)";
        } else {
          console.warn(
            `      [${logContext}] Skipping item in HasProperties of '${fullPropName}' - not valid ref or embedded prop:`,
            subPropRefOrObject
          );
          continue;
        }
        if (subPropertyEntity) {
          await extractPropertyValueRecursive(
            ifcApi,
            modelID,
            subPropertyEntity,
            targetObject,
            fullPropName,
            logContext,
            processedCache,
            recursionPath
          );
        } else {
          console.warn(
            `      [${logContext}] Sub-property (ID: ${subPropIdForLog}) for '${fullPropName}' resolved to null.`
          );
        }
      }
    }
  } else {
    let extractedValue: any = `(Unhandled ${propIfcType})`;
    const unit = propertyEntity.Unit?.value;

    if (propertyEntity.NominalValue?.value !== undefined) {
      extractedValue = propertyEntity.NominalValue.value;
      if (unit) {
        extractedValue = { value: extractedValue, unit: unit };
      }
    } else if (propertyEntity.Value?.value !== undefined) {
      extractedValue = propertyEntity.Value.value;
      if (unit) {
        extractedValue = { value: extractedValue, unit: unit };
      }
    } else if (
      propertyEntity.ListValues?.value !== undefined &&
      Array.isArray(propertyEntity.ListValues.value)
    ) {
      const listVals = propertyEntity.ListValues.value.map((item: any) =>
        item.value !== undefined ? item.value : item
      );
      if (unit) {
        extractedValue = { values: listVals, unit: unit };
      } else {
        extractedValue = listVals;
      }
    } else if (
      propertyEntity.EnumerationValues?.value !== undefined &&
      Array.isArray(propertyEntity.EnumerationValues.value)
    ) {
      const enumVals = propertyEntity.EnumerationValues.value.map((item: any) =>
        item.value !== undefined ? item.value : item
      );
      if (unit) {
        extractedValue = { values: enumVals, unit: unit };
      } else {
        extractedValue = enumVals;
      }
    } else if (
      propertyEntity.LowerBoundValue?.value !== undefined ||
      propertyEntity.UpperBoundValue?.value !== undefined
    ) {
      extractedValue = {};
      if (propertyEntity.LowerBoundValue?.value !== undefined)
        extractedValue.LowerBound = propertyEntity.LowerBoundValue.value;
      if (propertyEntity.UpperBoundValue?.value !== undefined)
        extractedValue.UpperBound = propertyEntity.UpperBoundValue.value;
      // Unit is already handled here if present with Lower/Upper bounds.
      if (unit) extractedValue.Unit = unit;
    } else if (propertyEntity.NominalValue === null) {
      // NominalValue is explicitly null, not just undefined
      extractedValue = `(${ifcApi.GetNameFromTypeCode(
        propertyEntity.type as number
      )})`;
      // It's unlikely to have a unit if the value itself is null, but to be safe:
      // if (unit) {
      //   extractedValue = { value: extractedValue, unit: unit };
      // }
      // Decided against adding unit here as it's less common for a null value to have a unit.
    }
    targetObject[fullPropName] = extractedValue;
  }

  if (propExpressID !== undefined) {
    // Cache the fact that this property entity was processed.
    // We could cache the `extractedValue` if it makes sense, or just a marker.
    // For complex properties, `extractedValue` isn't a single thing.
    // Caching `true` marks it as "visited and processed its structure".
    processedCache.set(propExpressID, true); // Mark as processed
    recursionPath.delete(propExpressID);
  }
}

// Helper function to extract direct, simple attributes from an IFC entity object
function extractDirectAttributes(
  entity: any,
  targetObject: Record<string, any>,
  // Pre-defined list of common IFC entity attributes that are usually not displayed as simple properties
  // or are handled elsewhere (like Name, Description for the main entity group title).
  excludedKeys: string[] = [
    "expressID",
    "type",
    "GlobalId",
    "OwnerHistory",
    // "Name", "Description", // Keep Name/Description if they aren't used for the group title itself
    "HasPropertySets",
    "HasProperties",
    "HasAssociations",
    "DefiningValues",
    "RepresentationMaps",
    "IsRelatedWith",
    "RelatesProperties",
    "MaterialLayers",
    "Materials",
    "ApplicableOccurrence",
    "ObjectPlacement",
    "Representation", // Often complex and handled by geometry system
  ]
) {
  for (const key in entity) {
    if (Object.prototype.hasOwnProperty.call(entity, key)) {
      if (key.startsWith("_") || excludedKeys.includes(key)) {
        continue;
      }
      const attributeValue = entity[key];
      if (attributeValue === null) {
        targetObject[key] = null;
      } else if (
        attributeValue?.value !== undefined &&
        typeof attributeValue.type === "number"
      ) {
        // Handles IFC's wrapped values like { value: X, type: Y (number) }
        targetObject[key] = attributeValue.value;
      } else if (typeof attributeValue !== "object") {
        // Handles primitive values directly on the entity
        targetObject[key] = attributeValue;
      } else if (
        attributeValue?.value !== undefined &&
        attributeValue.type === undefined
      ) {
        // Handles cases where .value is present but .type might be missing (e.g. from complex prop resolutions)
        targetObject[key] = attributeValue.value;
      }
      // Not attempting to stringify complex objects here to avoid overly verbose/unreadable output.
      // Specific handlers for known complex attribute structures would be needed if they should be displayed.
    }
  }
}

export function IFCModel({ modelData, outlineLayer }: IFCModelProps) {
  const { scene, camera, controls } = useThree(); // Get controls directly
  const ownModelID = useRef<number | null>(null);
  const meshesRef = useRef<THREE.Group | null>(null);
  const modelTransformRef = useRef<THREE.Matrix4>(new THREE.Matrix4());

  const {
    ifcApi,
    setSpatialTreeForModel,
    setElementProperties,
    selectedElement,
    highlightedElements,
    highlightedClassificationCode,
    setModelIDForLoadedModel,
    setAvailableCategoriesForModel,
    classifications,
    showAllClassificationColors,
    userHiddenElements,
    setRawBufferForModel,
    baseCoordinationMatrix,
    setBaseCoordinationMatrix,
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
      group.applyMatrix4(modelTransformRef.current);
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
        // Keep original global coordinates so multiple models align correctly
        const settings = { COORDINATE_TO_ORIGIN: false, USE_FAST_BOOLS: true };

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

        const modelCoordMatrix = ifcApi.GetCoordinationMatrix(newIfcModelID);
        let relativeMatrix = new THREE.Matrix4();
        if (!baseCoordinationMatrix) {
          setBaseCoordinationMatrix(modelCoordMatrix);
          relativeMatrix.identity();
        } else {
          const baseMat = new THREE.Matrix4().fromArray(baseCoordinationMatrix);
          const currentMat = new THREE.Matrix4().fromArray(modelCoordMatrix);
          const baseInv = baseMat.clone().invert();
          relativeMatrix.multiplyMatrices(baseInv, currentMat);
        }
        modelTransformRef.current.copy(relativeMatrix);
        ifcApi.SetGeometryTransformation(newIfcModelID, Array.from(relativeMatrix.elements));

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
        let targetMaterial: THREE.Material | THREE.Material[] =
          trueOriginalMaterial;
        let isCurrentlyVisible = true;

        // Step 1: Apply "Show All Classification Colors" if active
        if (showAllClassificationColors) {
          let elementClassificationColor: string | null = null;
          for (const classification of Object.values(
            classifications as Record<string, any>
          )) {
            const isInClassification = classification.elements?.some(
              (el: SelectedElementInfo) =>
                el &&
                el.modelID === currentModelID &&
                el.expressID === expressID
            );
            if (isInClassification) {
              elementClassificationColor = classification.color || "#808080";
              break;
            }
          }
          if (elementClassificationColor) {
            let isCorrectMaterial = false;
            if (mesh.material instanceof THREE.MeshStandardMaterial) {
              if (
                mesh.material.color.getHexString().toLowerCase() ===
                  elementClassificationColor.substring(1).toLowerCase() &&
                mesh.material.opacity === 0.9 &&
                mesh.material.transparent
              ) {
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
          const activeClassification =
            classifications[highlightedClassificationCode];
          const isElementInActiveClassification =
            activeClassification?.elements?.some(
              (el: SelectedElementInfo) =>
                el &&
                el.modelID === currentModelID &&
                el.expressID === expressID
            );

          if (isElementInActiveClassification) {
            isCurrentlyVisible = true;
            if (activeClassification && activeClassification.color) {
              let isCorrectMaterial = false;
              if (mesh.material instanceof THREE.MeshStandardMaterial) {
                if (
                  mesh.material.color.getHexString().toLowerCase() ===
                    activeClassification.color.substring(1).toLowerCase() &&
                  mesh.material.opacity === 0.7 &&
                  mesh.material.transparent
                ) {
                  isCorrectMaterial = true;
                  targetMaterial = mesh.material;
                }
              }
              if (!isCorrectMaterial) {
                targetMaterial = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(activeClassification.color),
                  transparent: true,
                  opacity: 0.7,
                  side: THREE.DoubleSide,
                });
              }
            }
          } else {
            if (
              activeClassification &&
              activeClassification.elements &&
              activeClassification.elements.length > 0
            ) {
              isCurrentlyVisible = false;
              targetMaterial = trueOriginalMaterial;
            } else {
              isCurrentlyVisible = true;
            }
          }
        }

        // Step 3: Apply User Hidden State (high precedence, but selected can override)
        const isUserExplicitlyHidden = userHiddenElements.some(
          (hiddenEl) =>
            hiddenEl.modelID === currentModelID &&
            hiddenEl.expressID === expressID
        );

        if (isUserExplicitlyHidden) {
          isCurrentlyVisible = false;
        }

        // Step 4: Selected Element (highest priority for visibility and material)
        if (
          selectedElement &&
          selectedElement.modelID === currentModelID &&
          selectedElement.expressID === expressID
        ) {
          targetMaterial = selectionMaterial;
          isCurrentlyVisible = true;
        }

        mesh.visible = isCurrentlyVisible;

        // Apply the determined targetMaterial, with disposal check
        if (mesh.material !== targetMaterial && isCurrentlyVisible) {
          const oldMaterial = mesh.material as THREE.Material;
          if (
            oldMaterial !== trueOriginalMaterial &&
            !(
              Array.isArray(trueOriginalMaterial) &&
              trueOriginalMaterial.includes(oldMaterial)
            ) &&
            !Array.isArray(oldMaterial)
          ) {
            if (typeof oldMaterial.dispose === "function")
              oldMaterial.dispose();
          }
          mesh.material = targetMaterial;
        } else if (
          !isCurrentlyVisible &&
          mesh.material !== trueOriginalMaterial
        ) {
          if (mesh.material !== trueOriginalMaterial) {
            const oldMaterial = mesh.material as THREE.Material;
            if (
              oldMaterial !== trueOriginalMaterial &&
              !(
                Array.isArray(trueOriginalMaterial) &&
                trueOriginalMaterial.includes(oldMaterial)
              ) &&
              !Array.isArray(oldMaterial)
            ) {
              if (typeof oldMaterial.dispose === "function")
                oldMaterial.dispose();
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
        // Ensure Properties API is initialized
        if (!ifcApi.properties) {
          console.log(
            "Initializing Properties API (fetchPropertiesForSelectedElement)"
          );
          ifcApi.properties = new Properties(ifcApi);
        }

        // Helper to process IFCPROPERTYSET entities (uses extractPropertyValueRecursive)
        const processApiPset = async (
          psetEntity: any, // This must be an IFCPROPERTYSET entity
          targetPSetData: Record<string, any>,
          psetNameForLogging: string
        ) => {
          if (
            psetEntity.HasProperties &&
            Array.isArray(psetEntity.HasProperties)
          ) {
            const processedCache = new Map<number, any>();
            const recursionPath = new Set<number>();
            for (const propRefOrObject of psetEntity.HasProperties) {
              let propToProcess = null;
              if (
                propRefOrObject?.value !== undefined &&
                typeof propRefOrObject.value === "number"
              ) {
                try {
                  propToProcess = await ifcApi.GetLine(
                    currentModelID,
                    propRefOrObject.value,
                    true
                  );
                } catch (e) {
                  console.warn(
                    `[${psetNameForLogging}] Error fetching IfcProperty by reference (ID: ${propRefOrObject.value}):`,
                    e
                  );
                  continue;
                }
              } else if (
                propRefOrObject?.expressID !== undefined &&
                propRefOrObject.Name?.value
              ) {
                propToProcess = propRefOrObject; // Embedded IfcProperty
              } else {
                console.warn(
                  `[${psetNameForLogging}] Skipping item in HasProperties - not a valid reference or embedded IfcProperty:`,
                  propRefOrObject
                );
                continue;
              }
              if (propToProcess) {
                await extractPropertyValueRecursive(
                  ifcApi,
                  currentModelID,
                  propToProcess,
                  targetPSetData,
                  "",
                  psetNameForLogging,
                  processedCache,
                  recursionPath
                );
              }
            }
          }
        };

        // --- Step A: Get Basic Element Attributes ---
        const elementData = await ifcApi.GetLine(
          currentModelID,
          currentSelectedExpressID,
          true
        );
        const elementType = ifcApi.GetNameFromTypeCode(elementData.type);
        console.log(`Element type: ${elementType}`);
        const psetsData: Record<string, Record<string, any>> = {};
        psetsData["Element Attributes"] = {};
        for (const key in elementData) {
          if (Object.prototype.hasOwnProperty.call(elementData, key)) {
            if (key === "expressID" || key === "type") continue;
            const value = elementData[key];
            if (typeof value !== "object" || value === null)
              psetsData["Element Attributes"][key] = value;
            else if (value && value.value !== undefined)
              psetsData["Element Attributes"][key] = value.value;
          }
        }

        // --- Step B: Get Instance PropertySets ---
        console.log(
          "Step B: Fetching Instance Properties.getPropertySets(inclType=false)..."
        );
        try {
          const instancePsets = await ifcApi.properties.getPropertySets(
            currentModelID,
            currentSelectedExpressID,
            true,
            false
          );
          console.log(
            `  Found ${instancePsets?.length || 0} instance PSet definitions.`
          );
          if (instancePsets && instancePsets.length > 0) {
            for (const pset of instancePsets) {
              if (
                pset &&
                pset.Name?.value &&
                ifcApi.GetNameFromTypeCode(pset.type) === "IFCPROPERTYSET"
              ) {
                const psetName = pset.Name.value;
                if (!psetsData[psetName]) psetsData[psetName] = {};
                console.log(
                  `  Processing Instance IFCPROPERTYSET: ${psetName}`
                );
                await processApiPset(pset, psetsData[psetName], psetName);
              }
            }
          }
        } catch (e) {
          console.error("Error in Step B (Instance getPropertySets()):", e);
        }

        // --- Step C: Get Type Information & Associated Property Definitions ---
        console.log(
          "Step C: Fetching Type Info & Props with Properties.getTypeProperties()..."
        );
        try {
          const typeObjects = await ifcApi.properties.getTypeProperties(
            currentModelID,
            currentSelectedExpressID,
            true
          );
          console.log(`  Found ${typeObjects?.length || 0} Type definitions.`);
          if (typeObjects && typeObjects.length > 0) {
            for (const typeObject of typeObjects) {
              const typeObjectName =
                typeObject?.Name?.value ||
                `TypeObject_${
                  typeObject.expressID || typeObjects.indexOf(typeObject)
                }`;
              const typeAttributesPSetName = `Type Attributes: ${typeObjectName}`;
              if (!psetsData[typeAttributesPSetName])
                psetsData[typeAttributesPSetName] = {};
              console.log(
                `  Processing Type Object's direct attributes: ${typeObjectName}`
              );
              // Extract direct attributes of the Type Object itself
              extractDirectAttributes(
                typeObject,
                psetsData[typeAttributesPSetName],
                ["Name", "Description"]
              ); // Name/Desc used for group
              if (Object.keys(psetsData[typeAttributesPSetName]).length === 0)
                delete psetsData[typeAttributesPSetName];

              if (
                typeObject.HasPropertySets &&
                Array.isArray(typeObject.HasPropertySets)
              ) {
                console.log(
                  `    Type ${typeObjectName} has ${typeObject.HasPropertySets.length} associated property definition entities.`
                );
                for (const propDefRefOrObject of typeObject.HasPropertySets) {
                  let propDefEntity = null;
                  if (
                    propDefRefOrObject?.value !== undefined &&
                    typeof propDefRefOrObject.value === "number"
                  ) {
                    try {
                      propDefEntity = await ifcApi.GetLine(
                        currentModelID,
                        propDefRefOrObject.value,
                        true
                      );
                    } catch (e) {
                      console.warn(
                        `Error fetching entity (ID: ${propDefRefOrObject.value}) for Type ${typeObjectName}:`,
                        e
                      );
                      continue;
                    }
                  } else if (propDefRefOrObject?.expressID !== undefined) {
                    propDefEntity = propDefRefOrObject;
                  } else {
                    // If it's not a reference and not an embedded object with an expressID, skip it.
                    console.warn(
                      `    Skipping item in Type ${typeObjectName}'s HasPropertySets - not a valid reference or recognized embedded entity:`,
                      propDefRefOrObject
                    );
                    continue;
                  }

                  if (propDefEntity) {
                    const propDefEntityType = ifcApi.GetNameFromTypeCode(
                      propDefEntity.type
                    );
                    const propDefInstanceName = propDefEntity.Name?.value;

                    if (propDefEntityType === "IFCPROPERTYSET") {
                      const psetName = propDefInstanceName || "Unnamed PSet";
                      const finalPsetName = `${psetName} (from Type: ${typeObjectName})`;
                      if (!psetsData[finalPsetName])
                        psetsData[finalPsetName] = {};
                      console.log(
                        `    Processing IFCPROPERTYSET from Type ${typeObjectName}: ${psetName}`
                      );
                      await processApiPset(
                        propDefEntity,
                        psetsData[finalPsetName],
                        finalPsetName
                      );
                    } else if (propDefEntityType) {
                      // Handle other definitional entities
                      const groupNameSuggestion =
                        propDefInstanceName || propDefEntityType;
                      const groupName = `${groupNameSuggestion} (from Type: ${typeObjectName})`;
                      if (!psetsData[groupName]) psetsData[groupName] = {};
                      console.log(
                        `    Processing Entity ${groupNameSuggestion} (Type: ${propDefEntityType}) from Type ${typeObjectName} as property group`
                      );
                      // Extract direct attributes from this definitional entity
                      extractDirectAttributes(
                        propDefEntity,
                        psetsData[groupName]
                      );
                      if (Object.keys(psetsData[groupName]).length === 0)
                        delete psetsData[groupName];
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("Error in Step C (Type Properties & Psets):", e);
        }

        // --- Step D: Get Material Properties ---
        console.log(
          "Step D: Fetching Material Props with Properties.getMaterialsProperties()..."
        );
        try {
          const materialsAndDefs =
            await ifcApi.properties.getMaterialsProperties(
              currentModelID,
              currentSelectedExpressID,
              true,
              true
            );
          console.log(
            `  Found ${
              materialsAndDefs?.length || 0
            } Material definitions/associations.`
          );

          if (materialsAndDefs && materialsAndDefs.length > 0) {
            for (const matDef of materialsAndDefs) {
              const matDefType = ifcApi.GetNameFromTypeCode(matDef.type);
              const matDefNameFromIFC = matDef.Name?.value;

              if (matDefType === "IFCMATERIALPROPERTIES") {
                const psetName = matDefNameFromIFC || "Material Properties";
                const finalGroupName = `Material Properties: ${psetName}`;
                if (!psetsData[finalGroupName]) psetsData[finalGroupName] = {};
                console.log(`  Processing IFCMATERIALPROPERTIES: ${psetName}`);
                await processApiPset(
                  matDef,
                  psetsData[finalGroupName],
                  finalGroupName
                );
                if (Object.keys(psetsData[finalGroupName]).length === 0)
                  delete psetsData[finalGroupName];
              } else if (matDefType === "IFCMATERIAL") {
                const materialName =
                  matDefNameFromIFC || `Material_${matDef.expressID}`;
                const materialGroupName = `Material: ${materialName}`;
                if (!psetsData[materialGroupName])
                  psetsData[materialGroupName] = {};
                console.log(`  Processing IFCMATERIAL: ${materialName}`);
                // Extract direct attributes of IfcMaterial itself
                extractDirectAttributes(matDef, psetsData[materialGroupName], [
                  "Name",
                  "Description",
                ]);
                if (Object.keys(psetsData[materialGroupName]).length === 0)
                  delete psetsData[materialGroupName];
              } else if (matDefType === "IFCMATERIALLAYERSET") {
                const layerSetName =
                  matDefNameFromIFC || `MatLayerSet_${matDef.expressID}`;
                const layerSetGroupName = `LayerSet: ${layerSetName}`;
                if (!psetsData[layerSetGroupName])
                  psetsData[layerSetGroupName] = {};
                console.log(
                  `  Processing IFCMATERIALLAYERSET: ${layerSetName}`
                );
                if (matDef.TotalThickness?.value !== undefined) {
                  psetsData[layerSetGroupName]["TotalThickness"] =
                    matDef.TotalThickness.value;
                }
                if (
                  matDef.MaterialLayers &&
                  Array.isArray(matDef.MaterialLayers)
                ) {
                  console.log(
                    `    ${layerSetName} has ${matDef.MaterialLayers.length} layers.`
                  );
                  for (const [
                    index,
                    layerEntity,
                  ] of matDef.MaterialLayers.entries()) {
                    const layerNumber = index + 1;
                    let layerPrefix = `Layer_${layerNumber}`;
                    try {
                      if (
                        !layerEntity ||
                        typeof layerEntity.expressID !== "number"
                      ) {
                        console.warn(
                          `    [${layerSetName}] Invalid IfcMaterialLayer object at index ${index}:`,
                          layerEntity
                        );
                        continue;
                      }

                      if (layerEntity.Name?.value) {
                        psetsData[layerSetGroupName][
                          `${layerPrefix}_Identifier`
                        ] = layerEntity.Name.value;
                      }

                      let layerMaterialName = `Material_Unknown`;
                      const directMaterialEntity = layerEntity.Material; // This is often the resolved IfcMaterial entity

                      if (
                        directMaterialEntity &&
                        typeof directMaterialEntity.expressID === "number"
                      ) {
                        // Assuming directMaterialEntity is the IfcMaterial object itself
                        layerMaterialName =
                          directMaterialEntity.Name?.value ||
                          `UnnamedMaterial_${directMaterialEntity.expressID}`;
                      } else if (
                        directMaterialEntity &&
                        typeof directMaterialEntity.value === "number"
                      ) {
                        // Fallback if Material is still a reference { value: X }
                        console.warn(
                          `    [${layerSetName}] ${layerPrefix} Material is a reference, attempting to resolve:`,
                          directMaterialEntity
                        );
                        try {
                          const actualLayerMaterial = await ifcApi.GetLine(
                            currentModelID,
                            directMaterialEntity.value,
                            true
                          );
                          if (actualLayerMaterial) {
                            layerMaterialName =
                              actualLayerMaterial.Name?.value ||
                              `UnnamedMaterial_${actualLayerMaterial.expressID}`;
                          } else {
                            console.warn(
                              `    [${layerSetName}] Failed to retrieve IfcMaterial for ${layerPrefix} (Material ExpressID: ${directMaterialEntity.value}).`
                            );
                          }
                        } catch (e) {
                          console.warn(
                            `    [${layerSetName}] Error resolving IfcMaterial for ${layerPrefix} (Material ExpressID: ${directMaterialEntity.value}):`,
                            e
                          );
                        }
                      } else if (directMaterialEntity) {
                        console.warn(
                          `    [${layerSetName}] ${layerPrefix} has an unexpected Material attribute structure:`,
                          directMaterialEntity
                        );
                        layerMaterialName = `MaterialData_${layerEntity.expressID}`;
                      }

                      psetsData[layerSetGroupName][
                        `${layerPrefix}_MaterialName`
                      ] = layerMaterialName;

                      const layerThickness = layerEntity.LayerThickness?.value;
                      if (layerThickness !== undefined) {
                        psetsData[layerSetGroupName][
                          `${layerPrefix}_Thickness`
                        ] = layerThickness;
                      }

                      if (layerEntity.Category?.value) {
                        psetsData[layerSetGroupName][
                          `${layerPrefix}_Category`
                        ] = layerEntity.Category.value;
                      }
                      if (layerEntity.Priority?.value !== undefined) {
                        psetsData[layerSetGroupName][
                          `${layerPrefix}_Priority`
                        ] = layerEntity.Priority.value;
                      }
                      if (layerEntity.IsVentilated?.value !== undefined) {
                        psetsData[layerSetGroupName][
                          `${layerPrefix}_IsVentilated`
                        ] = layerEntity.IsVentilated.value;
                      }
                    } catch (e) {
                      console.warn(
                        `Error processing ${layerPrefix} for ${layerSetName} (LayerEntityExpressID: ${layerEntity?.expressID}):`,
                        e
                      );
                    }
                  }
                }
                // Cleanup logic for layerSetGroupName remains the same, ensuring TotalThickness isn't the ONLY prop if no layers exist
                if (
                  Object.keys(psetsData[layerSetGroupName]).length === 0 ||
                  (Object.keys(psetsData[layerSetGroupName]).length === 1 &&
                    psetsData[layerSetGroupName]["TotalThickness"] ===
                      undefined) ||
                  (psetsData[layerSetGroupName]["TotalThickness"] !==
                    undefined &&
                    Object.keys(psetsData[layerSetGroupName]).length === 1 &&
                    Object.keys(psetsData[layerSetGroupName])[0] ===
                      "TotalThickness" &&
                    matDef.MaterialLayers &&
                    matDef.MaterialLayers.length === 0)
                ) {
                  if (
                    Object.keys(psetsData[layerSetGroupName]).length === 0 ||
                    (Object.keys(psetsData[layerSetGroupName]).length === 1 &&
                      psetsData[layerSetGroupName].hasOwnProperty(
                        "TotalThickness"
                      ) &&
                      (psetsData[layerSetGroupName]["TotalThickness"] ===
                        undefined ||
                        (matDef.MaterialLayers &&
                          matDef.MaterialLayers.length === 0)))
                  ) {
                    delete psetsData[layerSetGroupName];
                  }
                }
              } else if (matDefType === "IFCMATERIALLIST") {
                const listName =
                  matDefNameFromIFC || `MatList_${matDef.expressID}`;
                const listGroupName = `MaterialList: ${listName}`;
                if (!psetsData[listGroupName]) psetsData[listGroupName] = {};
                console.log(`  Processing IFCMATERIALLIST: ${listName}`);
                if (matDef.Materials && Array.isArray(matDef.Materials)) {
                  console.log(
                    `    ${listName} has ${matDef.Materials.length} materials.`
                  );
                  for (const [
                    index,
                    materialRef,
                  ] of matDef.Materials.entries()) {
                    if (materialRef?.value) {
                      try {
                        const material = await ifcApi.GetLine(
                          currentModelID,
                          materialRef.value,
                          true
                        );
                        psetsData[listGroupName][`Material_${index + 1}`] =
                          material.Name?.value ||
                          `UnnamedMaterial_${material.expressID}`;
                      } catch (e) {
                        console.warn(
                          `Error processing material ${
                            index + 1
                          } in list ${listName}:`,
                          e
                        );
                      }
                    }
                  }
                }
                if (Object.keys(psetsData[listGroupName]).length === 0)
                  delete psetsData[listGroupName];
              } else {
                // Generic fallback for other material-related definitions returned by getMaterialsProperties
                const groupNameSuggestion = matDefNameFromIFC || matDefType;
                const fallbackGroupName = `MaterialInfo: ${groupNameSuggestion}`;
                if (!psetsData[fallbackGroupName])
                  psetsData[fallbackGroupName] = {};
                console.log(
                  `  Processing other Material Definition: ${groupNameSuggestion} (Type: ${matDefType})`
                );
                // Extract direct attributes from this other material definition entity
                extractDirectAttributes(matDef, psetsData[fallbackGroupName], [
                  "Name",
                  "Description",
                ]);
                if (Object.keys(psetsData[fallbackGroupName]).length === 0)
                  delete psetsData[fallbackGroupName];
              }
            }
          }
        } catch (e) {
          console.error("Error in Step D (getMaterialsProperties()):", e);
        }

        const allProperties = {
          modelID: currentModelID,
          expressID: currentSelectedExpressID,
          ifcType: elementType,
          attributes: elementData, // This remains the direct attributes from GetLine
          propertySets: psetsData,
        };

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
