import { z } from "zod";

export const cronJobSchema = z.object({
  id: z.string().min(1),
  schedule: z.string().min(1),
  prompt: z.string().min(1),
  once: z.boolean(),
});

export type CronJobRecord = z.infer<typeof cronJobSchema>;

export type CreateCronJobInput = Omit<CronJobRecord, "id">;

export type UpdateCronJobInput = Partial<CreateCronJobInput>;

export interface TickEvent {
  source: "cron";
  job: CronJobRecord;
  prompt: string;
  tickedAt: string;
}
