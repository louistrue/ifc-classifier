const content = {
  en: `# IFC Classifier

IfcClassifier helps you apply standardized classifications to IFC models right in your browser. The project is open source under the AGPL v3 license and is still a work in progress.

## What It Does

Assigning classification codes in IFC shouldn't slow you down—it should just work. IFC Classifier is a simple, fast solution that handles IFC classifications your way, using [**web-ifc**](https://thatopen.github.io/engine_web-ifc/docs/) for processing models and [**IfcOpenShell**](https://github.com/IfcOpenShell/IfcOpenShell) for exporting proper ClassificationReferences, all while following the standards defined by [**buildingSMART**](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/).

## Key Features

  - **Automate code assignment** across IFC elements using customizable rules
  - **Switch between classification systems** (Uniclass, eBKP-H, or your custom schema)
  - **Import or export classifications and rules** as JSON or Excel
  - **Copy Global IDs** right from the properties panel
  - **3D selection-based classification** for quick manual fixes
  - **Browser-based** and completely open source

Try it out on your own models and let us know how it works for you!

## Privacy & Security

**Your IFC data never leaves your device.** The application processes all files locally in your browser using [**WebAssembly**](https://webassembly.org/) technology:

- **WebAssembly (WASM)** allows the IFC parser to run at near-native speed directly in your browser
- All processing happens on your device—no server uploads required
- Your models and their data remain private and secure

> **🔍 Verify it yourself:** Press \`F12\` or \`Ctrl+Shift+I\` to open browser developer tools, select the Network tab, and observe that **no IFC data is ever transmitted** while using the application. Your data stays on your device!

## Project Status

This application is still in development. Your feedback and contributions are welcome to help improve its functionality.`,
  de: `# IFC Classifier

IfcClassifier hilft dir, standardisierte Klassifizierungen direkt im Browser auf IFC-Modelle anzuwenden. Das Projekt ist quelloffen unter der AGPL v3 Lizenz und befindet sich noch in Entwicklung.

## Was macht es?

Die Zuordnung von Klassifizierungscodes zu IFC-Elementen soll dich nicht ausbremsen. IFC Classifier bietet eine einfache und schnelle Lösung, nutzt [**web-ifc**](https://thatopen.github.io/engine_web-ifc/docs/) zur Modellverarbeitung und [**IfcOpenShell**](https://github.com/IfcOpenShell/IfcOpenShell) zum Export korrekter ClassificationReferences und folgt dabei den Standards von [**buildingSMART**](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/).

## Hauptfunktionen

  - **Automatische Codezuweisung** über anpassbare Regeln
  - **Wechsel zwischen Klassifikationssystemen** (Uniclass, eBKP-H oder eigenes Schema)
  - **Klassifikationen und Regeln** als JSON oder Excel importieren und exportieren
  - **Global IDs** im Eigenschaften-Panel kopieren
  - **Manuelle Zuordnung** über 3D-Selektion
  - **Im Browser** und vollständig Open Source

Probiere es mit eigenen Modellen aus und gib uns Feedback!

## Datenschutz & Sicherheit

**Deine IFC-Daten verlassen niemals dein Gerät.** Alle Dateien werden lokal im Browser mit [**WebAssembly**](https://webassembly.org/) verarbeitet:

- **WebAssembly (WASM)** ermöglicht nahezu native Geschwindigkeit im Browser
- Es findet keine Serverübertragung statt – alles bleibt auf deinem Gerät
- Deine Modelle und Daten bleiben privat und sicher

> **🔍 Überprüfe es selbst:** Mit \`F12\` oder \`Ctrl+Shift+I\` die Entwicklertools öffnen, den Reiter Netzwerk wählen und sehen, dass **keine IFC-Daten übertragen** werden.

## Projektstatus

Diese Anwendung befindet sich noch in Entwicklung. Feedback und Beiträge sind willkommen.`
};
export default content;
