"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { Download, Upload } from "lucide-react";
import {
  useAcademicYear,
  withYearQuery,
} from "@/components/academicYears/AcademicYearProvider";
import { ListPageHeader } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import type { AcademicYearRow } from "@/lib/academicYears/types";
import { YEAR_PACK_PARTS, matchYearPackPart } from "@/lib/yearPack/manifest";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
  return j as { years: AcademicYearRow[] };
};

type PackPartResult = {
  key: string;
  label: string;
  inserted: number;
  updated: number;
  failed: number;
};

export function AcademicYearsClient() {
  const { refresh, viewingYear, readOnly } = useAcademicYear();
  const { data, error, isLoading, mutate } = useSWR("/api/academic-years", fetcher);
  const [yearName, setYearName] = useState("");
  const [setActive, setSetActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [packBusy, setPackBusy] = useState<"export" | "import" | null>(null);
  const [packMsg, setPackMsg] = useState<string | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const years = data?.years ?? [];
  const yearId = viewingYear?.id ?? null;
  const yearLabel = viewingYear?.year_name ?? "השנה הנצפית";

  async function createYear(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year_name: yearName, set_active: setActive }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setYearName("");
      await mutate();
      await refresh();
      setMsg("שנה נוצרה בהצלחה");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string) {
    setMsg(null);
    const r = await fetch("/api/academic-years", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active_year_id: id }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg((j as { error?: string }).error ?? "שגיאה");
      return;
    }
    await mutate();
    await refresh();
    setMsg("השנה הפעילה עודכנה");
  }

  async function exportYearPack() {
    if (!yearId) {
      setPackMsg("אין שנה נצפית לייצוא");
      return;
    }
    setPackBusy("export");
    setPackMsg(null);
    try {
      const r = await fetch(withYearQuery("/api/academic-years/year-pack/export", yearId));
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "שגיאת ייצוא");
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition") ?? "";
      const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
      const rawName = decodeURIComponent(m?.[1] || m?.[2] || `year-pack-${yearLabel}.zip`);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = rawName;
      a.click();
      URL.revokeObjectURL(a.href);
      setPackMsg(`הורד ZIP לשנת ${yearLabel} (${YEAR_PACK_PARTS.map((p) => p.label).join(", ")})`);
    } catch (err) {
      setPackMsg((err as Error).message);
    } finally {
      setPackBusy(null);
    }
  }

  async function postYearPack(fd: FormData) {
    if (readOnly) {
      setPackMsg("שנה בארכיון — ייבוא חסום");
      return;
    }
    if (!yearId) {
      setPackMsg("אין שנה פעילה לייבוא");
      return;
    }
    setPackBusy("import");
    setPackMsg("מייבא… זה יכול לקחת דקה–שתיים בקבצים גדולים. אל תסגרי את הדף.");
    try {
      const r = await fetch(withYearQuery("/api/academic-years/year-pack/import", yearId), {
        method: "POST",
        body: fd,
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        parts?: PackPartResult[];
      };
      if (!r.ok) throw new Error(j.error ?? "שגיאת ייבוא");
      const summary = (j.parts ?? [])
        .map(
          (p) =>
            `${p.label}: +${p.inserted} / עדכון ${p.updated}${p.failed ? ` / כשל ${p.failed}` : ""}`,
        )
        .join(" · ");
      setPackMsg(summary || "הייבוא הושלם");
      await refresh();
    } catch (err) {
      const m = (err as Error).message || "";
      if (/failed to fetch|networkerror|load failed/i.test(m)) {
        setPackMsg(
          "החיבור נקטע או שהשרת איטי. רענני את הדף ובדקי אם הנתונים כבר נכנסו. מומלץ ייבוא ZIP.",
        );
      } else {
        setPackMsg(m || "שגיאת ייבוא");
      }
    } finally {
      setPackBusy(null);
      if (zipInputRef.current) zipInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }

  async function onZipSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      setPackMsg("יש לבחור קובץ ZIP (אותו קובץ שהורדת בייצוא)");
      return;
    }
    const fd = new FormData();
    fd.append("zip", file);
    await postYearPack(fd);
  }

  async function onFolderSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    const picked = new Map<string, File>();
    for (const f of Array.from(fileList)) {
      const key = matchYearPackPart(f.webkitRelativePath || f.name);
      if (key) picked.set(key, f);
    }
    if (!picked.size) {
      setPackMsg(
        `לא נמצאו קבצי חבילת שנה בתיקייה. צפויים: ${YEAR_PACK_PARTS.map((p) => p.filename).join(", ")}`,
      );
      return;
    }
    const fd = new FormData();
    for (const f of picked.values()) fd.append("files", f);
    await postYearPack(fd);
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="שנות לימוד"
        subtitle="כל שנה היא מערכת עצמאית — אין העתקה או קידום בין שנים. רק שנה אחת פעילה."
      />

      <section className="rounded-2xl border bg-white p-6 dark:bg-zinc-900/40">
        <h2 className="text-lg font-semibold">ייצוא / ייבוא שנה</h2>
        <p className="mt-1 text-sm text-zinc-600">
          לשנה הנצפית כרגע: <span className="font-medium">{yearLabel}</span>
          {readOnly ? " (ארכיון — ייבוא חסום)" : ""}. כולל כיתות, התמחויות, מסלולים, מורות,
          תלמידות ושיבוצים — ללא מבחנים, השלמות ומעקב.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          מומלץ: ייצוא → הורדת ZIP → ייבוא אותו ZIP לשנה החדשה. תיקייה פתוחה עלולה להיכשל אם יש בה הרבה
          קבצים.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!yearId || packBusy !== null}
            onClick={() => void exportYearPack()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" aria-hidden />
            {packBusy === "export" ? "מייצא…" : "ייצוא"}
          </button>
          <button
            type="button"
            disabled={!yearId || readOnly || packBusy !== null}
            onClick={() => zipInputRef.current?.click()}
            title={readOnly ? "ייבוא חסום בארכיון" : "ייבוא קובץ ZIP מהייצוא"}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden />
            {packBusy === "import" ? "מייבא…" : "ייבוא ZIP"}
          </button>
          <button
            type="button"
            disabled={!yearId || readOnly || packBusy !== null}
            onClick={() => folderInputRef.current?.click()}
            title={readOnly ? "ייבוא חסום בארכיון" : "ייבוא מתיקייה עם קבצי האקסל"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            ייבוא תיקייה
          </button>
          <input
            ref={zipInputRef}
            type="file"
            className="hidden"
            accept=".zip,application/zip"
            onChange={(e) => void onZipSelected(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            multiple
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => void onFolderSelected(e.target.files)}
          />
        </div>
        {packMsg ? <p className="mt-3 text-sm text-zinc-600">{packMsg}</p> : null}
      </section>

      <form onSubmit={createYear} className="rounded-2xl border bg-white p-6 dark:bg-zinc-900/40">
        <h2 className="text-lg font-semibold">פתיחת שנת לימודים</h2>
        <p className="mt-1 text-sm text-zinc-600">
          השנה הקודמת נשארת בארכיון. מעלים מחדש תלמידות, מורות, כיתות ושיבוצים לשנה החדשה.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            <span className="font-medium">שם שנה (למשל תשפ״ז)</span>
            <input
              required
              value={yearName}
              onChange={(e) => setYearName(e.target.value)}
              className="mt-1 block w-48 rounded-lg border px-3 py-2"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={setActive} onChange={(e) => setSetActive(e.target.checked)} />
            הפוך לשנה פעילה
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "פותח…" : "פתיחת שנה"}
          </button>
        </div>
        {msg ? <p className="mt-3 text-sm text-zinc-600">{msg}</p> : null}
      </form>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <p className="text-red-600">{(error as Error).message}</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-white dark:bg-zinc-900/40">
          {years.map((y) => (
            <li key={y.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">
                {y.year_name}
                {y.is_active ? (
                  <span className="ms-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">פעילה</span>
                ) : null}
              </span>
              {!y.is_active ? (
                <button
                  type="button"
                  onClick={() => void activate(y.id)}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  הפוך לפעילה
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
