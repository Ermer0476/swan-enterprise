import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Already signed in? Skip the form.
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold">S</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            SWAN Enterprise
          </h1>
          <p className="text-sm text-muted-foreground">
            Integrated Maritime Management Platform
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Swan Shipping Corporation · Authorized users only
        </p>
      </div>
    </main>
  );
}
