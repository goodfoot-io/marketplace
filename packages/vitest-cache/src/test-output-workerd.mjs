/**
 * Classify exact workerd record shapes and validate counted diagnostic claims.
 *
 * @summary Classify exact workerd record shapes and validate counted diagnostic claims.
 */
// Closed catalogue of workerd runtime records a passed test may claim.
//
// workerd prints these records itself, outside any test-owned fault site, so
// they cannot carry an expected-native token. A test claims them by declaring
// the record shape, the exact exception message, and the exact count it causes
// (through a test-side helper such as `expectWorkerdDiagnostic`). Capture fails the run on any
// record that matches no shape, any observed (shape, message) count that differs
// from the passed tests' declared total, and any declaration that is not owned by
// a passed test. There is no wildcard shape.

/** Any line that begins a workerd exception record. */
export const WORKERD_RECORD_STARTS = ['uncaught exception;', 'exception = '];

const STACK = /^stack: \S+@[0-9a-f]+(?: \S+@[0-9a-f]+)*$/;

// A JavaScript trace workerd prints under a record head: one or more
// `    at <frame>` lines.
const TRACE_LINE = /^ {4}at \S.*$/;

/**
 * Exact runtime record categories; classification retains catalogue order.
 * @typedef {'promise-rejection' | 'io-context-rejection' | 'reader-canceled' | 'pump-canceled' | 'request-hung' | 'wasm-trap' | 'stale-wasm-rejection' | 'rpc-rejection'} WorkerdShape
 */
/**
 * Runtime grammar and optional fixed-message/continuation requirements.
 * @typedef {{head: RegExp, stack?: boolean, trace?: boolean, message?: string}} WorkerdRecordDefinition
 */
/**
 * Classified diagnostic and the continuation owed by its matching head.
 * @typedef {{shape: WorkerdShape, message: string, stack: boolean, trace: boolean}} WorkerdRecord
 */
/**
 * Exact positive count a passed test claims for one runtime diagnostic.
 * @typedef {{shape: WorkerdShape, message: string, count: number}} WorkerdClaim
 */

