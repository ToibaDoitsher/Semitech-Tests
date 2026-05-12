import { redirect } from "next/navigation";
import { hasAppSession } from "@/lib/auth/passwordSession";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await hasAppSession()) redirect("/dashboard");
  redirect("/login");
}
