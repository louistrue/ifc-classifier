# Architecture Overview

The IFC Classifier application is built with modern web technologies and runs entirely in the browser. This document summarizes the major components and how they interact.

## Tech Stack

- **Next.js** and **React** provide the core web framework.
- **TypeScript** is used across the code base.
- **Three.js** with **@react-three/fiber** renders the 3D scene.
- **Tailwind CSS**, **Shadcn/ui** and **Radix UI** supply styling and accessible UI primitives.
- **web-ifc** parses IFC files directly in the browser through WebAssembly.
- **IfcOpenShell** is loaded via Pyodide to export IFC files with proper `IfcClassificationReference` entities.

These technologies are listed in the project README for quick reference.

## Frontend Structure

The project uses Next.js 14 with the `app/` directory. Pages such as `page.tsx` and layout components live here. Global styles are defined in `app/globals.css`.

All application state related to IFC models lives in `context/ifc-context.tsx`, which defines a React context with functions for loading models, selecting elements and applying classifications.

UI components are placed in the `components/` folder. Key files include `ifc-viewer.tsx` for the 3D viewer and `ifc-model.tsx` for loading IFC geometry.

## IFC Parsing with web-ifc

Browser-side parsing is handled by the `web-ifc` engine. The viewer initializes an `IfcAPI` instance and loads the WebAssembly modules from the CDN.

```ts
const ifcAPIInstance = new IfcAPI();
ifcAPIInstance.SetWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.68/", true);
await ifcAPIInstance.Init();
```

Once initialised, `web-ifc` provides low-level functions such as `GetLine` and `GetLineIDsWithType` to read element data from the loaded model. Geometry is rendered with Three.js via React Three Fiber.

## IFC Export with IfcOpenShell

To write IFC files with classification data, the app uses IfcOpenShell compiled to WebAssembly via Pyodide. The export service fetches the IfcOpenShell wheel and installs it inside a Pyodide runtime:

```ts
const IFC_OPEN_SHELL_WHEEL_URL = "https://raw.githubusercontent.com/IfcOpenShell/wasm-wheels/main/ifcopenshell-0.8.2+d50e806-cp312-cp312-emscripten_3_1_58_wasm32.whl";
const pyodide = await window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/" });
await pyodide.loadPackage("micropip");
await micropip.install(IFC_OPEN_SHELL_WHEEL_URL);
```

A Python script running inside Pyodide uses IfcOpenShell to open the model, attach `IfcClassificationReference` entities, and return the modified IFC string for download.

## Data Flow

1. Users load an IFC file in the browser. `web-ifc` parses the file and the viewer displays it.
2. Classifications and rules are managed in React state. Users can assign codes to elements through the UI.
3. When exporting, the current classification data and raw IFC file are sent to the Pyodide runtime. IfcOpenShell writes the new classification relationships and returns the resulting IFC text.
4. The user can download the modified file locally. No IFC data leaves the browser.

## Directory Overview

- `app/` – Next.js pages and global providers
- `components/` – React components including the viewer and panels
- `context/` – shared React context for model state
- `services/` – functions for importing/exporting classifications and IFC files

Together these pieces form a purely client-side application that reads, visualizes, classifies and exports IFC models without server dependencies.
