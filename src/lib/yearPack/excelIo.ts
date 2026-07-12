import * as XLSX from "xlsx";

/** בונה קובץ xlsx בזיכרון מכותרות + שורות (מערכי ערכים). */
export function aoaToXlsxBuffer(sheetName: string, aoa: (string | number | boolean | null)[][]): Buffer {
  const safeSheet = sheetName.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "Sheet1";
  const ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [[""]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
}

/** קורא גיליון ראשון מקובץ excel לאובייקטים. */
export function readFirstSheetRows(buf: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
}

export async function paginateSelect<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
