import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AcademicYearProvider } from "@/components/academicYears/AcademicYearProvider";
import { SwrProvider } from "@/components/providers/SwrProvider";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    // לא לקרוא ל-clearSession כאן — cookies.set אסור ב-Layout
    redirect("/login?reauth=1");
  }
  const displayName = user.full_name?.trim() || user.username?.trim() || "";
  return (
    <SwrProvider>
      <Suspense fallback={null}>
        <AcademicYearProvider>
          <AppShell userDisplayName={displayName}>{children}</AppShell>
        </AcademicYearProvider>
      </Suspense>
    </SwrProvider>
  );
}
