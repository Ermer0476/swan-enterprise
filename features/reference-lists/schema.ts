import { z } from "zod";

// Validation for the office-editable reference lists. `value` is the string
// written onto records (e.g. VesselDocument.type) — capped at 80 to match the
// consuming free-text fields — and is immutable after creation, so an existing
// record's stored value never dangles. Only label/sortOrder/active are
// editable, mirroring the Unit Master's immutable `unit` + editable label.
export const addReferenceListItemSchema = z.object({
  listKey: z.string().trim().min(1),
  value: z.string().trim().min(1, "Value is required").max(80),
  label: z.string().trim().min(1, "Label is required").max(120),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(0),
});

export const updateReferenceListItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1, "Label is required").max(120),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(0),
  active: z.coerce.boolean().optional().default(false),
});

export const deleteReferenceListItemSchema = z.object({
  id: z.string().uuid(),
});
