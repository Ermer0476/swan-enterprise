import { z } from "zod";

export const uploadQuestionnaireSchema = z.object({
  label: z.string().trim().min(2, "Give this version a label").max(200),
});

export type UploadQuestionnaireInput = z.infer<typeof uploadQuestionnaireSchema>;
