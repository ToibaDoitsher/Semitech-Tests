import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

/** כותרות בעברית — שורת הדוגמה חייבת להתאים לשמות קיימים בלוקאפים (הגדרות) */
export async function GET() {
  const headers = ["שם פרטי", "שם משפחה", "תעודת זהות", "שכבה", "כיתה", "התמחות", "מסלול"];
  const example = ["לאה", "כהן", "000000000", "א", "יג1", "גרפיקה", "הוראה"];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "תלמידות");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const body = new Uint8Array(buf);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="students_template.xlsx"',
    },
  });
}
