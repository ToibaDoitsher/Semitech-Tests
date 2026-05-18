import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { STUDENT_EXCEL_EXAMPLE_ROW, STUDENT_EXCEL_HEADERS } from "@/lib/students/excelTemplate";

export const dynamic = "force-dynamic";

export async function GET() {
  const ws = XLSX.utils.aoa_to_sheet([
    [...STUDENT_EXCEL_HEADERS],
    [...STUDENT_EXCEL_EXAMPLE_ROW],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "תלמידות");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="students_template.xlsx"',
    },
  });
}
