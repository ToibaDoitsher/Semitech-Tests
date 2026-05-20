import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ENTITY_LABELS, isLookupEntity } from "@/lib/lookups/entities";
import { LOOKUP_EXCEL_EXAMPLES, LOOKUP_EXCEL_HEADER } from "@/lib/lookups/excelTemplate";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
  }

  const title = ENTITY_LABELS[entity];
  const examples = LOOKUP_EXCEL_EXAMPLES[entity];
  const ws = XLSX.utils.aoa_to_sheet([
    [LOOKUP_EXCEL_HEADER],
    ...examples.map((name) => [name]),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lookup_${entity}_template.xlsx"`,
    },
  });
}
