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
import { AcademicYearBanner } from "@/components/academicYears/AcademicYearBanner";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationsBell } from "@/components/NotificationsBell";
import { SoundToggle } from "@/components/SoundToggle";

type NavItem = { href: string; label: string; icon: LucideIcon; iconClass: string };

const nav: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: LayoutDashboard, iconClass: "text-sky-600 dark:text-sky-400" },
  { href: "/students", label: "תלמידות", icon: Users, iconClass: "text-violet-600 dark:text-violet-400" },
  { href: "/students/import", label: "ייבוא", icon: Upload, iconClass: "text-emerald-600 dark:text-emerald-400" },
  { href: "/teachers", label: "מורות", icon: GraduationCap, iconClass: "text-amber-600 dark:text-amber-400" },
  { href: "/assignments", label: "שיבוצים", icon: ListChecks, iconClass: "text-rose-600 dark:text-rose-400" },
  { href: "/exams", label: "מבחנים", icon: BookOpen, iconClass: "text-indigo-600 dark:text-indigo-400" },
  { href: "/calendar", label: "יומן", icon: CalendarDays, iconClass: "text-cyan-600 dark:text-cyan-400" },
  { href: "/makeups", label: "השלמות", icon: AlarmClock, iconClass: "text-orange-600 dark:text-orange-400" },
  { href: "/tracking", label: "מעקב", icon: Eye, iconClass: "text-teal-600 dark:text-teal-400" },
  { href: "/settings", label: "לוקאפים", icon: Settings2, iconClass: "text-fuchsia-600 dark:text-fuchsia-400" },
  { href: "/settings/academic-years", label: "שנות לימוד", icon: Settings2, iconClass: "text-blue-600 dark:text-blue-400" },
  { href: "/archive", label: "ארכיון", icon: Settings2, iconClass: "text-slate-500 dark:text-slate-400" },
  { href: "/settings/users", label: "משתמשים", icon: Settings2, iconClass: "text-slate-600 dark:text-slate-400" },
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

