import { z } from "zod";

const safe = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const identity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u);
const handle = z.string().min(1).max(256);
const cursor = z.string().min(1).max(1024);
const wait = z.number().int().min(0).max(60_000);
const budget = z.number().int().min(4).max(65_536);

export const inputs = {
  exec_command: z
    .object({
      expected_server_instance_id: handle,
      operation_id: identity,
      cmd: z.string().min(1).max(65_536),
      workdir: z.string().min(1).max(4096).optional(),
      login: z.boolean().default(true),
      tty: z.boolean().default(false),
      label: z.string().max(128).optional(),
      yield_time_ms: wait.default(10_000),
      timeout_ms: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).nullable().default(null),
      max_output_bytes: budget.default(16_384),
    })
    .strict(),
  read_process: z
    .object({
      session_id: handle,
      cursor,
      wait_ms: wait.default(0),
      max_output_bytes: budget.default(16_384),
      known_state_version: safe.optional(),
    })
    .strict(),
  write_stdin: z
    .object({
      session_id: handle,
      write_id: identity,
      chars: z.string().max(65_536).default(""),
      close_stdin: z.boolean().default(false),
      interrupt: z.boolean().default(false),
      cursor: cursor.optional(),
      yield_time_ms: wait.default(0),
      max_output_bytes: budget.default(16_384),
    })
    .strict()
    .superRefine((value, context) => {
      if (!value.chars && !value.close_stdin && !value.interrupt)
        context.addIssue({ code: "custom", message: "Empty mutation: use read_process." });
      if (value.interrupt && (value.chars || value.close_stdin))
        context.addIssue({ code: "custom", message: "interrupt excludes chars and close_stdin." });
      if (!value.cursor && value.yield_time_ms > 0)
        context.addIssue({ code: "custom", message: "Output observation requires cursor." });
    }),
  terminate_process: z.object({ session_id: handle, wait_ms: wait.optional() }).strict(),
  list_processes: z
    .object({
      operation_id: identity.optional(),
      include_completed: z.boolean().default(true),
      limit: z.number().int().min(1).max(100).default(50),
      page_token: cursor.optional(),
    })
    .strict(),
};

export type ToolName = keyof typeof inputs;
export type ExecInput = z.infer<typeof inputs.exec_command>;
export type ReadInput = z.infer<typeof inputs.read_process>;
export type WriteInput = z.infer<typeof inputs.write_stdin>;
export type TerminateInput = z.infer<typeof inputs.terminate_process>;
export type ListInput = z.infer<typeof inputs.list_processes>;

export const descriptions: Record<ToolName, string> = {
  exec_command:
    "Start one fresh Bash context. Choose operation_id before calling; promptly retry the same identity and execution arguments after a lost reply. Identity deduplication covers the bounded recent-operation window. Commands use a fresh cwd/environment and every accepted start has a handle, including fast exits and failed spawns.",
  read_process:
    "Read retained output without consuming it. Use the returned cursor after receiving a response; retry an earlier cursor after loss. Leader exit, closed output, and fully read output are separate facts.",
  write_stdin:
    "Reserve an exactly deduplicated stdin mutation using write_id. Retrying the same ID recovers delivery; conflicting payload fails. close_stdin sends bytes then pipe EOF; interrupt is separate from termination.",
  terminate_process:
    "Idempotently request cleanup of the managed process group. Signal success is not confirmation; follow in-progress cleanup with read_process. Preserve actual exit code and signal.",
  list_processes:
    "Read-only authenticated discovery of active work and bounded recent completions. Recover a lost start by operation_id. Listing consumes neither output nor write acknowledgments.",
};

