import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { importYearPack, type YearPackFileInput } from "@/lib/yearPack/importPack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const scope = await resolveAcademicYearScope(
      supabase,
      scopeFromSearchParams(new URL(request.url).searchParams),
    );
    if (scope.readOnly) {
      return NextResponse.json(readOnlyResponse(), { status: 403 });
    }

    const form = await request.formData();
    const files: YearPackFileInput[] = [];
    const seen = new Set<string>();

    for (const value of [...form.getAll("files"), ...form.getAll("file")]) {
      if (!(value instanceof Blob) || value.size === 0) continue;
      const file = value instanceof File ? value : null;
      const relative = file?.webkitRelativePath?.trim() || "";
      const name = relative || file?.name || "file.xlsx";
      if (!/\.(xlsx|xlsm|xls)$/i.test(name)) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      files.push({ name, buffer: Buffer.from(await value.arrayBuffer()) });
    }

    const result = await importYearPack(supabase, scope.year.id, files);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאת ייבוא" },
      { status: 500 },
    );
  }
}
