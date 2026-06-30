import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";
import { escapePrintText } from "@/lib/export/printClient";
import { studentProfileFields, type StudentDisplayFields } from "@/lib/students/display";
import type { StudentCardData } from "@/lib/students/loadStudentCardData";
import type { ExamStudentStatus, MakeupExamStatus } from "@/lib/types/db";

const EXAM_STATUS: Record<ExamStudentStatus, string> = {
  pending: "ממתין",
  took: "נבחנה במועד",
  missing: "לא נבחנה",
  makeup: "בהשלמה",
  completed: "הושלמה בהשלמה",
};

const MAKEUP_STATUS: Record<MakeupExamStatus, string> = {
  open: "פתוח",
  completed: "הושלם",
};

export const STUDENT_CARD_PRINT_CSS = `
@page { size: A4; margin: 10mm; }
html, body { margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #111827;
  font-size: 10pt;
  line-height: 1.35;
}
.student-card {
  page-break-after: always;
  break-after: page;
  min-height: 0;
}
.student-card:last-child {
  page-break-after: auto;
  break-after: auto;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 5mm;
  margin-bottom: 4mm;
  padding-bottom: 3mm;
  border-bottom: 1px solid #d1d5db;
}
.card-logo {
  width: 22mm;
  height: 22mm;
  object-fit: contain;
  flex-shrink: 0;
}
.card-title-block { flex: 1; min-width: 0; }
.card-name {
  margin: 0;
  font-size: 16pt;
  font-weight: 700;
  line-height: 1.2;
}
.card-tz {
  margin: 1mm 0 0;
  font-size: 10pt;
  color: #4b5563;
}
.profile-line {
  margin: 0 0 4mm;
  padding: 2.5mm 3mm;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 2mm;
  font-size: 9.5pt;
  line-height: 1.45;
  word-wrap: break-word;
}
.section-title {
  margin: 3mm 0 1.5mm;
  font-size: 11pt;
  font-weight: 700;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
  margin-bottom: 3mm;
}
.data-table th,
.data-table td {
  border: 1px solid #e5e7eb;
  padding: 2px 4px;
  text-align: right;
  vertical-align: top;
}
.data-table th {
  background: #f1f5f9;
  font-weight: 600;
}
.data-table tr {
  break-inside: avoid;
  page-break-inside: avoid;
}
.empty-row {
  color: #6b7280;
  font-style: italic;
  padding: 2mm 0;
  font-size: 9pt;
}
`;

function profileLineHtml(student: StudentDisplayFields & { first_name?: string; last_name?: string }) {
  const parts = studentProfileFields(student)
    .filter((f) => f.label !== "הערות")
    .map((f) => `${f.label}: ${f.value}`)
    .filter((s) => !s.endsWith(": —"));
  return escapePrintText(parts.join(" · "));
}

function formatDateYmd(ymd: string | null | undefined) {
  if (!ymd) return "—";
  const d = ymd.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? formatHebrewDateFromYmd(d) : "—";
}

export function estimateStudentCardPages(card: StudentCardData): number {
  const rows = card.exam_students.length + card.makeups.length;
  if (rows <= 12) return 1;
  if (rows <= 24) return 2;
  return 1 + Math.ceil((rows - 12) / 12);
}

export function estimateTotalCardPages(cards: StudentCardData[]): number {
  return cards.reduce((sum, c) => sum + estimateStudentCardPages(c), 0);
}

export function buildStudentCardSectionHtml(
  card: StudentCardData,
  logoUrl: string,
): string {
  const s = card.student;
  const name = escapePrintText(`${s.last_name} ${s.first_name}`);
  const tz = escapePrintText(s.tz);

  const examRows = card.exam_students.length
    ? card.exam_students
        .map((row) => {
          const subject = escapePrintText(row.exam?.subject ?? "מבחן");
          const date = escapePrintText(formatDateYmd(row.exam?.exam_date));
          const teacher = escapePrintText(row.exam?.teacher_name ?? "—");
          const status = escapePrintText(EXAM_STATUS[row.status] ?? row.status);
          return `<tr>
            <td>${subject}</td>
            <td>${date}</td>
            <td>${teacher}</td>
            <td>${status}</td>
          </tr>`;
        })
        .join("")
    : "";

  const makeupRows = card.makeups.length
    ? card.makeups
        .map((m) => {
          const subject = escapePrintText(m.exam?.subject ?? "מבחן");
          const examDate = escapePrintText(formatDateYmd(m.exam?.exam_date));
          const makeupDate = escapePrintText(formatDateYmd(m.completed_at));
          const status = escapePrintText(MAKEUP_STATUS[m.status] ?? m.status);
          const grade = m.grade != null ? escapePrintText(String(m.grade)) : "—";
          return `<tr>
            <td>${subject}</td>
            <td>${examDate}</td>
            <td>${makeupDate}</td>
            <td>${status}</td>
            <td>${grade}</td>
          </tr>`;
        })
        .join("")
    : "";

  return `<section class="student-card">
  <header class="card-header">
    <img class="card-logo" src="${escapePrintText(logoUrl)}" alt="" />
    <div class="card-title-block">
      <h1 class="card-name">${name}</h1>
      <p class="card-tz">ת״ז <span dir="ltr">${tz}</span></p>
    </div>
  </header>
  <p class="profile-line">${profileLineHtml(s)}</p>
  <h2 class="section-title">מבחנים</h2>
  ${
    examRows
      ? `<table class="data-table">
    <thead><tr>
      <th>מקצוע</th><th>תאריך מבחן</th><th>מורה</th><th>סטטוס</th>
    </tr></thead>
    <tbody>${examRows}</tbody>
  </table>`
      : `<p class="empty-row">אין רישומי מבחנים</p>`
  }
  <h2 class="section-title">השלמות</h2>
  ${
    makeupRows
      ? `<table class="data-table">
    <thead><tr>
      <th>מקצוע</th><th>תאריך מבחן</th><th>תאריך השלמה</th><th>סטטוס</th><th>ציון</th>
    </tr></thead>
    <tbody>${makeupRows}</tbody>
  </table>`
      : `<p class="empty-row">אין השלמות</p>`
  }
</section>`;
}

export function buildStudentCardsPrintHtml(cards: StudentCardData[], logoUrl: string): string {
  return cards.map((c) => buildStudentCardSectionHtml(c, logoUrl)).join("\n");
}
