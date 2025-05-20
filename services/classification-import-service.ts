import * as XLSX from "xlsx";
import { ClassificationItem, SelectedElementInfo } from "@/context/ifc-context";

/**
 * Parse an Excel file and return an array of ClassificationItem objects.
 * Expects columns: code | name | color | elements
 * Elements should be in "modelID:expressID" format separated by semicolons.
 */
export async function parseClassificationsFromExcel(file: File): Promise<ClassificationItem[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return [];

  const header: string[] = rows[0].map((h) => String(h).trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const items: ClassificationItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const code = String(row[idx("code")] ?? "").trim();
    if (!code) continue;
    const name = String(row[idx("name")] ?? "");
    const color = String(row[idx("color")] ?? "#3b82f6");
    const elementsStr = String(row[idx("elements")] ?? "");
    let elements: SelectedElementInfo[] = [];
    if (elementsStr) {
      elements = elementsStr.split(";").map((pair) => {
        const [modelIdStr, expressIdStr] = pair.split(":");
        return {
          modelID: parseInt(modelIdStr, 10),
          expressID: parseInt(expressIdStr, 10),
        } as SelectedElementInfo;
      });
    }
    items.push({ code, name, color, elements });
  }

  return items;
}
