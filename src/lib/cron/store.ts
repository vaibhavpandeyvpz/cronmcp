import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { crontabPath } from "../paths.js";
import {
  type CreateCronJobInput,
  type CronJobRecord,
  cronJobSchema,
  type UpdateCronJobInput,
} from "./types.js";
import { validateSchedule } from "./schedule.js";

export class CronStore {
  constructor(private readonly path = crontabPath()) {}

  async list(): Promise<CronJobRecord[]> {
    const content = await this.readAll();
    if (!content.trim()) {
      return [];
    }

    const jobs: CronJobRecord[] = [];
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]?.trim() ?? "";
      if (!line) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSONL at line ${index + 1} in ${this.path}.`);
      }

      try {
        const job = cronJobSchema.parse(parsed);
        validateSchedule(job.schedule);
        jobs.push(job);
      } catch {
        throw new Error(
          `Invalid job payload at line ${index + 1} in ${this.path}.`,
        );
      }
    }

    return jobs;
  }

  async add(input: CreateCronJobInput): Promise<CronJobRecord> {
    const job = cronJobSchema.parse({
      id: `job_${randomUUID()}`,
      ...input,
      createdAt: Date.now(),
    });
    const jobs = await this.list();
    jobs.push(job);
    await this.writeAll(jobs);
    return job;
  }

  async update(id: string, input: UpdateCronJobInput): Promise<CronJobRecord> {
    const jobs = await this.list();
    const index = jobs.findIndex((job) => job.id === id);
    if (index < 0) {
      throw new Error(`Cron job not found: ${id}`);
    }

    const patch = compactUpdate(input);
    const updated = cronJobSchema.parse({
      ...jobs[index],
      ...patch,
      id,
    });
    jobs[index] = updated;
    await this.writeAll(jobs);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const jobs = await this.list();
    const next = jobs.filter((job) => job.id !== id);
    if (next.length === jobs.length) {
      return false;
    }

    await this.writeAll(next);
    return true;
  }

  private async readAll(): Promise<string> {
    await this.ensureReady();

    try {
      return await readFile(this.path, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        await writeFile(this.path, "", "utf8");
        return "";
      }

      throw error;
    }
  }

  private async writeAll(jobs: CronJobRecord[]): Promise<void> {
    await this.ensureReady();

    const tempPath = `${this.path}.${randomUUID()}.tmp`;
    const data = jobs.map((job) => JSON.stringify(job)).join("\n");
    const payload = data ? `${data}\n` : "";

    await writeFile(tempPath, payload, "utf8");
    await rename(tempPath, this.path);
  }

  private async ensureReady(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
  }
}

type NodeError = Error & { code?: string };

function isNodeError(error: unknown): error is NodeError {
  return Boolean(error && typeof error === "object" && "code" in error);
}

function compactUpdate(input: UpdateCronJobInput): UpdateCronJobInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as UpdateCronJobInput;
}
