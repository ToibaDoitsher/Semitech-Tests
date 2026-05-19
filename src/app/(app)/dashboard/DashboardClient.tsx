"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlarmClock, ArrowLeft, CalendarDays, ClipboardList, Eye, Users } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { ListPageHeader } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";

import { apiFetcher } from "@/lib/api/fetcher";

type Item = {
  id: string;
  subject: string;
  exam_date: string;
  teacher_name: string;
  statusLabel: string;
};

type Stats = {
  examsTotal: number;
  examsToday: number;
  examsUpcoming: number;
  makeupsOpen: number;
  studentsTotal: number;
  studentsInMakeup: number;
  trackingTodo: number;
};

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  href,
  staggerIndex = 0,
}: {
  title: string;
  value: number;
  hint: string;
  icon: typeof Users;
  href?: string;
  staggerIndex?: number;
}) {
  const reduce = useReducedMotion();
  const inner = (
    <motion.div
      className="rounded-2xl border border-slate-200/70 bg-white/95 p-5 shadow-[var(--shadow-card)] ring-1 ring-slate-900/[0.02] transition-all hover:-translate-y-[1px] hover:border-slate-300/80 hover:shadow-lg dark:border-zinc-700/60 dark:bg-zinc-900/45 dark:ring-white/[0.04] dark:hover:border-zinc-600/70"
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduce ? 0 : 0.44,
        ease: [0.22, 1, 0.36, 1],
        delay: reduce ? 0 : staggerIndex * 0.07,
      }}
      whileHover={{ y: -1 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50">{value}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/70 bg-gradient-to-b from-white to-zinc-50 p-2.5 text-[var(--color-primary)] shadow-sm dark:border-zinc-700/60 dark:from-zinc-900 dark:to-zinc-900/40">
          <Icon className="size-6" strokeWidth={1.75} />
        </div>
      </div>
      {href ? (
        <div className="mt-4 flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
          <span>מעבר</span>
          <ArrowLeft className="size-4" />
        </div>
      ) : null}
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded-2xl">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function DashboardClient() {
  const reduceMotion = useReducedMotion();
  const { data, error, isLoading } = useSWR<{ items: Item[] }>("/api/exams/upcoming?limit=8", apiFetcher);
  const { data: stats, error: statsErr } = useSWR<Stats>("/api/stats/dashboard", apiFetcher);

  return (
    <div className="space-y-10">
      <ListPageHeader
        title="דף הבית"
        subtitle="סיכום יומיומי — מבחנים קרובים, סטטיסטיקות וקיצורי דרך"
        actions={
          <ExportExcelButton
            label="מבחנים קרובים לאקסל"
            filename="מבחנים-קרובים"
            sheetName="קרובים"
            getRows={async () => {
              const r = await fetch("/api/exams/upcoming?limit=300");
              const j = (await r.json()) as { items?: Item[]; error?: string };
              if (!r.ok) throw new Error(j.error ?? "שגיאה");
              return (j.items ?? []).map((it) => ({
                תאריך: it.exam_date,
                מקצוע: it.subject,
                מורה: it.teacher_name,
                סטטוס: it.statusLabel,
              }));
          }}
        />
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="מבחנים היום"
          value={stats?.examsToday ?? 0}
          hint="תאריך היום"
          icon={CalendarDays}
          href="/calendar"
          staggerIndex={0}
        />
        <StatCard
          title="השלמות פתוחות"
          value={stats?.makeupsOpen ?? 0}
          hint="דורשות טיפול"
          icon={AlarmClock}
          href="/makeups"
          staggerIndex={1}
        />
        <StatCard
          title="מעקב ללא ציונים"
          value={stats?.trackingTodo ?? 0}
          hint="טרם הוגשו / לא הועבר"
          icon={Eye}
          href="/tracking"
          staggerIndex={2}
        />
        <StatCard
          title="תלמידות בהשלמה"
          value={stats?.studentsInMakeup ?? 0}
          hint="סטטוס makeup / missing"
          icon={Users}
          href="/makeups"
          staggerIndex={3}
        />
        <StatCard
          title="מבחנים קרובים"
          value={stats?.examsUpcoming ?? 0}
          hint="מהיום והלאה"
          icon={ClipboardList}
          href="/exams"
          staggerIndex={4}
        />
        <StatCard
          title="תלמידות במערכת"
          value={stats?.studentsTotal ?? 0}
          hint="שנת לימודים פעילה"
          icon={Users}
          href="/students"
          staggerIndex={5}
        />
      </section>

      {statsErr ? (
        <p className="text-sm text-red-600">לא ניתן לטעון סטטיסטיקות: {(statsErr as Error).message}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.section
          className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm shadow-zinc-900/5 ring-1 ring-transparent transition-shadow hover:shadow-md hover:shadow-zinc-900/10 hover:ring-zinc-900/5 dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:shadow-black/30 dark:hover:ring-white/10 lg:col-span-2"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.46,
            ease: [0.22, 1, 0.36, 1],
            delay: reduceMotion ? 0 : 0.4,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">מבחנים קרובים</h3>
            <Link
              href="/calendar"
              className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            >
              יומן מלא
            </Link>
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                טוען…
              </span>
            ) : error ? (
              <span className="text-red-600">{(error as Error).message}</span>
            ) : null}
          </div>
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {(data?.items ?? []).length ? (
              data!.items.map((it) => (
                <li
                  key={it.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-3 first:pt-0 hover:bg-zinc-50/70 dark:hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-950 dark:text-zinc-50">{it.exam_date}</div>
                    <div className="truncate text-sm text-zinc-700 dark:text-zinc-200">
                      {it.subject} · {it.teacher_name}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{it.statusLabel}</div>
                  </div>
                  <Link
                    href={`/exams/${it.id}`}
                    className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md active:scale-[0.98] dark:border-zinc-700/70 dark:bg-zinc-900/30 dark:text-zinc-100 dark:hover:bg-white/5"
                  >
                    פתיחה
                  </Link>
                </li>
              ))
            ) : !isLoading ? (
              <li className="py-12 text-center">
                <CalendarDays className="mx-auto size-10 text-slate-300" strokeWidth={1.25} />
                <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">אין מבחנים קרובים</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">כדי להתחיל — צרי מבחן חדש או עדכני תאריכים</p>
                <Link
                  href="/exams/new"
                  className="mt-4 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-primary-hover)] hover:shadow-md active:scale-[0.98]"
                >
                  מבחן חדש
                </Link>
              </li>
            ) : null}
          </ul>
        </motion.section>

        <motion.section
          className="space-y-3 rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm shadow-zinc-900/5 ring-1 ring-transparent transition-shadow hover:shadow-md hover:shadow-zinc-900/10 hover:ring-zinc-900/5 dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:shadow-black/30 dark:hover:ring-white/10"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.46,
            ease: [0.22, 1, 0.36, 1],
            delay: reduceMotion ? 0 : 0.5,
          }}
        >
          <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">פעולות מהירות</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">מעבר לעמודים המרכזיים</p>
          <div className="mt-2 flex flex-col gap-2">
            {[
              { href: "/students", label: "תלמידות" },
              { href: "/students/import", label: "ייבוא מאקסל" },
              { href: "/exams", label: "מבחנים" },
              { href: "/assignments", label: "שיבוצים" },
              { href: "/tracking", label: "מעקב" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-white hover:shadow-md active:scale-[0.98] dark:border-zinc-700/70 dark:bg-zinc-950/20 dark:text-zinc-100 dark:hover:bg-white/5"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
