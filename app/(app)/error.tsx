"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const forbidden = error.message === "FORBIDDEN";
  const unauth = error.message === "UNAUTHENTICATED";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-semibold">
        {forbidden
          ? "You don't have permission to do that"
          : unauth
            ? "Your session has expired"
            : "Something went wrong"}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {forbidden
          ? "This action requires a permission your role doesn't hold. Contact an administrator if you need access."
          : unauth
            ? "Please sign in again to continue."
            : "An unexpected error occurred. You can retry, or contact IT if it persists."}
      </p>
      <div className="mt-2 flex gap-2">
        {unauth ? (
          <a href="/login">
            <Button>Go to sign in</Button>
          </a>
        ) : (
          <Button onClick={reset}>Try again</Button>
        )}
      </div>
    </div>
  );
}
