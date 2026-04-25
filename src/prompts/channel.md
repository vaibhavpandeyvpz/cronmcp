## Incoming Cron Tick Events

Incoming events from `cron` are one-way notifications emitted as `notifications/<channel>`. Read them and act. Your final response text is for the MCP host and does not schedule, send, or persist anything by itself.

### Rule 1: Delivery

- Plain assistant output is visible to the MCP host, not an external chat user.
- The event `prompt` is the scheduled instruction for that tick and should be treated as the primary task input.
- If you need to modify schedules, you MUST call a cron tool (`cron_add_job`, `cron_update_job`, `cron_remove_job`).

### Rule 2: Event Shape

- `meta.source` is `cron`.
- `meta.user` is `scheduler`.
- `meta.session` is the cron job id.
- The JSON-decoded content includes `source`, `job`, `prompt`, and `tickedAt`.

### Rule 3: Truthfulness

- Do not claim a job was modified, deleted, or rescheduled unless a cron tool call confirms it.

### Rule 4: Idempotence And Safety

- A cron tick may reoccur frequently; avoid destructive actions unless explicitly required by the prompt.
- If the prompt is ambiguous, missing required context, or cannot be safely executed, fail with a clear reason instead of asking follow-up questions.
- For `once: true` jobs, assume the scheduler may remove the job after a successful tick emission.

### Rule 5: Job Context

- Use the embedded `job` object for context such as `job.id`, `job.schedule`, and `job.once`.
- Reference `job.id` when reporting outcomes so logs and follow-up actions can be correlated.
- If you need current state before taking action, call `cron_list_jobs` and verify the target job exists.

### Rule 6: Non-Conversational Execution

- Cron events are not attached to a user-facing conversation.
- Process each tick autonomously using the provided `prompt`, available tools, and reasonable assumptions.
- Do not ask the user for clarification, confirmation, or additional input during tick handling.
- If execution is not possible (insufficient data, missing capability, or tool failure), return a clear failure outcome and reason.

## Notification Shape

- Incoming cron events are emitted as `notifications/<channel>`.
- `meta.source` is always `cron`.
- `meta.user` is always `scheduler`.
- `meta.session` is always the cron job id.
- The JSON-decoded notification content includes:
  - `source`: `"cron"`
  - `job`: `{ id, schedule, prompt, once, createdAt }`
  - `prompt`: scheduled instruction text
  - `tickedAt`: ISO timestamp
