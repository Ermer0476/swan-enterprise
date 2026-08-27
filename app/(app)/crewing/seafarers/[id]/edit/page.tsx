import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { requireOfficeOrNotFound } from "@/features/crewing/visibility";
import { getSeafarer } from "@/features/crewing/queries";
import { formatCrewName } from "@/features/crewing/ui";
import { PageHeader } from "@/components/ui/page-header";
import { SeafarerForm } from "../../seafarer-form";

/** `<input type="date">` wants `yyyy-mm-dd`; the column is stored at UTC
 *  midnight, so slicing the ISO string is the round trip that does not shift a
 *  date across a timezone. */
function dateInputValue(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditSeafarerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("crew:update");
  requireOfficeOrNotFound(user);

  const { id } = await params;
  const detail = await getSeafarer(user, id);
  if (!detail) notFound();

  const s = detail.seafarer;

  // The tier the read returned IS the tier the form renders. A caller without
  // crew:read-sensitive never received those values, so the form cannot show
  // them — and updateSeafarerAction omits the columns from its write, so the
  // absent inputs cannot null them either.
  const sensitive =
    detail.tier === "RESTRICTED"
      ? {
          nationality: detail.seafarer.nationality ?? "",
          dateOfBirth: dateInputValue(detail.seafarer.dateOfBirth),
          contactPhone: detail.seafarer.contactPhone ?? "",
          contactEmail: detail.seafarer.contactEmail ?? "",
          nextOfKinName: detail.seafarer.nextOfKinName ?? "",
          nextOfKinRelationship: detail.seafarer.nextOfKinRelationship ?? "",
          nextOfKinPhone: detail.seafarer.nextOfKinPhone ?? "",
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href={`/crewing/seafarers/${s.id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {formatCrewName(s, "prose")}
      </Link>
      <PageHeader title="Edit Seafarer" description={formatCrewName(s, "prose")} />
      <SeafarerForm
        mode="edit"
        seafarerId={s.id}
        updatedAt={s.updatedAt.toISOString()}
        values={{
          crewCode: s.crewCode ?? "",
          lastName: s.lastName,
          firstName: s.firstName,
          middleName: s.middleName ?? "",
          suffix: s.suffix ?? "",
        }}
        sensitive={sensitive}
      />
    </div>
  );
}
