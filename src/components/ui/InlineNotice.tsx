import { cn } from "@/lib/utils";

type Props = {
  tone: "success" | "error" | "warning" | "info";
  children: React.ReactNode;
  className?: string;
};

export function InlineNotice({ tone, children, className }: Props) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "success" &&
          "border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
        tone === "error" &&
          "border-red-200/80 bg-red-50/90 text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200",
        tone === "warning" &&
          "border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100",
        tone === "info" &&
          "border-sky-200/80 bg-sky-50/90 text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-100",
        className,
      )}
    >
      {children}
    </p>
  );
}
