export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block size-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-700 ${className}`}
      aria-label="טוען"
    />
  );
}
