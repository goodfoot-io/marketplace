import path from "node:path";

export interface PatchEdit {
  filePath: string;
  deleted: boolean;
  chunks: Array<{ oldContent: string; newContent: string }>;
}

/** Codex's apply_patch handler sends the freeform patch as { command }. */
export function parseCodexPatch(toolInput: unknown, cwd: string): PatchEdit[] {
  if (
    typeof toolInput !== "object" ||
    toolInput === null ||
    !("command" in toolInput) ||
    typeof toolInput.command !== "string"
  ) {
    throw new Error("Expected apply_patch tool_input.command to contain patch text");
  }
  const lines = toolInput.command.trim().split(/\r?\n/);
  if (lines.shift() !== "*** Begin Patch" || lines.pop() !== "*** End Patch") {
    throw new Error("Invalid apply_patch envelope");
  }
  const edits: PatchEdit[] = [];
  let edit: PatchEdit | undefined;
  let mode: "add" | "update" | "delete" | undefined;
  let oldLines: string[] = [];
  let newLines: string[] = [];
  const flush = (): void => {
    if (edit && (oldLines.length || newLines.length)) {
      edit.chunks.push({ oldContent: oldLines.join("\n"), newContent: newLines.join("\n") });
    }
    oldLines = [];
    newLines = [];
  };
  for (const line of lines) {
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (header) {
      flush();
      mode = header[1] === "Add" ? "add" : header[1] === "Delete" ? "delete" : "update";
      edit = { filePath: path.resolve(cwd, header[2]), deleted: mode === "delete", chunks: [] };
      edits.push(edit);
    } else if (line.startsWith("*** Move to: ") && edit && mode === "update") {
      edit.filePath = path.resolve(cwd, line.slice("*** Move to: ".length));
    } else if ((line === "@@" || line.startsWith("@@ ") || line === "*** End of File") && mode === "update") {
      flush();
    } else if (edit && mode === "add" && line.startsWith("+")) {
      newLines.push(line.slice(1));
    } else if (edit && mode === "update" && line.startsWith("+")) {
      newLines.push(line.slice(1));
    } else if (edit && mode === "update" && line.startsWith("-")) {
      oldLines.push(line.slice(1));
    } else if (edit && mode === "update" && (line.startsWith(" ") || line === "")) {
      const content = line.slice(1);
      oldLines.push(content);
      newLines.push(content);
    } else {
      throw new Error(`Unrecognized apply_patch line: ${line}`);
    }
  }
  flush();
  return edits;
}
