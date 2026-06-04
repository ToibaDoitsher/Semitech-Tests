"use client";

import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ListDataCard, ListPageHeader } from "@/components/ui/ListPage";
import { cursorClassForHref } from "@/lib/ui/interactiveCursor";
import { Spinner } from "@/components/ui/Spinner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Severity = "urgent" | "warning" | "info";
type IconKey = "calendar" | "alert" | "clock" | "file" | "send" | "check";

type Notification = {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  body: string;
  href: string;
  icon: IconKey;
  sortDate?: string;
  extraCount?: number;
};

type Counts = { urgent: number; warning: number; info: number; total: number };

const SEVERITY_LABEL: Record<Severity, string> = {
  urgent: "דחוף",
  warning: "התראה",
  info: "מידע",
};

const SEVERITY_PILL: Record<Severity, string> = {
  urgent: "bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",
  warning:
    "bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  info: "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
};

const SEVERITY_LEFT_BORDER: Record<Severity, string> = {
  urgent: "border-r-4 border-r-red-500",
  warning: "border-r-4 border-r-amber-500",
  info: "border-r-4 border-r-sky-500",
};

const SEVERITY_ICON_COLOR: Record<Severity, string> = {
  urgent: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
};

function NotificationIcon({ icon, severity }: { icon: IconKey; severity: Severity }) {
  const cls = `size-5 shrink-0 ${SEVERITY_ICON_COLOR[severity]}`;
  if (icon === "calendar") return <Calendar className={cls} strokeWidth={2} />;
  if (icon === "alert") return <AlertTriangle className={cls} strokeWidth={2} />;
  if (icon === "clock") return <Clock className={cls} strokeWidth={2} />;
  if (icon === "file") return <FileText className={cls} strokeWidth={2} />;
  if (icon === "send") return <Send className={cls} strokeWidth={2} />;
  return <CheckCircle2 className={cls} strokeWidth={2} />;
}

export function NotificationsClient() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<{
    items: Notification[];
    counts: Counts;
    generated_at?: string;
    read_only?: boolean;
  }>("/api/notifications", fetcher, {
    refreshInterval: 60_000,
    refreshWhenHidden: false,
  });

  const [filter, setFilter] = useState<"all" | Severity>("all");

  const items = data?.items ?? [];
  const counts = data?.counts ?? { urgent: 0, warning: 0, info: 0, total: 0 };

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => it.severity === filter);
  }, [items, filter]);

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="התראות"
        subtitle="כל הפעולות הדורשות תשומת לב — מבחנים קרובים, יעדי הגשה, השלמות פתוחות וציונים באיחור"
        actions={
          <button
            type="button"
            onClick={() => void mutate()}
            disabled={isValidating}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200"
          >
            {isValidating ? "מרענן…" : "ריענון"}
          </button>
        }
      />

      {data?.read_only ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          אינך צופה בשנה הפעילה — אין התראות לארכיון.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="סך הכל"
          count={counts.total}
          color="zinc"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <SummaryCard
          label="דחוף"
          count={counts.urgent}
          color="red"
          active={filter === "urgent"}
          onClick={() => setFilter("urgent")}
        />
        <SummaryCard
          label="התראה"
          count={counts.warning}
          color="amber"
          active={filter === "warning"}
          onClick={() => setFilter("warning")}
        />
        <SummaryCard
          label="מידע"
          count={counts.info}
          color="sky"
          active={filter === "info"}
          onClick={() => setFilter("info")}
        />
      </div>

      <ListDataCard>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
            <Spinner className="size-4" />
            טוען התראות…
          </div>
        ) : error ? (
          <p className="px-6 py-10 text-center text-sm text-red-600">
            שגיאה בטעינת התראות: {(error as Error).message}
          </p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
            <CheckCircle2 className="size-12 text-emerald-500" strokeWidth={1.5} />
            <p className="text-sm">
              {filter === "all"
                ? "אין התראות פתוחות — הכל מסודר"
                : `אין התראות בקטגוריה «${SEVERITY_LABEL[filter as Severity]}»`}
            </p>
            <Bell className="size-5 text-zinc-300" strokeWidth={1.5} />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((it) => (
              <li key={it.id}>
                <Link
                  href={it.href}
                  className={`flex items-start gap-3 bg-white px-5 py-4 transition hover:bg-zinc-50 dark:bg-transparent dark:hover:bg-white/5 ${cursorClassForHref(it.href)} ${SEVERITY_LEFT_BORDER[it.severity]}`}
                >
                  <NotificationIcon icon={it.icon} severity={it.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {it.title}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_PILL[it.severity]}`}
                      >
                        {SEVERITY_LABEL[it.severity]}
                      </span>
                      {it.extraCount ? (
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          +{it.extraCount} נושאים נוספים
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{it.body}</p>
                  </div>
                  <span className="self-center text-xs text-sky-700 hover:underline dark:text-sky-300">
                    מעבר →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ListDataCard>

      <p className="text-center text-xs text-zinc-400">
        ההתראות מתעדכנות אוטומטית כל דקה · מבוססות על נתונים חיים מהמערכת
        {data?.generated_at ? ` · נטען לאחרונה ${new Date(data.generated_at).toLocaleTimeString("he-IL")}` : ""}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: "zinc" | "red" | "amber" | "sky";
  active: boolean;
  onClick: () => void;
}) {
  const colorMap: Record<string, { dot: string; ring: string; activeText: string }> = {
    zinc: { dot: "bg-zinc-400", ring: "ring-zinc-300", activeText: "text-zinc-900" },
    red: { dot: "bg-red-500", ring: "ring-red-300", activeText: "text-red-700" },
    amber: { dot: "bg-amber-500", ring: "ring-amber-300", activeText: "text-amber-700" },
    sky: { dot: "bg-sky-500", ring: "ring-sky-300", activeText: "text-sky-700" },
  };
  const c = colorMap[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-right shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900/40 ${
        active ? `ring-2 ${c.ring}` : ""
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className={`size-2 rounded-full ${c.dot}`} />
      </div>
      <span className={`text-2xl font-semibold tabular-nums ${active ? c.activeText : "text-zinc-900 dark:text-zinc-100"}`}>
        {count}
      </span>
    </button>
  );
}
