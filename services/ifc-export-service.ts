// services/ifc-export-service.ts

// --- Pyodide and IfcOpenShell Integration ---
import { type PyodideInterface } from "pyodide"; // Official typings

declare global {
    interface Window {
        loadPyodide: (config?: { indexURL?: string }) => Promise<PyodideInterface>;
        pyodide?: PyodideInterface; // Instance attached to window for potential reuse/debugging
    }
}

// URL for the IfcOpenShell wheel
const IFC_OPEN_SHELL_WHEEL_URL = "https://raw.githubusercontent.com/IfcOpenShell/wasm-wheels/main/ifcopenshell-0.8.2+d50e806-cp312-cp312-emscripten_3_1_58_wasm32.whl";

let pyodidePromise: Promise<PyodideInterface> | null = null;

async function getPyodideInstance(): Promise<PyodideInterface> {
    if (typeof window.loadPyodide !== 'function') {
        // This error indicates the Pyodide script itself hasn't been loaded.
        // It should be included in the main HTML file (e.g., via a <script> tag).
        console.error("Pyodide script not loaded. Please ensure it's included in your HTML page.");
        throw new Error("Pyodide script not loaded.");
    }

    if (!pyodidePromise) {
        pyodidePromise = (async () => {
            console.log("Loading Pyodide...");
            const pyodide = await window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/", // Updated to v0.26.0
            });
            console.log("Pyodide loaded successfully.");

            console.log("Loading micropip package...");
            await pyodide.loadPackage("micropip");
            const micropip = pyodide.pyimport("micropip");
            console.log("Micropip loaded successfully.");

            console.log(`Installing IfcOpenShell from: ${IFC_OPEN_SHELL_WHEEL_URL}`);
            try {
                await micropip.install(IFC_OPEN_SHELL_WHEEL_URL);
                console.log("IfcOpenShell installed successfully via micropip.");

                // Perform a simple import test to confirm successful installation
                const version = pyodide.runPython("import ifcopenshell; ifc_version = ifcopenshell.version; ifc_version");
                console.log('IfcOpenShell version:', version);
                if (!version) {
                    throw new Error("IfcOpenShell imported but version is undefined. Installation might be incomplete.");
                }
            } catch (error) {
                console.error("Error installing or testing IfcOpenShell:", error);
                pyodidePromise = null; // Reset promise to allow retry on next call
                throw error;
            }

            window.pyodide = pyodide; // Optional: make instance available globally for debugging
            return pyodide;
        })();
    }
    return pyodidePromise;
}

// --- End Pyodide Integration ---

const PYTHON_IFC_PROCESSING_SCRIPT = `
import ifcopenshell
import ifcopenshell.guid
import json
import time # For CreationDate timestamp

# Note: Pyodide's home directory /home/pyodide is usually writable.
TEMP_IFC_PATH = "/home/pyodide/temp_model.ifc"

def get_or_create_owner_history(model):
    owner_history = model.by_type("IfcOwnerHistory")
    if owner_history:
        return owner_history[0]

    person = model.create_entity("IfcPerson",
                                 Identification="N/A",
                                 GivenName="Default",
                                 FamilyName="User")
    organization = model.create_entity("IfcOrganization",
                                       Name="Default Organization",
                                       Description="Organization for IFC Classifier")
    person_and_org = model.create_entity("IfcPersonAndOrganization",
                                         ThePerson=person,
                                         TheOrganization=organization)

    app_developer = model.create_entity("IfcOrganization", Name="IFC Classifier Tool Developer")
    application = model.create_entity("IfcApplication",
                                      ApplicationDeveloper=app_developer,
                                      Version="1.0",
                                      ApplicationFullName="IFC Classifier Tool",
                                      ApplicationIdentifier="ifc-classifier.app")
    
    current_time = int(time.time())

    new_owner_history = model.create_entity("IfcOwnerHistory",
                                            OwningUser=person_and_org,
                                            OwningApplication=application,
                                            State="READWRITE",
                                            ChangeAction="ADDED", 
                                            CreationDate=current_time) 
    return new_owner_history

def export_ifc_with_classifications(ifc_file_uint8array_js, classifications_json_str):
    try:
        ifc_file_bytes = bytes(ifc_file_uint8array_js.to_py())

        with open(TEMP_IFC_PATH, "wb") as f:
            f.write(ifc_file_bytes)

        model = ifcopenshell.open(TEMP_IFC_PATH)
        if not model:
            return {"error": "Failed to open IFC model from buffer using IfcOpenShell."}

        owner_history = get_or_create_owner_history(model)
        classifications_data = json.loads(classifications_json_str)

        for code, data in classifications_data.items():
            class_name = data.get("name", str(code)) 
            identification = str(code) 
            
            existing_classification_source = None
            for c in model.by_type("IfcClassification"):
                if c.Name == class_name: # Assuming name is unique identifier for IfcClassification
                    existing_classification_source = c
                    break
            
            classification_source = existing_classification_source or model.create_entity(
                "IfcClassification", 
                Source="IFC Classifier Tool", # Added Source
                Edition="1.0", # Added Edition
                Name=class_name, 
                # OwnerHistory=owner_history # OwnerHistory is not directly on IfcClassification
            )
            
            existing_class_ref = None
            # Ensure we are checking against the correct classification_source
            for cr in model.by_type("IfcClassificationReference"):
                # Check if ReferencedSource exists and it's the same entity instance
                if cr.ReferencedSource == classification_source and cr.Identification == identification:
                    existing_class_ref = cr
                    break
            
            class_ref = existing_class_ref or model.create_entity(
                "IfcClassificationReference",
                Identification=identification,
                Name=class_name, 
                ReferencedSource=classification_source,
                # OwnerHistory=owner_history # OwnerHistory not directly on IfcClassificationReference
            )
            
            element_express_ids_to_classify = []
            if "elements" in data and isinstance(data["elements"], list):
                for elem_info in data["elements"]:
                    if isinstance(elem_info, dict) and "expressID" in elem_info:
                        try:
                            element_express_ids_to_classify.append(int(elem_info["expressID"]))
                        except (ValueError, TypeError):
                            print(f"Warning: Could not parse expressID: {elem_info.get('expressID')}")
            
            if not element_express_ids_to_classify:
                continue

            elements_to_relate = []
            for express_id in element_express_ids_to_classify:
                element = model.by_id(express_id)
                if element:
                    already_classified = False
                    # Check existing associations for this specific element and classification reference
                    if hasattr(element, 'HasAssociations'):
                         for assoc_rel in element.HasAssociations:
                            if assoc_rel.is_a("IfcRelAssociatesClassification"):
                                # Compare the RelatingClassification entity instance directly
                                if assoc_rel.RelatingClassification == class_ref:
                                    already_classified = True
                                    break
                    if not already_classified:
                        elements_to_relate.append(element)
                else:
                    print(f"Warning: Element with expressID {express_id} not found in model.")
            
            if elements_to_relate:
                model.create_entity(
                    "IfcRelAssociatesClassification",
                    GlobalId=ifcopenshell.guid.new(),
                    OwnerHistory=owner_history, # Correctly placed here
                    RelatedObjects=elements_to_relate,
                    RelatingClassification=class_ref,
                )
        
        output_ifc_str = model.to_string()
        return {"ifcData": output_ifc_str}

    except Exception as e:
        import traceback
        error_message = f"Python error during IFC processing: {str(e)}"
        tb_str = traceback.format_exc()
        # These prints go to the browser console if Pyodide is configured to show stdout/stderr
        print(error_message)
        print(tb_str)
        return {"error": error_message, "traceback": tb_str}
`;

