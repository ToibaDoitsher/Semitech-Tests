"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Item = { id: string; type: string; message: string; href: string };

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data } = useSWR<{ items: Item[]; unread: number }>("/api/notifications", fetcher, {
    refreshInterval: 120_000,
    refreshWhenHidden: false,
    dedupingInterval: 30_000,
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-xl border border-zinc-200 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900"
        onClick={() => setOpen((o) => !o)}
        aria-label="התראות"
      >
        <Bell className="size-5 text-zinc-700 dark:text-zinc-200" />
        {unread > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <ul className="absolute end-0 z-50 mt-2 w-72 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {items.length ? (
            items.map((it) => (
              <li key={it.id}>
                <Link
                  href={it.href}
                  className="block px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  {it.message}
                </Link>
              </li>
            ))
          ) : (
            <li className="px-3 py-4 text-center text-sm text-zinc-500">אין התראות</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