/** @type {Readonly<Record<WorkerdShape, WorkerdRecordDefinition>>} */
const WORKERD_RECORD_SHAPES = Object.freeze({
  // A rejected promise whose reason is not an Error, reported by workerd's
  // isolate (`worker.c++`), for example a body source that errors mid-response.
  'promise-rejection': {
    head: /^uncaught exception; source = Uncaught \(in promise\); exception = (.+)$/,
    stack: false
  },
  // The same failure surfacing from the request's IoContext (`io-context.c++`)
  // as a converted jsg.Error. workerd follows it with a native stack line.
  'io-context-rejection': {
    head: /^uncaught exception; exception = workerd\/jsg\/\S+\/value\.h:\d+: failed: jsg\.Error: (.+)$/,
    stack: true
  },
  // An identity-transform producer observing its reader's deliberate cancel.
  // The message slot is the fixed runtime text.
  'reader-canceled': {
    head: /^exception = workerd\/api\/streams\/identity-transform-stream\.c\+\+:\d+: disconnected: (reader canceled)$/,
    stack: true,
    message: 'reader canceled'
  },
  // The pump behind a response body observing its reader's deliberate cancel
  // (`internal.c++`, the byte-stream pump, as opposed to the identity transform
  // above). The message slot is the fixed runtime text.
  'pump-canceled': {
    head: /^exception = workerd\/api\/streams\/internal\.c\+\+:\d+: disconnected: (pump canceled)$/,
    stack: true,
    message: 'pump canceled'
  },
  // A request workerd cancels because its Worker code can no longer answer it
  // (the request whose handler trapped). The message slot is the fixed
  // runtime text.
  'request-hung': {
    head: /^uncaught exception; exception = workerd\/io\/io-context\.c\+\+:\d+: failed: jsg\.Error: (The Workers runtime canceled this request because it detected that your Worker's code had hung and would never generate a response\. Refer to: \S+)$/,
    stack: true,
    message:
      "The Workers runtime canceled this request because it detected that your Worker's code had hung and would never generate a response. Refer to: https://developers.cloudflare.com/workers/observability/errors/"
  },
  // A wasm trap that escaped to the event loop: workerd prints the isolate's
  // JavaScript trace under the head. The only trap claimed is the one a Rust
  // abort raises (`unreachable`).
  'wasm-trap': {
    head: /^uncaught exception; desc = (RuntimeError: unreachable)$/,
    trace: true,
    message: 'RuntimeError: unreachable'
  },
  // The wasm-bindgen glue refusing an object that belongs to an instance a
  // Worker reset has since replaced, surfacing from a stream's pull. It is
  // listed before `rpc-rejection`, whose head pattern would also match it:
  // classification takes the first shape that matches.
  'stale-wasm-rejection': {
    head: /^uncaught exception; source = Uncaught \(in promise\); stack = Error: (Invalid stale object from previous Wasm instance)$/,
    trace: true,
    message: 'Invalid stale object from previous Wasm instance'
  },
  // A rejection of a Durable Object RPC method itself, reported by the isolate
  // when the call crosses the RPC boundary. The record has no `stack:` line;
  // the JavaScript stack of the thrown error follows the head as `    at `
  // trace lines. The message slot is the thrown error's `Name: message` line,
  // so a claim names both the class workerd reports and the text, for example
  // `CoordinatorRefusal: repository_rpc:conflict`. The first stack frame is
  // inside the called method's own chain: a floating promise started by a
  // method and rejected later is a defect to fix in the product, not a record
  // to claim. This is the catch-all for a thrown `Name: message` and stays last.
  'rpc-rejection': {
    head: /^uncaught exception; source = Uncaught \(in promise\); stack = ([A-Za-z]+: .+)$/,
    trace: true
  }
});

/**
 * Whether `line` is a JavaScript trace line printed under a `trace` record head.
 *
 * @param {string} line - One workerd output line.
 * @returns {boolean} Whether this matches a JavaScript trace line.
 */
export function isWorkerdTraceLine(line) {
  return TRACE_LINE.test(line);
}

/**
 * Whether `line` is the native stack line workerd prints after a record head.
 *
 * @param {string} line - One workerd output line.
 * @returns {boolean} Whether this matches the selected native stack shape.
 */
export function isWorkerdStackLine(line) {
  return STACK.test(line);
}

/**
 * Classify one complete record head (no line terminator).
 *
 * @param {string} line - One complete workerd record head without terminator.
 * @returns {WorkerdRecord | undefined} First exact catalogue match with message/stack/trace requirements, or undefined.
 */
export function classifyWorkerdRecord(line) {
  for (const [shape, definition] of Object.entries(WORKERD_RECORD_SHAPES)) {
    const match = definition.head.exec(line);
    const message = match?.[1];
    if (message !== undefined && isWorkerdShape(shape))
      return { shape, message, stack: definition.stack === true, trace: definition.trace === true };
  }
  return undefined;
}

/**
 * Check that a parsed category selects an own catalogue entry.
 * @param {unknown} value - Parsed record category before validation.
 * @returns {value is WorkerdShape} Whether the category belongs to the closed catalogue.
 */
function isWorkerdShape(value) {
  return typeof value === 'string' && Object.hasOwn(WORKERD_RECORD_SHAPES, value);
}

/**
 * Validate one parsed claim without trusting JSON or task-metadata index types.
 * @param {unknown} claim - Parsed shape/message/count candidate.
 * @returns {WorkerdClaim} Validated exact claim with its original values.
 * @throws For unknown shape, multiline/empty/mismatched fixed message or nonpositive unsafe count.
 */
export function validateWorkerdClaim(claim) {
  const shape = claim && typeof claim === 'object' && 'shape' in claim ? claim.shape : undefined;
  if (!isWorkerdShape(shape)) throw new Error(`Unknown workerd record shape in declaration: ${JSON.stringify(shape)}`);
  const definition = WORKERD_RECORD_SHAPES[shape];
  if (
    !claim ||
    typeof claim !== 'object' ||
    !('message' in claim) ||
    typeof claim.message !== 'string' ||
    !claim.message ||
    /[\r\n]/.test(claim.message)
  ) {
    throw new Error('A workerd record declaration needs one exact single-line message');
  }
  if (definition.message !== undefined && claim.message !== definition.message) {
    throw new Error(`A ${shape} declaration must name the fixed runtime message ${JSON.stringify(definition.message)}`);
  }
  if (!('count' in claim) || typeof claim.count !== 'number' || !Number.isSafeInteger(claim.count) || claim.count < 1) {
    throw new Error('A workerd record declaration needs a positive integer count');
  }
  return { shape, message: claim.message, count: claim.count };
}

/**
 * Validate one declared claim; returns its canonical key.
 *
 * @param {unknown} claim - Declared exact shape/message/positive count.
 * @returns {string} Canonical shape and message key; count is validated separately.
 * @throws For unknown shape, multiline/empty/mismatched fixed message or nonpositive unsafe count.
 */
export function workerdClaimKey(claim) {
  const validated = validateWorkerdClaim(claim);
  return `${validated.shape}\u0000${validated.message}`;
}
