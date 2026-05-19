import { Suspense } from "react";
import { FlashBanner } from "@/components/ui/FlashBanner";

/** הודעת הצלחה אחרי redirect (?flash=...) */
export function PageFlash() {
  return (
    <Suspense fallback={null}>
      <FlashBanner />
    </Suspense>
  );
}
