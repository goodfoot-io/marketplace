import { describe, expect, it } from "vitest";
import { type ConsoleEvent, ConsoleRenderer, TerminalFilter } from "../src/logging/console-renderer.js";

function command(session = "a", extra: Partial<Extract<ConsoleEvent, { type: "command" }>> = {}): ConsoleEvent {
  return {
    type: "command",
    session,
    cwd: "/workspace",
    command: "./ask-name.sh",
    label: "Ask for a name",
    tty: false,
    ...extra,
  };
}
function complete(session = "a", extra: Partial<Extract<ConsoleEvent, { type: "complete" }>> = {}): ConsoleEvent {
  return { type: "complete", session, code: 0, signal: null, reason: null, ...extra };
}

describe("Bash-like console", () => {
  it("renders a prompt, immediate partial output, natural input and unlabelled stderr", () => {
    const renderer = new ConsoleRenderer(true, false);
    const output = [
      renderer.render(command()),
      renderer.render({ type: "output", session: "a", stream: "stdout", text: "Name: " }),
      renderer.render({ type: "input", session: "a", text: "John\n", interrupt: false }),
      renderer.render({ type: "output", session: "a", stream: "stdout", text: "Hello, John\n" }),
      renderer.render({ type: "output", session: "a", stream: "stderr", text: "Warning: default profile\n" }),
      renderer.render(complete()),
      renderer.render(command("b", { command: "pwd" })),
      renderer.render({ type: "output", session: "b", stream: "stdout", text: "/workspace\n" }),
      renderer.render(complete("b")),
    ].join("");
    expect(output).toBe(
      "/workspace $ ./ask-name.sh\nName: John\nHello, John\nWarning: default profile\n/workspace $ pwd\n/workspace\n/workspace $ ",
    );
    expect(output).not.toMatch(/stdout|stderr|stdin|Done|\[01\]|no newline/u);
  });

  it("does not emit empty ready prompts into redirected output", () => {
    const renderer = new ConsoleRenderer();
    expect(renderer.render(command())).toBe("/workspace $ ./ask-name.sh\n");
    expect(renderer.render(complete())).toBe("");
    expect(renderer.render(command("b", { cwd: "/other", command: "true" }))).toBe("/other $ true\n");
    expect(renderer.render(complete("b", { code: 7 }))).toBe("[exit 7]\n");
  });

  it("keeps arbitrary chunking invisible, including no-newline output at exit", () => {
    const renderer = new ConsoleRenderer(true);
    let output = renderer.render(command());
    for (const text of ["Na", "me", ": "])
      output += renderer.render({ type: "output", session: "a", stream: "stdout", text });
    expect(output).toBe("/workspace $ ./ask-name.sh\nName: ");
    output += renderer.render(complete());
    expect(output).toBe("/workspace $ ./ask-name.sh\nName: \n/workspace $ ");
  });

  it("never synthesizes PTY echo, including hidden input and interrupts", () => {
    const renderer = new ConsoleRenderer();
    renderer.render(command("a", { tty: true }));
    expect(renderer.render({ type: "input", session: "a", text: "secret-password\n", interrupt: false })).toBe("");
    expect(renderer.render({ type: "input", session: "a", text: "", interrupt: true })).toBe("");
    expect(renderer.render({ type: "output", session: "a", stream: "terminal", text: "public-echo\r\n" })).toBe(
      "public-echo\r\n",
    );
  });

  it("uses dividers only for overlap and never mixes partial lines from different commands", () => {
    const renderer = new ConsoleRenderer();
    expect(renderer.render(command("a", { label: "Tests" }))).not.toContain("──");
    renderer.render({ type: "output", session: "a", stream: "stdout", text: "Partial test output" });
    expect(renderer.render(command("b", { command: "yarn dev", label: "Dev server" }))).toBe(
      "\n── Dev server · /workspace ──\n/workspace $ yarn dev\n",
    );
    expect(renderer.render({ type: "output", session: "b", stream: "stderr", text: "Listening\n" })).toBe(
      "Listening\n",
    );
    expect(renderer.render({ type: "output", session: "a", stream: "stdout", text: "Tests passed\n" })).toBe(
      "── Tests · /workspace ──\nTests passed\n",
    );
    expect(renderer.render(complete("b"))).toContain("Dev server · /workspace · finished");
    expect(renderer.render(complete("a"))).toBe("");
  });

  it("shows failures, signals and timeouts without misclassifying stderr", () => {
    for (const [extra, expected] of [
      [{ code: 3 }, "[exit 3]"],
      [{ code: null, signal: "SIGINT" }, "[SIGINT]"],
      [{ code: null, signal: "SIGTERM", reason: "timeout" }, "[timed out]"],
      [{ code: null, reason: "failed_to_start" }, "[failed to start]"],
    ] as const) {
      const renderer = new ConsoleRenderer(true);
      renderer.render(command());
      expect(renderer.render(complete("a", extra))).toBe(`/workspace ${expected} $ `);
    }
  });

  it("preserves multiline commands and ignores events for completed commands", () => {
    const renderer = new ConsoleRenderer();
    expect(renderer.render(command("a", { command: "printf 'one\\n'\nprintf 'two\\n'" }))).toContain(
      "\n> printf 'two\\n'\n",
    );
    renderer.render(complete());
    expect(renderer.render(complete())).toBe("");
    expect(renderer.render({ type: "output", session: "a", stream: "stdout", text: "late" })).toBe("");
  });

  it("renders actionable notices on a fresh line and closes an idle prompt cleanly", () => {
    const renderer = new ConsoleRenderer(true);
    renderer.render(command());
    renderer.render({ type: "output", session: "a", stream: "stdout", text: "Prompt: " });
    expect(renderer.render({ type: "notice", text: "Input delivery failed", session: "a" })).toBe(
      "\nInput delivery failed\n",
    );
    renderer.render(complete());
    expect(renderer.close()).toBe("\n");
  });
});

