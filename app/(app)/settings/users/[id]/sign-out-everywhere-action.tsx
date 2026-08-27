"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import {
  signOutEverywhereAction,
  type ActionResult,
} from "@/features/users/actions";
import { Button } from "@/components/ui/button";

/**
 * "Sign out everywhere", confirmed in place — the same two-step shape as
 * user-active-actions.tsx beside it, for an action that changes who can get in.
 *
 * Confirmed rather than one-click because it is not undoable: every device
 * that account is signed in on has to authenticate again, and on a ship that
 * means someone reads the password out over the radio.
 */
export function SignOutEverywhereAction({
  userId,
  userName,
  isSelf,
}: {
  userId: string;
  userName: string;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function run() {
    setError(null);
    const fd = new FormData();
    fd.set("userId", userId);
    startTransition(async () => {
      const res: ActionResult = await signOutEverywhereAction(fd);
      if (res.ok) setDone(true);
      else setError(res.error);
      setConfirming(false);
    });
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {isSelf
              ? "Sign out of all devices, including this one? You'll need to sign in again."
              : `Sign ${userName} out of all devices? They'll need to sign in again on each one.`}
          </span>
          <Button variant="danger" size="sm" onClick={run} disabled={pending}>
            {pending ? "Signing out…" : "Yes"}
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
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <LogOut className="h-4 w-4" /> Sign out everywhere
        </Button>
      )}
      {/* The revocation lands on the target's *next* request, not instantly —
          say so, rather than implying a device already showing a page has
          gone dark. */}
      {done && !confirming && (
        <p className="text-sm text-success" role="status">
          Signed out. Takes effect on their next page load.
        </p>
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
