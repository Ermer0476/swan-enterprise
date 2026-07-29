"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(
    loginAction,
    { error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@swanshipping.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
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
