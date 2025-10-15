#!/usr/bin/env node

// build/dist/src/test-agent.js
import { promises as fs } from "fs";
import path from "path";
import { query } from "@anthropic-ai/claude-code";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import yaml from "js-yaml";
var server = new Server(
  {
    name: "test-agent-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);
function parseFrontMatter(content) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontMatterRegex);
  if (match) {
    try {
      const frontMatter = yaml.load(match[1]);
      const contentWithoutFrontMatter = content.slice(match[0].length);
      return { frontMatter, content: contentWithoutFrontMatter };
    } catch (error) {
      console.error("Failed to parse YAML front matter:", error);
      return { frontMatter: null, content };
    }
  }
  return { frontMatter: null, content };
}
function formatToolInput(toolName, input) {
  const lines = [];
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      if (value.includes("\n")) {
        lines.push(
          `  ${key}=\`
${value.split("\n").map((line) => "    " + line).join("\n")}
  \``
        );
      } else {
        lines.push(`  ${key}="${value}"`);
      }
    } else if (typeof value === "object" && value !== null) {
      lines.push(`  ${key}=${JSON.stringify(value)}`);
    } else {
      lines.push(`  ${key}=${String(value)}`);
    }
  }
  return lines.join(",\n");
}
async function logAgentExecution(systemInstructionsFile, description, prompt, transcript) {
  const logDir = path.join("/workspace", "reports", ".test-agent-logs");
  await fs.mkdir(logDir, { recursive: true });
  const now = /* @__PURE__ */ new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, -1);
  const filename = `${timestamp}.md`;
  const filepath = path.join(logDir, filename);
  const formattedPrompt = prompt.split("\n").map((line) => `> ${line}`).join("\n");
  const systemInstructionsSection = systemInstructionsFile ? `### System Instructions
\`${systemInstructionsFile}\`

` : `### System Instructions
_Using default system instructions_

`;
  const content = `## Task: ${description}

${systemInstructionsSection}### Prompt
${formattedPrompt}

---

${transcript.join("\n\n")}`;
  await fs.writeFile(filepath, content, "utf-8");
  return filepath;
}
server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: "task",
      description: "Launch a new agent to handle complex, multi-step tasks autonomously. The agent runs with custom system instructions loaded from a specified file.",
      inputSchema: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "A short (3-5 word) description of the task"
          },
          prompt: {
            type: "string",
            description: "The task for the agent to perform"
          },
          system_instructions_file: {
            type: "string",
            description: "Absolute path to a markdown file containing system instructions that define the agent's behavior, capabilities, and approach. If not provided, the agent will use the `general-purpose` agent type."
          }
        },
        required: ["description", "prompt"]
      }
    }
  ]
}));
server.setRequestHandler(CallToolRequestSchema, async (request, meta) => {
  if (request.params.name !== "task") {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }
  const { description, prompt, system_instructions_file } = request.params.arguments;
  if (!description) {
    throw new McpError(ErrorCode.InvalidParams, "description is required");
  }
  if (!prompt) {
    throw new McpError(ErrorCode.InvalidParams, "prompt is required");
  }
  let customSystemPrompt;
  let frontMatter = null;
  if (system_instructions_file) {
    if (!path.isAbsolute(system_instructions_file)) {
      throw new McpError(ErrorCode.InvalidParams, "system_instructions_file must be an absolute path");
    }
    try {
      const fileContent = await fs.readFile(system_instructions_file, "utf-8");
      const parsed = parseFrontMatter(fileContent);
      frontMatter = parsed.frontMatter;
      customSystemPrompt = parsed.content;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new McpError(ErrorCode.InvalidParams, `System instructions file not found: ${system_instructions_file}`);
      }
      throw new McpError(ErrorCode.InternalError, `Failed to read system instructions file: ${error.message}`);
    }
  }
  const abortController = new AbortController();
  if (meta && typeof meta === "object" && "signal" in meta && meta.signal instanceof AbortSignal) {
    meta.signal.addEventListener("abort", () => {
      abortController.abort();
    });
  }
  try {
    let result = "";
    const transcript = [];
    const queryOptions = {
      maxTurns: 100,
      includePartialMessages: true,
      abortController
    };
    if (customSystemPrompt) {
      queryOptions.customSystemPrompt = customSystemPrompt;
    }
    if (frontMatter) {
      if (frontMatter.model) {
        queryOptions.model = frontMatter.model;
      }
      if (frontMatter.tools) {
        const toolsList = frontMatter.tools.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
        if (toolsList.includes("*")) {
          queryOptions.disallowedTools = ["Task", "mcp__test-agent__task"];
        } else if (toolsList.length > 0) {
          queryOptions.allowedTools = toolsList;
          if (!toolsList.includes("Task") && !toolsList.includes("mcp__test-agent__task")) {
          }
        }
      } else {
        queryOptions.disallowedTools = ["Task", "mcp__test-agent__task"];
      }
    } else {
      queryOptions.disallowedTools = ["Task", "mcp__test-agent__task"];
    }
    for await (const message of query({
      prompt,
      options: queryOptions
    })) {
      if (abortController.signal.aborted) {
        throw new Error("Operation was aborted");
      }
      if (message.type === "result" && message.subtype === "success") {
        result = message.result;
      } else if (message.type === "result" && (message.subtype === "error_max_turns" || message.subtype === "error_during_execution")) {
        throw new Error(`Agent error: ${message.subtype}`);
      } else if (message.type === "user") {
        if ("message" in message && message.message && typeof message.message === "object") {
          const msg = message.message;
          if (msg.content && Array.isArray(msg.content)) {
            for (const content of msg.content) {
              if (content.type === "tool_result") {
                if (content.is_error) {
                  transcript.push(`\`\`\`tool-response-error
${String(content.content)}
\`\`\``);
                } else {
                  const responseContent = typeof content.content === "string" ? content.content : JSON.stringify(content.content, null, 2);
                  const cleanedContent = responseContent.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
                  transcript.push(`\`\`\`tool-response
${cleanedContent}
\`\`\``);
                }
              }
            }
          }
        }
      } else if (message.type === "assistant") {
        if ("message" in message && message.message && typeof message.message === "object") {
          const msg = message.message;
          if (msg.content && Array.isArray(msg.content)) {
            for (const content of msg.content) {
              if (content.type === "text" && content.text) {
                transcript.push(content.text);
              } else if (content.type === "tool_use" && content.name) {
                const input = content.input;
                const formattedInput = formatToolInput(content.name, input);
                transcript.push(`\`\`\`tool-call
${content.name}(
${formattedInput}
)
\`\`\``);
              } else if (content.type === "tool_result") {
                if (content.is_error) {
                  transcript.push(`\`\`\`tool-response-error
${String(content.content)}
\`\`\``);
                } else {
                  const responseContent = typeof content.content === "string" ? content.content : JSON.stringify(content.content, null, 2);
                  transcript.push(`\`\`\`tool-response
${responseContent}
\`\`\``);
                }
              }
            }
          }
        }
      } else if (message.type === "stream_event") {
        const eventObj = message;
        if ("event" in eventObj && eventObj.event && typeof eventObj.event === "object") {
          const event = eventObj.event;
          if (event.type === "tool_use" && event.tool_use && event.tool_use.name) {
            const input = event.tool_use.input;
            const formattedInput = formatToolInput(event.tool_use.name, input);
            transcript.push(`\`\`\`tool-call
${event.tool_use.name}(
${formattedInput}
)
\`\`\``);
          } else if (event.type === "content_block_stop" && event.content_block) {
            const block = event.content_block;
            if (block.type === "tool_use" && block.name && block.input) {
              const input = block.input;
              const formattedInput = formatToolInput(block.name, input);
              transcript.push(`\`\`\`tool-call
${block.name}(
${formattedInput}
)
\`\`\``);
            } else if (block.type === "tool_result") {
              if (block.is_error) {
                transcript.push(`\`\`\`tool-response-error
${String(block.content)}
\`\`\``);
              } else {
                const responseContent = typeof block.content === "string" ? block.content : JSON.stringify(block.content, null, 2);
                transcript.push(`\`\`\`tool-response
${responseContent}
\`\`\``);
              }
            }
          }
        }
      }
    }
    if (!result) {
      throw new Error("No result obtained from the agent");
    }
    const logFilePath = await logAgentExecution(system_instructions_file, description, prompt, transcript);
    const resultWithLogInfo = `${result}

---
\u{1F4C4} Execution log: ${logFilePath}`;
    return {
      content: [
        {
          type: "text",
          text: resultWithLogInfo
        }
      ]
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Operation was aborted" || error.name === "AbortError") {
        console.error("[Agent Tool] Query aborted by client");
        throw new McpError(ErrorCode.InternalError, "Request was cancelled by client");
      }
      throw new McpError(ErrorCode.InternalError, `Agent execution failed: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, "Agent execution failed: Unknown error");
  }
});
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
// Auto-start server when bundled
startServer().catch((error) => { console.error("Failed to start server:", error); process.exit(1); });
export {
  startServer
};
