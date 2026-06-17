import { escapePrintText } from "@/lib/export/printClient";

/** שורה מוכנה להדפסה (ערכים כבר מסוננים ל-HTML) */
export type MakeupPrintRow = {
  student: string;
  exam: string;
  teacher: string;
  makeupDate: string;
  startGrade: string;
  paid: string;
  note: string;
};

/**
 * פריסת דף מדבקות — 3×11 (33 מדבקות לדף A4).
 * שוליים: 0.5 ס"מ (5 מ"מ) למעלה ולמטה בלבד; ללא שוליים צדדיים — 3 עמודות שוות על כל רוחב הדף.
 */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_TOP = 5;
const MARGIN_BOTTOM = 5;
const COLS = 3;
const ROWS = 11;

export const LABEL_SHEET = {
  cols: COLS,
  rows: ROWS,
  labelsPerPage: COLS * ROWS,
  marginTopMm: MARGIN_TOP,
  marginBottomMm: MARGIN_BOTTOM,
  marginLeftMm: 0,
  marginRightMm: 0,
  labelWidthMm: PAGE_W / COLS,
  labelHeightMm: (PAGE_H - MARGIN_TOP - MARGIN_BOTTOM) / ROWS,
} as const;

export const MAKEUPS_LIST_PRINT_CSS = `
@page { size: A4; margin: 12mm; }
body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
.print-header { display: flex; align-items: center; gap: 5mm; margin-bottom: 6mm; padding-bottom: 4mm; border-bottom: 1px solid #e5e7eb; }
.print-logo { width: 18mm; height: 18mm; object-fit: contain; flex-shrink: 0; }
.print-header-text { flex: 1; min-width: 0; }
.page-title { font-size: 16pt; font-weight: 700; margin: 0 0 2mm; }
.summary { font-size: 10pt; color: #4b5563; margin: 0; }
.year-line { font-size: 9pt; color: #6b7280; margin: 1mm 0 0; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; }
th, td { border: 1px solid #e5e7eb; padding: 3px 5px; vertical-align: top; text-align: right; }
th { background: #f1f5f9; font-weight: 600; }
td.note-cell { font-size: 9pt; max-width: 55mm; white-space: pre-wrap; word-wrap: break-word; }
tr { break-inside: avoid; page-break-inside: avoid; }
`;

export const MAKEUPS_LABELS_PRINT_CSS = `
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; width: 210mm; }
* { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
.label-page {
  width: 210mm;
  height: 297mm;
  margin: 0;
  padding: ${MARGIN_TOP}mm 0 ${MARGIN_BOTTOM}mm 0;
  display: grid;
  grid-template-columns: repeat(${COLS}, calc(${PAGE_W}mm / ${COLS}));
  grid-template-rows: repeat(${ROWS}, calc((${PAGE_H}mm - ${MARGIN_TOP + MARGIN_BOTTOM}mm) / ${ROWS}));
  gap: 0;
  page-break-after: always;
  break-after: page;
  overflow: hidden;
}
.label-page:last-child { page-break-after: auto; break-after: auto; }
.label-item {
  width: 100%;
  height: 100%;
  padding: 0.5mm 1.5mm;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.label-title {
  font-size: 9.5pt;
  font-weight: 700;
  line-height: 1.08;
  margin: 0 0 0.3mm;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 2mm;
  row-gap: 0.1mm;
  font-size: 8.5pt;
  line-height: 1.08;
}
.label-field {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-field-wide {
  grid-column: 1 / -1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-note {
  font-size: 8pt;
  line-height: 1.08;
  margin: 0.3mm 0 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  word-break: break-word;
}
.label-note-empty { color: #9ca3af; }
@media print {
  html, body { width: 210mm; height: auto; }
  .label-page { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

function labelItemHtml(row: MakeupPrintRow): string {
  const student = row.student || "תלמידה";
  const exam = row.exam || "—";
  const teacher = row.teacher || "—";
  const makeupDate = row.makeupDate || "—";
  const startGrade = row.startGrade || "—";
  const paid = row.paid || "—";
  const noteRaw = row.note.trim();
  const noteClass = noteRaw ? "label-note" : "label-note label-note-empty";
  const noteText = noteRaw ? `הערה: ${row.note}` : "הערה: —";

  return `<div class="label-item">
  <div class="label-title">${student}</div>
  <div class="label-grid">
    <span class="label-field-wide">מבחן: ${exam}</span>
    <span class="label-field">השלמה: ${makeupDate}</span>
    <span class="label-field">מורה: ${teacher}</span>
    <span class="label-field">ציון: ${startGrade}</span>
    <span class="label-field">בתשלום: ${paid}</span>
  </div>
  <p class="${noteClass}">${noteText}</p>
</div>`;
}

export type MakeupListPrintRow = {
  student: string;
  exam: string;
  examDate: string;
  makeupDate: string;
  teacher: string;
  note: string;
};

export function buildMakeupsListPrintHtml({
  rows,
  totalCount,
  isFiltering,
  logoUrl,
  yearName,
}: {
  rows: MakeupListPrintRow[];
  totalCount: number;
  isFiltering: boolean;
  logoUrl: string;
  yearName?: string;
}) {
  const summary = `סה"כ ${rows.length} רשומות${isFiltering ? ` (מסונן מתוך ${totalCount})` : ""}`;
  const yearLine = yearName ? `<p class="year-line">שנת לימודים ${escapePrintText(yearName)}</p>` : "";

  const tableRows = rows
    .map(
      (row) => `<tr>
  <td>${row.student || "—"}</td>
  <td>${row.exam || "—"}</td>
  <td>${row.examDate || "—"}</td>
  <td>${row.makeupDate || "—"}</td>
  <td>${row.teacher || "—"}</td>
  <td class="note-cell">${row.note || "—"}</td>
</tr>`,
    )
    .join("");

  return `<header class="print-header">
  <img class="print-logo" src="${escapePrintText(logoUrl)}" alt="" />
  <div class="print-header-text">
    <h1 class="page-title">רשימת השלמות</h1>
    <p class="summary">${summary}</p>
    ${yearLine}
  </div>
</header>
<table>
  <thead>
    <tr>
      <th>שם תלמידה</th>
      <th>שם המבחן</th>
      <th>תאריך מבחן</th>
      <th>תאריך השלמה</th>
      <th>שם המורה</th>
      <th>הערה</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>`;
}

/** דפי מדבקות בלבד — ללא כותרת, כמו דיוור ב-Word */
export function buildMakeupsLabelsPrintHtml({ rows }: { rows: MakeupPrintRow[] }) {
  const pages = chunk(rows, LABEL_SHEET.labelsPerPage);
  return pages
    .map((pageRows) => {
      const cells = pageRows.map(labelItemHtml).join("");
      const emptySlots = LABEL_SHEET.labelsPerPage - pageRows.length;
      const fillers = emptySlots > 0 ? '<div class="label-item" aria-hidden="true"></div>'.repeat(emptySlots) : "";
      return `<section class="label-page">${cells}${fillers}</section>`;
    })
    .join("");
}
