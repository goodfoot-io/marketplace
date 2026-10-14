/**
 * Validate deferred native diagnostics against exact passed-test claims.
 *
 * @summary Validate deferred native diagnostics against exact passed-test claims.
 */
import { hash } from 'node:crypto';
import { once } from 'node:events';
import { appendFileSync, closeSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { errnoCode, errorMessage } from './errors.ts';
import { NATIVE_MARKER } from './test-output-native.mjs';
import {
  classifyWorkerdRecord,
  isWorkerdStackLine,
  isWorkerdTraceLine,
  validateWorkerdClaim,
  WORKERD_RECORD_STARTS,
  workerdClaimKey
} from './test-output-workerd.mjs';

const NATIVE_PREFIX = 'uncaught exception; source = Uncaught (in promise); stack = ';
const PREFIX = `${NATIVE_PREFIX}${NATIVE_MARKER}`;

const STACK_START = 'stack: ';
const TRACE_START = '    at ';

/**
 * Exact fixture assertion evidence paired with a framed native diagnostic.
 * @typedef {{token: string, message: string}} NativeDiagnosticClaim
 */
/**
 * Original test result and its counted diagnostic assertions.
 * @typedef {{owner: string, state: string, expected: NativeDiagnosticClaim[], expectedWorkerd: import('./test-output-workerd.mjs').WorkerdClaim[]}} DiagnosticVerdict
 */
/**
 * Child output capture with its private verdict path and final reconciliation boundary.
 * @typedef {{resultPath: string, accepted: () => boolean, pump: (source: AsyncIterable<unknown>, destination: import('node:stream').Writable) => Promise<void>, finish: (status: number) => number}} TestOutputCapture
 */

/**
 * Read fixture assertions from parsed verdicts or original runner metadata.
 * @param {unknown} value - Untrusted assertion list; absence declares no assertions.
 * @returns {NativeDiagnosticClaim[]} Exact token/message assertions in their original order.
 * @throws For a present non-array or an assertion without string token/message fields.
 */
export function nativeDiagnosticClaims(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Native diagnostic assertions must be an array');
  return value.map((entry) => {
    /** @type {unknown} */
    const claim = entry;
    if (
      !claim ||
      typeof claim !== 'object' ||
      !('token' in claim) ||
      typeof claim.token !== 'string' ||
      !('message' in claim) ||
      typeof claim.message !== 'string'
    )
      throw new Error('Native diagnostic assertions require exact token/message strings');
    return { token: claim.token, message: claim.message };
  });
}

/**
 * Read counted runtime claims using the canonical closed workerd catalogue.
 * @param {unknown} value - Untrusted runtime claim list; absence declares no claims.
 * @returns {import('./test-output-workerd.mjs').WorkerdClaim[]} Validated original shape/message/count values.
 * @throws For a present non-array or a claim rejected by the catalogue.
 */
export function workerdDiagnosticClaims(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Workerd diagnostic claims must be an array');
  return value.map((entry) => validateWorkerdClaim(entry));
}

/**
 * Require the original result ownership before accepting serialized claims.
 * @param {unknown} value - Parsed private verdict record.
 * @returns {DiagnosticVerdict} Original owner/result with canonical diagnostic claims.
 * @throws For malformed ownership, result or claim fields.
 */
function diagnosticVerdict(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    !('owner' in value) ||
    typeof value.owner !== 'string' ||
    !('state' in value) ||
    typeof value.state !== 'string'
  )
    throw new Error('Native diagnostic verdict requires original owner and result state');
  return {
    owner: value.owner,
    state: value.state,
    expected: nativeDiagnosticClaims('expected' in value ? value.expected : undefined),
    expectedWorkerd: workerdDiagnosticClaims('expectedWorkerd' in value ? value.expectedWorkerd : undefined)
  };
}

/**
 * Explicitly framed test-fixture records and workerd runtime records are deferred; every other byte passes through. A workerd record is accepted only when passed tests declared exactly that many of its (shape, message).
 *
 * @param {string} cwd - Current package/worktree directory used for diagnostic artifact naming.
 * @returns {TestOutputCapture} Capture with private verdict path, backpressured pumps, final reconciliation and accepted-state accessor.
 * @throws For temporary artifact creation failure.
 */
