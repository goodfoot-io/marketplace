/** MCP registration for the complete five-tool managed-shell surface. */
import { McpServer, type StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { descriptions, inputs, outputSchema, type ToolName } from "./contracts.js";
import { DomainError } from "./errors.js";
import type { ProcessManager } from "./process-manager.js";

export const SERVER_NAME = "shell-mcp";
export const SERVER_VERSION = "0.1.0";
export const TOOL_NAMES = [
  "exec_command",
  "read_process",
  "write_stdin",
  "terminate_process",
  "list_processes",
] as const;

export function createServer(manager: ProcessManager): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Discover the server instance with list_processes before starting commands. Reuse operation_id, write_id, and cursors exactly when recovering a lost response.",
    },
  );

  register(server, manager, "exec_command", "Execute Bash command", false, false, (input) =>
    manager.execCommand(inputs.exec_command.parse(input)),
  );
  register(server, manager, "read_process", "Read process", true, true, (input) =>
    manager.readProcess(inputs.read_process.parse(input)),
  );
  register(server, manager, "write_stdin", "Write process input", false, false, (input) =>
    manager.writeStdin(inputs.write_stdin.parse(input)),
  );
  register(server, manager, "terminate_process", "Terminate process", false, true, (input) =>
    manager.terminateProcess(inputs.terminate_process.parse(input)),
  );
  register(server, manager, "list_processes", "List managed processes", true, true, (input) =>
    manager.listProcesses(inputs.list_processes.parse(input)),
  );
  return server;
}

function register<Name extends ToolName>(
  server: McpServer,
  manager: ProcessManager,
  name: Name,
  title: string,
  readOnly: boolean,
  idempotent: boolean,
  handler: (input: unknown) => Promise<Record<string, unknown>>,
): void {
  server.registerTool(
    name,
    {
      title,
      description: descriptions[name],
      inputSchema: inputs[name] as StandardSchemaWithJSON,
      outputSchema: outputSchema as StandardSchemaWithJSON,
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: name === "terminate_process",
        idempotentHint: idempotent,
        openWorldHint: true,
      },
    },
    async (input: unknown) => {
      manager.logInvocation(name, "started");
      let result: Record<string, unknown>;
      let isError = false;
      try {
        result = await handler(input);
      } catch (error) {
        isError = true;
        result =
          error instanceof DomainError
            ? error.result(manager.instanceId)
            : new DomainError(
                "INVALID_ARGUMENT",
                error instanceof Error ? error.message : "Tool request failed validation.",
              ).result(manager.instanceId);
      }
      manager.logInvocation(name, isError ? "failed" : "succeeded");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        structuredContent: result,
        ...(isError ? { isError: true } : {}),
      };
    },
  );
}
