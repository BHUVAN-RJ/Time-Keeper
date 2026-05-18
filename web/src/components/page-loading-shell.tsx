/** Skeleton shown while a route’s client fetch is in flight. */
export function PageLoadingShell({
  title,
  rows = 7,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-6 py-2 animate-pulse">
      <div>
        <h1 className="text-xl font-semibold text-tk-ink">{title}</h1>
        <div className="mt-2 h-4 w-48 rounded bg-tk-line/80" />
      </div>
      <ul className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="card h-16 p-3" />
        ))}
      </ul>
    </div>
  );
}
