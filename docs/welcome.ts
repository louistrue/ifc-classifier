const content = `
# IFC Classifier

IfcClassifier helps you apply standardized classifications to IFC models right in your browser. The project is open source under the AGPL v3 license and is still a work in progress.

## What It Does

Assigning classification codes in IFC shouldn't slow you down—it should just work. IFC Classifier is a simple, fast solution that handles IFC classifications your way, using [**web-ifc**](https://thatopen.github.io/engine_web-ifc/docs/) for processing models and [**IfcOpenShell**](https://github.com/IfcOpenShell/IfcOpenShell) for exporting proper ClassificationReferences, all while following the standards defined by [**buildingSMART**](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/).

## Key Features

- **Automate code assignment** across IFC elements using customizable rules
- **Switch between classification systems** (Uniclass, eBKP-H, or your custom schema)
- **Simple workflow** designed to speed up classification tasks
- **Browser-based** with no installation required
- **Completely open source** and ready for contributions

Try it out on your own models and let us know how it works for you!

## Privacy & Security

**Your IFC data never leaves your device.** The application processes all files locally in your browser using [**WebAssembly**](https://webassembly.org/) technology:

- **WebAssembly (WASM)** allows the IFC parser to run at near-native speed directly in your browser
- All processing happens on your device—no server uploads required
- Your models and their data remain private and secure

> **🔍 Verify it yourself:** Press \`F12\` or \`Ctrl+Shift+I\` to open browser developer tools, select the Network tab, and observe that **no IFC data is ever transmitted** while using the application. Your data stays on your device!

## Project Status

This application is still in development. Your feedback and contributions are welcome to help improve its functionality.
`;
export default content;
