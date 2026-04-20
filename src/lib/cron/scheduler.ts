import { CronJob, validateCronExpression } from "cron";
import type { CronJobRecord, TickEvent } from "./types.js";

type ScheduledEntry = {
  job: CronJobRecord;
  worker: CronJob;
};

export interface CronSchedulerHandlers {
  onTick(event: TickEvent): Promise<void>;
  onOnce(job: CronJobRecord): Promise<void>;
}

export class CronScheduler {
  private readonly jobs = new Map<string, ScheduledEntry>();

  constructor(private readonly handlers: CronSchedulerHandlers) {}

  load(jobs: CronJobRecord[]): void {
    this.stopAll();
    jobs.forEach((job) => this.schedule(job));
  }

  list(): Array<CronJobRecord & { scheduled: boolean }> {
    return Array.from(this.jobs.values()).map(({ job, worker }) => ({
      ...job,
      scheduled: worker.isActive,
    }));
  }

  schedule(job: CronJobRecord): void {
    validateSchedule(job.schedule);
    this.unschedule(job.id);

    const worker = new CronJob(job.schedule, () => {
      void this.handleTick(job.id);
    });
    this.jobs.set(job.id, { job, worker });
    worker.start();
  }

  unschedule(id: string): boolean {
    const entry = this.jobs.get(id);
    if (!entry) {
      return false;
    }

    entry.worker.stop();
    this.jobs.delete(id);
    return true;
  }

  stopAll(): void {
    for (const entry of this.jobs.values()) {
      entry.worker.stop();
    }
    this.jobs.clear();
  }

  private async handleTick(id: string): Promise<void> {
    const entry = this.jobs.get(id);
    if (!entry) {
      return;
    }

    const event: TickEvent = {
      source: "cron",
      job: entry.job,
      prompt: entry.job.prompt,
      tickedAt: new Date().toISOString(),
    };

    try {
      await this.handlers.onTick(event);
    } catch {
      return;
    }

    if (!entry.job.once) {
      return;
    }

    this.unschedule(entry.job.id);
    try {
      await this.handlers.onOnce(entry.job);
    } catch {
      // Do not re-schedule once jobs after firing.
    }
  }
}

export function validateSchedule(schedule: string): void {
  const result = validateCronExpression(schedule);
  if (!result.valid) {
    const message = result.error ? String(result.error) : undefined;
    throw new Error(message ?? `Invalid cron expression: ${schedule}`);
  }
}
