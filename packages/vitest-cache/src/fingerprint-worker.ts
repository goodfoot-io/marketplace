/**
 * Execute the original digest and guard backend inside a persistent fingerprint worker.
 * @summary Retain completed tree metadata, but release every phase's filesystem observations.
 */
import { hash } from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { DigestStore, type TreeSnapshot } from './digest-store.ts';
import { errorMessage } from './errors.ts';
import { joinFilesystemBudget, physicalPath } from './filesystem-batch.ts';
import { FingerprintPhase, inputsDigest } from './fingerprint.ts';
import {
  emptyFingerprintStatistics,
  type FingerprintCommand,
  type FingerprintRequest,
  type FingerprintResponse
} from './fingerprint-protocol.ts';

const data: unknown = workerData;
if (
  !data ||
  typeof data !== 'object' ||
  !('budget' in data) ||
  !(data.budget instanceof SharedArrayBuffer) ||
  !('slot' in data) ||
  typeof data.slot !== 'number'
)
  throw new Error('invalid fingerprint worker initialization');
joinFilesystemBudget(data.budget, data.slot);
const port = parentPort;
if (!port) throw new Error('fingerprint worker requires a parent port');
const phases = new Map<number, FingerprintPhase>();
const snapshots = new Map<string, TreeSnapshot>();

async function phaseFor(
  command: Extract<FingerprintCommand, { kind: 'local' | 'closure' }>
): Promise<FingerprintPhase> {
  let phase = phases.get(command.phase);
  if (!phase) {
    phase = new FingerprintPhase(await physicalPath(command.root), {
      store: new DigestStore(command.folder, { treeSnapshots: snapshots })
    });
    phases.set(command.phase, phase);
  }
  return phase;
}

async function execute(command: FingerprintCommand): Promise<unknown> {
  switch (command.kind) {
    case 'json':
      return command.values.map((value) => hash('sha256', JSON.stringify(value), 'hex'));
    case 'local': {
      const phase = await phaseFor(command);
      const inputs = await phase.inputDigests(command.files, command.declarations);
      return {
        inputs: [...inputs],
        inputDigest: inputsDigest(inputs, command.declarations),
        executables: command.executables.length ? await phase.executablesDigest(command.executables) : null,
        execution: hash('sha256', JSON.stringify(command.execution), 'hex')
      };
    }
    case 'closure':
      return (await phaseFor(command)).packages().closure(command.paths, command.toolchain, command.toolchainRoot);
    case 'release': {
      const phase = phases.get(command.phase);
      phases.delete(command.phase);
      return phase?.stats ?? emptyFingerprintStatistics();
    }
  }
}

// The controller admits one command at a time to each role; no recursive workers or file-byte RPC.
port.on('message', async (request: FingerprintRequest) => {
  let response: FingerprintResponse;
  try {
    response = { id: request.id, value: await execute(request.command) };
  } catch (error) {
    response = { id: request.id, error: errorMessage(error) };
  }
  port.postMessage(response);
});
