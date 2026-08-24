"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { useSortableRows } from "@/lib/use-sortable-rows";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Badge } from "@/components/ui/badge";
import { AttachmentQuickView } from "@/components/attachments/attachment-quick-view";
import { deleteVesselDocumentAction } from "@/features/vessel-documents/actions";
import { formatDate } from "@/lib/utils";
import type { DocumentWarningStatus } from "@/features/vessel-documents/queries";

function DeleteButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function remove() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteVesselDocumentAction(fd);
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs">
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="font-medium text-danger hover:underline disabled:opacity-50"
        >
          {isPending ? "…" : "Delete?"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="text-muted-foreground hover:underline disabled:opacity-50"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title={`Delete ${name}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

export type DocumentRow = {
  id: string;
  type: string;
  refNo: string | null;
  name: string;
  issuingBody: string | null;
  certNo: string | null;
  issuedDate: Date | null;
  expiredDate: Date | null;
  active: boolean;
  vesselId: string | null;
  warningStatus: DocumentWarningStatus;
};

function WarningIcon({ status }: { status: DocumentWarningStatus }) {
  if (!status) return null;
  const tone = status === "expired" ? "text-danger" : "text-warning";
  const label = status === "expired" ? "Expired" : "Expiring soon";
  return (
    <span title={label}>
      <AlertTriangle className={`h-4 w-4 ${tone}`} aria-label={label} />
    </span>
  );
}

export function DocumentRegister({
  rows,
  attachments,
  archivedAttachments,
  canEdit,
  canDelete,
  editBasePath,
}: {
  rows: DocumentRow[];
  attachments: Map<string, { id: string; fileName: string; mimeType: string }[]>;
  /** A superseded/old version of the certificate — a separate slot from
   * `attachments`, not a history of it. */
  archivedAttachments: Map<string, { id: string; fileName: string; mimeType: string }[]>;
  canEdit: boolean;
  canDelete: boolean;
  /** e.g. "/documents/vessel" — each row's edit link is `${editBasePath}/${id}/edit`. */
  editBasePath: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.issuingBody ?? "").toLowerCase().includes(q) ||
      (r.certNo ?? "").toLowerCase().includes(q) ||
      (r.refNo ?? "").toLowerCase().includes(q)
    );
  });

  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows(filtered, (row, key) => {
    switch (key) {
      case "refNo":
        return row.refNo ?? "";
      case "type":
        return row.type;
      case "name":
        return row.name;
      case "issuingBody":
        return row.issuingBody ?? "";
      case "certNo":
        return row.certNo ?? "";
      case "issued":
        return row.issuedDate ?? new Date(0);
      case "expired":
        return row.expiredDate ?? new Date(0);
      case "warning":
        // Expired first, then expiring-soon, then everything else — so
        // clicking this column surfaces what needs attention right away.
        return row.warningStatus === "expired" ? 0 : row.warningStatus === "warning" ? 1 : 2;
      default:
        return "";
    }
  });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="divide-x divide-border">
              <SortableHeader label="Ref" sortKey="refNo" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Type" sortKey="type" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Document" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Issuing Body" sortKey="issuingBody" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Cert No." sortKey="certNo" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Issued" sortKey="issued" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Expired" sortKey="expired" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 font-medium">Attachment</th>
              <th className="px-3 py-2 font-medium">Archived</th>
              <SortableHeader
                label="Warning"
                sortKey="warning"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="w-14 px-2 py-2 text-center"
              />
              <th className="px-3 py-2 font-medium">Origin</th>
              {(canEdit || canDelete) && <th className="w-20 px-3 py-2 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={canEdit || canDelete ? 12 : 11} className="px-4 py-10 text-center text-muted-foreground">
                  No data available
                </td>
              </tr>
            )}
            {sorted.map((row) => (
              <tr key={row.id} className={`divide-x divide-border border-t border-border ${row.active ? "" : "opacity-50"}`}>
                <td className="px-3 py-2 align-top text-xs text-muted-foreground">{row.refNo ?? "—"}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{row.type}</td>
                <td className="px-3 py-2 align-top font-medium">{row.name}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{row.issuingBody ?? "—"}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{row.certNo ?? "—"}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{formatDate(row.issuedDate)}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{formatDate(row.expiredDate)}</td>
                <td className="px-3 py-2 align-top">
                  <AttachmentQuickView attachments={attachments.get(row.id) ?? []} />
                </td>
                <td className="px-3 py-2 align-top">
                  <AttachmentQuickView attachments={archivedAttachments.get(row.id) ?? []} />
                </td>
                <td className="px-2 py-2 text-center align-top">
                  <div className="flex justify-center"><WarningIcon status={row.warningStatus} /></div>
                </td>
                <td className="px-3 py-2 align-top">
                  <Badge tone={row.vesselId ? "accent" : "neutral"}>{row.vesselId ? "VESSEL" : "COMPANY"}</Badge>
                </td>
                {(canEdit || canDelete) && (
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <Link
                          href={`${editBasePath}/${row.id}/edit`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {canDelete && <DeleteButton id={row.id} name={row.name} />}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
