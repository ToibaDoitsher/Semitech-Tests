import { NextResponse } from "next/server";
import JSZip from "jszip";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { importYearPack, type YearPackFileInput } from "@/lib/yearPack/importPack";
import { matchYearPackPart } from "@/lib/yearPack/manifest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

async function filesFromZip(buf: Buffer): Promise<YearPackFileInput[]> {
  const zip = await JSZip.loadAsync(buf);
  const out: YearPackFileInput[] = [];
  const seen = new Set<string>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry || entry.dir) continue;
    const key = matchYearPackPart(path);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const data = await entry.async("uint8array");
    out.push({ name: path, buffer: Buffer.from(data) });
  }
  return out;
}

async function collectUploadFiles(form: FormData): Promise<YearPackFileInput[]> {
  const files: YearPackFileInput[] = [];
  const seenKeys = new Set<string>();

  for (const value of [...form.getAll("files"), ...form.getAll("file"), ...form.getAll("zip")]) {
    if (!(value instanceof Blob) || value.size === 0) continue;
    const file = value instanceof File ? value : null;
    const relative = file?.webkitRelativePath?.trim() || "";
    const name = relative || file?.name || "file.xlsx";

    if (/\.zip$/i.test(name) || value.type === "application/zip" || value.type === "application/x-zip-compressed") {
      const fromZip = await filesFromZip(Buffer.from(await value.arrayBuffer()));
      for (const f of fromZip) {
        const key = matchYearPackPart(f.name);
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        files.push(f);
      }
      continue;
    }

    if (!/\.(xlsx|xlsm|xls)$/i.test(name)) continue;
    const key = matchYearPackPart(name);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    files.push({ name, buffer: Buffer.from(await value.arrayBuffer()) });
  }

  return files;
}

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
    const files = await collectUploadFiles(form);
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
