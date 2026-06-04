import Link from "next/link";
import { ENTITY_LABELS, LOOKUP_ENTITIES } from "@/lib/lookups/entities";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-3 shadow-sm backdrop-blur">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">ניהול לוקאפים</div>
        <nav className="mt-2 flex flex-wrap gap-2">
          {LOOKUP_ENTITIES.map((slug) => (
            <Link
              key={slug}
              href={`/settings/${slug}`}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 hover:border-violet-300 hover:bg-violet-50"
            >
              {ENTITY_LABELS[slug]}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
