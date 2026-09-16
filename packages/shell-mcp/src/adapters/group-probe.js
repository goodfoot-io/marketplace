import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

/** @typedef {{ pid: number, state: string, start: string }} Member */

/**
 * Best-effort helper; it is only invoked by an isolated scope worker.
 *
 * Plain JavaScript on purpose: the worker is started by a bare `node`, so
 * nothing it loads can spawn a helper that joins the group it is probing. See
 * the note at the top of `scope-worker.js`.
 *
 * @param {number} pgid
 * @returns {Member[] | null} group members, or null when the host cannot say
 */
export function members(pgid) {
  try {
    if (process.platform === "linux") {
      const entries = readdirSync("/proc");
      if (entries.length > 100_000) return null;
      /** @type {Member[]} */
      const found = [];
      for (const id of entries) {
        if (!/^\d+$/u.test(id)) continue;
        try {
          const stat = readFileSync(`/proc/${id}/stat`, "utf8");
          const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
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
