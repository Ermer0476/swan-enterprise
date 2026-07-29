import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar permissions={Array.from(user.permissions)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar fullName={user.fullName} roles={user.roles} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
