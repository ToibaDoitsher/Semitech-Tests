"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { soundEngine, type SoundName } from "@/lib/ui/sounds";

type SoundContextValue = {
  muted: boolean;
  toggle: () => void;
  play: (name: SoundName) => void;
};

const SoundContext = createContext<SoundContextValue>({
  muted: false,
  toggle: () => undefined,
  play: () => undefined,
});

export function useSound() {
  return useContext(SoundContext);
}

/**
 * מספק את שירות הצלילים לכל האפליקציה:
 *  - מנגן "מעבר" כשמשתנה הנתיב (usePathname)
 *  - מאזין גלובלית ללחיצות ובוחר צליל לפי הקשר הכפתור
 *  - חושף mute toggle שהמצב שלו נשמר ב-localStorage
 *
 * כיצד לבחור צליל מותאם לכפתור:
 *   <button data-sound="success">…  // כופה צליל מסוים
 *   <button data-no-sound>…         // משתיק כפתור בודד
 */
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [muted, setMuted] = useState(false);
  const initialNavRef = useRef(true);

  // טעינת state מ-localStorage (רץ רק בצד לקוח)
  useEffect(() => {
    setMuted(soundEngine.isMuted());
  }, []);

  // צליל מעבר בכל שינוי נתיב — חוץ מהטעינה הראשונית
  useEffect(() => {
    if (initialNavRef.current) {
      initialNavRef.current = false;
      return;
    }
    soundEngine.play("transition");
  }, [pathname]);

  // מאזין לחיצות גלובלי
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // איתור הכפתור / לינק הקרוב
      const clickable = target.closest<HTMLElement>(
        'button, [role="button"], a[href], input[type="submit"], input[type="button"]',
      );
      if (!clickable) return;
      if (clickable.dataset.noSound !== undefined) return;
      if (clickable.hasAttribute("disabled")) return;
      if ((clickable as HTMLButtonElement).disabled) return;

      // override מפורש
      const explicit = clickable.dataset.sound as SoundName | undefined;
      if (explicit) {
        soundEngine.play(explicit);
        return;
      }

      // קישורים: לרוב הם מעבר בין דפים — נשאיר אותם ל-pathname effect
      if (clickable.tagName === "A") {
        const href = (clickable as HTMLAnchorElement).getAttribute("href") ?? "";
        // לינקים חיצוניים / mailto / # — צריכים צליל קליק כי לא יקרה pathname change
        if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http")) {
          soundEngine.play("click");
        }
        return;
      }

      // checkbox / radio / role="switch" — צליל toggle
      if (clickable.getAttribute("role") === "switch") {
        soundEngine.play("toggle");
        return;
      }
      if (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) {
        soundEngine.play("toggle");
        return;
      }

      // בחירת צליל לפי קונטקסט הכפתור
      const cls = clickable.className || "";
      const isSubmit =
        (clickable as HTMLButtonElement).type === "submit" ||
        clickable.tagName === "INPUT" && (clickable as HTMLInputElement).type === "submit";

      if (cls.includes("bg-red") || cls.includes("text-red") || cls.includes("danger")) {
        soundEngine.play("delete");
      } else if (cls.includes("bg-emerald") || cls.includes("text-emerald")) {
        soundEngine.play("success");
      } else if (isSubmit) {
        soundEngine.play("confirm");
      } else {
        soundEngine.play("click");
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const toggle = useCallback(() => {
    const next = soundEngine.toggleMuted();
    setMuted(next);
    if (!next) {
      // אישור קצר ששמע פועל שוב
      soundEngine.play("confirm");
    }
  }, []);

  const play = useCallback((name: SoundName) => {
    soundEngine.play(name);
  }, []);

  return (
    <SoundContext.Provider value={{ muted, toggle, play }}>{children}</SoundContext.Provider>
  );
}
