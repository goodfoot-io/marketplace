/** Presentation events are separate from diagnostic records and MCP transcripts. */
export type ConsoleEvent =
  | { type: "command"; session: string; cwd: string; command: string; label: string | null; tty: boolean }
  | { type: "output"; session: string; stream: string; text: string }
  | { type: "input"; session: string; text: string; interrupt: boolean }
  | { type: "complete"; session: string; code: number | null; signal: string | null; reason: string | null }
  | { type: "notice"; text: string; session?: string };

interface Command {
  cwd: string;
  title: string;
  tty: boolean;
  filters: Map<string, TerminalFilter>;
}

/**
 * A streaming, bounded escape parser. Only SGR color/style sequences survive;
 * OSC, clipboard commands, cursor movement and screen clearing never reach the
 * operator's terminal. State belongs to a source stream, not an arbitrary chunk.
 */
export class TerminalFilter {
  private mode: "text" | "escape" | "csi" | "string" | "string-escape" = "text";
  private sequence = "";
  private overflow = false;

  constructor(private readonly color: boolean) {}

  push(text: string): string {
    let output = "";
    for (const char of text) {
      const code = char.codePointAt(0) ?? 0;
      if (this.mode === "string") {
        if (char === "\x07" || char === "\x9c") this.mode = "text";
        else if (char === "\x1b") this.mode = "string-escape";
        continue;
      }
      if (this.mode === "string-escape") {
        this.mode = char === "\\" ? "text" : char === "\x1b" ? "string-escape" : "string";
        continue;
      }
      if (this.mode === "escape") {
        if (char === "[") {
          this.mode = "csi";
          this.sequence = "";
          this.overflow = false;
        } else if ("]PX^_".includes(char)) this.mode = "string";
        else this.mode = "text";
        continue;
      }
      if (this.mode === "csi") {
        if (code >= 0x40 && code <= 0x7e) {
          if (char === "m" && this.color && !this.overflow && /^[\d;:]*$/u.test(this.sequence))
            output += `\x1b[${this.sequence}m`;
          this.mode = "text";
          this.sequence = "";
        } else if (char === "\x1b") this.mode = "escape";
        else if (this.sequence.length < 128) this.sequence += char;
        else this.overflow = true;
        continue;
      }
      if (char === "\x1b") this.mode = "escape";
      else if (char === "\x9b") {
        this.mode = "csi";
        this.sequence = "";
        this.overflow = false;
      } else if ("\x90\x98\x9d\x9e\x9f".includes(char)) this.mode = "string";
      else if (char === "\n" || char === "\r" || char === "\t" || char === "\b") output += char;
      else if (code >= 0x20 && !(code >= 0x7f && code <= 0x9f)) output += char;
      else if (code < 0x20 && char !== "\x07") output += `^${String.fromCharCode(code + 64)}`;
    }
    return output;
  }
}

/** No terminal controls or newlines are allowed in a prompt or divider. */
function heading(text: string): string {
  return new TerminalFilter(false).push(text).replace(/[\r\n\t\b]/gu, " ");
}

/**
 * Looks like Bash without pretending executions share a persistent shell. Output
 * is emitted immediately, including prompts without newlines. Only overlapping
 * commands need source-switch dividers; no numeric identities are displayed.
 */
export class ConsoleRenderer {
  private readonly commands = new Map<string, Command>();
  private focus: string | undefined;
  private lineOpen = false;
  private idlePrompt: { cwd: string; status: string } | undefined;

  constructor(
    private readonly terminal = false,
    private readonly color = false,
  ) {}

  render(event: ConsoleEvent): string {
    if (event.type === "notice") {
      const context = event.session === undefined ? "" : this.select(event.session);
      const text = new TerminalFilter(this.color).push(event.text);
      return context + this.newline() + this.reset() + this.track(`${text.replace(/\n?$/u, "\n")}`);
    }
    if (event.type === "command") {
      const previousPrompt = this.idlePrompt;
      this.idlePrompt = undefined;
      const filters = new Map<string, TerminalFilter>();
      const entry: Command = {
        cwd: event.cwd,
        title: heading(event.label || event.command.split("\n")[0] || "Command").slice(0, 160),
        tty: event.tty,
        filters,
      };
      let before = "";
      if (this.commands.size > 0) before = this.divider(entry);
      const reuse = previousPrompt?.cwd === event.cwd && this.lineOpen && this.commands.size === 0;
      if (!reuse) before += this.newline() + this.prompt(event.cwd, "");
      const command = new TerminalFilter(false).push(event.command).replace(/\n/gu, "\n> ");
      this.commands.set(event.session, entry);
      this.focus = event.session;
      return before + this.track(`${command}\n`);
    }
    const command = this.commands.get(event.session);
    if (!command) return "";
    if (event.type === "output") {
      let filter = command.filters.get(event.stream);
      if (!filter) {
        filter = new TerminalFilter(this.color);
        command.filters.set(event.stream, filter);
      }
      const text = filter.push(event.text);
      if (text === "") return "";
      return this.select(event.session) + this.track(text);
    }
    if (event.type === "input") {
      // A PTY provides its own echo, including ECHO-off password behavior. Never
      // synthesize PTY echo or attempt to guess password prompts from their text.
      if (command.tty) return "";
      const text = event.interrupt ? "^C\n" : new TerminalFilter(false).push(event.text);
      if (text === "") return "";
      return this.select(event.session) + this.track(text);
    }
    const status =
      event.reason === "timeout"
        ? "timed out"
        : event.reason === "failed_to_start"
          ? "failed to start"
          : event.signal
            ? event.signal
            : event.code !== null && event.code !== 0
              ? `exit ${event.code}`
              : "";
    let text = "";
    this.commands.delete(event.session);
    if (this.commands.size > 0) {
      text = this.divider(command, status || "finished");
      this.focus = undefined;
    } else {
      text = this.newline() + this.reset();
      this.focus = undefined;
      if (this.terminal) {
        text += this.prompt(command.cwd, status);
        this.idlePrompt = { cwd: command.cwd, status };
      } else if (status) text += this.track(`[${status}]\n`);
    }
    return text;
  }

  /** End an idle prompt cleanly during shutdown. */
  close(): string {
    this.commands.clear();
    this.focus = undefined;
    return this.newline() + this.reset();
  }

  private select(session: string): string {
    if (this.focus === session) return "";
    const command = this.commands.get(session);
    if (!command) return "";
    this.focus = session;
    return this.divider(command);
  }

  private divider(command: Command, status?: string): string {
    return (
      this.newline() +
      this.reset() +
      this.paint(`── ${command.title} · ${heading(command.cwd)}${status ? ` · ${status}` : ""} ──`, "2") +
      this.track("\n")
    );
  }

  private prompt(cwd: string, status: string): string {
    this.lineOpen = true;
    return `${this.paint(heading(cwd), "2")}${status ? ` ${this.paint(`[${status}]`, "31")}` : ""} ${this.paint("$", "36")} `;
  }

  private newline(): string {
    this.idlePrompt = undefined;
    if (!this.lineOpen) return "";
    this.lineOpen = false;
    return "\n";
  }

  private track(text: string): string {
    if (text.length > 0) this.lineOpen = !text.endsWith("\n");
    return text;
  }

  private paint(text: string, style: string): string {
    return this.color ? `\x1b[${style}m${text}\x1b[0m` : text;
  }

  private reset(): string {
    return this.color ? "\x1b[0m" : "";
  }
}
