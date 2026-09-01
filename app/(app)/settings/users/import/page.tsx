import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ImportPanel } from "./import-panel";

/**
 * Employee Masterlist import (E2). Gated on admin:manage-users like the rest of
 * User Management; the shore-only rule is enforced in the actions, not here, so
 * the page renders and the refusal (if any) surfaces on submit.
 */
export default async function ImportUsersPage() {
  await requirePermission("admin:manage-users");

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/settings/users"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>
      <PageHeader
        title="Import Employee Masterlist"
        description="Upload a masterlist spreadsheet, review what was found, then apply. Existing accounts are matched by employee ID and have their masterlist fields updated; a new row with an email creates a guest account with a minimal role and a one-time password."
      />
      <ImportPanel />
    </div>
  );
}
