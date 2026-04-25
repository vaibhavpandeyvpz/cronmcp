# cronmcp

[![npm version](https://img.shields.io/npm/v/cronmcp)](https://www.npmjs.com/package/cronmcp)
[![Publish to NPM](https://github.com/vaibhavpandeyvpz/cronmcp/actions/workflows/publish-npm.yml/badge.svg)](https://github.com/vaibhavpandeyvpz/cronmcp/actions/workflows/publish-npm.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

`cronmcp` is an open-source cron scheduler stdio MCP server built on top of [`cron`](https://www.npmjs.com/package/cron), [`cron-parser`](https://www.npmjs.com/package/cron-parser), `commander`, and `@modelcontextprotocol/sdk`.

It lets MCP-compatible clients create and manage scheduled prompt jobs, and optionally subscribe to cron tick notifications through an MCP notification channel.

## Highlights

- Exposes cron scheduling as an MCP server over stdio.
- Uses the `cron` package for in-process job execution.
- Validates schedules as 5-field local cron (`M H DoM Mon DoW`).
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

2. If your MCP host supports notifications and you want tick events, enable channels:

```bash
npx cronmcp mcp --channels
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

`schedule` values use local-time 5-field cron: `minute hour day-of-month month day-of-week`.

## Push Channel

When started with `--channels`, the server:

- advertises the experimental MCP capability `hooman/channel`
- advertises `hooman/user` with path `meta.user`
- advertises `hooman/session` with path `meta.session`
- advertises `hooman/thread` with path `meta.thread`
- emits `notifications/hooman/channel` for scheduled cron tick events

Each notification includes:

- `content`: a JSON-encoded event payload
- `meta.source`: `cron` (channel contract)
- `meta.user`: `scheduler`
- `meta.session`: the cron job ID
- `meta.thread`: omitted for cron tick events

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
{
  "id": "job_34a56f84-cf7e-4f8d-810c-1777d9f4a5f1",
  "schedule": "*/5 * * * *",
  "prompt": "Check queue depth",
  "once": false,
  "createdAt": 1777098600000
}
```

## Notes

- Cron expressions must be valid 5-field local schedules.
- Jobs must have a next run within the next year.
- At most 50 jobs can be scheduled at once.
- Recurring jobs auto-expire after 7 days (they fire one final time, then are removed).
- Recurring jobs use deterministic jitter to avoid synchronized fire spikes.
- `once: true` jobs are removed after the first successful tick.
- Incoming notification channels depend on MCP host support.

## License

MIT. See [LICENSE](LICENSE).
