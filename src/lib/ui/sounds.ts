/**
 * מנוע צלילי UI מבוסס Web Audio API.
 * כל הצלילים מסונתזים בזמן אמת — בלי קבצי אודיו, בלי תלות חיצונית.
 *
 * שמות הצלילים (לשימוש קוד + לתצוגה למשתמש):
 *   - transition  → "מעבר"   — מעבר בין דפים
 *   - click       → "קליק"   — לחיצה רגילה על כפתור
 *   - confirm     → "אישור"  — שליחת טופס / כפתור primary
 *   - success     → "הצלחה"  — פעולה הצליחה (שמירה/יצירה)
 *   - delete      → "מחיקה"  — כפתור הרסני (אדום)
 *   - error       → "שגיאה"  — שגיאה / כישלון
 *   - toggle      → "החלף"   — toggle / checkbox / טאב
 */

export type SoundName =
  | "transition"
  | "click"
  | "confirm"
  | "success"
  | "delete"
  | "error"
  | "toggle";

export const SOUND_LABELS_HE: Record<SoundName, string> = {
  transition: "מעבר",
  click: "קליק",
  confirm: "אישור",
  success: "הצלחה",
  delete: "מחיקה",
  error: "שגיאה",
  toggle: "החלף",
};

export const SOUND_DESCRIPTIONS_HE: Record<SoundName, string> = {
  transition: "צליל ניווט בין דפים — מעבר רך עולה",
  click: "טיק קצר ועדין ללחיצה רגילה",
  confirm: "צמד צלילים נעימים לאישור / שליחת טופס",
  success: "ארפג'יו עולה למשמע פעולה שהצליחה",
  delete: "צליל נמוך יורד לפעולה הרסנית",
  error: "טון מעומעם לסימון שגיאה",
  toggle: "טיק חד וקצרצר ל-checkbox / מתג",
};

const STORAGE_KEY = "ui:sound:muted";
const MIN_GAP_MS = 25;

type ToneOptions = {
  type?: OscillatorType;
  attackMs?: number;
  releaseMs?: number;
  volumeFactor?: number;
  glideTo?: number;
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private masterVolume = 0.18; // עוצמת בסיס שקטה
  private lastPlayAt = 0;
  private initialized = false;

  /** קריאה ראשונה בצד לקוח כדי לקרוא העדפת mute מ-localStorage. */
  init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    try {
      this.muted = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  isMuted(): boolean {
    this.init();
    return this.muted;
  }

  setMuted(value: boolean) {
    this.init();
    this.muted = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // localStorage חסום — נסתפק בזיכרון
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.isMuted());
    return this.muted;
  }

  private getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private tone(frequency: number, durationMs: number, opts: ToneOptions = {}, delayMs = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      // resume דורש מחווה של משתמש (תקפיץ אזהרה בקונסול בטעינה ראשונה — תקין)
      ctx.resume().catch(() => undefined);
    }

    const start = ctx.currentTime + delayMs / 1000;
    const durSec = durationMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(frequency, start);
    if (opts.glideTo !== undefined) {
      osc.frequency.linearRampToValueAtTime(opts.glideTo, start + durSec);
    }

    const peak = Math.max(0.0001, this.masterVolume * (opts.volumeFactor ?? 1));
    const attack = (opts.attackMs ?? 5) / 1000;
    const release = (opts.releaseMs ?? Math.min(80, durationMs * 0.4)) / 1000;
    const peakTime = start + attack;
    const releaseStart = Math.max(peakTime, start + durSec - release);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, peakTime);
    gain.gain.setValueAtTime(peak, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durSec);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + durSec + 0.05);
  }

  play(name: SoundName) {
    this.init();
    if (this.muted) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - this.lastPlayAt < MIN_GAP_MS) return; // מניעת ספאם בלחיצות מרובות
    this.lastPlayAt = now;

    switch (name) {
      case "transition":
        // מעבר רך מ-C5 ל-G5 — חיווי לטעינת דף
        this.tone(523, 180, { type: "sine", glideTo: 784, volumeFactor: 0.65, releaseMs: 90 });
        break;

      case "click":
        // טיק קצרצר ב-A5
        this.tone(880, 45, { type: "sine", attackMs: 2, releaseMs: 35, volumeFactor: 0.55 });
        break;

      case "confirm":
        // C5 ואז E5 — צמד רכות שמרגיש מאשר
        this.tone(523, 80, { type: "sine", volumeFactor: 0.6 });
        this.tone(659, 110, { type: "sine", volumeFactor: 0.7 }, 65);
        break;

      case "success":
        // C5 → E5 → G5 — ארפג'יו מז'ורי קצר
        this.tone(523, 80, { type: "sine", volumeFactor: 0.55 });
        this.tone(659, 80, { type: "sine", volumeFactor: 0.6 }, 70);
        this.tone(784, 160, { type: "sine", volumeFactor: 0.7 }, 140);
        break;

      case "delete":
        // ירידה נמוכה A3 → E3
        this.tone(220, 220, { type: "triangle", glideTo: 165, volumeFactor: 0.7, releaseMs: 90 });
        break;

      case "error":
        // טון נמוך + מינור (A3 + B♭3) — מורגש כשגיאה בלי להבעית
        this.tone(220, 220, { type: "triangle", volumeFactor: 0.55 });
        this.tone(233, 220, { type: "triangle", volumeFactor: 0.5 });
        break;

      case "toggle":
        // טיק חד וקצרצר ב-G5
        this.tone(784, 28, { type: "square", attackMs: 1, releaseMs: 20, volumeFactor: 0.3 });
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
