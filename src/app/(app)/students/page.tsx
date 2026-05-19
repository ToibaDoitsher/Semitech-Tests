import { PageFlash } from "@/components/ui/PageFlash";
import { StudentsListClient } from "./StudentsListClient";

export const dynamic = "force-dynamic";

export default function StudentsPage() {
  return (
    <>
      <PageFlash />
      <StudentsListClient />
    </>
  );
}
