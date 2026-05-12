import { ExamEditClient } from "./ExamEditClient";

export const dynamic = "force-dynamic";

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamEditClient id={id} />;
}
