"use client";

import { useState } from "react";
import useSWR from "swr";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { ListPageHeader } from "@/components/ui/ListPage";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("אין הרשאה או שגיאה");
  return r.json();
});

type UserRow = {
  id: string;
  username: string;
  full_name: string;
  active: boolean;
};

export function UsersAdminClient() {
  const { data, error, mutate } = useSWR<{ users: UserRow[] }>("/api/users", fetcher);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    // חובה לתפוס את הטופס לפני ה-await — אחרי await currentTarget הופך null
    const form = e.currentTarget;
    const fd = new FormData(form);
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFeedback({ tone: "error", text: (j as { error?: string }).error ?? "שגיאה" });
        return;
      }
      form.reset();
      await mutate();
      setFeedback({ tone: "success", text: `המשתמש «${username}» נוסף בהצלחה` });
    } catch (err) {
      setFeedback({ tone: "error", text: (err as Error).message ?? "שגיאת רשת" });
    }
  }

  return (
    <div className="space-y-8">
      <ListPageHeader title="ניהול משתמשים" subtitle="כל המשתמשים עם גישה מלאה למערכת" />
      {error ? <p className="text-sm text-red-600">{(error as Error).message}</p> : null}

      <form onSubmit={createUser} className="grid max-w-lg gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold text-zinc-900">משתמש חדש</h2>
        {feedback ? <InlineNotice tone={feedback.tone}>{feedback.text}</InlineNotice> : null}
        <input name="username" required placeholder="שם משתמש" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
        <input name="password" type="password" required placeholder="סיסמה" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">
          הוספה
        </button>
      </form>

      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
        {(data?.users ?? []).map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span>{u.username}</span>
            <span className={u.active ? "text-emerald-600" : "text-red-600"}>{u.active ? "פעיל" : "לא פעיל"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
