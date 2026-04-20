# cronmcp

[![npm version](https://img.shields.io/npm/v/cronmcp)](https://www.npmjs.com/package/cronmcp)
[![Publish to NPM](https://github.com/vaibhavpandeyvpz/cronmcp/actions/workflows/publish-npm.yml/badge.svg)](https://github.com/vaibhavpandeyvpz/cronmcp/actions/workflows/publish-npm.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

`cronmcp` is an open-source cron scheduler stdio MCP server built on top of [`cron`](https://www.npmjs.com/package/cron), `commander`, and `@modelcontextprotocol/sdk`.

It lets MCP-compatible clients create and manage scheduled prompt jobs, and optionally subscribe to cron tick notifications through an MCP notification channel.

## Highlights

- Exposes cron scheduling as an MCP server over stdio.
- Uses the `cron` package for in-process job execution.
- Persists jobs in JSONL under `~/.cronmcp/crontab`.
- Provides tools to list, add, update, and remove jobs.
- Supports one-shot schedules through `once: true`.
- Can emit scheduled tick events over an optional MCP notification channel.

## Requirements

- Node.js `24+`

## Installation

Use it without installing globally:

```bash
npx cronmcp mcp
```

Or for local development:

```bash
npm install
npm run build
npm run dev -- mcp
```

## Quick Start

1. Start the MCP server:

```bash
npx cronmcp mcp
```

2. If your MCP host supports notifications and you want tick events, provide a channel name:

```bash
npx cronmcp mcp --channel claude/channel
```

The server uses stdio, so it is meant to be launched by an MCP client or wrapper rather than browsed directly in a terminal.

## CLI Usage

### MCP Server

```bash
npx cronmcp mcp
```

Starts the stdio MCP server with job persistence at `~/.cronmcp/crontab`.

## MCP Tools

The server currently exposes these tools:

- `cron_list_jobs`
- `cron_add_job`
- `cron_update_job`
- `cron_remove_job`

## Push Channel

When started with `--channel <name>`, the server:

- advertises the experimental MCP capability `<name>`
- advertises `identity/session` with path `meta.session`
- emits `notifications/<name>` for scheduled cron tick events

Each notification includes:

- `content`: a JSON-encoded event payload
- `meta.source`: `cron` (channel contract)
- `meta.user`: `scheduler`
- `meta.session`: the cron job ID

The JSON-decoded `content` payload includes:

- `source`
- `job`
- `prompt`
- `tickedAt`

## Local Data

`cronmcp` stores local state under `~/.cronmcp/`:

- `crontab` for JSONL job records

Each record shape:

```json
{"id":"job_34a56f84-cf7e-4f8d-810c-1777d9f4a5f1","schedule":"*/5 * * * * *","prompt":"Check queue depth","once":false}
```

## Notes

- Cron expression validity is checked before jobs are persisted.
- `once: true` jobs are removed after the first successful tick.
- Incoming notification channels depend on MCP host support.

## License

MIT. See [LICENSE](LICENSE).
