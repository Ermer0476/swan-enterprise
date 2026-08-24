import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";
import { getNavCounts } from "@/lib/nav-counts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isShipboard = user.department === "SHIPBOARD";
  const counts = await getNavCounts(user.companyId, isShipboard ? user.vesselId : null);

  return (
    <AppShell
      fullName={user.fullName}
      roles={user.roles}
      permissions={Array.from(user.permissions)}
      counts={counts}
    >
      {children}
    </AppShell>
  );
}
