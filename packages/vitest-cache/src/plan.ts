/**
 * Share pending-test selection with global setup across bundled config copies.
 *
 * @summary Share pending-test selection with global setup across bundled config copies.
 */
import type { TestProject } from 'vitest/node';

/**
 * The execution plan the cache reporter computes before Vitest runs global
 * setup. Vitest bundles each configuration, so module state here is not shared
 * with the configuration's copy of the cache; the plan lives on a global symbol.
 */
const PLAN = Symbol.for('goodfoot.vitest-cache.plan');

/** Current pending module IDs globally and by project, before global setup selection. */
export type Plan = { all: string[]; projects: Map<string, string[]> };

const planSlot = globalThis as unknown as Record<symbol, Plan | null | undefined>;

/**
 * Replace the current bundled run pending-test plan; null retains unknown setup requirements.
 *
 * @param plan - Current pending plan or null when selection is unknown.
 */
export function publishPlan(plan: Plan | null) {
  planSlot[PLAN] = plan;
}

/**
 * Absolute test module IDs that will execute for `project` in this run. The root project receives every pending file, because its global setup serves all projects. `null` means the plan is unknown and setup must run.
 *
 * @param project - Current Vitest project.
 * @returns Copy of pending module IDs; root sees all, unknown plan returns null and requires setup.
 */
export function pendingTestFiles(project: TestProject): string[] | null {
  const plan = planSlot[PLAN];
  if (!plan) return null;
  if (project.vitest?.getRootProject?.() === project) return [...plan.all];
  const pending = plan.projects.get(project.name);
  return pending ? [...pending] : [];
}

/**
 * Whether global setup for `project` has a pending file matching `predicate`.
 *
 * @param project - Current Vitest project.
 * @param predicate - Pending-file matcher, defaulting to every file.
 * @returns True for unknown plan or at least one matching pending file.
 */
export function setupNeeded(project: TestProject, predicate: (file: string) => boolean = () => true) {
  const pending = pendingTestFiles(project);
  return pending === null || pending.some(predicate);
}
