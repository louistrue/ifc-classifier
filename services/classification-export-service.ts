import * as XLSX from "xlsx";
import { ClassificationItem, SelectedElementInfo } from "@/context/ifc-context";

/**
 * Export classifications to an Excel workbook.
 * Elements are serialized as "modelID:expressID" pairs separated by semicolons.
 */
export function exportClassificationsToExcel(classifications: Record<string, ClassificationItem>): ArrayBuffer {
  const header = ["code", "name", "color", "elements"];
  const rows: any[][] = [header];
  for (const cls of Object.values(classifications)) {
    const elementsStr = (cls.elements || [])
      .map((el: SelectedElementInfo) => `${el.modelID}:${el.expressID}`)
      .join(";");
    rows.push([cls.code, cls.name, cls.color, elementsStr]);
  }
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Classifications");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
