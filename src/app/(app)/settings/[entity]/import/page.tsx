import { notFound } from "next/navigation";
import { isLookupEntity } from "@/lib/lookups/entities";
import { ImportLookupsClient } from "./ImportLookupsClient";

export const dynamic = "force-dynamic";

export default async function ImportLookupsPage({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!isLookupEntity(entity)) notFound();
  return <ImportLookupsClient entity={entity} />;
}
