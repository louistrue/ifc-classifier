import * as XLSX from "xlsx";
import { ClassificationItem, SelectedElementInfo } from "@/context/ifc-context";

/**
 * Convert an array of classifications to an Excel workbook.
 * Elements are serialized as "modelID:expressID" pairs separated by semicolons.
 */
export function exportClassificationsToExcel(
  classifications: ClassificationItem[]
): ArrayBuffer {
  try {
    const header = ["code", "name", "color", "elements"];
    const rows: any[][] = [header];

    for (const classification of classifications) {
      const elements: SelectedElementInfo[] = classification.elements || [];
      const elementStr = elements
        .map((el) => `${el.modelID}:${el.expressID}`)
        .join(";");
      rows.push([
        classification.code,
        classification.name,
        classification.color,
        elementStr,
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Classifications");

    return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  } catch (error) {
    console.error("Error exporting classifications to Excel:", error);
    throw new Error(
      "Failed to export classifications to Excel. See console for details."
    );
  }
}
