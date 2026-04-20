import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import { CronChannel } from "../cron/channel.js";
import { CronScheduler, validateSchedule } from "../cron/scheduler.js";
import { CronStore } from "../cron/store.js";
import { createJsonResult } from "./helpers.js";
import { packageMetadata } from "../package-metadata.js";
import type { CreateCronJobInput, UpdateCronJobInput } from "../cron/types.js";

function instructions(channel = false): string {
  const files = ["formatting.md", channel ? "channel.md" : null].filter(
    Boolean,
  );
  const root = dirname(fileURLToPath(import.meta.url));
  const sections = files.map((file) =>
    readFileSync(resolve(root, `../../prompts/${file}`), "utf8").trim(),
  );
  return `${sections.join("\n\n").trim()}\n`;
}

export class CronMcpServer {
  readonly mcp: McpServer;

  private readonly store: CronStore;
  private readonly scheduler: CronScheduler;
  private readonly channelPublisher?: CronChannel;

  private constructor(channel?: string) {
    this.mcp = new McpServer(
      {
        name: packageMetadata.name,
        version: packageMetadata.version,
      },
      {
        capabilities: {
          experimental: channel
            ? {
                "identity/session": { path: "meta.session" },
                [channel]: {},
              }
            : undefined,
        },
        instructions: instructions(Boolean(channel)),
      },
    );

    this.store = new CronStore();
    this.channelPublisher = channel
      ? new CronChannel(this.mcp.server, channel)
      : undefined;
    this.scheduler = new CronScheduler({
      onTick: async (event) => {
        await this.channelPublisher?.publish(event);
      },
      onOnce: async (job) => {
        await this.store.remove(job.id);
      },
    });
  }

  static async create(channel?: string): Promise<CronMcpServer> {
    const server = new CronMcpServer(channel);
    server.registerTools();
    await server.bootstrap();
    return server;
  }

  async start(transport: Transport): Promise<void> {
    await this.mcp.connect(transport);
  }

  async shutdown(): Promise<void> {
    this.scheduler.stopAll();
  }

  private async bootstrap(): Promise<void> {
    const jobs = await this.store.list();
    this.scheduler.load(jobs);
  }

  private registerTools(): void {
    this.mcp.registerTool(
      "cron_list_jobs",
      {
        title: "List cron jobs",
        description:
          "List scheduled cron jobs loaded from ~/.cronmcp/crontab with runtime scheduling status.",
      },
      async () => createJsonResult({ jobs: this.scheduler.list() }),
    );

    this.mcp.registerTool(
      "cron_add_job",
      {
        title: "Add cron job",
        description:
          "Add a cron job with schedule, prompt, and once flag, then schedule it immediately.",
        inputSchema: z.object({
          schedule: z
            .string()
            .describe("Cron expression used by the cron package."),
          prompt: z.string().describe("Prompt sent on each scheduled tick."),
          once: z
            .boolean()
            .default(false)
            .describe("If true, the job is removed after first successful tick."),
        }),
      },
      async ({ schedule, prompt, once }) => {
        const job = await this.addJob({
          schedule,
          prompt,
          once: once ?? false,
        });
        return createJsonResult({ job });
      },
    );

    this.mcp.registerTool(
      "cron_update_job",
      {
        title: "Update cron job",
        description:
          "Update schedule, prompt, and/or once for a cron job and reschedule it.",
        inputSchema: z.object({
          id: z.string().describe("Cron job id to update."),
          schedule: z.string().optional(),
          prompt: z.string().optional(),
          once: z.boolean().optional(),
        }),
      },
      async ({ id, schedule, prompt, once }) => {
        const job = await this.updateJob(id, {
          schedule,
          prompt,
          once,
        });
        return createJsonResult({ job });
      },
    );

    this.mcp.registerTool(
      "cron_remove_job",
      {
        title: "Remove cron job",
        description:
          "Remove a cron job from ~/.cronmcp/crontab and stop its scheduled worker.",
        inputSchema: z.object({
          id: z.string().describe("Cron job id to remove."),
        }),
      },
      async ({ id }) => createJsonResult({ removed: await this.removeJob(id) }),
    );
  }

  private async addJob(input: CreateCronJobInput) {
    validateSchedule(input.schedule);

    const job = await this.store.add(input);
    this.scheduler.schedule(job);
    return job;
  }

  private async updateJob(id: string, input: UpdateCronJobInput) {
    if (!input.schedule && !input.prompt && input.once === undefined) {
      throw new Error("Provide at least one field to update.");
    }

    if (input.schedule) {
      validateSchedule(input.schedule);
    }

    const job = await this.store.update(id, input);
    this.scheduler.schedule(job);
    return job;
  }

  private async removeJob(id: string): Promise<boolean> {
    const removed = await this.store.remove(id);
    if (removed) {
      this.scheduler.unschedule(id);
    }

    return removed;
  }
}
