"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  changeMyPasswordAction,
  type ChangePasswordState,
} from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Set new password"}
    </Button>
  );
}

/**
 * New password + confirm, nothing else. The password fields are never written
 * back on error (unlike the app's data forms) — re-typing a password is the
 * point of a confirm field, and echoing a rejected one into the DOM is exactly
 * what a password input is built to avoid.
 */
export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(
    changeMyPasswordAction,
    { error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </div>
          {state.error && (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          )}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
