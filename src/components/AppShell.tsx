"use client";

import { motion } from "framer-motion";
import {
  AlarmClock,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  Eye,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings2,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

const nav: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: LayoutDashboard },
  { href: "/students", label: "תלמידות", icon: Users },
  { href: "/students/import", label: "ייבוא", icon: Upload },
  { href: "/teachers", label: "מורות", icon: GraduationCap },
  { href: "/assignments", label: "שיבוצים", icon: ListChecks },
  { href: "/exams", label: "מבחנים", icon: BookOpen },
  { href: "/calendar", label: "יומן", icon: CalendarDays },
  { href: "/makeups", label: "השלמות", icon: AlarmClock },
  { href: "/tracking", label: "מעקב", icon: Eye },
  { href: "/settings", label: "לוקאפים", icon: Settings2 },
];

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/students/import") return pathname.startsWith("/students/import");
  if (item.href === "/students") return pathname.startsWith("/students") && !pathname.startsWith("/students/import");
  if (item.href === "/settings") return pathname.startsWith("/settings");
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function titleForPath(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/") return "בית";
  const map: Record<string, string> = {
    students: "תלמידות",
    teachers: "מורות",
    assignments: "שיבוצים",
    exams: "מבחנים",
    calendar: "יומן מבחנים",
    makeups: "השלמות",
    tracking: "מעקב מבחנים",
    settings: "לוקאפים והגדרות",
    import: "ייבוא תלמידות",
    new: "חדש",
    edit: "עריכה",
  };
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (parts[0] && map[parts[0]]) {
    if (last === "import") return map.import;
    if (last === "new") return `${map[parts[0]]} — ${map.new}`;
    if (last === "edit") return `${map[parts[0]]} — ${map.edit}`;
    if (parts.length > 1 && parts[0] === "students") return "תלמידה";
    if (parts.length > 1 && parts[0] === "exams") return "מבחן";
    return map[parts[0]] ?? "מערכת מבחנים";
  }
  return "מערכת מבחנים";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const pageTitle = useMemo(() => titleForPath(pathname), [pathname]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const sidebarWidthClass = collapsed ? "w-[var(--sidebar-w-collapsed)]" : "w-[var(--sidebar-w)]";

  return (
    <div className="flex min-h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
      <aside
        className={`flex shrink-0 flex-col border-e border-[var(--border)] bg-[var(--surface)] shadow-sm transition-[width] duration-200 ${sidebarWidthClass}`}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
          <Link
            href="/dashboard"
            className={[
              "flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-slate-100 dark:hover:bg-white/10",
              collapsed ? "justify-center" : "",
            ].join(" ")}
            title="בית"
          >
            <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <Image src="/logo.png" alt="לוגו" fill className="object-contain p-1.5" sizes="36px" priority />
            </span>
            {!collapsed ? <span className="truncate text-sm font-bold text-[var(--foreground)]">מערכת מבחנים</span> : null}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-lg p-1.5 text-[var(--muted)] ring-1 ring-transparent transition hover:bg-slate-100 hover:text-[var(--foreground)] hover:ring-slate-300 hover:shadow-sm active:scale-95 dark:hover:bg-white/10 dark:hover:ring-white/20"
            title={collapsed ? "הרחבה" : "כיווץ"}
          >
            <ChevronLeft className={`size-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {nav.map((item) => {
            const active = isNavActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ring-1 ring-transparent transition-all outline-none",
                  active
                    ? "bg-[var(--color-primary)] text-white shadow-md hover:bg-[var(--color-primary-hover)] hover:text-white hover:shadow-lg [&_svg]:text-white [&_svg]:opacity-100 hover:[&_svg]:text-white"
                    : "text-[var(--foreground)] hover:bg-slate-100 hover:text-slate-900 hover:shadow-md hover:ring-slate-200/90 [&_svg]:text-[var(--muted)] hover:[&_svg]:text-slate-800 active:scale-[0.98] dark:hover:bg-slate-700/90 dark:hover:text-zinc-50 dark:hover:ring-slate-500/40 dark:[&_svg]:text-zinc-400 dark:hover:[&_svg]:text-zinc-50",
                  collapsed ? "justify-center px-2" : "",
                ].join(" ")}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="size-5 shrink-0 opacity-90" strokeWidth={1.75} />
                {!collapsed ? <span className="truncate text-inherit">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-2">
          <div className={["mb-2 flex flex-col gap-2", collapsed ? "items-center" : ""].join(" ")}>
            <a
              href="mailto:t025959714@gmail.com"
              className={["group rounded-xl border border-zinc-200 bg-white/70 p-2 shadow-sm transition hover:bg-white hover:shadow-md dark:border-zinc-700/60 dark:bg-zinc-900/30 dark:hover:bg-white/5", collapsed ? "w-auto" : "w-full"].join(" ")}
              title="שליחת מייל"
            >
              <div className="flex justify-center">
                <span className="relative h-9 w-28 shrink-0 overflow-hidden rounded-lg">
                  <Image src="/footer-logo.png" alt="T.Doitsher" fill className="object-contain" sizes="112px" />
                </span>
              </div>
            </a>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className={[
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-700 ring-1 ring-transparent transition hover:bg-red-50 hover:shadow-md hover:ring-red-200 active:scale-[0.98] dark:hover:bg-red-950/30 dark:hover:ring-red-900/40",
              collapsed ? "justify-center" : "",
            ].join(" ")}
            title={collapsed ? "יציאה" : undefined}
          >
            <LogOut className="size-5 shrink-0" strokeWidth={1.75} />
            {!collapsed ? "יציאה" : null}
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 backdrop-blur-md md:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-50">{pageTitle}</h1>
            <p className="truncate text-xs text-[var(--muted)]">
              <span className="font-mono text-[10px] opacity-70" dir="ltr">
                {pathname}
              </span>
            </p>
          </div>
        </header>

        <motion.main
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8"
          initial={{ opacity: 0.96 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}
