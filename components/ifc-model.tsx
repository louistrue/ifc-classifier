"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
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
  IFCRELASSOCIATESMATERIAL,
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
    hiddenModelIds,
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
  }, [scene, ifcApi, modelData.id, highlightMaterial, selectionMaterial]);

  const createThreeJSGeometry = useCallback(
    (ifcGeomData: any) => {
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
    },
    [ifcApi]
  );

  const createMeshes = useCallback(() => {
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
    meshesRef.current = group;
    try {
      const flatMeshes = ifcApi.LoadAllGeometry(ownModelID.current!);
      for (let i = 0; i < flatMeshes.size(); i++) {
        const flatMesh = flatMeshes.get(i);
        const elementExpressID = flatMesh.expressID;
        const placedGeometries = flatMesh.geometries;
        for (let j = 0; j < placedGeometries.size(); j++) {
          const placedGeometry = placedGeometries.get(j);
          const ifcGeometryData = ifcApi.GetGeometry(
            ownModelID.current!,
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
  }, [ifcApi, scene, modelData.id, createThreeJSGeometry]);

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
    modelData.url,
    ifcApi,
    scene,
    modelData.id,
    setModelIDForLoadedModel,
    setSpatialTreeForModel,
    setAvailableCategoriesForModel,
    setInternalApiIdForEffects,
    setRawBufferForModel,
    createMeshes,
    baseCoordinationMatrix,
    setBaseCoordinationMatrix,
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

    const modelHidden = hiddenModelIds.includes(modelData.id);
    meshesRef.current.visible = !modelHidden;
    if (modelHidden) {
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
          console.log(`HIDE: Element ${currentModelID}-${expressID} hidden by user filters`);
        }

        // Step 4: Selected Element (highest priority for visibility and material)
        if (
          selectedElement &&
          selectedElement.modelID === currentModelID &&
          selectedElement.expressID === expressID
        ) {
          targetMaterial = selectionMaterial;
          isCurrentlyVisible = true;
          console.log(`SELECT OVERRIDE: Element ${currentModelID}-${expressID} visible despite filtering because it's selected`);
        }

        // Debug log for hidden elements
        if (!isCurrentlyVisible) {
          console.log(`RESULT: Element ${currentModelID}-${expressID} final visibility = false`);
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
    hiddenModelIds,
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

  // Memoized function for fetching properties
  const fetchPropertiesForSelectedElement = useCallback(async () => {
    if (
      !ifcApi ||
      !selectedElement ||
      internalApiIdForEffects === null ||
      selectedElement.modelID !== internalApiIdForEffects
    ) {
      if (!selectedElement) setElementProperties(null);
      console.log(`IFCModel (${modelData.id}) - Property Fetch: Aborting.`);
      return;
    }

    const { expressID: currentSelectedExpressID } = selectedElement;
    const currentModelID = internalApiIdForEffects;
    const psetsData: Record<string, Record<string, any>> = {};

    console.log(
      `IFCModel (${modelData.id}): Fetching ALL props for element ${currentSelectedExpressID} in model ${currentModelID}`
    );

    try {
      if (!ifcApi.properties) {
        ifcApi.properties = new Properties(ifcApi);
      }

      // --- Step A: Get Basic Element Attributes (Restored) ---
      const elementDataFromServer = await ifcApi.GetLine(
        currentModelID,
        currentSelectedExpressID,
        true
      );
      const elementType = ifcApi.GetNameFromTypeCode(
        elementDataFromServer.type
      );
      psetsData["Element Attributes"] = {};
      for (const key in elementDataFromServer) {
        if (Object.prototype.hasOwnProperty.call(elementDataFromServer, key)) {
          if (key === "expressID" || key === "type") continue;
          const value = elementDataFromServer[key];
          if (typeof value !== "object" || value === null)
            psetsData["Element Attributes"][key] = value;
          else if (value && value.value !== undefined)
            psetsData["Element Attributes"][key] = value.value;
        }
      }

      // Helper to process IFCPROPERTYSET entities (Restored - ensure extractPropertyValueRecursive is correctly defined globally or passed if needed)
      const processApiPset = async (
        psetEntity: any,
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
                  `[${psetNameForLogging}] Error fetching IfcProperty by ID ${propRefOrObject.value}:`,
                  e
                );
                continue;
              }
            } else if (
              propRefOrObject?.expressID !== undefined &&
              propRefOrObject.Name?.value
            ) {
              propToProcess = propRefOrObject;
            } else {
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

      // --- Step B: Get Instance PropertySets (Restored) ---
      const instancePsets = await ifcApi.properties.getPropertySets(
        currentModelID,
        currentSelectedExpressID,
        true,
        false
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
            await processApiPset(pset, psetsData[psetName], psetName);
          }
        }
      }

      // --- Step C: Get Type Information & Associated Property Definitions (Restored) ---
      const typeObjects = await ifcApi.properties.getTypeProperties(
        currentModelID,
        currentSelectedExpressID,
        true
      );
      if (typeObjects && typeObjects.length > 0) {
        for (const typeObject of typeObjects) {
          const typeObjectName =
            typeObject?.Name?.value ||
            `TypeObject_${typeObject.expressID || typeObjects.indexOf(typeObject)
            }`;
          const typeAttributesPSetName = `Type Attributes: ${typeObjectName}`;
          if (!psetsData[typeAttributesPSetName])
            psetsData[typeAttributesPSetName] = {};
          extractDirectAttributes(
            typeObject,
            psetsData[typeAttributesPSetName],
            ["Name", "Description"]
          );
          if (Object.keys(psetsData[typeAttributesPSetName]).length === 0)
            delete psetsData[typeAttributesPSetName];

          if (
            typeObject.HasPropertySets &&
            Array.isArray(typeObject.HasPropertySets)
          ) {
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
                  if (!psetsData[finalPsetName]) psetsData[finalPsetName] = {};
                  await processApiPset(
                    propDefEntity,
                    psetsData[finalPsetName],
                    finalPsetName
                  );
                } else if (propDefEntityType) {
                  const groupNameSuggestion =
                    propDefInstanceName || propDefEntityType;
                  const groupName = `${groupNameSuggestion} (from Type: ${typeObjectName})`;
                  if (!psetsData[groupName]) psetsData[groupName] = {};
                  extractDirectAttributes(propDefEntity, psetsData[groupName]);
                  if (Object.keys(psetsData[groupName]).length === 0)
                    delete psetsData[groupName];
                }
              }
            }
          }
        }
      }

      // --- Step D: Get Material Properties (with Fallback) ---
      let materialsAndDefs = await ifcApi.properties.getMaterialsProperties(
        currentModelID,
        currentSelectedExpressID,
        true,
        true
      );
      console.log(
        `IFCModel (${modelData.id}): getMaterialsProperties returned:`,
        materialsAndDefs ? materialsAndDefs.length : "null/undefined"
      );

      if (!materialsAndDefs || materialsAndDefs.length === 0) {
        console.log(
          `IFCModel (${modelData.id}): Attempting fallback for materials for element ${currentSelectedExpressID}`
        );
        const relAssociatesMaterialIDs = await ifcApi.GetLineIDsWithType(
          currentModelID,
          IFCRELASSOCIATESMATERIAL
        );
        const foundMaterialsViaFallback: any[] = [];
        for (let i = 0; i < relAssociatesMaterialIDs.size(); i++) {
          const relID = relAssociatesMaterialIDs.get(i);
          const relAssociatesMaterial = await ifcApi.GetLine(
            currentModelID,
            relID,
            false
          );
          if (
            relAssociatesMaterial.RelatedObjects &&
            Array.isArray(relAssociatesMaterial.RelatedObjects)
          ) {
            const isElementAssociated =
              relAssociatesMaterial.RelatedObjects.some(
                (obj: any) => obj.value === currentSelectedExpressID
              );
            if (
              isElementAssociated &&
              relAssociatesMaterial.RelatingMaterial?.value
            ) {
              try {
                const materialEntity = await ifcApi.GetLine(
                  currentModelID,
                  relAssociatesMaterial.RelatingMaterial.value,
                  true
                );
                if (materialEntity)
                  foundMaterialsViaFallback.push(materialEntity);
              } catch (e) {
                console.warn(
                  `Fallback error fetching material entity ID ${relAssociatesMaterial.RelatingMaterial.value}:`,
                  e
                );
              }
            }
          }
        }
        if (foundMaterialsViaFallback.length > 0) {
          console.log(
            `IFCModel (${modelData.id}): Fallback found ${foundMaterialsViaFallback.length} material(s).`
          );
          materialsAndDefs = foundMaterialsViaFallback;
        } else {
          console.log(
            `IFCModel (${modelData.id}): Fallback also found no materials.`
          );
        }
      }

      if (materialsAndDefs && materialsAndDefs.length > 0) {
        for (const matDef of materialsAndDefs) {
          const matDefType = ifcApi.GetNameFromTypeCode(matDef.type);
          const matDefNameFromIFC = matDef.Name?.value;
          let groupName = "";
          // Logic to create groupName based on matDefType and add to psetsData (as before)
          // Example for IFCMATERIAL:
          if (matDefType === "IFCMATERIAL") {
            const materialName =
              matDefNameFromIFC || `Material_${matDef.expressID}`;
            groupName = `Material: ${materialName}`;
            if (!psetsData[groupName]) psetsData[groupName] = {};
            extractDirectAttributes(matDef, psetsData[groupName], [
              "Name",
              "Description",
            ]);
            if (Object.keys(psetsData[groupName]).length === 0)
              delete psetsData[groupName];
          } else if (matDefType === "IFCMATERIALLAYERSET") {
            const layerSetName =
              matDefNameFromIFC || `MatLayerSet_${matDef.expressID}`;
            groupName = `LayerSet: ${layerSetName}`;
            if (!psetsData[groupName]) psetsData[groupName] = {};
            if (matDef.TotalThickness?.value !== undefined) {
              psetsData[groupName]["TotalThickness"] =
                matDef.TotalThickness.value;
            }
            if (matDef.MaterialLayers && Array.isArray(matDef.MaterialLayers)) {
              for (const [
                index,
                layerEntity,
              ] of matDef.MaterialLayers.entries()) {
                psetsData[groupName][`Layer_${index + 1}_Thickness`] =
                  layerEntity.LayerThickness?.value;
                psetsData[groupName][`Layer_${index + 1}_Material`] =
                  layerEntity.Material?.Name?.value ||
                  layerEntity.Material?.value ||
                  "Unknown Material";
              }
            }
            if (
              Object.keys(psetsData[groupName]).length === 0 &&
              !psetsData[groupName]["TotalThickness"]
            )
              delete psetsData[groupName];
            else if (
              Object.keys(psetsData[groupName]).length === 1 &&
              psetsData[groupName]["TotalThickness"] &&
              (!matDef.MaterialLayers || matDef.MaterialLayers.length === 0)
            )
              delete psetsData[groupName]; //delete if only total thickness and no layers
          } // Add other material type processing (IFCMATERIALPROPERTIES, IFCMATERIALLIST, generic) as it was originally
          else if (matDefType === "IFCMATERIALPROPERTIES") {
            const psetName = matDefNameFromIFC || "Material Properties";
            groupName = `Material Properties: ${psetName}`;
            if (!psetsData[groupName]) psetsData[groupName] = {};
            await processApiPset(matDef, psetsData[groupName], groupName);
            if (Object.keys(psetsData[groupName]).length === 0)
              delete psetsData[groupName];
          } else if (matDefType === "IFCMATERIALLIST") {
            const listName = matDefNameFromIFC || `MatList_${matDef.expressID}`;
            groupName = `MaterialList: ${listName}`;
            if (!psetsData[groupName]) psetsData[groupName] = {};
            if (matDef.Materials && Array.isArray(matDef.Materials)) {
              for (const [index, materialRef] of matDef.Materials.entries()) {
                if (materialRef?.value) {
                  try {
                    const material = await ifcApi.GetLine(
                      currentModelID,
                      materialRef.value,
                      true
                    );
                    psetsData[groupName][`Material_${index + 1}`] =
                      material.Name?.value ||
                      `UnnamedMaterial_${material.expressID}`;
                  } catch (e) {
                    console.warn("Error processing material in list", e);
                  }
                }
              }
            }
            if (Object.keys(psetsData[groupName]).length === 0)
              delete psetsData[groupName];
          } else {
            const groupNameSuggestion = matDefNameFromIFC || matDefType;
            groupName = `MaterialInfo: ${groupNameSuggestion}`;
            if (!psetsData[groupName]) psetsData[groupName] = {};
            extractDirectAttributes(matDef, psetsData[groupName], [
              "Name",
              "Description",
            ]);
            if (Object.keys(psetsData[groupName]).length === 0)
              delete psetsData[groupName];
          }
        }
      }

      const allProperties = {
        modelID: currentModelID,
        expressID: currentSelectedExpressID,
        ifcType: elementType,
        attributes: elementDataFromServer,
        propertySets: psetsData,
      };
      setElementProperties(allProperties);
    } catch (error) {
      console.error(
        `IFCModel (${modelData.id}): Error fetching properties for element ${currentSelectedExpressID}:`,
        error
      );
      setElementProperties({ error: "Failed to fetch properties" });
    }
  }, [
    ifcApi,
    selectedElement,
    internalApiIdForEffects,
    modelData.id,
    setElementProperties,
  ]);

  // Fetch properties effect - This is the useEffect that calls the memoized callback
  useEffect(() => {
    if (
      selectedElement &&
      internalApiIdForEffects !== null &&
      selectedElement.modelID === internalApiIdForEffects
    ) {
      fetchPropertiesForSelectedElement();
    } else {
      setElementProperties(null);
    }
  }, [
    selectedElement,
    internalApiIdForEffects,
    fetchPropertiesForSelectedElement,
    modelData.id, // Added modelData.id here
    setElementProperties, // Added setElementProperties here
  ]);

  return isLoading ? (
    <>{/* Optionally return a per-model loader here */}</>
  ) : null;
}
