import { requirePermission } from "@/lib/rbac";
import { listVesselOptions, suggestNextRefNo } from "@/features/non-conformities/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NewNcrForm } from "./new-ncr-form";

export default async function NewNcrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("ncr:create");
  const [vessels, suggestedRefNo, sp] = await Promise.all([
    listVesselOptions(user.companyId),
    suggestNextRefNo(user.companyId),
    searchParams,
  ]);

  // Populated when opened via "Add Deficiency" from PSC/Internal/External
  // Audit (one finding = one NCR) — left editable here; locking auto-filled
  // fields is deferred until that integration lands.
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const prefill = {
    vesselId: first(sp.vesselId) ?? "",
    source: first(sp.source) ?? "",
    sourceEntityId: first(sp.sourceEntityId) ?? "",
    requirement: first(sp.requirement) ?? "",
    description: first(sp.description) ?? "",
    raisedAt: first(sp.raisedAt) ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Raise Non-Conformity"
        description="Record a finding where an SMS clause, regulation or standard is not met."
      />
      <NewNcrForm vessels={vessels} suggestedRefNo={suggestedRefNo} prefill={prefill} />
    </div>
  );
}
