"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InlineNotice } from "@/components/ui/InlineNotice";

const FLASH_MESSAGES: Record<string, string> = {
  student_added: "התלמידה נוספה בהצלחה",
  teacher_added: "המורה נוספה בהצלחה",
};

export function FlashBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const flash = searchParams.get("flash");
    if (!flash || !FLASH_MESSAGES[flash]) return;

    setBanner(FLASH_MESSAGES[flash]);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("flash");
    const next = params.toString() ? `${pathname}?${params}` : pathname;
    router.replace(next, { scroll: false });

    const hide = window.setTimeout(() => setBanner(null), 4500);
    return () => window.clearTimeout(hide);
  }, [pathname, router, searchParams]);

  if (!banner) return null;

  return (
    <InlineNotice tone="success" className="mb-4">
      {banner}
    </InlineNotice>
  );
}
