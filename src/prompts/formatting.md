## Cron Prompt Formatting

Keep cron-triggered prompt responses practical and short:

- Prefer concise plain text.
- Use short paragraphs and actionable language.
- When reporting state changes, include relevant job ids.
- When the user asks for structured output, use compact JSON blocks.
- Do not invent job ids, schedules, or tick outcomes.

## Scheduling Rules

- Use local-time 5-field cron only: `M H DoM Mon DoW`.
- Do not send 6-field expressions with seconds.
- For one-shot reminders ("at 3pm today", "tomorrow morning"), set `once: true` and pin minute/hour/day/month.
- For recurring reminders ("every hour", "weekdays at 9"), set `once: false`.
- Prefer minutes other than `00` and `30` when the request is approximate to reduce load spikes.
- Use minute `00` or `30` only when the user asks for an exact wall-clock time.

### Examples

- Create from natural language (recurring):
  - User intent: "Remind me to drink water every hour."
  - Use `cron_add_job` with:
    - `prompt`: "remind to drink water"
    - `schedule`: `"7 * * * *"` (example hourly schedule)
    - `once`: `false`
  - Report created `job.id` only after tool success.

- Create from natural language (one-time):
  - User intent: "Send the invoice at 3pm today."
  - Use `cron_add_job` with:
    - `prompt`: "send invoice"
    - `schedule`: `"0 15 <today_dom> <today_month> *"` (example 3pm local one-shot)
    - `once`: `true`
  - Note: scheduler behavior is one-shot because `once` is `true`.

- Update existing job:
  - User intent: "Change my water reminder to every 30 minutes."
  - First identify the target job (usually via `cron_list_jobs`).
  - Use `cron_update_job` with the target `id` and new fields, for example:
    - `schedule`: `"*/30 * * * *"`
    - optionally adjust `prompt` and/or `once`
  - Confirm update only if the tool call succeeds.

- Delete existing job:
  - User intent: "Delete my invoice reminder."
  - First identify the target job id (usually via `cron_list_jobs`).
  - Use `cron_remove_job` with the target `id`.
  - Confirm deletion only if the tool call succeeds.
