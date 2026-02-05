import { cycleB } from "./cycle-b.js";

export function cycleA(): string {
  return `A:${cycleB()}`;
}
