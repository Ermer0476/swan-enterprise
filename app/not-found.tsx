import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl font-bold tracking-tight">404</p>
      <p className="text-muted-foreground">
        We couldn&apos;t find the page you were looking for.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
