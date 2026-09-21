import { afterEach, describe, expect, it, vi } from "vitest";
import { type Hooks, type PtyLike, type PtyModule, Scope } from "../src/adapters/adapter.js";

function ptyHarness() {
  let onExit: ((event: { exitCode: number; signal?: number }) => void) | undefined;
  const pty: PtyLike = {
    pid: 4242,
    write: () => undefined,
    kill: () => undefined,
    onData: () => undefined,
    onExit: (callback) => {
      onExit = callback;
    },
  };
  const module: PtyModule = { spawn: () => pty };
  const scopeEmpty = vi.fn();
  const hooks: Hooks = {
    output: () => undefined,
    streamEnd: () => undefined,
    started: () => undefined,
    outcome: () => undefined,
    failed: () => undefined,
    lost: () => undefined,
    scopeEmpty,
  };
  const scope = new Scope({ bash: "/bin/bash", cmd: "true", login: false, cwd: "/", tty: true }, hooks, 20, 20, module);
  return { scope, scopeEmpty, exit: () => onExit?.({ exitCode: 0 }) };
}

describe("Scope PTY cleanup observation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("confirms an immediately empty PTY group after terminal closure", async () => {
    const kill = vi.spyOn(process, "kill").mockImplementation(() => {
      const error = new Error("gone") as NodeJS.ErrnoException;
      error.code = "ESRCH";
      throw error;
    });
    const { scope, scopeEmpty, exit } = ptyHarness();
    await scope.start();

    exit();

    expect(kill).toHaveBeenCalledWith(-4242, 0);
    expect(scopeEmpty).toHaveBeenCalledOnce();
  });

  it("keeps probing a closed PTY group until delayed descendants disappear", async () => {
    vi.useFakeTimers();
    let probes = 0;
    vi.spyOn(process, "kill").mockImplementation(() => {
      probes++;
      if (probes < 3) return true;
      const error = new Error("gone") as NodeJS.ErrnoException;
      error.code = "ESRCH";
      throw error;
    });
    const { scope, scopeEmpty, exit } = ptyHarness();
    await scope.start();

    exit();
    expect(scopeEmpty).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);

    expect(scopeEmpty).toHaveBeenCalledOnce();
    scope.dispose();
  });

  it("does not start a group probe when PTY exit arrives after disposal", async () => {
    const kill = vi.spyOn(process, "kill");
    const { scope, scopeEmpty, exit } = ptyHarness();
    await scope.start();

    scope.dispose();
    exit();

    expect(kill).not.toHaveBeenCalled();
    expect(scopeEmpty).not.toHaveBeenCalled();
  });

  it("cancels an existing PTY group probe permanently on disposal", async () => {
    vi.useFakeTimers();
    const kill = vi.spyOn(process, "kill").mockReturnValue(true);
    const { scope, scopeEmpty, exit } = ptyHarness();
    await scope.start();
    exit();
    expect(kill).toHaveBeenCalledOnce();

    scope.dispose();
    await vi.advanceTimersByTimeAsync(100);

    expect(kill).toHaveBeenCalledOnce();
    expect(scopeEmpty).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
