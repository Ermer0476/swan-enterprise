"use client";

import { useState, useTransition } from "react";
import { Power, PowerOff } from "lucide-react";
import { setUserActiveAction, type ActionResult } from "@/features/users/actions";
import { Button } from "@/components/ui/button";

/**
 * Activate / Deactivate, confirmed in place — a two-step confirmation for an
 * action that changes who can get in.
 *
 * The button offered is always the opposite of the current state: Activate
 * when inactive, Deactivate when active.
 */
export function UserActiveActions({
  userId,
  userName,
  active,
  isSelf,
}: {
  userId: string;
  userName: string;
  active: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function run() {
    setError(null);
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("active", String(!active));
    startTransition(async () => {
      const res: ActionResult = await setUserActiveAction(fd);
      if (!res.ok) setError(res.error);
      setConfirming(false);
    });
  }

  // Deactivating yourself is refused server-side; don't offer the button that
  // can only ever be answered with a refusal.
  if (isSelf && active) {
    return (
      <p className="text-xs text-muted-foreground">
        You can&apos;t deactivate your own account.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {active
              ? `Deactivate ${userName}? They will be refused at sign-in immediately.`
              : `Activate ${userName}?`}
          </span>
          <Button
            variant={active ? "danger" : "success"}
            size="sm"
            onClick={run}
            disabled={pending}
          >
            {pending ? "Saving…" : "Yes"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant={active ? "outline" : "success"}
          onClick={() => setConfirming(true)}
        >
          {active ? (
            <><PowerOff className="h-4 w-4" /> Deactivate</>
          ) : (
            <><Power className="h-4 w-4" /> Activate</>
          )}
        </Button>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
