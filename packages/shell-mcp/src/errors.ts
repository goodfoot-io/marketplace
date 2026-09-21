export const recoveries: Record<string, string> = {
  INVALID_ARGUMENT: "Correct the arguments. No new mutation was accepted.",
  SERVER_INSTANCE_MISMATCH:
    "Discover the current instance with list_processes. Earlier effects may be unknown; do not rerun automatically.",
  SESSION_UNKNOWN: "Look up the operation_id with list_processes. Absence is not proof that the command never ran.",
  SESSION_EXPIRED:
    "Look up the operation_id. Full results expired; earlier effects must not be replayed automatically.",
  OPERATION_ID_CONFLICT:
    "Correct caller identity bookkeeping. This operation_id already names different execution arguments.",
  WRITE_ID_CONFLICT: "Correct caller identity bookkeeping. This write_id already names different input.",
  OPERATION_RESULT_EXPIRED:
    "This identity remains used. Inspect external effects deliberately; never restart automatically under a new ID.",
  WRITE_RESULT_EXPIRED: "This write identity remains used. Do not resend input automatically under a new ID.",
  CURSOR_INVALID: "Use a cursor returned for this session and instance, or explicitly request start.",
  CURSOR_EXPIRED: "Inspect output_loss. Explicitly resume at earliest_cursor to retrieve surviving history.",
  OUTPUT_GAP: "Inspect output_loss and recovery_cursor. Explicitly choose that surviving position; history was lost.",
  STDIN_CLOSED:
    "Read the existing process outcome. Replay a known write_id to recover its record; do not assume input was unapplied.",
  INPUT_QUEUE_FULL:
    "No input was accepted. Back off and retry the same write_id; read/list/terminate remain available.",
  PTY_UNAVAILABLE:
    "Install and validate the optional node-pty adapter, or deliberately choose tty:false before starting.",
  UNSUPPORTED_OPERATION: "Use a documented operation for this mode; PTY Ctrl-D is not pipe EOF.",
  CAPACITY_EXCEEDED:
    "No new mutation was accepted. Preserve existing jobs; wait for active work or transcript retirement to free capacity.",
  SHUTTING_DOWN: "Admission is closed. Observe existing operations; do not blindly execute them in another instance.",
  OBSERVER_CANCELLED:
    "Only observation was cancelled. Recover accepted work by operation_id/session_id and retry the previous cursor.",
};

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DomainError";
  }
  result(instance: string): Record<string, unknown> {
    return {
      server_instance_id: instance,
      result_kind: "error",
      accepted: false,
      error: {
        code: this.code,
        message: this.message,
        recovery: recoveries[this.code] ?? "Inspect the returned state before retrying.",
      },
      ...this.details,
    };
  }
}

export function requireThat(
  condition: unknown,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): asserts condition {
  if (!condition) throw new DomainError(code, message, details);
}
