"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  updateCommitteeMeetingAction,
  deleteCommitteeMeetingAction,
} from "@/features/committee-meetings/actions";
import { COMMITTEE_TYPE_LABELS, type CommitteeTypeValue } from "@/features/committee-meetings/schema";
import { AutoGrowInput, Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type MeetingHeader = {
  id: string;
  vesselId: string | null;
  position: string | null;
  meetingDate: string; // yyyy-mm-dd
  meetingTime: string | null;
  chairman: string | null;
  inCharge: string | null;
  members: string | null;
  inAttendance: string | null;
  forAcknowledgement: string | null;
  vesselRemarks: string | null;
  shoreRemarks: string | null;
  published: boolean;
  approved: boolean;
};

type AgendaItemView = {
  id: string;
  seq: number;
  committeeType: CommitteeTypeValue;
  code: string | null;
  label: string;
  details: string | null;
  shoreComments: string | null;
};

type NewTopic = { key: string; label: string; details: string };

function textOrEmpty(v: string | null): string {
  return v ?? "";
}

export function MeetingEditForm({
  meeting,
  agendaItems,
  editable,
  canDelete,
  canApprove,
}: {
  meeting: MeetingHeader;
  agendaItems: AgendaItemView[];
  editable: boolean;
  canDelete: boolean;
  canApprove: boolean;
}) {
  const [header, setHeader] = useState({
    position: textOrEmpty(meeting.position),
    meetingDate: meeting.meetingDate,
    meetingTime: textOrEmpty(meeting.meetingTime),
    chairman: textOrEmpty(meeting.chairman),
    inCharge: textOrEmpty(meeting.inCharge),
    members: textOrEmpty(meeting.members),
    inAttendance: textOrEmpty(meeting.inAttendance),
    forAcknowledgement: textOrEmpty(meeting.forAcknowledgement),
    vesselRemarks: textOrEmpty(meeting.vesselRemarks),
    shoreRemarks: textOrEmpty(meeting.shoreRemarks),
    published: meeting.published,
    approved: meeting.approved,
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
    vesselRemarks: textOrEmpty(meeting.vesselRemarks),
    shoreRemarks: textOrEmpty(meeting.shoreRemarks),
    published: meeting.published,
    approved: meeting.approved,
  };

  const [agendaEdits, setAgendaEdits] = useState<Record<string, { details: string; shoreComments: string }>>(
    Object.fromEntries(
      agendaItems.map((a) => [a.id, { details: textOrEmpty(a.details), shoreComments: textOrEmpty(a.shoreComments) }]),
    ),
  );
  const baseAgenda = Object.fromEntries(
    agendaItems.map((a) => [a.id, { details: textOrEmpty(a.details), shoreComments: textOrEmpty(a.shoreComments) }]),
  );

  const [newTopics, setNewTopics] = useState<NewTopic[]>([]);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof typeof header>(field: K, value: (typeof header)[K]) {
    setHeader((prev) => ({ ...prev, [field]: value }));
  }
  function setAgendaField(id: string, field: "details" | "shoreComments", value: string) {
    setAgendaEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { details: "", shoreComments: "" }), [field]: value },
    }));
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

  const isDirty =
    JSON.stringify(header) !== JSON.stringify(baseHeader) ||
    JSON.stringify(agendaEdits) !== JSON.stringify(baseAgenda) ||
    newTopics.some((t) => t.label.trim() !== "");

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("meetingId", meeting.id);
    fd.set("vesselId", meeting.vesselId ?? "");
    fd.set("position", header.position);
    fd.set("meetingDate", header.meetingDate);
    fd.set("meetingTime", header.meetingTime);
    fd.set("chairman", header.chairman);
    fd.set("inCharge", header.inCharge);
    fd.set("members", header.members);
    fd.set("inAttendance", header.inAttendance);
    fd.set("forAcknowledgement", header.forAcknowledgement);
    fd.set("vesselRemarks", header.vesselRemarks);
    fd.set("shoreRemarks", header.shoreRemarks);
    fd.set("published", header.published ? "true" : "false");
    fd.set("approved", header.approved ? "true" : "false");

    for (const a of agendaItems) {
      const e = agendaEdits[a.id];
      fd.append("agendaId", a.id);
      fd.append("agendaCommitteeType", a.committeeType);
      fd.append("agendaCode", a.code ?? "");
      fd.append("agendaLabel", a.label);
      fd.append("agendaDetails", e?.details ?? "");
      fd.append("agendaShoreComments", e?.shoreComments ?? "");
    }
    for (const t of newTopics) {
      if (!t.label.trim()) continue;
      fd.append("agendaId", "");
      fd.append("agendaCommitteeType", "OTHERS");
      fd.append("agendaCode", "");
      fd.append("agendaLabel", t.label);
      fd.append("agendaDetails", t.details);
      fd.append("agendaShoreComments", "");
    }

    startTransition(async () => {
      const res = await updateCommitteeMeetingAction(fd);
      if (!res.ok) setError(res.error);
      else setNewTopics([]);
    });
  }

  function remove() {
    if (!confirm(`Delete ${meeting.id ? "this" : ""} committee meeting record?`)) return;
    const fd = new FormData();
    fd.set("meetingId", meeting.id);
    startDeleting(async () => {
      await deleteCommitteeMeetingAction(fd);
    });
  }

  const grouped = new Map<CommitteeTypeValue, AgendaItemView[]>();
  for (const a of agendaItems) {
    const list = grouped.get(a.committeeType) ?? [];
    list.push(a);
    grouped.set(a.committeeType, list);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="position">Position</Label>
          <AutoGrowInput id="position" value={header.position} disabled={!editable} onChange={(e) => setField("position", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meetingDate">Date</Label>
          <Input id="meetingDate" type="date" value={header.meetingDate} disabled={!editable} onChange={(e) => setField("meetingDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meetingTime">Time</Label>
          <AutoGrowInput id="meetingTime" value={header.meetingTime} disabled={!editable} onChange={(e) => setField("meetingTime", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="chairman">Chairman</Label>
          <AutoGrowInput id="chairman" value={header.chairman} disabled={!editable} onChange={(e) => setField("chairman", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inCharge">In-charge</Label>
          <AutoGrowInput id="inCharge" value={header.inCharge} disabled={!editable} onChange={(e) => setField("inCharge", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="members">Members</Label>
          <Textarea id="members" rows={3} value={header.members} disabled={!editable} onChange={(e) => setField("members", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inAttendance">In attendance</Label>
          <Textarea id="inAttendance" rows={3} value={header.inAttendance} disabled={!editable} onChange={(e) => setField("inAttendance", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="forAcknowledgement">For acknowledgement</Label>
          <Textarea id="forAcknowledgement" rows={3} value={header.forAcknowledgement} disabled={!editable} onChange={(e) => setField("forAcknowledgement", e.target.value)} />
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
                    value={agendaEdits[a.id]?.details ?? ""}
                    disabled={!editable}
                    onChange={(e) => setAgendaField(a.id, "details", e.target.value)}
                    placeholder="Discussion details…"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Shore comments</Label>
                  <AutoGrowInput
                    value={agendaEdits[a.id]?.shoreComments ?? ""}
                    disabled={!editable}
                    onChange={(e) => setAgendaField(a.id, "shoreComments", e.target.value)}
                    placeholder="Office reply…"
                  />
                </div>
              </div>
            ))}
          </div>
        ))}

        {editable && (
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
                <AutoGrowInput value={t.details} onChange={(e) => updateTopic(t.key, "details", e.target.value)} placeholder="Discussion details…" />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addTopic}>
              <Plus className="h-4 w-4" /> Add topic
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vesselRemarks">Vessel remarks</Label>
          <AutoGrowInput id="vesselRemarks" value={header.vesselRemarks} disabled={!editable} onChange={(e) => setField("vesselRemarks", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shoreRemarks">Shore remarks</Label>
          <AutoGrowInput id="shoreRemarks" value={header.shoreRemarks} disabled={!editable} onChange={(e) => setField("shoreRemarks", e.target.value)} />
        </div>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-border p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={header.published} onChange={(e) => setField("published", e.target.checked)} className="h-4 w-4" />
            Published
          </label>
          <label className="flex items-center gap-2 text-sm" title={canApprove ? undefined : "Only the vessel (Master) can approve — this marks the minutes as complete and sends them to the office."}>
            <input
              type="checkbox"
              checked={header.approved}
              disabled={!canApprove}
              onChange={(e) => setField("approved", e.target.checked)}
              className="h-4 w-4"
            />
            Approved{!canApprove && <span className="text-xs text-muted-foreground">(vessel only)</span>}
          </label>
        </div>
      )}

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        {canDelete ? (
          <Button type="button" variant="outline" onClick={remove} disabled={deleting}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        ) : <span />}
        {editable && (
          <Button type="button" variant={isDirty ? "success" : "outline"} disabled={!isDirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </div>
    </div>
  );
}
