"use client";

import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import heLocale from "@fullcalendar/core/locales/he";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListDataCard, ListPageHeader } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { ExamSchedulePrintSheet } from "@/components/calendar/ExamSchedulePrintSheet";
import { PrintButton } from "@/components/PrintButton";
import { useAcademicYear, withYearTermQuery } from "@/components/academicYears/AcademicYearProvider";
import type { CalendarExamProps } from "@/lib/calendar/types";
import { formatGregorianDateLong } from "@/lib/calendar/schedulePrint";
import { formatHebrewDateFromDate, formatHebrewDateFromYmd } from "@/lib/hebrewDate";

function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHebrewCalendar(d: Date): string {
  return formatHebrewDateFromDate(d);
}

function parseLocalYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  return new Date(y, mo - 1, day);
}

function eventStartYmd(ev: EventInput): string {
  const s = ev.start;
  if (!s) return "";
  if (s instanceof Date) return fmtLocalDate(s);
  if (typeof s === "string") return s.length >= 10 ? s.slice(0, 10) : s;
  return "";
}

type XProps = CalendarExamProps;

export function CalendarClient() {
  const { viewingYear, viewingTerm } = useAcademicYear();
  const [rawEvents, setRawEvents] = useState<EventInput[]>([]);
  const [dayExamCount, setDayExamCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventClickArg | null>(null);
  const [dayOpen, setDayOpen] = useState<{ date: string; events: EventInput[] } | null>(null);
  const rangeRef = useRef<{ start: string; end: string } | null>(null);

  const [fTeacher, setFTeacher] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [fClass, setFClass] = useState("");
  const [fSpec, setFSpec] = useState("");
  const [fTrack, setFTrack] = useState("");
  const [fTone, setFTone] = useState("");
  const [printPreview, setPrintPreview] = useState(false);

  const loadRange = useCallback(async (start: Date, endInclusive: Date) => {
    const s = fmtLocalDate(start);
    const e = fmtLocalDate(endInclusive);
    rangeRef.current = { start: s, end: e };
    setLoading(true);
    setLoadError(null);
    try {
      const url = withYearTermQuery(
        `/api/calendar/exams?start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`,
        viewingYear?.id,
        viewingTerm,
      );
      const r = await fetch(url);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאת טעינה");
      setRawEvents((j as { events: EventInput[] }).events ?? []);
      setDayExamCount((j as { dayExamCount?: Record<string, number> }).dayExamCount ?? {});
    } catch (err) {
      setRawEvents([]);
      setDayExamCount({});
      setLoadError((err as Error).message ?? "שגיאת טעינה");
    } finally {
      setLoading(false);
    }
  }, [viewingYear, viewingTerm]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const g = rangeRef.current;
      if (!g) return;
      void (async () => {
        const url = withYearTermQuery(
          `/api/calendar/exams?start=${encodeURIComponent(g.start)}&end=${encodeURIComponent(g.end)}`,
          viewingYear?.id,
          viewingTerm,
        );
        const r = await fetch(url);
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          setLoadError(null);
          setRawEvents((j as { events: EventInput[] }).events ?? []);
          setDayExamCount((j as { dayExamCount?: Record<string, number> }).dayExamCount ?? {});
        }
      })();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [viewingYear, viewingTerm]);

  useEffect(() => {
    const g = rangeRef.current;
    if (!g) return;
    void (async () => {
      const url = withYearTermQuery(
        `/api/calendar/exams?start=${encodeURIComponent(g.start)}&end=${encodeURIComponent(g.end)}`,
        viewingYear?.id,
        viewingTerm,
      );
      const r = await fetch(url);
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setLoadError(null);
        setRawEvents((j as { events: EventInput[] }).events ?? []);
        setDayExamCount((j as { dayExamCount?: Record<string, number> }).dayExamCount ?? {});
      }
    })();
  }, [viewingYear, viewingTerm]);

  const filterOptions = useMemo(() => {
    const teachers = new Map<string, string>();
    const subjects = new Set<string>();
    const grades = new Map<string, string>();
    const classes = new Map<string, string>();
    const specs = new Map<string, string>();
    const tracks = new Map<string, string>();
    const tones = new Set<string>();
    for (const ev of rawEvents) {
      const xp = ev.extendedProps as unknown as XProps;
      if (!xp) continue;
      if (xp.teacherId) teachers.set(xp.teacherId, xp.teacherName || xp.teacherId);
      if (xp.subject) subjects.add(xp.subject);
      if (xp.gradeLevelName) grades.set(xp.gradeLevelName, xp.gradeLevelName);
      if (xp.targetType === "class") classes.set(xp.targetLabel, xp.targetLabel);
      if (xp.targetType === "specialization") specs.set(xp.targetLabel, xp.targetLabel);
      if (xp.targetType === "track") tracks.set(xp.targetLabel, xp.targetLabel);
      if (xp.tone) tones.add(xp.tone);
    }
    return {
      teachers: [...teachers.entries()].sort((a, b) => a[1].localeCompare(b[1], "he")),
      subjects: [...subjects].sort((a, b) => a.localeCompare(b, "he")),
      grades: [...grades.keys()],
      classes: [...classes.keys()].sort((a, b) => a.localeCompare(b, "he")),
      specs: [...specs.keys()].sort((a, b) => a.localeCompare(b, "he")),
      tracks: [...tracks.keys()].sort((a, b) => a.localeCompare(b, "he")),
      tones: [...tones],
    };
  }, [rawEvents]);

  const visibleEvents = useMemo(() => {
    return rawEvents.filter((ev) => {
      const xp = ev.extendedProps as unknown as XProps;
      if (!xp) return true;
      if (fTeacher && xp.teacherId !== fTeacher) return false;
      if (fSubject && xp.subject !== fSubject) return false;
      if (fGrade && xp.gradeLevelName !== fGrade) return false;
      if (fClass && !(xp.targetType === "class" && xp.targetLabel === fClass)) return false;
      if (fSpec && !(xp.targetType === "specialization" && xp.targetLabel === fSpec)) return false;
      if (fTrack && !(xp.targetType === "track" && xp.targetLabel === fTrack)) return false;
      if (fTone && xp.tone !== fTone) return false;
      return true;
    });
  }, [rawEvents, fTeacher, fSubject, fGrade, fClass, fSpec, fTrack, fTone]);

  const printFilters = useMemo(() => {
    const teacherName = fTeacher
      ? filterOptions.teachers.find(([id]) => id === fTeacher)?.[1]
      : undefined;
    return {
      subject: fSubject || undefined,
      grade: fGrade || undefined,
      classTarget: fClass || undefined,
      spec: fSpec || undefined,
      track: fTrack || undefined,
      teacher: teacherName,
    };
  }, [fSubject, fGrade, fClass, fSpec, fTrack, fTeacher, filterOptions.teachers]);

  const printRangeLabel = useMemo(() => {
    const g = rangeRef.current;
    if (!g) return undefined;
    return `תקופה: ${formatGregorianDateLong(g.start)} — ${formatGregorianDateLong(g.end)}`;
  }, [visibleEvents, printPreview]);

  const onDatesSet = useCallback(
    (info: DatesSetArg) => {
      const endEx = new Date(info.end);
      endEx.setMilliseconds(endEx.getMilliseconds() - 1);
      void loadRange(info.start, endEx);
    },
    [loadRange],
  );

  return (
    <div className="space-y-8" dir="rtl">
      <div className="calendar-screen-only space-y-8">
      <ListPageHeader
        title="יומן מבחנים"
        subtitle="חודש / שבוע / יום · תאריך עברי בכל יום · צבעים לפי סטטוס · ריענון כל דקה. מוצגים רק מבחנים עם תאריך מבחן — שיבוץ מורה לכיתה/מסלול בלי יצירת מבחן לא מופיע כאן."
        actions={
          <>
            <button
              type="button"
              onClick={() => setPrintPreview((v) => !v)}
              className="no-print inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900 hover:bg-sky-100"
            >
              {printPreview ? "הסתר תצוגת הדפסה" : "לוח להדפסה"}
            </button>
            {printPreview ? <PrintButton label="הדפס לוח" /> : null}
            <ExportExcelButton
              label="יומן (מסננים) לאקסל"
              filename="יומן-מבחנים"
              sheetName="אירועים"
              getRows={async () =>
                visibleEvents.map((ev) => {
                  const xp = ev.extendedProps as unknown as XProps;
                  const c = xp?.counts;
                  const ymd = eventStartYmd(ev);
                  const hd = parseLocalYmd(ymd);
                  return {
                    תאריך: ymd,
                    תאריך_עברי: hd ? formatHebrewDateFromYmd(ymd) : "",
                    מקצוע: xp?.subject ?? "",
                    מורה: xp?.teacherName ?? "",
                    סוג_יעד: xp?.targetTypeLabel ?? xp?.targetType ?? "",
                    שם_יעד: xp?.targetLabel ?? "",
                    שכבה: xp?.gradeLevelName ?? "",
                    סהכ_תלמידות: c?.total ?? 0,
                    נבחנו: c?.took ?? 0,
                    חסרות: c?.missing ?? 0,
                    השלמות: c?.makeup ?? 0,
                    הושלמו: c?.completed ?? 0,
                    ממתין: c?.pending ?? 0,
                  };
                })
              }
            />
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner className="size-4" />
                טוען אירועים…
              </div>
            ) : null}
            {loadError ? (
              <p className="max-w-md text-sm text-red-600" role="alert">
                {loadError}
              </p>
            ) : null}
          </>
        }
      />

      <ListDataCard>
        <div className="grid gap-3 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect label="מורה" value={fTeacher} onChange={setFTeacher} options={filterOptions.teachers.map(([id, name]) => ({ id, name }))} />
        <FilterSelect label="מקצוע" value={fSubject} onChange={setFSubject} options={filterOptions.subjects.map((s) => ({ id: s, name: s }))} />
        <FilterSelect
          label="שכבה (מזוהה משיבוץ)"
          value={fGrade}
          onChange={setFGrade}
          options={filterOptions.grades.map((g) => ({ id: g, name: g.slice(0, 8) }))}
        />
        <FilterSelect label="כיתה (יעד)" value={fClass} onChange={setFClass} options={filterOptions.classes.map((n) => ({ id: n, name: n }))} />
        <FilterSelect label="התמחות (יעד)" value={fSpec} onChange={setFSpec} options={filterOptions.specs.map((n) => ({ id: n, name: n }))} />
        <FilterSelect label="מסלול (יעד)" value={fTrack} onChange={setFTrack} options={filterOptions.tracks.map((n) => ({ id: n, name: n }))} />
        <FilterSelect
          label="סטטוס ויזואלי"
          value={fTone}
          onChange={setFTone}
          options={filterOptions.tones.map((t) => ({
            id: t,
            name:
              t === "future"
                ? "עתידי"
                : t === "took"
                  ? "נבחנו במועד"
                  : t === "completed"
                    ? "הושלמו בהשלמה"
                    : t === "makeup"
                      ? "יש השלמות"
                      : t === "problem"
                        ? "בעיה"
                        : t === "pending"
                          ? "ממתין"
                          : t === "mixed"
                            ? "מעורב"
                            : t,
          }))}
        />
      </div>
      </ListDataCard>

      <div className="legend flex flex-wrap gap-3 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-zinc-200" /> עתידי
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-300" /> נבחנו במועד
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-sky-300" /> הושלמו בהשלמה
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-amber-200" /> השלמות / חסרות
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-red-300" /> בעיה / חוסר נתונים
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-orange-300" /> עומס יום (&gt;5)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-fuchsia-300" /> מורה — 2+ מבחנים באותו יום
        </span>
      </div>

      <div className="calendar-shell rounded-xl border border-zinc-200 bg-white p-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          locale={heLocale}
          direction="rtl"
          height="auto"
          headerToolbar={{
            right: "prev,next today",
            center: "title",
            left: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          buttonText={{ today: "היום" }}
          events={visibleEvents}
          datesSet={onDatesSet}
          dayHeaderContent={(arg) => (
            <div className="flex items-center justify-center py-1 leading-tight">
              <span>{arg.text}</span>
            </div>
          )}
          dayCellContent={(arg) => (
            <div className="flex flex-col items-end gap-0.5 leading-tight">
              <span className="fc-daygrid-day-number">{arg.dayNumberText}</span>
              <span className="text-[10px] font-normal text-zinc-500">{formatHebrewCalendar(arg.date)}</span>
            </div>
          )}
          dateClick={(info) => {
            const k = fmtLocalDate(info.date);
            const dayEvents = visibleEvents.filter((ev) => eventStartYmd(ev) === k);
            setDayOpen({ date: k, events: dayEvents });
          }}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            setDetail(info);
          }}
          dayCellClassNames={(arg) => {
            const k = fmtLocalDate(arg.date);
            const n = dayExamCount[k] ?? 0;
            return n > 5 ? ["day-overload"] : [];
          }}
        />
      </div>
      </div>

      {printPreview ? (
        <div className="exam-schedule-print-root rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <ExamSchedulePrintSheet
            events={visibleEvents}
            filters={printFilters}
            academicYearName={viewingYear?.year_name}
            rangeLabel={printRangeLabel}
          />
        </div>
      ) : null}

      {dayOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setDayOpen(null)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-zinc-900">מבחנים ב־{dayOpen.date}</h2>
            {parseLocalYmd(dayOpen.date) ? (
              <p className="mt-1 text-sm text-zinc-500">{formatHebrewCalendar(parseLocalYmd(dayOpen.date)!)}</p>
            ) : null}
            <ul className="mt-4 space-y-2">
              {dayOpen.events.length ? (
                dayOpen.events.map((ev) => {
                  const xp = ev.extendedProps as unknown as XProps;
                  return (
                    <li key={String(ev.id)}>
                      <Link
                        href={`/exams/${xp.examId}`}
                        className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                        onClick={() => setDayOpen(null)}
                      >
                        <span className="font-medium">{xp?.subject}</span>
                        <span className="text-zinc-600"> · {xp?.teacherName}</span>
                      </Link>
                    </li>
                  );
                })
              ) : (
                <li className="text-sm text-zinc-500">אין מבחנים ביום זה (לפי המסננים)</li>
              )}
            </ul>
            <button type="button" className="mt-4 rounded-lg border border-zinc-300 px-3 py-2 text-sm" onClick={() => setDayOpen(null)}>
              סגירה
            </button>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const xp = detail.event.extendedProps as unknown as XProps;
              const c = xp.counts;
              const examD = parseLocalYmd(xp.examDate);
              const heb = examD ? formatHebrewCalendar(examD) : "";
              return (
                <>
                  <h2 className="text-lg font-semibold text-zinc-900">{xp.subject}</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {xp.teacherName} · {xp.examDate}
                    {heb ? ` (${heb})` : ""}
                  </p>
                  <p className="mt-2 text-sm text-zinc-700">
                    יעד: {xp.targetTypeLabel} {xp.targetLabel}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-zinc-800">
                    <li>סה״כ תלמידות: {c.total}</li>
                    <li>נבחנו במועד: {c.took}</li>
                    <li>להשלמה / ממתין: {c.pending + c.missing + c.makeup}</li>
                    <li>הושלמו בהשלמה: {c.completed}</li>
                  </ul>
                  {xp.classConflict ? (
                    <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-2 py-2 text-xs text-amber-900">
                      ייתכן עומס מבחנים לכיתה — יותר ממבחן אחד לאותה כיתה באותו יום
                    </p>
                  ) : null}
                  {xp.teacherOverlap ? (
                    <p className="mt-3 rounded-md border border-fuchsia-300 bg-fuchsia-50 px-2 py-2 text-xs text-fuchsia-900">
                      למורה זו יש יותר ממבחן אחד באותו יום
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/exams/${xp.examId}`}
                      className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm text-white"
                    >
                      מעבר למסך מבחן
                    </Link>
                    <button type="button" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" onClick={() => setDetail(null)}>
                      סגירה
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-zinc-700">{label}</span>
      <select
        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">הכל</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