export function createTestOutputCapture(cwd) {
  const worktree = hash('sha256', cwd, 'hex').slice(0, 12);
  const directory = mkdtempSync(join(tmpdir(), `goodfoot-test-output-${worktree}-`));
  const artifact = join(directory, 'expected-native.log');
  const resultPath = join(directory, 'test-verdicts.jsonl');
  const fd = openSync(artifact, 'wx', 0o600);
  /** @type {NativeDiagnosticClaim[]} */
  const records = [];
  /** @type {{shape: import('./test-output-workerd.mjs').WorkerdShape, message: string}[]} */
  const workerdRecords = [];
  /** @type {Buffer} */
  let tail = Buffer.alloc(0);
  let bytes = 0;
  /** @type {Error | undefined} */
  let failure;
  /** @param {string} text - Exact diagnostic evidence appended to the private artifact. */
  const save = (text) => {
    const buffer = Buffer.from(text);
    let offset = 0;
    while (offset < buffer.length) offset += writeSync(fd, buffer, offset);
    bytes += buffer.length;
    tail = Buffer.concat([tail, buffer.subarray(-8192)]).subarray(-8192);
  };
  /**
   * @param {import('node:stream').Writable} destination - Original parent byte sink.
   * @param {Buffer} buffer - Exact child bytes forwarded under backpressure.
   * @returns {Promise<void>} Completion of byte forwarding and any required drain.
   */
  const output = async (destination, buffer) => {
    if (buffer.length && !destination.write(buffer)) await once(destination, 'drain');
  };
  /**
   * @param {Buffer} line - Complete framed diagnostic line including its terminator.
   * @returns {boolean} Whether the original fixture frame was recognized and retained.
   * @throws For an artifact write failure or exceeded record bound.
   */
  const capture = (line) => {
    const text = line.toString('utf8');
    const match = /^(\d+):([A-Za-z0-9+/]+={0,2})\r?\n$/.exec(text.slice(PREFIX.length));
    if (!match) return false;
    const declaredLength = match[1];
    const spelling = match[2];
    if (declaredLength === undefined || spelling === undefined) return false;
    const encoded = Buffer.from(spelling, 'base64');
    if (encoded.length !== Number(declaredLength) || encoded.toString('base64') !== spelling) return false;
    /** @type {unknown} */
    let value;
    try {
      value = JSON.parse(encoded.toString('utf8'));
    } catch {
      return false;
    }
    if (
      !value ||
      typeof value !== 'object' ||
      !('token' in value) ||
      typeof value.token !== 'string' ||
      !/^[0-9a-f-]{36}$/.test(value.token) ||
      !('stack' in value) ||
      typeof value.stack !== 'string' ||
      !('message' in value) ||
      typeof value.message !== 'string'
    )
      return false;
    if (records.length + workerdRecords.length >= 4096)
      throw new Error('Expected-native record count exceeds the 4096-record run bound');
    save(`uncaught exception; source = Uncaught (in promise); stack = ${value.stack}\n`);
    records.push({ token: value.token, message: value.message });
    return true;
  };
  return {
    resultPath,
    /**
     * After finish(): whether every deferred diagnostic matched a passed-test expectation.
     *
     * @returns {boolean} Whether no capture failure is recorded; meaningful acceptance requires finish first.
     */
    accepted() {
      return !failure;
    },
    /**
     * Forward unclaimed bytes under destination backpressure and retain bounded exact deferred records.
     *
     * @param {AsyncIterable<unknown>} source - Child stdout/stderr readable byte source.
     * @param {import('node:stream').Writable} destination - Parent output writable byte destination.
     * @returns {Promise<void>} Completion of source draining and byte forwarding.
     * @throws For streaming/write errors or exceeding deferred-record bounds.
     */
    async pump(source, destination) {
      // A line is buffered only while its start can still begin a deferred
      // record (or the stack line owed by the previous workerd record).
      /** @type {Buffer} */
      let line = Buffer.alloc(0);
      let passthrough = false;
      /** @type {import('./test-output-workerd.mjs').WorkerdRecord | undefined} */
      let owedStack;
      /** @type {{shape: import('./test-output-workerd.mjs').WorkerdShape, lines: number} | undefined} */
      let owedTrace;
      const candidates = () => [
        PREFIX,
        ...WORKERD_RECORD_STARTS,
        ...(owedStack ? [STACK_START] : []),
        ...(owedTrace ? [TRACE_START] : [])
      ];
      const settleOwedStack = () => {
        if (owedStack) failure ??= new Error(`A workerd ${owedStack.shape} record was not followed by its stack line`);
        owedStack = undefined;
      };
      // A trace ends at the first line that is not a trace line; it must have
      // at least one.
      const settleOwedTrace = () => {
        if (owedTrace && owedTrace.lines === 0)
          failure ??= new Error(`A workerd ${owedTrace.shape} record was not followed by its trace`);
        owedTrace = undefined;
      };
      /**
       * @param {Buffer} buffer - One complete candidate diagnostic line.
       * @returns {Promise<void>} Completion of classification and original-byte forwarding.
       * @throws For an artifact write failure or exceeded record bound.
       */
      const complete = async (buffer) => {
        const text = buffer.toString('utf8').replace(/\r?\n$/, '');
        if (owedTrace) {
          if (isWorkerdTraceLine(text)) {
            save(`${text}\n`);
            owedTrace.lines++;
            return;
          }
          settleOwedTrace();
        }
        if (owedStack) {
          if (isWorkerdStackLine(text)) {
            save(`${text}\n`);
            owedStack = undefined;
            return;
          }
          settleOwedStack();
        }
        if (text.startsWith(PREFIX)) {
          let captured = false;
          try {
            captured = capture(buffer);
          } catch (error) {
            failure = error instanceof Error ? error : new Error(errorMessage(error));
          }
          if (!captured) {
            failure ??= new Error('A native diagnostic frame was malformed');
            await output(destination, buffer);
          }
          return;
        }
        const record = WORKERD_RECORD_STARTS.some((start) => text.startsWith(start))
          ? classifyWorkerdRecord(text)
          : undefined;
        if (!record && text.startsWith(NATIVE_PREFIX)) {
          failure ??= new Error('An unclaimed native exception was emitted');
          await output(destination, buffer);
          return;
        }
        if (!record) {
          if (WORKERD_RECORD_STARTS.some((start) => text.startsWith(start))) {
            failure ??= new Error('A workerd record matched no declared record shape');
          }
          await output(destination, buffer);
          return;
        }
        if (records.length + workerdRecords.length >= 4096)
          throw new Error('Expected-native record count exceeds the 4096-record run bound');
        workerdRecords.push({ shape: record.shape, message: record.message });
        save(`${text}\n`);
        if (record.stack) owedStack = record;
        if (record.trace) owedTrace = { shape: record.shape, lines: 0 };
      };
      for await (const chunk of source) {
        if (!Buffer.isBuffer(chunk)) throw new TypeError('Vitest child output must contain byte buffers');
        let offset = 0;
        while (offset < chunk.length) {
          const newline = chunk.indexOf(10, offset);
          const end = newline < 0 ? chunk.length : newline + 1;
          const part = chunk.subarray(offset, end);
          offset = end;
          if (passthrough) {
            await output(destination, part);
          } else {
            line = Buffer.concat([line, part]);
            const start = line.toString('utf8');
            const possible = candidates().some(
              (candidate) => candidate.startsWith(start) || start.startsWith(candidate)
            );
            if (!possible || line.length > 65_536) {
              settleOwedStack();
              settleOwedTrace();
              if (start.startsWith(NATIVE_PREFIX)) failure ??= new Error('An unclaimed native exception was emitted');
              else if (WORKERD_RECORD_STARTS.some((candidate) => start.startsWith(candidate)))
                failure ??= new Error('A workerd record exceeded the 65536-byte line bound');
              await output(destination, line);
              line = Buffer.alloc(0);
              passthrough = newline < 0;
            } else if (newline >= 0) {
              try {
                await complete(line);
              } catch (error) {
                failure ??= error instanceof Error ? error : new Error(errorMessage(error));
                await output(destination, line);
              }
              line = Buffer.alloc(0);
            }
          }
          if (newline >= 0) passthrough = false;
        }
      }
      const rest = line.toString('utf8');
      if (rest.startsWith(NATIVE_PREFIX)) failure ??= new Error('An unterminated native diagnostic was emitted');
      else if (rest && WORKERD_RECORD_STARTS.some((candidate) => rest.startsWith(candidate)))
        failure ??= new Error('An unterminated workerd record was emitted');
      settleOwedStack();
      settleOwedTrace();
      await output(destination, line);
    },
    /**
     * Reconcile deferred records with exact passed-test verdicts, retaining diagnostic evidence on failure.
     *
     * @param {number} status - Original child exit status.
     * @returns {number} Original nonzero status or failure status 1, otherwise zero after reconciliation.
     */
    finish(status) {
      try {
        closeSync(fd);
        /** @type {DiagnosticVerdict[]} */
        let verdicts = [];
        try {
          if (statSync(resultPath).size > 1_048_576)
            throw new Error('Native diagnostic verdicts exceed the 1048576-byte run bound');
          verdicts = readFileSync(resultPath, 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => diagnosticVerdict(JSON.parse(line)));
        } catch (error) {
          // No verdict file means no test claimed anything; every deferred
          // record then fails reconciliation below with its own description.
          if (errnoCode(error) !== 'ENOENT')
            failure ??= error instanceof Error ? error : new Error(errorMessage(error));
        }
        /** @type {Map<string, NativeDiagnosticClaim & {state: string}>} */
        const expected = new Map();
        for (const verdict of verdicts) {
          for (const entry of verdict.expected ?? []) {
            if (expected.has(entry.token)) throw new Error('Duplicate expected-native diagnostic token');
            expected.set(entry.token, { ...entry, state: verdict.state });
          }
        }
        /** @type {Set<string>} */
        const observed = new Set();
        for (const record of records) {
          if (observed.has(record.token))
            failure ??= new Error('An expected native diagnostic was observed more than once');
          observed.add(record.token);
          const entry = expected.get(record.token);
          if (!entry || entry.message !== record.message || entry.state !== 'passed') {
            failure ??= new Error('A deferred native diagnostic has no matching passed-test expectation');
          }
        }
        for (const [token] of expected) {
          if (!records.some((record) => record.token === token))
            failure ??= new Error('An expected native diagnostic was not observed');
        }
        // workerd records carry no owner, so claims are exact per-run totals by
        // (shape, message). A claim from a test that did not pass is stale.
        /** @type {Map<string, number>} */
        const declared = new Map();
        for (const verdict of verdicts) {
          for (const claim of verdict.expectedWorkerd ?? []) {
            const key = workerdClaimKey(claim);
            if (verdict.state !== 'passed') {
              failure ??= new Error(
                `A workerd record declaration is owned by a ${verdict.state} test: ${verdict.owner}`
              );
              continue;
            }
            declared.set(key, (declared.get(key) ?? 0) + claim.count);
          }
        }
        /** @type {Map<string, number>} */
        const observedWorkerd = new Map();
        for (const record of workerdRecords) {
          const key = workerdClaimKey({ ...record, count: 1 });
          observedWorkerd.set(key, (observedWorkerd.get(key) ?? 0) + 1);
        }
        for (const key of new Set([...declared.keys(), ...observedWorkerd.keys()])) {
          const want = declared.get(key) ?? 0;
          const got = observedWorkerd.get(key) ?? 0;
          if (want !== got) {
            const [shape, message] = key.split('\u0000');
            failure ??= new Error(
              `workerd ${shape} records for ${JSON.stringify(message)}: declared ${want}, observed ${got}`
            );
          }
        }
        if (failure)
          process.stderr.write(
            `[test-output] Capture/expectation failure: ${failure.message}; artifacts: ${directory}\n`
          );
        const deferred = records.length + workerdRecords.length;
        if ((status !== 0 || failure) && deferred) {
          process.stderr.write(
            `\n[test-output] Native diagnostics${bytes > tail.length ? ' (truncated to the last 8192 bytes)' : ''}. Complete artifact: ${artifact}\n${tail.toString('utf8')}\n`
          );
        }
        if (!deferred && !failure) rmSync(directory, { recursive: true, force: true });
        else
          appendFileSync(join(directory, 'owner.txt'), `Worktree/package: ${cwd}\nChild exit: ${status}\n`, {
            mode: 0o600
          });
        return status || (failure ? 1 : 0);
      } catch (error) {
        failure ??= error instanceof Error ? error : new Error(errorMessage(error));
        process.stderr.write(
          `[test-output] Capture finalization failed: ${errorMessage(error)}; artifact: ${artifact}\n`
        );
        return status || 1;
      }
    }
  };
}
