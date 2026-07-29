export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-48 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
