import { PageFlash } from "@/components/ui/PageFlash";
import { TeachersListClient } from "./TeachersListClient";

export const dynamic = "force-dynamic";

export default function TeachersPage() {
  return (
    <>
      <PageFlash />
      <TeachersListClient />
    </>
  );
}