describe("terminal escape safety", () => {
  it("preserves SGR colors only when enabled, at every possible chunk boundary", () => {
    const source = "\x1b[31mred\x1b[0m plain\n";
    for (let boundary = 0; boundary <= source.length; boundary++) {
      const color = new TerminalFilter(true);
      const plain = new TerminalFilter(false);
      expect(color.push(source.slice(0, boundary)) + color.push(source.slice(boundary))).toBe(source);
      expect(plain.push(source.slice(0, boundary)) + plain.push(source.slice(boundary))).toBe("red plain\n");
    }
  });

  it("strips screen controls, OSC clipboard operations and DCS, even split across chunks", () => {
    const source = "a\x1b[2Jb\x1b]52;c;secret\x07c\x1bPpayload\x1b\\d\x1b[H";
    for (let boundary = 0; boundary <= source.length; boundary++) {
      const filter = new TerminalFilter(true);
      expect(filter.push(source.slice(0, boundary)) + filter.push(source.slice(boundary))).toBe("abcd");
    }
  });

  it("bounds unterminated escape sequences and isolates stream parser state", () => {
    const filter = new TerminalFilter(true);
    expect(filter.push(`\x1b[${";".repeat(100_000)}mtext`)).toBe("text");
    expect(filter.push(`\x1b]${"x".repeat(100_000)}`)).toBe("");
    expect(filter.push("\x07recovered")).toBe("recovered");
    const renderer = new ConsoleRenderer(false, true);
    renderer.render(command());
    expect(renderer.render({ type: "output", session: "a", stream: "stdout", text: "\x1b]52;" })).toBe("");
    expect(renderer.render({ type: "output", session: "a", stream: "stderr", text: "Error\n" })).toBe("Error\n");
  });

  it("sanitizes labels and cwd without changing MCP data", () => {
    const renderer = new ConsoleRenderer();
    const event = command("a", { cwd: "/work\nforged", label: "\x1b[31mlabel" });
    const copy = structuredClone(event);
    expect(renderer.render(event)).toContain("/work forged $ ");
    expect(event).toEqual(copy);
  });
});
