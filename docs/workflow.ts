const content = `
### 1. Import Your Model

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
`;
export default content;
