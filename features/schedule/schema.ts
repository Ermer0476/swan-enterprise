import { z } from "zod";

export const SCHEDULE_ITEM_KINDS = ["DRILL", "FAMILIARIZATION"] as const;

export const scheduleItemSchema = z.object({
  kind: z.enum(SCHEDULE_ITEM_KINDS),
  // "" = the fleet-wide fallback set; a real flag name scopes the item to
  // only vessels flying that flag — see prisma/schema.prisma's ScheduleItem
  // comment and features/schedule/queries.ts's resolveEffectiveScheduleItems.
  flag: z.string().trim().max(100).optional().or(z.literal("")),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  itemNo: z.string().trim().max(20).optional().or(z.literal("")),
  name: z.string().trim().min(2, "Name is required").max(300),
  smsReference: z.string().trim().max(80).optional().or(z.literal("")),
  frequencyLabel: z.string().trim().max(80).optional().or(z.literal("")),
  frequencyDays: z.string().trim().optional().or(z.literal("")),
});

export const createScheduleItemSchema = scheduleItemSchema;
export const updateScheduleItemSchema = scheduleItemSchema.extend({ id: z.string().uuid() });

export const cloneFlagScheduleSchema = z.object({
  kind: z.enum(SCHEDULE_ITEM_KINDS),
  sourceFlag: z.string().trim().max(100).optional().or(z.literal("")),
  targetFlag: z.string().trim().min(1, "Select a target flag").max(100),
});
