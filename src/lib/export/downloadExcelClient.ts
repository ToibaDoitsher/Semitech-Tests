"use client";

/** ייצוא גיליון אחד ממערך אובייקטים (מפתחות = כותרות עמודות) */
export async function downloadExcelFromRows(
  filename: string,
  sheetName: string,
  rows: Record<string, string | number | boolean | null | undefined>[],
) {
  const XLSX = await import("xlsx");
  const safeSheet = sheetName.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "Sheet1";
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "אין נתונים": "" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, name);
  
}
