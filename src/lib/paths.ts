import { homedir } from "node:os";
import { join } from "node:path";

export const APP_FOLDER = ".cronmcp";

export function appRoot(): string {
  return join(homedir(), APP_FOLDER);
}

export function crontabPath(): string {
  return join(appRoot(), "crontab");
}
