import * as XLSX from "xlsx";
import { Rule, RuleCondition } from "@/context/ifc-context";

/**
 * Parse an Excel file into Rule objects.
 *
 * Expected format (header row in first sheet):
 * id | name | description | classificationCode | active | property1 | operator1 | value1 | property2 | operator2 | value2 | ...
 *
 * Each rule can contain multiple conditions. Additional sets of
 * property/operator/value columns will be read until no more columns exist.
 */
export async function parseRulesFromExcel(file: File): Promise<Rule[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return [];

  const header: string[] = rows[0].map((h) => String(h).trim());
  const idx = (name: string) => header.indexOf(name);

  const rules: Rule[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const id = String(row[idx("id")] ?? `rule-${Date.now()}-${i}`);
    const name = String(row[idx("name")] ?? "");
    if (!name) continue; // skip empty rows
    const description = String(row[idx("description")] ?? "");
    const classificationCode = String(row[idx("classificationCode")] ?? "");
    const activeRaw = row[idx("active")];
    const active = String(activeRaw).toLowerCase() !== "false" && activeRaw !== 0;

    const start = idx("active") + 1;
    const conditions: RuleCondition[] = [];
    for (let col = start; col < header.length; col += 3) {
      const property = row[col];
      const operator = row[col + 1];
      const value = row[col + 2];
      if (property !== undefined && property !== "") {
        conditions.push({
          property: String(property),
          operator: String(operator ?? ""),
          value: value ?? "",
        });
      }
    }

    rules.push({
      id,
      name,
      description,
      classificationCode,
      active,
      conditions,
    });
  }

  return rules;
}
