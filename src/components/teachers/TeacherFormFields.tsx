type Props = {
  defaults?: {
    first_name?: string;
    last_name?: string;
    tz?: string | null;
    email?: string | null;
    notes?: string | null;
  };
};

export function TeacherFormFields({ defaults }: Props) {
  return (
    <>
      <p className="md:col-span-2 -mb-2 text-xs text-zinc-500">
        חובה להזין לפחות אחד מהשמות (שם פרטי או שם משפחה).
      </p>
      <label className="block">
        <div className="text-sm font-medium">שם פרטי</div>
        <input
          name="first_name"
          defaultValue={defaults?.first_name ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
      <label className="block">
        <div className="text-sm font-medium">שם משפחה</div>
        <input
          name="last_name"
          defaultValue={defaults?.last_name ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
      <label className="block">
        <div className="text-sm font-medium">ת״ז</div>
        <input
          name="tz"
          inputMode="numeric"
          pattern="\d{0,9}"
          defaultValue={defaults?.tz ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          placeholder="עד 9 ספרות"
        />
      </label>
      <label className="block">
        <div className="text-sm font-medium">מייל</div>
        <input
          name="email"
          type="email"
          defaultValue={defaults?.email ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
      <label className="block md:col-span-2">
        <div className="text-sm font-medium">הערות</div>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
    </>
  );
}