export function AppShell({
  children,
  userDisplayName = "",
}: {
  children: React.ReactNode;
  userDisplayName?: string;
}) {
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
    <div className="flex min-h-screen w-full bg-transparent text-[var(--foreground)]">
      <aside
        className={`flex shrink-0 flex-col border-e border-[var(--border)] bg-[var(--sidebar-bg)] shadow-[inset_-1px_0_0_rgb(226_232_240_/_0.6)] transition-[width] duration-200 dark:shadow-[inset_-1px_0_0_rgb(51_65_85_/_0.35)] ${sidebarWidthClass}`}
      >
        <div className="flex h-[3.75rem] items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)]/60 px-3 backdrop-blur-sm dark:bg-[var(--surface)]/40">
          <Link
            href="/dashboard"
            className={[
              "flex min-w-0 items-center gap-2.5 rounded-2xl px-2 py-1.5 transition hover:bg-white hover:shadow-sm dark:hover:bg-white/10",
              collapsed ? "justify-center" : "",
            ].join(" ")}
            title="בית"
          >
            <span className="relative size-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-2 ring-white/80 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-zinc-800/80">
              <Image src="/logo.png" alt="לוגו" fill className="object-contain p-2" sizes="48px" priority />
            </span>
            {!collapsed ? (
              <span className="truncate text-base font-extrabold tracking-tight text-slate-800 dark:text-zinc-50">מערכת מבחנים</span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-xl p-2 text-[var(--muted)] ring-1 ring-transparent transition hover:bg-white hover:text-[var(--foreground)] hover:shadow-md hover:ring-slate-200/80 active:scale-95 dark:hover:bg-white/10 dark:hover:ring-white/15"
            title={collapsed ? "הרחבה" : "כיווץ"}
          >
            <ChevronLeft className={`size-5 text-sky-600 transition-transform hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2.5">
          {nav.map((item) => {
            const active = isNavActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium outline-none ring-1 ring-transparent transition-all",
                  active
                    ? "bg-[var(--color-primary)] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.14),0_4px_14px_-4px_rgb(37_99_235_/_0.45)] ring-[var(--color-primary)]/30 hover:bg-[var(--color-primary-hover)] hover:shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.16),0_6px_18px_-4px_rgb(37_99_235_/_0.4)]"
                    : "text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-md hover:ring-slate-200/90 active:scale-[0.98] dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white dark:hover:ring-white/10",
                  collapsed ? "justify-center px-2" : "",
                ].join(" ")}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={[
                    "size-5 shrink-0 transition-transform duration-200",
                    active ? "text-white opacity-95 scale-105" : `${item.iconClass} opacity-95 group-hover:scale-110`,
                  ].join(" ")}
                  strokeWidth={active ? 2.1 : 1.85}
                />
                {!collapsed ? <span className="truncate text-inherit">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] bg-[var(--surface)]/50 p-2.5 dark:bg-[var(--surface)]/30">
          <div className={["mb-2 flex flex-col gap-2", collapsed ? "items-center" : ""].join(" ")}>
            <a
              href="mailto:t025959714@gmail.com"
              className={["group rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-sm transition hover:shadow-md dark:border-zinc-600/80 dark:bg-zinc-900/50 dark:hover:bg-zinc-900/80", collapsed ? "w-auto" : "w-full"].join(" ")}
              title="שליחת מייל"
            >
              <div className="flex justify-center">
                <span className="relative h-9 w-28 shrink-0 overflow-hidden rounded-xl">
                  <Image src="/footer-logo.png" alt="T.Doitsher" fill className="object-contain" sizes="112px" />
                </span>
              </div>
            </a>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className={[
              "group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-600 ring-1 ring-transparent transition hover:bg-red-50 hover:text-red-700 hover:shadow-md hover:ring-red-100 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-red-950/25 dark:hover:text-red-300 dark:hover:ring-red-900/30",
              collapsed ? "justify-center" : "",
            ].join(" ")}
            title={collapsed ? "יציאה" : undefined}
          >
            <LogOut className="size-5 shrink-0 text-rose-500 transition-colors group-hover:text-rose-600 dark:text-rose-400 dark:group-hover:text-rose-300" strokeWidth={1.75} />
            {!collapsed ? "יציאה" : null}
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[linear-gradient(145deg,rgb(248_250_252_/_0.95)_0%,rgb(239_246_255_/_0.45)_32%,var(--background)_58%)] dark:bg-[linear-gradient(145deg,rgb(15_23_42_/_0.98)_0%,rgb(30_41_59_/_0.6)_45%,var(--background)_70%)]">
        <header className="sticky top-0 z-30 flex h-auto min-h-[3.75rem] shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/85 px-4 py-2 shadow-sm backdrop-blur-md md:px-8 dark:bg-[var(--surface)]/80">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-[var(--color-primary)] dark:text-blue-200">{pageTitle}</h1>
          </div>
          {userDisplayName ? (
            <div
              className="hidden items-center gap-2 rounded-2xl border border-sky-200/70 bg-gradient-to-l from-sky-50 via-white to-violet-50 px-3.5 py-1.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-white/60 sm:inline-flex dark:border-sky-400/30 dark:from-sky-950/40 dark:via-zinc-900/40 dark:to-violet-950/40 dark:text-zinc-100 dark:ring-white/5"
              title={`שלום, ${userDisplayName}`}
            >
              <span aria-hidden className="text-base leading-none">👋</span>
              <span className="text-[var(--muted)] dark:text-zinc-300">שלום,</span>
              <span className="bg-gradient-to-l from-[var(--color-primary)] to-violet-600 bg-clip-text font-extrabold text-transparent dark:from-sky-300 dark:to-violet-300">
                {userDisplayName}
              </span>
            </div>
          ) : null}
          <AcademicYearBanner />
          <div className="hidden w-full max-w-sm md:block md:w-72">
            <GlobalSearch />
          </div>
          <SoundToggle />
          <NotificationsBell />
        </header>

        <motion.main
          className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10 2xl:px-12"
          initial={{ opacity: 0.96 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mx-auto w-full max-w-[1600px] pb-4">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}
