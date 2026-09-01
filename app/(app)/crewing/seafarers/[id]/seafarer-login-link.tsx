"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  linkSeafarerToUserAction,
  unlinkSeafarerFromUserAction,
  createLoginForSeafarerAction,
} from "@/features/crewing/link-actions";
import type { ActionResult } from "@/features/shared/action-result";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The crew ↔ login control on a seafarer's record. Office + admin:manage-users
 * only — the page renders it only for a caller who holds the permission, and
 * every action re-checks server-side.
 *
 * Three states in one place:
 *  - LINKED     → the login's email, a link to its account page, and Unlink.
 *  - UNLINKED   → "Create login" (mint a new account) OR "Link existing user".
 * The buttons post to the three server actions; a returned error shows inline.
 */

function PendingButton({
  label,
  pendingLabel,
  variant,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  variant?: "outline" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

type UserOption = { id: string; email: string; fullName: string };

export function SeafarerLoginLink({
  seafarerId,
  linked,
  unlinkedUsers,
}: {
  seafarerId: string;
  linked: { id: string; email: string } | null;
  unlinkedUsers: UserOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "create" | "link">("idle");
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  async function runUnlink(formData: FormData) {
    const result: ActionResult = await unlinkSeafarerFromUserAction(formData);
    setError(result.ok ? null : result.error);
    if (result.ok) setConfirmUnlink(false);
  }

  async function runLink(formData: FormData) {
    const result: ActionResult = await linkSeafarerToUserAction(formData);
    setError(result.ok ? null : result.error);
    if (result.ok) setMode("idle");
  }

  async function runCreate(formData: FormData) {
    const result: ActionResult = await createLoginForSeafarerAction(formData);
    setError(result.ok ? null : result.error);
    if (result.ok) setMode("idle");
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Login account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked ? (
          <div className="space-y-3">
            <p className="text-sm">
              Login account:{" "}
              <Link
                href={`/settings/users/${linked.id}`}
                className="font-medium text-primary hover:underline"
              >
                {linked.email}
              </Link>
            </p>
            {confirmUnlink ? (
              <form action={runUnlink} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="seafarerId" value={seafarerId} />
                <PendingButton variant="danger" label="Yes, unlink" pendingLabel="Unlinking…" />
                <Button type="button" variant="ghost" onClick={() => setConfirmUnlink(false)}>
                  Cancel
                </Button>
                <p className="max-w-prose text-xs text-muted-foreground">
                  The login itself is kept and can still sign in — only the tie to this crew
                  record is removed.
                </p>
              </form>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirmUnlink(true)}>
                Unlink
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This crew record has no login yet. Create one, or tie it to an account that already
              exists.
            </p>

            {mode === "idle" && (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => setMode("create")}>
                  Create login
                </Button>
                <Button type="button" variant="outline" onClick={() => setMode("link")}>
                  Link existing user
                </Button>
              </div>
            )}

            {mode === "create" && (
              <form action={runCreate} className="space-y-3">
                <input type="hidden" name="seafarerId" value={seafarerId} />
                <div className="max-w-sm">
                  <label htmlFor="login-email" className="mb-1 block text-sm font-medium">
                    Email for the new login
                  </label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    required
                    placeholder="name@example.com"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    A one-time password is set and the account is forced to change it on first
                    sign-in. The crew code and current vessel are carried over.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <PendingButton label="Create login" pendingLabel="Creating…" />
                  <Button type="button" variant="ghost" onClick={() => setMode("idle")}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {mode === "link" && (
              <form action={runLink} className="space-y-3">
                <input type="hidden" name="seafarerId" value={seafarerId} />
                <div className="max-w-sm">
                  <label htmlFor="login-user" className="mb-1 block text-sm font-medium">
                    Existing login
                  </label>
                  {unlinkedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No unlinked accounts are available to link.
                    </p>
                  ) : (
                    <select
                      id="login-user"
                      name="userId"
                      required
                      defaultValue=""
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="" disabled>
                        Choose an account…
                      </option>
                      {unlinkedUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} — {u.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <PendingButton
                    label="Link account"
                    pendingLabel="Linking…"
                    disabled={unlinkedUsers.length === 0}
                  />
                  <Button type="button" variant="ghost" onClick={() => setMode("idle")}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
