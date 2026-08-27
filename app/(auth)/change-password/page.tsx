import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Set a new password" };

/**
 * The forced first-login password change, and any later voluntary change. It
 * lives in the (auth) route group, NOT (app), on purpose: the (app) layout
 * redirects every must-change account here, so rendering this page through that
 * layout would loop. Out here it has its own minimal frame and never touches
 * the app shell.
 *
 * A signed-out visitor is sent to /login — this page acts on the session user
 * and there is nothing to change without one.
 */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const forced = user.mustChangePassword;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold">S</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {forced ? "Set your password" : "Change your password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {forced
              ? "Your account was issued a temporary password. Choose your own before you continue."
              : "Choose a new password for your account."}
          </p>
        </div>
        <ChangePasswordForm />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Signed in as {user.fullName} · all password changes are recorded
        </p>
      </div>
    </main>
  );
}
