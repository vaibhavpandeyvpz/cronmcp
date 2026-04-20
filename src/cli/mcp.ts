import process from "node:process";
import type { Command as CommanderCommand } from "commander";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CliIO } from "../lib/cli-io.js";
import { CronMcpServer } from "../lib/mcp/server.js";
import { register } from "../lib/signal-handler.js";
import type { CliCommand } from "../types.js";

export class McpCommand implements CliCommand {
  constructor(private readonly io = new CliIO(process.stderr, process.stderr)) {}

  register(program: CommanderCommand): void {
    program
      .command("mcp")
      .description("Start the stdio MCP server for local cron jobs")
      .option("--channel <name>", "Channel name, for receiving notifications")
      .action(this.action.bind(this));
  }

  private async action(options: { channel?: string }): Promise<void> {
    let keep = false;
    const server = await CronMcpServer.create(options.channel);

    const unregister = register(async () => {
      this.io.line("Shutting down cronmcp server...");
      await server.shutdown();
    });

    try {
      await server.start(new StdioServerTransport());
      this.io.line("Starting cronmcp server...");
      keep = true;
    } finally {
      unregister();
      if (!keep) {
        await server.shutdown();
      }
    }
  }
}
