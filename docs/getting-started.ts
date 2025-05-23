const content = {
  en: `## Loading a Model

1. Click **Load IFC File** in the viewer or drop a file onto the canvas.
2. Choose from a range of demo models in **Settings**, including official [**buildingSMART sample files**](https://github.com/buildingSMART/Sample-Test-Files) that cover various IFC schemas and building types.
3. You can also add your own model URLs for quick access.
4. Import existing classification or rule sets from JSON or Excel if available.

### Copying Element IDs

Use the copy icon next to **Global ID** in the **Properties** panel to copy the identifier.

## Exploring the Model

- Use the **Model Explorer** on the left to browse the spatial tree.
- Selecting an element shows its properties in the **Properties** panel below.

## Understanding IFC Schema

- **Hover over IFC class names** (like IfcWall, IfcColumn) to see instant schema previews with key information.
- **Click "View Schema"** to open the full documentation reader with comprehensive details about IFC entities.
- The documentation includes entity descriptions, attributes, inheritance relationships, and examples.
- All schema documentation is cached locally for fast access and offline use.

## Classifying Elements

1. Open the **Classifications** tab on the right.
2. Load a default set or create your own entries.
3. Select an element in 3D and choose **Assign Selected Element**.
`,
  de: `## Modell laden

1. Klicke auf **IFC-Datei laden** im Viewer oder ziehe eine Datei auf die Fläche.
2. Wähle unter **Einstellungen** aus Demo-Modellen, darunter [**buildingSMART-Beispieldateien**](https://github.com/buildingSMART/Sample-Test-Files) für verschiedene IFC-Schemata und Gebäudetypen.
3. Du kannst auch eigene Modell-URLs für schnellen Zugriff hinzufügen.

## Modell erkunden

- Mit dem **Model Explorer** links die Strukturbäume durchsuchen.
- Ein ausgewähltes Element zeigt seine Eigenschaften im **Properties**-Panel darunter.

## IFC-Schema verstehen

- **Bewege die Maus über IFC-Klassennamen** (wie IfcWall, IfcColumn) für sofortige Schema-Vorschauen mit wichtigen Informationen.
- **Klicke auf "Schema anzeigen"** um den vollständigen Dokumentations-Reader mit umfassenden Details zu IFC-Entitäten zu öffnen.
- Die Dokumentation enthält Entitätsbeschreibungen, Attribute, Vererbungsbeziehungen und Beispiele.
- Alle Schema-Dokumentation wird lokal zwischengespeichert für schnellen Zugriff und Offline-Nutzung.

## Elemente klassifizieren

1. Öffne rechts den Tab **Classifications**.
2. Lade einen Standardsatz oder erstelle eigene Einträge.
3. Wähle ein Element in 3D und nutze **Assign Selected Element**.
4. Optional kannst du bestehende Klassifikations- oder Regelsets aus JSON oder Excel importieren.

### IDs kopieren

Im **Properties**-Panel kannst du über das Kopiersymbol neben der **Global ID** den Wert in die Zwischenablage kopieren.
`};
export default content;
