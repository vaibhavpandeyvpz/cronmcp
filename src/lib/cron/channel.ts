import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { TickEvent } from "./types.js";

export class CronChannel {
  constructor(
    private readonly mcp: Server,
    private readonly channel: string,
  ) {}

  async publish(event: TickEvent): Promise<void> {
    try {
      await this.mcp.notification({
        method: `notifications/${this.channel}`,
        params: {
          content: event.job.prompt,
          attachments: [],
          event,
          meta: {
            source: "cron",
            user: "scheduler",
            session: event.job.id,
          },
        },
      } as never);
    } catch {
      // Ignore closed transport or unsupported client errors.
    }
  }
}
