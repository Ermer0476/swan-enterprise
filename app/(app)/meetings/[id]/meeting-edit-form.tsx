"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  updateDraftMeetingAction,
  saveOfficeReviewMeetingAction,
  closeMeetingAction,
  deleteCommitteeMeetingAction,
} from "@/features/committee-meetings/actions";
import { COMMITTEE_TYPE_LABELS, type CommitteeTypeValue } from "@/features/committee-meetings/schema";
import { AutoGrowInput, Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AttachmentList, type AttachmentView } from "@/components/attachments/attachment-list";
import { formatDate } from "@/lib/utils";

type MeetingHeader = {
  id: string;
  position: string | null;
  meetingDate: string; // yyyy-mm-dd
  meetingTime: string | null;
  chairman: string | null;
  inCharge: string | null;
  members: string | null;
  inAttendance: string | null;
  forAcknowledgement: string | null;
};

type RemarksAuthor = { fullName: string; rank: string | null };

type TypeRemarksView = {
  committeeType: CommitteeTypeValue;
  shoreRemarks: string | null;
  updatedByUser?: RemarksAuthor | null;
  updatedAt?: string | null;
};

type AgendaItemView = {
  id: string;
  seq: number;
  committeeType: CommitteeTypeValue;
  code: string | null;
  label: string;
  details: string | null;
};

function attributionCaption(author: RemarksAuthor | null | undefined, at: string | null | undefined) {
  if (!author) return null;
  return (
    <p className="text-xs text-muted-foreground">
      — {author.fullName}
      {author.rank ? `, ${author.rank}` : ""}
      {at ? ` · ${formatDate(at)}` : ""}
    </p>
  );
}

type NewTopic = { key: string; label: string; details: string };

function textOrEmpty(v: string | null): string {
  return v ?? "";
}

