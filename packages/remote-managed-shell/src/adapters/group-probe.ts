import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
export interface Member {
  pid: number;
  state: string;
  start: string;
}
/** Best-effort helper; it is only invoked by an isolated scope worker. */
export function members(pgid: number): Member[] | null {
  try {
    if (process.platform === "linux") {
      const entries = readdirSync("/proc");
      if (entries.length > 100_000) return null;
      const found: Member[] = [];
      for (const id of entries) {
        if (!/^\d+$/u.test(id)) continue;
        try {
          const fields = readFileSync(`/proc/${id}/stat`, "utf8")
            .slice(readFileSync(`/proc/${id}/stat`, "utf8").lastIndexOf(")") + 2)
            .split(" ");
          const state = fields[0];
          const start = fields[19];
          if (state && start && Number(fields[2]) === pgid && state !== "Z" && state !== "X")
            found.push({ pid: Number(id), state, start });
        } catch {
          /* process exited during the probe */
        }
      }
      return found;
    }
    if (process.platform === "darwin") {
      const output = spawnSync("/bin/ps", ["-axo", "pid=,pgid=,stat="], {
        encoding: "utf8",
        timeout: 500,
        maxBuffer: 4_194_304,
      });
      if (output.status !== 0) return null;
      return output.stdout.split("\n").flatMap((line) => {
        const [pid, group, state] = line.trim().split(/\s+/u);
        return Number(group) === pgid && state && !state.startsWith("Z")
          ? [{ pid: Number(pid), state, start: "unavailable" }]
          : [];
      });
    }
    return null;
  } catch {
    return null;
  }
}
export function groupExists(pgid: number): boolean {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
