import { CronExpressionParser } from "cron-parser";
import {
  NEXT_RUN_LOOKAHEAD_MS,
  RECURRING_JITTER_CAP_MS,
  RECURRING_JITTER_FRACTION,
} from "./constants.js";

const CRON_PARTS = 5;

export function normalizeSchedule(schedule: string): string {
  return schedule.trim().split(/\s+/).join(" ");
}

export function toRuntimeSchedule(schedule: string): string {
  return `0 ${normalizeSchedule(schedule)}`;
}

export function validateSchedule(schedule: string): void {
  const normalized = normalizeSchedule(schedule);
  assertFiveFieldSchedule(normalized);

  try {
    CronExpressionParser.parse(toRuntimeSchedule(normalized));
  } catch {
    throw new Error(
      `Invalid cron expression '${schedule}'. Expected 5 fields: M H DoM Mon DoW.`,
    );
  }
}

export function assertScheduleHasNextRun(schedule: string): void {
  const normalized = normalizeSchedule(schedule);
  const currentDate = new Date();
  const endDate = new Date(currentDate.getTime() + NEXT_RUN_LOOKAHEAD_MS);

  try {
    const interval = CronExpressionParser.parse(toRuntimeSchedule(normalized), {
      currentDate,
      endDate,
    });
    interval.next();
  } catch {
    throw new Error(
      `Cron expression '${schedule}' does not match any calendar date in the next year.`,
    );
  }
}

export function computeRecurringJitterMs(
  schedule: string,
  jobId: string,
  now = new Date(),
): number {
  const normalized = normalizeSchedule(schedule);
  const runtime = toRuntimeSchedule(normalized);
  const idFraction = stableJitterFraction(jobId);

  try {
    const interval = CronExpressionParser.parse(runtime, { currentDate: now });
    const first = interval.next();
    const second = interval.next();
    const periodMs = second.getTime() - first.getTime();
    if (periodMs <= 0) {
      return 0;
    }

    return Math.floor(
      Math.min(
        idFraction * RECURRING_JITTER_FRACTION * periodMs,
        RECURRING_JITTER_CAP_MS,
      ),
    );
  } catch {
    return 0;
  }
}

function assertFiveFieldSchedule(schedule: string): void {
  const parts = schedule.split(" ");
  if (parts.length !== CRON_PARTS) {
    throw new Error(
      `Invalid cron expression '${schedule}'. Expected 5 fields: M H DoM Mon DoW.`,
    );
  }
}

function stableJitterFraction(jobId: string): number {
  const normalized = jobId.toLowerCase().replace(/[^a-f0-9]/g, "");
  const seed = normalized.slice(0, 8);
  if (!seed) {
    return 0;
  }

  const parsed = Number.parseInt(seed, 16);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed / 0x1_0000_0000;
}