export const errorSchema = z.object({ code: z.string(), message: z.string(), recovery: z.string() });
export const cleanupSchema = z.object({
  scope: z.literal("managed_process_group"),
  status: z.enum(["not_requested", "in_progress", "confirmed", "unverified", "failed"]),
  detail: z.string(),
});
export const eventSchema = z.object({
  seq: safe,
  stream: z.enum(["stdout", "stderr", "terminal"]),
  offset: safe,
  data: z.string(),
});
export const lossSchema = z.object({
  occurred: z.literal(true),
  reason: z.string(),
  dropped_bytes: safe,
  raw_spool_dropped_bytes: safe,
});
export const spoolSchema = z.object({
  status: z.enum(["healthy", "degraded", "closed"]),
  reason: z.string().nullable(),
  pending_bytes: safe,
  disk_bytes: safe,
});
export const retentionSchema = z.object({
  target_ms: safe,
  result_expires_at: z.string().nullable(),
  result_expired: z.boolean(),
  policy: z.string(),
});
export const processSchema = z.object({
  server_instance_id: handle,
  session_id: handle,
  operation_id: identity,
  status: z.enum(["starting", "running", "exited", "failed_to_start"]),
  state_version: safe,
  exit_code: z.number().int().nullable(),
  signal: z.string().nullable(),
  stop_reason: z.enum(["user", "timeout", "shutdown"]).nullable(),
  cleanup: cleanupSchema,
  stdin_open: z.boolean(),
  tty: z.boolean(),
  elapsed_ms: safe,
  output_closed: z.boolean(),
  label: z.string().nullable(),
  command_summary: z.string(),
  command_summary_truncated: z.boolean(),
  spawn_directory: z.string(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  exited_at: z.string().nullable(),
  output_closed_at: z.string().nullable(),
  last_output_at: z.string().nullable(),
  retention: retentionSchema,
  spawn_error: z.object({ code: z.string(), message: z.string() }).nullable(),
  earliest_cursor: cursor,
  latest_cursor: cursor,
  retained_bytes: safe,
  output_loss: lossSchema.nullable(),
  spool: spoolSchema,
  text_encoding: z.literal("utf-8 replacement text; raw bytes retained in transcript when spooled"),
  invalid_utf8_observed: z.boolean(),
  terminal_view: z.boolean(),
});
export const pageSchema = z.object({
  read_from_cursor: cursor,
  next_cursor: cursor,
  output: z.array(eventSchema).max(128),
  has_more_output: z.boolean(),
  backlog_bytes: safe,
  output_bytes: safe,
  observation_complete: z.boolean(),
  effective_wait_ms: safe,
});
export const writeSchema = z.object({
  write_id: identity,
  accepted: z.literal(true),
  reservation_order: safe,
  delivery_status: z.enum(["queued", "handed_off", "failed", "indeterminate"]),
  bytes_accepted: safe,
  chars_bytes: safe,
  close_stdin: z.boolean(),
  interrupt: z.boolean(),
  accepted_at: z.string(),
  settled_at: z.string().nullable(),
  detail: z.string(),
  replayed: z.boolean(),
});

export type OutputEvent = z.infer<typeof eventSchema>;
export type Cleanup = z.infer<typeof cleanupSchema>;
export type ProcessSnapshot = z.infer<typeof processSchema>;
export type WriteRecord = z.infer<typeof writeSchema>;

const processResult = processSchema.extend({
  result_kind: z.literal("process"),
  accepted: z.literal(true),
  replayed: z.boolean().optional(),
  write: writeSchema.optional(),
  read_from_cursor: cursor,
  next_cursor: cursor,
  has_more_output: z.boolean(),
  backlog_bytes: safe,
  output_bytes: safe,
  observation_complete: z.boolean(),
  effective_wait_ms: safe,
  output: z.array(eventSchema).max(128),
});
const listingResult = z.object({
  server_instance_id: handle,
  result_kind: z.literal("listing"),
  mode: z.enum(["local", "public"]),
  processes: z.array(processSchema).max(100),
  next_page_token: cursor.nullable(),
  operation: z.record(z.string(), z.unknown()).nullable(),
  capabilities: z.record(z.string(), z.unknown()),
  environment: z.record(z.string(), z.unknown()),
  limits: z.record(z.string(), z.number()),
  health: z.record(z.string(), z.unknown()),
  pagination: z.string(),
});
const errorResult = z
  .object({ server_instance_id: handle, result_kind: z.literal("error"), accepted: z.boolean(), error: errorSchema })
  .passthrough();
export const outputSchema = z.union([processResult, listingResult, errorResult]);
