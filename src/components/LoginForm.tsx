"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LoginForm({
  initialError,
  clearStaleSession = false,
}: {
  initialError?: string;
  clearStaleSession?: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError === "wrong_password" ? "שם משתמש או סיסמה שגויים" : "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clearStaleSession) return;
    void fetch("/api/logout", { method: "POST" });
  }, [clearStaleSession]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (j as { error?: string }).error ?? "שגיאת התחברות";
        if (msg === "Unauthorized") {
          throw new Error("השרת חסם התחברות — עצרי והפעילי מחדש את npm run dev");
        }
        throw new Error(msg);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-[#c5d9d3] bg-[#f7fbf9] px-3.5 py-3 text-sm text-[#0f2f2a] outline-none transition placeholder:text-[#8aa39c] focus:border-[#1f6f5b] focus:bg-white focus:ring-2 focus:ring-[#1f6f5b]/25";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-[#2a4a44]">שם משתמש</span>
        <input
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="הקלידי שם משתמש"
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[#2a4a44]">סיסמה</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="הקלידי סיסמה"
            className={`${fieldClass} pe-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#5f7f77] transition hover:bg-[#e8f3ef] hover:text-[#1f6f5b]"
            aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </label>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-xl bg-[#1f6f5b] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#185a4a] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {loading ? "מתחברת…" : "כניסה למערכת"}
      </button>
    </form>
  );
}
