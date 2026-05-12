"use client";

import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";

const MAX_LEN = 128;
/** השהייה אחרי תו אחרון לפני שליחת הטופס (אין אורך קוד בצד לקוח) */
const AUTO_SUBMIT_IDLE_MS = 1200;

function Caret() {
  return (
    <span
      className="login-password-caret mb-px inline-block shrink-0 align-middle"
      aria-hidden
    />
  );
}

export function LoginPasswordDots() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const slotCount = Math.min(Math.max(4, value.length), 48);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!value.length) return;
    const t = window.setTimeout(() => {
      const form = document.getElementById("login-form");
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      }
    }, AUTO_SUBMIT_IDLE_MS);
    return () => window.clearTimeout(t);
  }, [value]);

  return (
    <label htmlFor={inputId} className="group block cursor-pointer text-center">
      <input
        ref={inputRef}
        id={inputId}
        name="password"
        type="password"
        required
        autoComplete="current-password"
        autoFocus
        value={value}
        maxLength={MAX_LEN}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="sr-only"
        dir="ltr"
        aria-label="קוד כניסה למערכת"
      />

      <div
        role="presentation"
        dir="ltr"
        onClick={focusInput}
        className="mt-2 inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1 overflow-visible px-0.5 py-3"
      >
        {Array.from({ length: slotCount }, (_, i) => (
          <Fragment key={i}>
            {focused && value.length === i ? <Caret /> : null}
            <span
              aria-hidden
              className={[
                "relative inline-flex size-[1.2rem] shrink-0 items-center justify-center overflow-visible rounded-full border-2 transition-colors sm:size-[1.35rem]",
                i < value.length
                  ? "login-star-slot--filled border-[var(--color-primary)] bg-[var(--color-primary)] shadow-sm dark:border-blue-500 dark:bg-blue-500"
                  : "border-slate-300/90 bg-slate-300/95 dark:border-zinc-600 dark:bg-zinc-600",
              ].join(" ")}
            >
              {i < value.length ? (
                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[1.85rem] font-black leading-none text-white sm:text-[2.1rem]">
                  *
                </span>
              ) : null}
            </span>
          </Fragment>
        ))}
        {focused && value.length === slotCount ? <Caret /> : null}
      </div>
    </label>
  );
}
