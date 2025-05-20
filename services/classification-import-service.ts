import * as XLSX from "xlsx";
import { ClassificationItem, SelectedElementInfo } from "@/context/ifc-context";

/**
 * Parse an Excel file into ClassificationItem objects.
 * Expected columns: code, name, color, elements
 * Elements should be encoded as "modelID:expressID" pairs separated by semicolons.
 */
export async function parseClassificationsFromExcel(
  file: File
): Promise<ClassificationItem[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return [];

  const header: string[] = rows[0].map((h) => String(h).trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());

  const classifications: ClassificationItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const code = String(row[idx("code")] ?? "").trim();
    if (!code) continue;
    const name = String(row[idx("name")] ?? "");
    const color = String(row[idx("color")] ?? "");
    const elementStr = String(row[idx("elements")] ?? "");
    const elements: SelectedElementInfo[] = elementStr
      ? elementStr.split(";").map((pair) => {
          const [model, id] = pair.split(":");
          return {
            modelID: parseInt(model, 10),
            expressID: parseInt(id, 10),
          } as SelectedElementInfo;
        })
      : [];

    classifications.push({ code, name, color, elements });
  }

  return classifications;
}
