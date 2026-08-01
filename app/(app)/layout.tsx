import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      fullName={user.fullName}
      roles={user.roles}
      permissions={Array.from(user.permissions)}
    >
      {children}
    </AppShell>
  );
}
