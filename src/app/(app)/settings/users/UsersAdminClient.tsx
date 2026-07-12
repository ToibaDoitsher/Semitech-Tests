"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { ListPageHeader } from "@/components/ui/ListPage";

type UserRow = {
  id: string;
  username: string;
  full_name: string;
  active: boolean;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j as { error?: string }).error;
    const err = new Error(msg ?? "שגיאה בטעינת משתמשים") as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return j as { users: UserRow[] };
};

export function UsersAdminClient() {
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR<{ users: UserRow[] }>("/api/users", fetcher);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function relogin() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    setBusy(true);
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401) {
          setFeedback({
            tone: "error",
            text: "לא מחוברת — לחצי «התחברות מחדש» למטה ואז נסי שוב להוסיף משתמש",
          });
          return;
        }
        setFeedback({ tone: "error", text: (j as { error?: string }).error ?? "שגיאה" });
        return;
      }
      form.reset();
      await mutate();
      setFeedback({ tone: "success", text: `המשתמש «${username}» נוסף בהצלחה` });
    } catch (err) {
      setFeedback({ tone: "error", text: (err as Error).message ?? "שגיאת רשת" });
    } finally {
      setBusy(false);
    }
  }

  const sessionDead = Boolean(error && (error as Error & { status?: number }).status === 401);

  return (
    <div className="space-y-8">
      <ListPageHeader title="ניהול משתמשים" subtitle="כל המשתמשים עם גישה מלאה למערכת" />

      {sessionDead ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">ההתחברות לא תקפה — אי אפשר ליצור משתמשים כרגע.</p>
          <p className="mt-1 text-amber-900/80">
            התחברי מחדש (למשל עם <span className="font-semibold">admin</span>) ואז חזרי לכאן להוספת משתמש.
          </p>
          <button
            type="button"
            onClick={() => void relogin()}
            className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
          >
            התחברות מחדש
          </button>
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      ) : null}

      <form
        onSubmit={createUser}
        className="grid max-w-lg gap-3 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="font-semibold text-zinc-900">משתמש חדש</h2>
        {feedback ? <InlineNotice tone={feedback.tone}>{feedback.text}</InlineNotice> : null}
        <input
          name="username"
          required
          disabled={sessionDead || busy}
          placeholder="שם משתמש"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:opacity-50"
        />
        <input
          name="password"
          type="password"
          required
          disabled={sessionDead || busy}
          placeholder="סיסמה"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sessionDead || busy}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "מוסיפה…" : "הוספה"}
        </button>
      </form>

      {isLoading && !sessionDead ? (
        <p className="text-sm text-zinc-500">טוענת משתמשים…</p>
      ) : null}

      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
        {(data?.users ?? []).map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span>{u.username}</span>
            <span className={u.active ? "text-emerald-600" : "text-red-600"}>
              {u.active ? "פעיל" : "לא פעיל"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
