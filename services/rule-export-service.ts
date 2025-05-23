import * as XLSX from "xlsx";
import { Rule } from "@/context/ifc-context";

/**
 * Convert an array of rules to an Excel workbook and return
 * the workbook binary string. The format matches what
 * `parseRulesFromExcel` expects during import.
 */
export function exportRulesToExcel(rules: Rule[]): ArrayBuffer {
  try {
    const maxConditions = rules.reduce(
      (max, r) => Math.max(max, r.conditions.length),
      0
    );

    const header = [
      "id",
      "name",
      "description",
      "classificationCode",
      "active",
    ];
    for (let i = 1; i <= maxConditions; i++) {
      header.push(`property${i}`);
      header.push(`operator${i}`);
      header.push(`value${i}`);
    }

    const rows: any[][] = [header];

    for (const rule of rules) {
      const row: any[] = [
        rule.id,
        rule.name,
        rule.description,
        rule.classificationCode,
        rule.active ? 1 : 0,
      ];

      rule.conditions.forEach((c) => {
        row.push(c.property);
        row.push(c.operator);
        row.push(c.value);
      });

      // ensure row has same length as header
      while (row.length < header.length) {
        row.push("");
      }

      rows.push(row);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rules");

    return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  } catch (error) {
    console.error("Error exporting rules to Excel:", error);
    throw new Error("Failed to export rules to Excel. See console for details.");
  }
}