export function MeetingEditForm({
  meeting,
  typeRemarks,
  agendaItems,
  shipEditable,
  officeEditable,
  canClose,
  canDelete,
  attachments,
}: {
  meeting: MeetingHeader;
  /** One overall office reply per committee type actually present in this
   * meeting — a combined Safety + Health & Hygiene meeting gets two. */
  typeRemarks: TypeRemarksView[];
  agendaItems: AgendaItemView[];
  /** Ship's own fields — position/date/agenda details/etc. — only while status = DRAFT. */
  shipEditable: boolean;
  /** Office's own fields — shore remarks + per-item shore comments — only while status = REPORTED. */
  officeEditable: boolean;
  /** Office-only, status = REPORTED: closes the meeting out, saving whatever's currently typed first. */
  canClose: boolean;
  canDelete: boolean;
  attachments: AttachmentView[];
}) {
  const editable = shipEditable || officeEditable;
  const [header, setHeader] = useState({
    position: textOrEmpty(meeting.position),
    meetingDate: meeting.meetingDate,
    meetingTime: textOrEmpty(meeting.meetingTime),
    chairman: textOrEmpty(meeting.chairman),
    inCharge: textOrEmpty(meeting.inCharge),
    members: textOrEmpty(meeting.members),
    inAttendance: textOrEmpty(meeting.inAttendance),
    forAcknowledgement: textOrEmpty(meeting.forAcknowledgement),
  });
  const baseHeader = {
    position: textOrEmpty(meeting.position),
    meetingDate: meeting.meetingDate,
    meetingTime: textOrEmpty(meeting.meetingTime),
    chairman: textOrEmpty(meeting.chairman),
    inCharge: textOrEmpty(meeting.inCharge),
    members: textOrEmpty(meeting.members),
    inAttendance: textOrEmpty(meeting.inAttendance),
    forAcknowledgement: textOrEmpty(meeting.forAcknowledgement),
  };

  const [agendaEdits, setAgendaEdits] = useState<Record<string, { details: string }>>(
    Object.fromEntries(agendaItems.map((a) => [a.id, { details: textOrEmpty(a.details) }])),
  );
  const baseAgenda = Object.fromEntries(agendaItems.map((a) => [a.id, { details: textOrEmpty(a.details) }]));

  const [typeRemarksState, setTypeRemarksState] = useState<Record<string, string>>(
    Object.fromEntries(typeRemarks.map((r) => [r.committeeType, textOrEmpty(r.shoreRemarks)])),
  );
  const baseTypeRemarks: Record<string, string> = Object.fromEntries(
    typeRemarks.map((r) => [r.committeeType, textOrEmpty(r.shoreRemarks)]),
  );
  function setTypeRemark(type: CommitteeTypeValue, value: string) {
    setTypeRemarksState((prev) => ({ ...prev, [type]: value }));
  }

  const [newTopics, setNewTopics] = useState<NewTopic[]>([]);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [closing, startClosing] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof typeof header>(field: K, value: (typeof header)[K]) {
    setHeader((prev) => ({ ...prev, [field]: value }));
  }
  function setAgendaField(id: string, value: string) {
    setAgendaEdits((prev) => ({ ...prev, [id]: { details: value } }));
  }
  function addTopic() {
    setNewTopics((prev) => [...prev, { key: crypto.randomUUID(), label: "", details: "" }]);
  }
  function removeTopic(key: string) {
    setNewTopics((prev) => prev.filter((t) => t.key !== key));
  }
  function updateTopic(key: string, field: "label" | "details", value: string) {
    setNewTopics((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  }

  const grouped = new Map<CommitteeTypeValue, AgendaItemView[]>();
  for (const a of agendaItems) {
    const list = grouped.get(a.committeeType) ?? [];
    list.push(a);
    grouped.set(a.committeeType, list);
  }
  const meetingTypes = Array.from(grouped.keys());

  const isDirty = shipEditable
    ? JSON.stringify(header) !== JSON.stringify(baseHeader) ||
      Object.keys(agendaEdits).some((id) => agendaEdits[id]?.details !== baseAgenda[id]?.details) ||
      newTopics.some((t) => t.label.trim() !== "")
    : officeEditable
      ? meetingTypes.some((t) => (typeRemarksState[t] ?? "") !== (baseTypeRemarks[t] ?? ""))
      : false;

  function buildOfficeReviewFormData(): FormData {
    const fd = new FormData();
    fd.set("meetingId", meeting.id);
    for (const t of meetingTypes) {
      fd.append("typeRemarksType", t);
      fd.append("typeRemarksText", typeRemarksState[t] ?? "");
    }
    return fd;
  }

  function save() {
    setError(null);
    if (shipEditable) {
      const fd = new FormData();
      fd.set("position", header.position);
      fd.set("meetingDate", header.meetingDate);
      fd.set("meetingTime", header.meetingTime);
      fd.set("chairman", header.chairman);
      fd.set("inCharge", header.inCharge);
      fd.set("members", header.members);
      fd.set("inAttendance", header.inAttendance);
      fd.set("forAcknowledgement", header.forAcknowledgement);
      for (const a of agendaItems) {
        fd.append("agendaId", a.id);
        fd.append("agendaCommitteeType", a.committeeType);
        fd.append("agendaCode", a.code ?? "");
        fd.append("agendaLabel", a.label);
        fd.append("agendaDetails", agendaEdits[a.id]?.details ?? "");
      }
      for (const t of newTopics) {
        if (!t.label.trim()) continue;
        fd.append("agendaId", "");
        fd.append("agendaCommitteeType", "OTHERS");
        fd.append("agendaCode", "");
        fd.append("agendaLabel", t.label);
        fd.append("agendaDetails", t.details);
      }
      startTransition(async () => {
        const res = await updateDraftMeetingAction(meeting.id, { ok: false, error: null }, fd);
        if (!res.ok) setError(res.error);
        else setNewTopics([]);
      });
    } else if (officeEditable) {
      const fd = buildOfficeReviewFormData();
      startTransition(async () => {
        const res = await saveOfficeReviewMeetingAction({ ok: false, error: null }, fd);
        if (!res.ok) setError(res.error);
      });
    }
  }

  /** Saves whatever shore remarks/comments are currently typed and closes the
   * meeting out in the same action — clicking Close never depends on Save
   * having been clicked first. */
  function closeOut() {
    setError(null);
    const fd = buildOfficeReviewFormData();
    startClosing(async () => {
      const res = await closeMeetingAction({ ok: false, error: null }, fd);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    if (!confirm("Delete this committee meeting record?")) return;
    const fd = new FormData();
    fd.set("meetingId", meeting.id);
    startDeleting(async () => {
      await deleteCommitteeMeetingAction(fd);
    });
  }

  // Every type this meeting covers still needs its own remarks before the
  // office can close it out — not just one of them.
  const missingRemarksTypes = meetingTypes.filter((t) => !(typeRemarksState[t] ?? "").trim());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="position">Position</Label>
          <AutoGrowInput id="position" value={header.position} disabled={!shipEditable} onChange={(e) => setField("position", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meetingDate">Date</Label>
          <Input id="meetingDate" type="date" value={header.meetingDate} disabled={!shipEditable} onChange={(e) => setField("meetingDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meetingTime">Time</Label>
          <AutoGrowInput id="meetingTime" value={header.meetingTime} disabled={!shipEditable} onChange={(e) => setField("meetingTime", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="chairman">Chairman</Label>
          <AutoGrowInput id="chairman" value={header.chairman} disabled={!shipEditable} onChange={(e) => setField("chairman", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inCharge">In-charge</Label>
          <AutoGrowInput id="inCharge" value={header.inCharge} disabled={!shipEditable} onChange={(e) => setField("inCharge", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="members">Members</Label>
          <Textarea id="members" rows={3} value={header.members} disabled={!shipEditable} onChange={(e) => setField("members", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inAttendance">In attendance</Label>
          <Textarea id="inAttendance" rows={3} value={header.inAttendance} disabled={!shipEditable} onChange={(e) => setField("inAttendance", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="forAcknowledgement">For acknowledgement</Label>
          <Textarea id="forAcknowledgement" rows={3} value={header.forAcknowledgement} disabled={!shipEditable} onChange={(e) => setField("forAcknowledgement", e.target.value)} />
        </div>
      </div>

      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([type, items]) => (
          <div key={type} className="space-y-3 rounded-md border border-border p-4">
            <h4 className="text-sm font-semibold">{COMMITTEE_TYPE_LABELS[type]}</h4>
            {items.map((a) => (
              <div key={a.id} className="space-y-2 border-t border-border pt-3 first:border-0 first:pt-0">
                <Label className="text-sm">
                  {a.seq}. {a.code ? `${a.code}) ` : ""}{a.label}
                </Label>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Discussion details</Label>
                  <AutoGrowInput
                    className="max-h-none"
                    value={agendaEdits[a.id]?.details ?? ""}
                    disabled={!shipEditable}
                    onChange={(e) => setAgendaField(a.id, e.target.value)}
                    placeholder="Discussion details…"
                  />
                </div>
              </div>
            ))}
            <div className="space-y-1 border-t border-border pt-3">
              <Label className="text-xs text-muted-foreground">Company Remarks — {COMMITTEE_TYPE_LABELS[type]}</Label>
              <AutoGrowInput
                className="max-h-none"
                value={typeRemarksState[type] ?? ""}
                disabled={!officeEditable}
                onChange={(e) => setTypeRemark(type, e.target.value)}
                placeholder="Office's overall reply for this committee…"
              />
              {attributionCaption(
                typeRemarks.find((r) => r.committeeType === type)?.updatedByUser,
                typeRemarks.find((r) => r.committeeType === type)?.updatedAt,
              )}
            </div>
          </div>
        ))}

        {shipEditable && (
          <div className="space-y-3 rounded-md border border-dashed border-border p-4">
            <h4 className="text-sm font-semibold">Add topic (Others)</h4>
            {newTopics.map((t) => (
              <div key={t.key} className="space-y-1.5 border-t border-border pt-3 first:border-0 first:pt-0">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Topic</Label>
                    <AutoGrowInput value={t.label} onChange={(e) => updateTopic(t.key, "label", e.target.value)} placeholder="e.g. SIRE 2.0 Inspection" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTopic(t.key)}
                    aria-label="Remove topic"
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <AutoGrowInput className="max-h-none" value={t.details} onChange={(e) => updateTopic(t.key, "details", e.target.value)} placeholder="Discussion details…" />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addTopic}>
              <Plus className="h-4 w-4" /> Add topic
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Attachments</Label>
        <AttachmentList
          entityType="CommitteeMeeting"
          entityId={meeting.id}
          attachments={attachments}
          editable={editable}
        />
      </div>

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        {canDelete ? (
          <Button type="button" variant="outline" onClick={remove} disabled={deleting}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        ) : <span />}
        <div className="flex items-center gap-2">
          {editable && (
            <Button type="button" variant={isDirty ? "success" : "outline"} disabled={!isDirty || pending} onClick={save}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          )}
          {canClose && (
            <div className="flex flex-col items-end gap-1">
              <Button
                type="button"
                onClick={closeOut}
                disabled={closing || missingRemarksTypes.length > 0}
                title={
                  missingRemarksTypes.length > 0
                    ? `Add shore remarks for ${missingRemarksTypes.map((t) => COMMITTEE_TYPE_LABELS[t]).join(", ")} before closing this meeting out`
                    : undefined
                }
              >
                {closing ? "Closing…" : "Close"}
              </Button>
              {missingRemarksTypes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Add remarks for {missingRemarksTypes.map((t) => COMMITTEE_TYPE_LABELS[t]).join(", ")} first.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
