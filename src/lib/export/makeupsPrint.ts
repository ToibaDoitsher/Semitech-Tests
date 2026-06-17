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
 * פריסת דף מדבקות — 3×8 (24 מדבקות לדף A4).
 * המידות מחושבות כך ש-8 שורות × 3 עמודות + שוליים = בדיוק 210×297 מ"מ,
 * כדי שלא «ייפול» תוכן לעמוד נוסף (כמו תבנית דיוור ב-Word).
 * תואם גיליונות Avery L7163 / Word «24 מדבקות» (בערך 63.5×34.6 מ"מ בפועל על A4).
 */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 10;
const MARGIN_LEFT = 7;
const MARGIN_RIGHT = 7;
const COLS = 3;
const ROWS = 8;

export const LABEL_SHEET = {
  cols: COLS,
  rows: ROWS,
  labelsPerPage: COLS * ROWS,
  marginTopMm: MARGIN_TOP,
  marginBottomMm: MARGIN_BOTTOM,
  marginLeftMm: MARGIN_LEFT,
  marginRightMm: MARGIN_RIGHT,
  labelWidthMm: (PAGE_W - MARGIN_LEFT - MARGIN_RIGHT) / COLS,
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
td.note-cell { font-size: 9pt; max-width: 45mm; word-wrap: break-word; }
tr { break-inside: avoid; page-break-inside: avoid; }
`;

export const MAKEUPS_LABELS_PRINT_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
.label-page {
  width: 210mm;
  height: 297mm;
  padding: ${LABEL_SHEET.marginTopMm}mm ${LABEL_SHEET.marginRightMm}mm ${LABEL_SHEET.marginBottomMm}mm ${LABEL_SHEET.marginLeftMm}mm;
  display: grid;
  grid-template-columns: repeat(${LABEL_SHEET.cols}, ${LABEL_SHEET.labelWidthMm}mm);
  grid-template-rows: repeat(${LABEL_SHEET.rows}, ${LABEL_SHEET.labelHeightMm}mm);
  gap: 0;
  page-break-after: always;
  break-after: page;
  overflow: hidden;
}
.label-page:last-child { page-break-after: auto; break-after: auto; }
.label-item {
  width: ${LABEL_SHEET.labelWidthMm}mm;
  height: ${LABEL_SHEET.labelHeightMm}mm;
  padding: 1.2mm 1.8mm;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.label-title {
  font-size: 7pt;
  font-weight: 700;
  line-height: 1.15;
  margin: 0 0 0.6mm;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-line {
  font-size: 6pt;
  line-height: 1.2;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-line-pair {
  font-size: 6pt;
  line-height: 1.2;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-note {
  font-size: 5.5pt;
  line-height: 1.18;
  margin: 0.4mm 0 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  word-break: break-word;
}
.label-note-empty { color: #9ca3af; }
@media print {
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
  <p class="label-line">מבחן: ${exam}</p>
  <p class="label-line">השלמה: ${makeupDate} · מורה: ${teacher}</p>
  <p class="label-line-pair">ציון התחלה: ${startGrade} · בתשלום: ${paid}</p>
  <p class="${noteClass}">${noteText}</p>
</div>`;
}

export function buildMakeupsListPrintHtml({
  rows,
  totalCount,
  isFiltering,
  logoUrl,
  yearName,
}: {
  rows: MakeupPrintRow[];
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
  <td>${row.makeupDate || "—"}</td>
  <td>${row.teacher || "—"}</td>
  <td>${row.startGrade || "—"}</td>
  <td>${row.paid || "—"}</td>
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
      <th>תאריך השלמה</th>
      <th>שם המורה</th>
      <th>ציון התחלה</th>
      <th>בתשלום</th>
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
