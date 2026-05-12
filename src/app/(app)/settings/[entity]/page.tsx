import { notFound } from "next/navigation";
import { isLookupEntity } from "@/lib/lookups/entities";
import { LookupManagerClient } from "../LookupManagerClient";

export const dynamic = "force-dynamic";

export default async function SettingsEntityPage({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!isLookupEntity(entity)) notFound();
  return <LookupManagerClient entity={entity} />;
}
