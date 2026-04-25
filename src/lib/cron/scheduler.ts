import { CronJob } from "cron";
import { RECURRING_MAX_AGE_MS } from "./constants.js";
import {
  computeRecurringJitterMs,
  toRuntimeSchedule,
  validateSchedule,
} from "./schedule.js";
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

    const worker = new CronJob(toRuntimeSchedule(job.schedule), () => {
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

    const recurring = !entry.job.once;
    const aged = recurring ? isRecurringJobExpired(entry.job) : false;
    const delayMs =
      recurring && !aged
        ? computeRecurringJitterMs(entry.job.schedule, entry.job.id)
        : 0;

    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const active = this.jobs.get(id);
    if (!active) {
      return;
    }

    const event: TickEvent = {
      source: "cron",
      job: active.job,
      prompt: active.job.prompt,
      tickedAt: new Date().toISOString(),
    };

    try {
      await this.handlers.onTick(event);
    } catch {
      return;
    }

    if (!active.job.once && !aged) {
      return;
    }

    this.unschedule(active.job.id);
    try {
      await this.handlers.onOnce(active.job);
    } catch {
      // Do not re-schedule once jobs after firing.
    }
  }
}

function isRecurringJobExpired(job: CronJobRecord): boolean {
  return Date.now() - job.createdAt >= RECURRING_MAX_AGE_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
