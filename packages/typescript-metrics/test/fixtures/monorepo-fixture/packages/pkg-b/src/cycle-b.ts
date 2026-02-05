import { cycleA } from "./cycle-a.js";

export function cycleB(): string {
  return `B:${cycleA()}`;
}
