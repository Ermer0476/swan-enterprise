import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { requireOfficeOrNotFound } from "@/features/crewing/visibility";
import { listVesselOptions } from "@/features/crewing/queries";
import { PageHeader } from "@/components/ui/page-header";
import { SeafarerForm } from "../seafarer-form";

const EMPTY_SENSITIVE = {
  nationality: "",
  dateOfBirth: "",
  contactPhone: "",
  contactEmail: "",
  nextOfKinName: "",
  nextOfKinRelationship: "",
  nextOfKinPhone: "",
};

export default async function NewSeafarerPage() {
  const user = await requirePermission("crew:create");
  requireOfficeOrNotFound(user);

  // The server decides whether the personal-details section exists at all.
  // Without crew:read-sensitive the inputs are not rendered, and
  // createSeafarerAction would receive blanks for them — the correct outcome:
  // a caller who may not read those fields may not populate them either.
  const showSensitive = can(user, "crew:read-sensitive");

  /**
   * The first-assignment block is a second permission, decided the same way.
   * `crew:create` adds a person; `crew:assign` puts him on a ship. Without it
   * the block is not rendered, and createSeafarerAction refuses a `vesselId`
   * from that caller anyway.
   */
  const canAssign = can(user, "crew:assign");
  const vessels = canAssign ? await listVesselOptions(user.companyId) : null;

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/crewing/seafarers"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Seafarer Register
      </Link>
      <PageHeader
        title="Add Seafarer"
        description="Register a person the company employs at sea. This is not a login — most seafarers never sign in."
      />
      <SeafarerForm
        mode="create"
        values={{ crewCode: "", lastName: "", firstName: "", middleName: "", suffix: "" }}
        sensitive={showSensitive ? EMPTY_SENSITIVE : null}
        vessels={vessels}
      />
    </div>
  );
}