/**
 * Represents the structure of classification data expected by the export service.
 * Key is the classification code.
 */
export interface ExportClassificationData {
    [code: string]: {
        name: string;
        code: string; // ensure code is part of the data as well for consistency
        color?: string; // color might be optional for export logic
        elements: Array<{ modelID: number; expressID: number }>; // Matches SelectedElementInfo
        // Potentially other classification properties like description etc.
    };
}

/**
 * Exports an IFC model with added classifications.
 * This function will initialize Pyodide, load IfcOpenShell, and run a Python script.
 * @param ifcFileBuffer The ArrayBuffer of the original IFC file.
 * @param classifications The classification data to embed.
 * @returns A Promise that resolves with the modified IFC data as a string, or null on error.
 */
export async function exportIfcWithClassificationsService(
    ifcFileBuffer: ArrayBuffer,
    classifications: ExportClassificationData
): Promise<string | null> {
    console.log("Starting IFC export process...");
    try {
        const pyodide = await getPyodideInstance();
        console.log("Pyodide instance obtained for export.");

        // Ensure the Python script is loaded into Pyodide's global scope
        // This makes the function export_ifc_with_classifications available.
        pyodide.runPython(PYTHON_IFC_PROCESSING_SCRIPT);
        console.log("Python IFC processing script loaded into Pyodide.");

        // Get the Python function from Pyodide's global scope
        const processIfcFunction = pyodide.globals.get("export_ifc_with_classifications");
        if (typeof processIfcFunction !== 'function') {
            console.error("Python function 'export_ifc_with_classifications' not found in Pyodide scope.");
            throw new Error("Python export function not available.");
        }
        console.log("Python export function retrieved from Pyodide.");

        const jsUint8Array = new Uint8Array(ifcFileBuffer);
        const classificationsJsonStr = JSON.stringify(classifications);
        console.log("Data prepared for Python script.");

        // Call the Python function
        // Result will be a PyProxy
        const resultProxy = await processIfcFunction(jsUint8Array, classificationsJsonStr);
        console.log("Python script executed. Processing result...");

        // The result from Python will be a PyProxy. Convert it to a JS object.
        // dict_converter: Object.fromEntries is good for simple dicts.
        const resultJS = resultProxy.toJs({ dict_converter: Object.fromEntries });
        resultProxy.destroy(); // Important to free memory used by PyProxy
        console.log("Python result converted to JS:", resultJS);

        if (resultJS.error) {
            console.error("Python script execution failed:", resultJS.error);
            return null;
        }

        if (resultJS.ifcData) {
            console.log("IFC export successful.");
            return resultJS.ifcData as string;
        } else {
            console.error("Python script did not return IFC data.");
            return null;
        }

    } catch (error) {
        console.error("Error during IFC export process:", error);
        // If getPyodideInstance() threw an error (e.g., IfcOpenShell install failed),
        // pyodidePromise will be rejected. We should reset it to allow retry.
        if (error instanceof Error && error.message.includes("IfcOpenShell")) {
            pyodidePromise = null; // Allow re-initialization on next attempt
        }
        return null;
    }
}

// --- Helper function for downloading ---
export function downloadFile(content: BlobPart, fileName: string, contentType: string) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    document.body.appendChild(a); // Required for Firefox
    a.click();
    URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
}
