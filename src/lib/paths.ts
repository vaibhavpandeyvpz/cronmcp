import { homedir } from "node:os";
import { join } from "node:path";

export const APP_FOLDER = ".cronmcp";
const CRONMCP_HOME_ENV = "CRONMCP_HOME";

export function appRoot(): string {
  const override = process.env[CRONMCP_HOME_ENV]?.trim();
  if (override) {
    return override;
  }

  return join(homedir(), APP_FOLDER);
}

export function crontabPath(): string {
  return join(appRoot(), "crontab");
}
