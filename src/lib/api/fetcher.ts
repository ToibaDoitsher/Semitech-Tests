/** fetcher ל-SWR — מציג את הודעת השגיאה מהשרת במקום «שגיאת טעינה» גנרית */
export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((j as { error?: string }).error ?? "שגיאת טעינה");
  }
  return j as T;
}
