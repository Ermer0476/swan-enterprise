import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { requireOfficeOrNotFound } from "@/features/crewing/visibility";
import { PageHeader } from "@/components/ui/page-header";
import { ImportPanel } from "./import-panel";

/**
 * Crew Manifest import. Gated on crew:create here (the whole register is
 * office-only, so requireOfficeOrNotFound applies too); the crew:assign
 * requirement and the shore-only refusal are enforced in the actions, so the
 * page renders and the refusal, if any, surfaces on submit.
 */
export default async function ImportCrewManifestPage() {
  const user = await requirePermission("crew:create");
  requireOfficeOrNotFound(user);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/crewing/seafarers"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Seafarer Register
      </Link>
      <PageHeader
        title="Import Crew Manifest"
        description="Upload a vessel's crew manifest, confirm which ship it is for, review what was found, then apply. Each man is matched by crew ID — an existing seafarer is reused, a new one is created — and embarked onto the vessel. A man already aboard another ship is flagged for a manual transfer, never moved automatically."
      />
      <ImportPanel />
    </div>
  );
}
