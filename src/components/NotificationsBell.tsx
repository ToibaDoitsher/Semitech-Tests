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
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
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

const SEVERITY_DOT: Record<Severity, string> = {
  urgent: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  urgent: "דחוף",
  warning: "התראה",
  info: "מידע",
};

const SEVERITY_ROW_BG: Record<Severity, string> = {
  urgent: "hover:bg-red-50/70 dark:hover:bg-red-950/20",
  warning: "hover:bg-amber-50/70 dark:hover:bg-amber-950/20",
  info: "hover:bg-sky-50/70 dark:hover:bg-sky-950/20",
};

const SEVERITY_ICON_COLOR: Record<Severity, string> = {
  urgent: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
};

function NotificationIcon({ icon, severity }: { icon: IconKey; severity: Severity }) {
  const cls = `size-4 shrink-0 ${SEVERITY_ICON_COLOR[severity]}`;
  if (icon === "calendar") return <Calendar className={cls} strokeWidth={2} />;
  if (icon === "alert") return <AlertTriangle className={cls} strokeWidth={2} />;
  if (icon === "clock") return <Clock className={cls} strokeWidth={2} />;
  if (icon === "file") return <FileText className={cls} strokeWidth={2} />;
  if (icon === "send") return <Send className={cls} strokeWidth={2} />;
  return <CheckCircle2 className={cls} strokeWidth={2} />;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useSWR<{ items: Notification[]; counts: Counts; read_only?: boolean }>(
    "/api/notifications",
    fetcher,
    {
      refreshInterval: 120_000,
      refreshWhenHidden: false,
      dedupingInterval: 30_000,
    },
  );

  // סגירה בלחיצה מחוץ
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const items = data?.items ?? [];
  const counts = data?.counts ?? { urgent: 0, warning: 0, info: 0, total: 0 };
  // badge = דחוף + התראות בלבד. מידע לא "שורף" את האייקון
  const badgeCount = counts.urgent + counts.warning;

  const top = items.slice(0, 12);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className="relative rounded-xl border border-zinc-200 bg-white p-2 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900"
        onClick={() => setOpen((o) => !o)}
        aria-label="התראות"
        aria-expanded={open}
      >
        <Bell className="size-5 text-zinc-700 dark:text-zinc-200" />
        {badgeCount > 0 ? (
          <span
            className={`absolute -end-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow ${
              counts.urgent > 0 ? "bg-red-500" : "bg-amber-500"
            }`}
            aria-label={`${badgeCount} התראות חדשות`}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute end-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
          role="dialog"
          aria-label="התראות"
        >
          {/* כותרת */}
          <div className="flex items-center justify-between border-b border-zinc-200/70 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-700/70 dark:bg-zinc-800/40">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">התראות</h3>
              {counts.total > 0 ? (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {counts.total}
                </span>
              ) : null}
            </div>
            {counts.total > 0 ? (
              <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                {counts.urgent > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-red-500" />
                    {counts.urgent} דחוף
                  </span>
                ) : null}
                {counts.warning > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    {counts.warning}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* רשימה */}
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {isLoading && !data ? (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">טוען…</li>
            ) : top.length ? (
              top.map((it) => (
                <li key={it.id}>
                  <Link
                    href={it.href}
                    className={`flex items-start gap-2.5 px-4 py-2.5 text-right text-sm transition ${
                      SEVERITY_ROW_BG[it.severity]
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <span
                      className={`mt-1 size-2 shrink-0 rounded-full ${SEVERITY_DOT[it.severity]}`}
                      aria-label={SEVERITY_LABEL[it.severity]}
                    />
                    <NotificationIcon icon={it.icon} severity={it.severity} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {it.title}
                        {it.extraCount ? (
                          <span className="ms-1 text-xs font-normal text-zinc-500">
                            (+{it.extraCount} נושאים נוספים)
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {it.body}
                      </span>
                    </span>
                  </Link>
                </li>
              ))
            ) : (
              <li className="px-4 py-8 text-center text-sm text-zinc-500">
                <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-500" strokeWidth={2} />
                אין התראות פתוחות — הכל מסודר
              </li>
            )}
          </ul>

          {/* תחתית — קישור לעמוד מלא + הסבר */}
          {items.length > top.length ? (
            <div className="border-t border-zinc-200/70 bg-zinc-50/50 px-4 py-2 text-center text-xs dark:border-zinc-700/70 dark:bg-zinc-800/30">
              <Link
                href="/notifications"
                className="font-medium text-sky-700 hover:underline dark:text-sky-300"
                onClick={() => setOpen(false)}
              >
                צפי בכל ההתראות ({items.length})
              </Link>
            </div>
          ) : counts.total > 0 ? (
            <div className="border-t border-zinc-200/70 bg-zinc-50/50 px-4 py-2 text-center text-[11px] text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-800/30">
              <Link
                href="/notifications"
                className="hover:underline"
                onClick={() => setOpen(false)}
              >
                עמוד התראות מלא
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
