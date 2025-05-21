const content = {
  en: `### 1. Import Your Model

Start by loading an IFC model using the **Load IFC** button in the viewer. You can also select from demo models available in the **Settings** tab.

### 2. Set Up Classifications

Before creating rules, establish your classification system:
- Load a built-in classification set (Uniclass Pr, eBKP-H) from the menu
- Or create custom classification entries with code, name, and color
- Your classifications will be the targets for both rules and manual assignments

### 3. Define Classification Rules

Once classifications are set up, automate the process:
- Create rules that target specific element properties
- Each rule maps element properties to a selected classification
- Rules can be toggled on/off and organized in priority order

### 4. Manual Refinement

For elements requiring special handling:
- Select individual elements in the 3D view
- Use the Classifications panel to assign or remove classifications
- Filter the Model Explorer by classification to verify completeness

### 5. Export & Share

When your model is fully classified:
- Use the **Export IFC** button to save your work with proper \`IfcClassificationReference\` entities
- Export your classifications and rules (including assigned element GUIDs) to:
  - **Excel** format for spreadsheet editing and documentation
  - **JSON** format for data integration and programmatic processing
- Later, you can import from either Excel or JSON to resume your classification work on the same or similar models
`,
  fr: `### 1. Import Your Model

Start by loading an IFC model using the **Load IFC** button in the viewer. You can also select from demo models available in the **Settings** tab.

### 2. Set Up Classifications

Before creating rules, establish your classification system:
- Load a built-in classification set (Uniclass Pr, eBKP-H) from the menu
- Or create custom classification entries with code, name, and color
- Your classifications will be the targets for both rules and manual assignments

### 3. Define Classification Rules

Once classifications are set up, automate the process:
- Create rules that target specific element properties
- Each rule maps element properties to a selected classification
- Rules can be toggled on/off and organized in priority order

### 4. Manual Refinement

For elements requiring special handling:
- Select individual elements in the 3D view
- Use the Classifications panel to assign or remove classifications
- Filter the Model Explorer by classification to verify completeness

### 5. Export & Share

When your model is fully classified:
- Use the **Export IFC** button to save your work with proper \`IfcClassificationReference\` entities
- Export your classifications and rules (including assigned element GUIDs) to:
  - **Excel** format for spreadsheet editing and documentation
  - **JSON** format for data integration and programmatic processing
- Later, you can import from either Excel or JSON to resume your classification work on the same or similar models
`,
  it: `### 1. Import Your Model

Start by loading an IFC model using the **Load IFC** button in the viewer. You can also select from demo models available in the **Settings** tab.

### 2. Set Up Classifications

Before creating rules, establish your classification system:
- Load a built-in classification set (Uniclass Pr, eBKP-H) from the menu
- Or create custom classification entries with code, name, and color
- Your classifications will be the targets for both rules and manual assignments

### 3. Define Classification Rules

Once classifications are set up, automate the process:
- Create rules that target specific element properties
- Each rule maps element properties to a selected classification
- Rules can be toggled on/off and organized in priority order

### 4. Manual Refinement

For elements requiring special handling:
- Select individual elements in the 3D view
- Use the Classifications panel to assign or remove classifications
- Filter the Model Explorer by classification to verify completeness

### 5. Export & Share

When your model is fully classified:
- Use the **Export IFC** button to save your work with proper \`IfcClassificationReference\` entities
- Export your classifications and rules (including assigned element GUIDs) to:
  - **Excel** format for spreadsheet editing and documentation
  - **JSON** format for data integration and programmatic processing
- Later, you can import from either Excel or JSON to resume your classification work on the same or similar models
`,
  de: `### 1. Modell importieren

Lade zunächst ein IFC-Modell über den Button **Load IFC** im Viewer. Alternativ kannst du im Tab **Settings** aus Demo-Modellen wählen.

### 2. Klassifikationen einrichten

Bevor du Regeln erstellst, lege dein Klassifikationssystem fest:
- Lade ein vorhandenes Set (Uniclass Pr, eBKP-H) über das Menü
- Oder erstelle eigene Einträge mit Code, Name und Farbe
- Diese Klassifikationen dienen als Ziel für Regeln und manuelle Zuordnungen

### 3. Klassifikationsregeln definieren

Sind Klassifikationen eingerichtet, kann der Prozess automatisiert werden:
- Erstelle Regeln, die auf bestimmte Eigenschaften abzielen
- Jede Regel ordnet Elemente einer gewählten Klassifikation zu
- Regeln können ein- oder ausgeschaltet und priorisiert werden

### 4. Manuelle Nachbearbeitung

Für spezielle Elemente:
- Einzelne Elemente in der 3D-Ansicht auswählen
- Im Panel Classifications zuweisen oder entfernen
- Im Model Explorer nach Klassifikation filtern, um Vollständigkeit zu prüfen

### 5. Export & Weitergabe

Ist das Modell vollständig klassifiziert:
- Mit **Export IFC** exportierst du inklusive \`IfcClassificationReference\`
- Klassifikationen und Regeln samt zugewiesenen GUIDs lassen sich als
  - **Excel** für Tabellenbearbeitung
  - **JSON** für Datenintegration
  exportieren
- Später kannst du Excel oder JSON importieren, um die Arbeit fortzusetzen
`};
export default content;
