import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AcademicYearProvider } from "@/components/academicYears/AcademicYearProvider";
import { SwrProvider } from "@/components/providers/SwrProvider";
import { SoundProvider } from "@/components/providers/SoundProvider";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ok = await hasAppSession();
  if (!ok) redirect("/login");
  const user = await getCurrentUser();
  const displayName = user?.full_name?.trim() || user?.username?.trim() || "";
  return (
    <SwrProvider>
      <Suspense fallback={null}>
        <AcademicYearProvider>
          <SoundProvider>
            <AppShell userDisplayName={displayName}>{children}</AppShell>
          </SoundProvider>
        </AcademicYearProvider>
      </Suspense>
    </SwrProvider>
  );
}
