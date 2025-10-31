#!/usr/bin/env node
import { exec } from 'child_process';
import crypto from 'crypto';
import { promises as dns } from 'dns';
import { promises as fs } from 'fs';
import { networkInterfaces } from 'os';
import path from 'path';
import { parseArgs, promisify } from 'util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import {
  type SessionState,
  type ExecuteToolArguments,
  validateExecuteToolArguments,
  isTextContent,
  isToolUseContent,
  isToolResultContent,
  isSdkResultMessage,
  isSdkUserMessage,
  isSdkAssistantMessage,
  getEnvironmentAsRecord
} from './types/browser.js';

const execAsync = promisify(exec);

/**
 * Find Chrome DevTools MCP processes that are children of this process
 */
async function findChromeMcpChildProcesses(): Promise<number[]> {
  try {
    const ourPid = process.pid;

    // Find all chrome-devtools-mcp processes
    const { stdout } = await execAsync('pgrep -f chrome-devtools-mcp || true');

    if (!stdout.trim()) {
      return [];
    }

    const allMcpPids = stdout
      .trim()
      .split('\n')
      .map((pid) => parseInt(pid, 10))
      .filter((pid) => !isNaN(pid));

    // For each PID, check if it's a descendant of our process
    const childPids: number[] = [];

    for (const pid of allMcpPids) {
      try {
        // Check parent PID chain using ps
        const { stdout: psOut } = await execAsync(`ps -o ppid= -p ${pid} || true`);
        const parentPid = parseInt(psOut.trim(), 10);

        if (!isNaN(parentPid)) {
          // Check if parent is us or our child (SDK spawns via node child_process)
          if (parentPid === ourPid) {
            childPids.push(pid);
          } else {
            // Check if grandparent is us (node -> npx -> chrome-devtools-mcp)
            const { stdout: grandparentOut } = await execAsync(`ps -o ppid= -p ${parentPid} || true`);
            const grandparentPid = parseInt(grandparentOut.trim(), 10);

            if (grandparentPid === ourPid) {
              childPids.push(pid);
            }
          }
        }
      } catch {
        // Process may have exited, skip
        continue;
      }
    }

    return childPids;
  } catch (error) {
    console.error('Error finding Chrome MCP child processes:', error);
    return [];
  }
}

/**
 * Kill hung Chrome DevTools MCP processes that are our children
 */
async function killHungChromeMcpProcesses(): Promise<number> {
  try {
    const childPids = await findChromeMcpChildProcesses();

    if (childPids.length === 0) {
      console.error('No Chrome MCP child processes found to kill');
      return 0;
    }

    console.error(`Found ${childPids.length} Chrome MCP child process(es): ${childPids.join(', ')}`);

    let killedCount = 0;
    for (const pid of childPids) {
      try {
        // Try SIGTERM first (graceful)
        process.kill(pid, 'SIGTERM');

        // Wait 1 second, then force kill if still alive
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          // Check if still alive
          process.kill(pid, 0);
          // Still alive, force kill
          process.kill(pid, 'SIGKILL');
          console.error(`Force killed hung Chrome MCP process ${pid}`);
        } catch {
          // Process already dead from SIGTERM
          console.error(`Gracefully terminated Chrome MCP process ${pid}`);
        }

        killedCount++;
      } catch (error) {
        console.error(`Failed to kill Chrome MCP process ${pid}:`, error);
      }
    }

    return killedCount;
  } catch (error) {
    console.error('Error killing hung Chrome MCP processes:', error);
    return 0;
  }
}

/**
 * Get the primary external IP address of the machine
 * First tries to resolve host.docker.internal (for Docker environments)
 * Then falls back to the first non-internal IPv4 address found
 */
async function getPrimaryExternalIP(): Promise<string> {
  // Try to resolve host.docker.internal first (Docker environment)
  try {
    const addresses = await dns.resolve4('host.docker.internal');
    if (addresses && addresses.length > 0) {
      console.error(`Resolved host.docker.internal to ${addresses[0]}`);
      return addresses[0];
    }
  } catch {
    // host.docker.internal not available, continue to fallback
  }

  // Fallback to detecting external IP from network interfaces
  const nets = networkInterfaces();

  // Iterate through all network interfaces
  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo) continue;

    for (const net of netInfo) {
      // Skip internal (loopback) addresses and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  // Fallback to localhost if no external IP found
  return 'localhost';
}

const server = new Server(
  {
    name: 'browser-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Session management
const sessions = new Map<string, SessionState>();

// Parse session TTL from environment variable (default: 5 minutes)
function getSessionTTL(): number {
  const envValue = process.env.BROWSER_SESSION_TTL_MS;
  if (!envValue) {
    return 5 * 60 * 1000; // Default: 5 minutes
  }

  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed) || parsed <= 0) {
    console.error(`Invalid BROWSER_SESSION_TTL_MS value: ${envValue}. Using default 5 minutes.`);
    return 5 * 60 * 1000;
  }

  return parsed;
}

const SESSION_TTL_MS = getSessionTTL();

// Chrome DevTools MCP Agent System Instructions - v5
const CHROME_SYSTEM_INSTRUCTIONS =
  String.raw`Browser automation agent using Chrome DevTools MCP server.

## Response Format

- Tool responses NOT shown to user
- Your message = all requested information
- No meta-commentary about tools used
- Direct answers only
- Example: "Get title" → "Example Domain" (NOT "I navigated and found...")

## Core Pattern

` +
  '```' +
  `
1. take_snapshot() → get UIDs
2. Use UIDs (click, fill, hover, drag)
3. take_snapshot() → get FRESH UIDs (old ones STALE)
` +
  '```' +
  `

**#1 Rule**: After ANY DOM change → take fresh snapshot
**Error**: "uid is coming from a stale snapshot"

## Critical Gotchas

**Dialog handling** = Two steps:
1. ` +
  '`click(uid)`' +
  ` → times out (expected)
2. ` +
  '`handle_dialog(action="accept")`' +
  ` → succeeds
3. ` +
  '`take_snapshot()`' +
  ` → fresh UIDs

**Scrolling** = No native tool, use JavaScript:
` +
  '```javascript' +
  `
evaluate_script(function: "() => window.scrollTo(0, document.documentElement.scrollHeight)")
` +
  '```' +
  `

**wait_for** = ONLY waits for text (nothing else)
- For other waits → use ` +
  '`evaluate_script`' +
  ` with async polling

**Screenshots** = ALWAYS use filePath:
` +
  '```javascript' +
  `
take_screenshot(filePath="/workspace/screenshot.png")
` +
  '```' +
  `
Without filePath → token limit error

**Navigation failures** = Always retry once (many transient)

## Data Extraction

**NEVER use snapshot for data** → token limits

**ALWAYS use evaluate_script**:
` +
  '```javascript' +
  `
evaluate_script(function: "() => ({
  items: Array.from(document.querySelectorAll('.item')).map(i => ({
    title: i.querySelector('.title')?.textContent
  }))
})")
` +
  '```' +
  `

Use snapshot ONLY for:
- Getting UIDs for interaction
- Initial page structure understanding
- Verifying navigation success

## When to take_snapshot

**ONLY if you need UIDs for next action**

**Take snapshot when**:
- After DOM change (click, fill, hover, drag, navigate) AND you need UIDs next
- Before interaction (to get UIDs)

**DON'T snapshot just to verify**:
` +
  '```javascript' +
  `
// ❌ WRONG: snapshot after click when you don't need UIDs next
click(uid="checkbox")
take_snapshot()  // Wasteful if you're not clicking anything else!

// ✅ CORRECT: only snapshot if you need UIDs for next action
click(uid="checkbox")
// No snapshot - done with interactions

// ❌ WRONG: verify after operation
click(uid="submit")
evaluate_script(function: "() => ({ url: window.location.href })")  // Wasteful!

// ✅ CORRECT: verify BEFORE conditional action
evaluate_script(function: "() => ({ checked: document.querySelector('#checkbox').checked })")
if (!checked) { take_snapshot(); click(uid); }
` +
  '```' +
  `

**Exception**: ` +
  '`fill_form()`' +
  ` takes snapshot automatically

**Never after**:
- ` +
  '`evaluate_script()`' +
  `
- ` +
  '`list_network_requests()`' +
  `
- ` +
  '`list_console_messages()`' +
  `
- ` +
  '`take_screenshot()`' +
  `

## Common Workflows

**Form fill**:
` +
  '```javascript' +
  `
navigate_page(url)
take_snapshot()
fill_form(elements=[{uid, value}, ...])  // auto-snapshots
click(uid="submit")
take_snapshot()
` +
  '```' +
  `

**Extract data**:
` +
  '```javascript' +
  `
navigate_page(url)
evaluate_script(function: "() => ({ data: [...] })")  // NO snapshot
` +
  '```' +
  `

**Hover menu**:
` +
  '```javascript' +
  `
take_snapshot()
hover(uid)
take_snapshot()  // new elements appeared
click(uid="submenu")
take_snapshot()
` +
  '```' +
  `

**Infinite scroll**:
` +
  '```javascript' +
  `
navigate_page(url)
evaluate_script(function: "() => window.scrollTo(0, document.documentElement.scrollHeight)")
evaluate_script(function: "async () => { await new Promise(r => setTimeout(r, 2000)); }")
take_snapshot()  // new content loaded
` +
  '```' +
  `

## Tool Selection

| Need | Tool |
|------|------|
| UIDs for interaction | ` +
  '`take_snapshot()`' +
  ` |
| Extract data | ` +
  '`evaluate_script()`' +
  ` |
| Visual verification | ` +
  '`take_screenshot(filePath=...)`' +
  ` |
| Fill multiple fields | ` +
  '`fill_form()`' +
  ` (preferred) |
| Fill single field | ` +
  '`fill()`' +
  ` |
| Wait for text | ` +
  '`wait_for()`' +
  ` |
| Wait for anything else | ` +
  '`evaluate_script()`' +
  ` with polling |
| Scroll | ` +
  '`evaluate_script()`' +
  ` |

## Error Recovery

**Stale UID**:
` +
  '```javascript' +
  `
take_snapshot()  // get fresh UIDs
// retry with new UID
` +
  '```' +
  `

**Navigation failed**:
` +
  '```javascript' +
  `
list_console_messages()
list_network_requests(pageSize=10)
take_screenshot(filePath="/tmp/error.png")
navigate_page(url)  // retry once
take_snapshot()
` +
  '```' +
  `

**Element not found**:
` +
  '```javascript' +
  `
evaluate_script(function: "() => ({ exists: !!document.querySelector('#id') })")
// If exists=false → wait or scroll
// If exists=true → take_snapshot() to get UID
` +
  '```' +
  `

**Dialog timeout**:
` +
  '```javascript' +
  `
// Expected - not an error
handle_dialog(action="accept")
take_snapshot()
` +
  '```' +
  `

**Token limit**:
- Screenshots → add ` +
  '`filePath`' +
  `
- Data → use ` +
  '`evaluate_script`' +
  ` not snapshot
- Network requests → paginate with ` +
  '`pageSize`' +
  `

## Debugging

` +
  '```javascript' +
  `
take_screenshot(filePath="/tmp/debug.png")
list_console_messages()
list_network_requests(pageSize=20)
evaluate_script(function: "() => ({ readyState: document.readyState })")
` +
  '```' +
  `

## Key Principles

1. Snapshot ONLY when you need UIDs (not after every operation)
2. Verify BEFORE decisions, NOT AFTER operations
3. JavaScript for data extraction
4. Files for screenshots
5. Dialog timeout is normal
6. Retry navigation once
7. evaluate_script for missing tools
8. Iframes/Shadow DOM work automatically

**Pattern**: snapshot → act (only re-snapshot if you need UIDs next)
`;

// Parse command-line arguments
async function parseChromeArgs(): Promise<{ browserUrl: string }> {
  try {
    const { values } = parseArgs({
      options: {
        browserUrl: { type: 'string' as const, short: 'b' },
        // Reserved for chrome-server
        version: { type: 'boolean' as const },
        help: { type: 'boolean' as const }
      },
      allowPositionals: false
    });

    // If browserUrl is not provided, use the primary external IP
    let browserUrl: string;
    if (!values.browserUrl || typeof values.browserUrl !== 'string') {
      const primaryIP = await getPrimaryExternalIP();
      browserUrl = `http://${primaryIP}:9222`;
      console.error(`No --browserUrl provided, using primary external IP: ${browserUrl}`);
    } else {
      browserUrl = values.browserUrl;
    }

    return {
      browserUrl
    };
  } catch (error) {
    console.error('Failed to parse command-line arguments:', error);
    process.exit(1);
  }
}

// Clean up stale sessions
function cleanupStaleSessions(): void {
  const now = Date.now();
  const beforeSize = sessions.size;

  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActivity.getTime() > SESSION_TTL_MS) {
      sessions.delete(id);
      console.error(`Session ${id} expired after ${SESSION_TTL_MS}ms of inactivity`);
    }
  }

  // Keep max 10 sessions (LRU eviction)
  if (sessions.size > 10) {
    const sorted = Array.from(sessions.entries()).sort(
      (a, b) => a[1].lastActivity.getTime() - b[1].lastActivity.getTime()
    );

    while (sessions.size > 10) {
      const [id] = sorted.shift()!;
      sessions.delete(id);
      console.error(`Session ${id} evicted (LRU - max 10 sessions)`);
    }
  }

  const removedCount = beforeSize - sessions.size;
  if (removedCount > 0) {
    console.error(`Cleaned up ${removedCount} session(s). Active sessions: ${sessions.size}`);
  }

  // Log when all sessions have expired
  if (beforeSize > 0 && sessions.size === 0) {
    console.error('All sessions expired - no active browser sessions');
  }
}

// Periodically clean up sessions
const cleanupIntervalId = setInterval(cleanupStaleSessions, 5 * 60 * 1000); // Every 5 minutes

// Helper to format tool inputs with proper type safety
function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      if (value.includes('\n')) {
        lines.push(
          `  ${key}=\`\n${value
            .split('\n')
            .map((line) => '    ' + line)
            .join('\n')}\n  \``
        );
      } else {
        lines.push(`  ${key}="${value}"`);
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`  ${key}=${JSON.stringify(value)}`);
    } else {
      lines.push(`  ${key}=${String(value)}`);
    }
  }

  return lines.join(',\n');
}

// Helper to safely convert unknown values to strings for progress messages
function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

// Helper to create progress message from tool name and input
function formatProgressMessage(toolName: string, input: Record<string, unknown>): string {
  // Remove mcp__chrome__ prefix for cleaner messages
  const cleanName = toolName.replace(/^mcp__chrome__/, '');

  // Format based on tool type
  switch (cleanName) {
    case 'navigate_page':
      return `Navigating to ${safeString(input.url) || 'page'}`;
    case 'click':
      return `Clicking element (uid: ${safeString(input.uid)})`;
    case 'fill':
      return `Filling input field (uid: ${safeString(input.uid)})`;
    case 'fill_form':
      return `Filling form with ${Array.isArray(input.elements) ? input.elements.length : 0} fields`;
    case 'take_snapshot':
      return 'Taking page snapshot';
    case 'take_screenshot':
      return input.filePath ? `Taking screenshot → ${safeString(input.filePath)}` : 'Taking screenshot';
    case 'evaluate_script':
      return 'Executing JavaScript';
    case 'list_pages':
      return 'Listing open pages';
    case 'list_network_requests':
      return 'Listing network requests';
    case 'list_console_messages':
      return 'Listing console messages';
    case 'new_page':
      return `Opening new page → ${safeString(input.url) || 'blank'}`;
    case 'close_page':
      return `Closing page (index: ${safeString(input.pageIdx)})`;
    case 'select_page':
      return `Selecting page (index: ${safeString(input.pageIdx)})`;
    case 'hover':
      return `Hovering element (uid: ${safeString(input.uid)})`;
    case 'drag':
      return `Dragging element (from: ${safeString(input.from_uid)}, to: ${safeString(input.to_uid)})`;
    case 'wait_for':
      return `Waiting for text: "${safeString(input.text)}"`;
    case 'handle_dialog':
      return `Handling dialog (action: ${safeString(input.action)})`;
    case 'get_network_request':
      return `Getting network request for ${safeString(input.url)}`;
    case 'upload_file':
      return `Uploading file: ${safeString(input.filePath)}`;
    case 'performance_start_trace':
      return 'Starting performance trace';
    case 'performance_stop_trace':
      return 'Stopping performance trace';
    case 'performance_analyze_insight':
      return `Analyzing insight: ${safeString(input.insightName)}`;
    case 'emulate_cpu':
      return `Setting CPU throttling: ${safeString(input.throttlingRate)}x`;
    case 'emulate_network':
      return `Setting network throttling: ${safeString(input.throttlingOption)}`;
    default:
      return `Executing ${cleanName}`;
  }
}

// Log browser automation execution
async function logBrowserExecution(sessionId: string, prompt: string, transcript: string[]): Promise<string> {
  const logDir = path.join('/workspace', 'reports', '.browser-automation-logs');

  // Ensure the directory exists
  await fs.mkdir(logDir, { recursive: true });

  // Create filename with current datetime
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -1);
  const filename = `${timestamp}_${sessionId}.md`;
  const filepath = path.join(logDir, filename);

  const content = `<prompt>
${prompt}
</prompt>

<session>
${sessionId}
</session>

<transcript>
${transcript.join('\n\n')}
</transcript>
${transcript.join('\n\n')}`;

  // Write to file
  await fs.writeFile(filepath, content, 'utf-8');

  return filepath;
}

// Register tool listing handler
server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'prompt',
      description:
        'Automate browser tasks: navigate pages, interact with elements, capture screenshots, debug issues, and analyze performance',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Instructions for browser automation task'
          },
          sessionId: {
            type: 'string',
            description: 'Session ID for conversation continuity'
          }
        },
        required: ['prompt']
      }
    }
  ]
}));

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request, meta) => {
  if (request.params.name !== 'prompt') {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }

  // Validate arguments with runtime type checking
  let args: ExecuteToolArguments;
  try {
    args = validateExecuteToolArguments(request.params.arguments);
  } catch (error) {
    throw new McpError(ErrorCode.InvalidParams, (error as Error).message);
  }

  const { prompt, sessionId: userSessionId } = args;

  if (!prompt) {
    throw new McpError(ErrorCode.InvalidParams, 'prompt is required');
  }

  // Extract progress token from meta for progress notifications
  const progressToken =
    meta && typeof meta === 'object' && '_meta' in meta && typeof meta._meta === 'object' && meta._meta !== null
      ? (meta._meta as Record<string, unknown>).progressToken
      : undefined;

  // Get or create session
  const sessionId = userSessionId || crypto.randomUUID();
  let session = sessions.get(sessionId);

  if (!session) {
    session = {
      id: sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      conversationHistory: [],
      isFirstQuery: true
    };
    sessions.set(sessionId, session);
  } else {
    session.lastActivity = new Date();
  }

  // Create an AbortController with 10-minute timeout
  const abortController = new AbortController();
  const timeoutMs = 10 * 60 * 1000; // 10 minutes
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  // Check if meta provides any cancellation signal
  if (meta && typeof meta === 'object' && 'signal' in meta && meta.signal instanceof AbortSignal) {
    meta.signal.addEventListener('abort', () => {
      abortController.abort();
      clearTimeout(timeoutId);
    });
  }

  // Declare variables that need to be accessible in error handling
  // Note: toolCallCount is incremented within nested loops, so it must be let not const
  let toolCallCount: number;
  toolCallCount = 0;
  let logPath: string | undefined;

  try {
    // Build context-aware prompt
    let contextualPrompt = prompt;
    if (session.conversationHistory.length > 0) {
      // Include sliding window of last 10 exchanges
      const recentHistory = session.conversationHistory.slice(-20); // 10 exchanges = 20 entries
      contextualPrompt = `Previous conversation context:\n${recentHistory.join('\n\n')}\n\nNew instruction: ${prompt}`;
    }

    // Append prompt rules from v5
    contextualPrompt += `\n\n---\n\n**Rules**:\n- Refresh UIDs after ANY DOM change\n- Use evaluate_script for data extraction\n- Save screenshots to files (not base64)\n- Respond with data only (no process description)`;

    // Get chrome-devtools-mcp arguments
    const { browserUrl } = await parseChromeArgs();

    // Configure query options
    const queryOptions: Parameters<typeof query>[0]['options'] = {
      systemPrompt: CHROME_SYSTEM_INSTRUCTIONS,
      maxTurns: 100,
      includePartialMessages: true,
      abortController,
      // Strict MCP configuration - only allow chrome-devtools-mcp
      strictMcpConfig: true,
      allowedTools: [
        'mcp__chrome__click',
        'mcp__chrome__close_page',
        'mcp__chrome__drag',
        'mcp__chrome__emulate_cpu',
        'mcp__chrome__emulate_network',
        'mcp__chrome__evaluate_script',
        'mcp__chrome__fill',
        'mcp__chrome__fill_form',
        'mcp__chrome__get_network_request',
        'mcp__chrome__handle_dialog',
        'mcp__chrome__hover',
        'mcp__chrome__list_console_messages',
        'mcp__chrome__list_network_requests',
        'mcp__chrome__list_pages',
        'mcp__chrome__navigate_page',
        'mcp__chrome__new_page',
        'mcp__chrome__performance_analyze_insight',
        'mcp__chrome__performance_start_trace',
        'mcp__chrome__performance_stop_trace',
        'mcp__chrome__select_page',
        'mcp__chrome__take_screenshot',
        'mcp__chrome__take_snapshot',
        'mcp__chrome__upload_file',
        'mcp__chrome__wait_for'
      ],
      permissionMode: 'bypassPermissions',
      mcpServers: {
        chrome: {
          command: 'npx',
          args: ['-y', 'chrome-devtools-mcp@latest', '--browserUrl', browserUrl],
          env: {
            ...getEnvironmentAsRecord(process.env),
            MAX_MCP_OUTPUT_TOKENS: '100000'
          }
        }
      }
    };

    // Add session resumption if we have an SDK session ID
    if (session.sdkSessionId && !session.isFirstQuery) {
      queryOptions.resume = session.sdkSessionId;
    }

    let result = '';
    const transcript: string[] = [];
    let noPageSelectedDetected = false;

    // Heartbeat tracking for detecting hung MCP processes
    let lastHeartbeat = Date.now();
    const heartbeatTimeoutMs = 60000; // 60 seconds of no progress = hung
    let mcpProcessHung = false;
    let heartbeatAbortTriggered = false;

    // Start heartbeat watchdog
    const heartbeatCheckInterval = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;

      if (timeSinceLastHeartbeat > heartbeatTimeoutMs && !mcpProcessHung) {
        mcpProcessHung = true;
        heartbeatAbortTriggered = true;
        console.error(
          `[Heartbeat Watchdog] No progress for ${Math.floor(timeSinceLastHeartbeat / 1000)}s - Chrome MCP may be hung`
        );
        console.error('[Heartbeat Watchdog] Attempting to kill hung Chrome MCP processes...');

        // Kill hung processes asynchronously
        killHungChromeMcpProcesses()
          .then((killedCount) => {
            if (killedCount > 0) {
              console.error(`[Heartbeat Watchdog] Killed ${killedCount} hung Chrome MCP process(es)`);
            }
            // Abort the current query to trigger retry
            abortController.abort();
          })
          .catch((err) => {
            console.error('[Heartbeat Watchdog] Failed to kill hung processes:', err);
            // Still abort even if kill failed
            abortController.abort();
          });
      }
    }, 10000); // Check every 10 seconds

    // Execute the query using Claude Code SDK
    try {
      for await (const message of query({
        prompt: contextualPrompt,
        options: queryOptions
      })) {
        // Update heartbeat on every message
        lastHeartbeat = Date.now();
        // Check if the operation was aborted
        if (abortController.signal.aborted) {
          throw new Error('Operation was aborted');
        }

        // Type the message as unknown first, then narrow with type guards
        const msg = message as unknown;

        // Extract session ID from first message if not yet captured
        if (!session.sdkSessionId && isSdkResultMessage(msg)) {
          // The SDK session ID is typically in the first result message
          // Store it for future resume operations
          if (msg.session_id) {
            session.sdkSessionId = msg.session_id;
          }
        }

        if (isSdkResultMessage(msg)) {
          // Handle all result message subtypes
          if (msg.subtype === 'error_max_turns' || msg.subtype === 'error_during_execution') {
            throw new Error(`Browser automation error: ${msg.subtype}`);
          }
          if (msg.subtype === 'success' && msg.result) {
            result = msg.result;
          }
        } else if (isSdkUserMessage(msg)) {
          // Handle tool results that come back as user messages
          const userMsg = msg.message as { content?: unknown[] } | undefined;
          if (userMsg && userMsg.content && Array.isArray(userMsg.content)) {
            for (const content of userMsg.content) {
              if (isToolResultContent(content)) {
                // Collect tool responses for user-facing output
                if (content.is_error) {
                  const errorContent = String(content.content);

                  // Detect "No page selected" error - indicates Chrome has zero pages
                  if (errorContent.includes('No page selected') && !noPageSelectedDetected) {
                    noPageSelectedDetected = true;
                    console.error(
                      'Detected "No page selected" error - Chrome has zero pages. Creating initial page...'
                    );

                    // Create a blank page via Chrome DevTools Protocol HTTP endpoint
                    try {
                      const createPageUrl = `${browserUrl.replace(/\/$/, '')}/json/new?about:blank`;
                      const response = await fetch(createPageUrl, { method: 'PUT' });
                      if (response.ok) {
                        const pageInfo = (await response.json()) as { id: string };
                        console.error(`Created initial page: ${pageInfo.id}`);
                        // Throw error to trigger retry with the new page
                        throw new Error('NO_PAGE_SELECTED_RECOVERED');
                      }
                    } catch (fetchError) {
                      if ((fetchError as Error).message === 'NO_PAGE_SELECTED_RECOVERED') {
                        throw fetchError;
                      }
                      console.error('Failed to create page via CDP:', fetchError);
                    }
                  }

                  transcript.push(`Tool response error:\n${errorContent}`);
                } else {
                  const responseContent =
                    typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2);
                  transcript.push(`Tool response:\n${responseContent}`);
                }
              }
            }
          }
        } else if (isSdkAssistantMessage(msg)) {
          // Log assistant messages as plain text content
          const assistantMsg = msg.message as { content?: unknown[] } | undefined;
          if (assistantMsg && assistantMsg.content && Array.isArray(assistantMsg.content)) {
            for (const content of assistantMsg.content) {
              if (isTextContent(content)) {
                transcript.push(`Assistant:\n${content.text}`);
              } else if (isToolUseContent(content)) {
                // Log tool usage in a clean format
                const formattedInput = formatToolInput(content.name, content.input);
                transcript.push(`Tool call: ${content.name}(\n${formattedInput}\n)`);

                // Send progress notification if token is available
                if (progressToken && typeof progressToken === 'string') {
                  toolCallCount++;
                  const progressMessage = formatProgressMessage(content.name, content.input);

                  // Send progress notification (fire and forget)
                  server
                    .notification({
                      method: 'notifications/progress',
                      params: {
                        progressToken,
                        progress: toolCallCount,
                        message: progressMessage
                      }
                    })
                    .catch((err: Error) => {
                      console.error('Failed to send progress notification:', err);
                    });
                }
              }
            }
          }
        }
      }

      // Clean up heartbeat watchdog on successful completion
      clearInterval(heartbeatCheckInterval);
    } catch (error) {
      // Clean up heartbeat watchdog on error
      clearInterval(heartbeatCheckInterval);

      // Check if this was triggered by heartbeat watchdog detecting hung Chrome MCP
      if (heartbeatAbortTriggered && error instanceof Error && error.message === 'Operation was aborted') {
        console.error('[Heartbeat Recovery] Retrying query with fresh Chrome MCP connection...');

        // Reset flags for retry
        heartbeatAbortTriggered = false;
        mcpProcessHung = false;
        lastHeartbeat = Date.now();

        // Reset state for retry
        result = '';
        transcript.length = 0;

        // Wait a moment for processes to fully terminate
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Retry the query with a fresh chrome-devtools-mcp connection
        for await (const message of query({
          prompt: contextualPrompt,
          options: queryOptions
        })) {
          // Update heartbeat on heartbeat recovery retry
          lastHeartbeat = Date.now();

          if (abortController.signal.aborted) {
            throw new Error('Operation was aborted');
          }

          const msg = message as unknown;

          if (!session.sdkSessionId && isSdkResultMessage(msg)) {
            if (msg.session_id) {
              session.sdkSessionId = msg.session_id;
            }
          }

          if (isSdkResultMessage(msg)) {
            if (msg.subtype === 'error_max_turns' || msg.subtype === 'error_during_execution') {
              throw new Error(`Browser automation error: ${msg.subtype}`);
            }
            if (msg.subtype === 'success' && msg.result) {
              result = msg.result;
            }
          } else if (isSdkUserMessage(msg)) {
            const userMsg = msg.message as { content?: unknown[] } | undefined;
            if (userMsg && userMsg.content && Array.isArray(userMsg.content)) {
              for (const content of userMsg.content) {
                if (isToolResultContent(content)) {
                  if (content.is_error) {
                    const errorContent = String(content.content);
                    transcript.push(`Tool response error:\n${errorContent}`);
                  } else {
                    const responseContent =
                      typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2);
                    transcript.push(`Tool response:\n${responseContent}`);
                  }
                }
              }
            }
          } else if (isSdkAssistantMessage(msg)) {
            const assistantMsg = msg.message as { content?: unknown[] } | undefined;
            if (assistantMsg && assistantMsg.content && Array.isArray(assistantMsg.content)) {
              for (const content of assistantMsg.content) {
                if (isTextContent(content)) {
                  transcript.push(`Assistant:\n${content.text}`);
                } else if (isToolUseContent(content)) {
                  const formattedInput = formatToolInput(content.name, content.input);
                  transcript.push(`Tool call: ${content.name}(\n${formattedInput}\n)`);

                  // Send progress notification if token is available
                  if (progressToken && typeof progressToken === 'string') {
                    toolCallCount++;
                    const progressMessage = formatProgressMessage(content.name, content.input);

                    server
                      .notification({
                        method: 'notifications/progress',
                        params: {
                          progressToken,
                          progress: toolCallCount,
                          message: progressMessage
                        }
                      })
                      .catch((err: Error) => {
                        console.error('Failed to send progress notification:', err);
                      });
                  }
                }
              }
            }
          }
        }
      } else if (error instanceof Error && error.message === 'NO_PAGE_SELECTED_RECOVERED') {
        // Check if it's a "No page selected" recovery - retry the query
        console.error('Retrying query after creating initial page...');

        // Reset state for retry
        result = '';
        transcript.length = 0;

        // Retry the query with a fresh chrome-devtools-mcp connection
        for await (const message of query({
          prompt: contextualPrompt,
          options: queryOptions
        })) {
          // Update heartbeat on retry path
          lastHeartbeat = Date.now();

          if (abortController.signal.aborted) {
            throw new Error('Operation was aborted');
          }

          const msg = message as unknown;

          if (!session.sdkSessionId && isSdkResultMessage(msg)) {
            if (msg.session_id) {
              session.sdkSessionId = msg.session_id;
            }
          }

          if (isSdkResultMessage(msg)) {
            if (msg.subtype === 'error_max_turns' || msg.subtype === 'error_during_execution') {
              throw new Error(`Browser automation error: ${msg.subtype}`);
            }
            if (msg.subtype === 'success' && msg.result) {
              result = msg.result;
            }
          } else if (isSdkUserMessage(msg)) {
            const userMsg = msg.message as { content?: unknown[] } | undefined;
            if (userMsg && userMsg.content && Array.isArray(userMsg.content)) {
              for (const content of userMsg.content) {
                if (isToolResultContent(content)) {
                  if (content.is_error) {
                    const errorContent = String(content.content);
                    transcript.push(`Tool response error:\n${errorContent}`);
                  } else {
                    const responseContent =
                      typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2);
                    transcript.push(`Tool response:\n${responseContent}`);
                  }
                }
              }
            }
          } else if (isSdkAssistantMessage(msg)) {
            const assistantMsg = msg.message as { content?: unknown[] } | undefined;
            if (assistantMsg && assistantMsg.content && Array.isArray(assistantMsg.content)) {
              for (const content of assistantMsg.content) {
                if (isTextContent(content)) {
                  transcript.push(`Assistant:\n${content.text}`);
                } else if (isToolUseContent(content)) {
                  const formattedInput = formatToolInput(content.name, content.input);
                  transcript.push(`Tool call: ${content.name}(\n${formattedInput}\n)`);

                  // Send progress notification if token is available (retry path)
                  if (progressToken && typeof progressToken === 'string') {
                    toolCallCount++;
                    const progressMessage = formatProgressMessage(content.name, content.input);

                    server
                      .notification({
                        method: 'notifications/progress',
                        params: {
                          progressToken,
                          progress: toolCallCount,
                          message: progressMessage
                        }
                      })
                      .catch((err: Error) => {
                        console.error('Failed to send progress notification:', err);
                      });
                  }
                }
              }
            }
          }
        }
      } else if (error instanceof Error && error.message.includes('resume')) {
        // Check if it's a session continuity error
        // Fall back to new session
        session.sdkSessionId = undefined;
        session.isFirstQuery = true;

        // Retry without resume option
        for await (const message of query({
          prompt: contextualPrompt,
          options: {
            ...queryOptions,
            resume: undefined
          }
        })) {
          // Update heartbeat on resume retry path
          lastHeartbeat = Date.now();

          if (abortController.signal.aborted) {
            throw new Error('Operation was aborted');
          }

          // Type the message as unknown first, then narrow with type guards
          const msg = message as unknown;

          if (isSdkResultMessage(msg)) {
            // Handle all result message subtypes
            if (msg.subtype === 'error_max_turns' || msg.subtype === 'error_during_execution') {
              throw new Error(`Browser automation error: ${msg.subtype}`);
            }
            if (msg.subtype === 'success' && msg.result) {
              result = msg.result;
            }
          } else if (isSdkUserMessage(msg)) {
            // Handle tool results in retry path too
            const userMsg = msg.message as { content?: unknown[] } | undefined;
            if (userMsg && userMsg.content && Array.isArray(userMsg.content)) {
              for (const content of userMsg.content) {
                if (isToolResultContent(content)) {
                  // Tool results are logged in transcript but not shown to user
                  const responseContent = content.is_error
                    ? String(content.content)
                    : typeof content.content === 'string'
                      ? content.content
                      : JSON.stringify(content.content, null, 2);
                  transcript.push(
                    content.is_error ? `Tool response error:\n${responseContent}` : `Tool response:\n${responseContent}`
                  );
                }
              }
            }
          }
        }
      } else {
        throw error;
      }
    }

    // Mark session as no longer first query
    session.isFirstQuery = false;

    // Add to conversation history
    session.conversationHistory.push(`User: ${prompt}`);
    session.conversationHistory.push(`Assistant: ${result}`);

    // Keep conversation history to last 10 exchanges
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-20);
    }

    // Log the execution
    logPath = await logBrowserExecution(sessionId, prompt, transcript);

    clearTimeout(timeoutId);

    // Build the final response text - only include the agent's response
    // Tool responses are not shown to the user
    let finalText = result || 'No response from automation agent.';

    // Add session info with usage instructions
    finalText += `\n\n**Session ID**: ${sessionId}

<tool-use-template>
mcp__chrome__prompt(
  prompt="your next instruction",
  sessionId="${sessionId}"
)
</tool-use-template>

**Log**: ${logPath}`;

    return {
      content: [
        {
          type: 'text',
          text: finalText
        }
      ]
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Preserve conversation history even on error
    session.conversationHistory.push(`User: ${prompt}`);
    session.conversationHistory.push(`Error: ${(error as Error).message}`);

    if (error instanceof Error && error.message === 'Operation was aborted') {
      const timeoutMinutes = Math.floor(timeoutMs / 60000);
      throw new McpError(
        ErrorCode.InternalError,
        `Browser automation request timed out after ${timeoutMinutes} minutes. ` +
          `Session: ${sessionId}. This typically indicates: ` +
          `(1) Chrome became unresponsive or disconnected, ` +
          `(2) A page is stuck loading resources, or ` +
          `(3) Bot detection is blocking automation. ` +
          `Check the log for details: ${logPath || 'not available yet'}`
      );
    }

    // Enhanced error context for better debugging
    const errorMessage =
      `Browser automation failed: ${(error as Error).message}. ` +
      `Session: ${sessionId}, Tool calls executed: ${toolCallCount}. ` +
      `This may indicate a connection issue, element interaction failure, or page loading problem. ` +
      `Review the session log for diagnostic details.`;

    throw new McpError(ErrorCode.InternalError, errorMessage);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  // Clean up the interval timer
  clearInterval(cleanupIntervalId);
  // Could persist session state here in future version
  process.exit(0);
});

process.on('SIGINT', () => {
  // Clean up the interval timer
  clearInterval(cleanupIntervalId);
  // Could persist session state here in future version
  process.exit(0);
});

// Start the server
async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Browser MCP server started');
}

// Export cleanup function for testing
export function cleanup(): void {
  clearInterval(cleanupIntervalId);
}

// Auto-start when invoked directly
// Resolve symlinks to handle npx execution where argv[1] points to npx cache
const resolveFileUrl = async (filePath: string): Promise<string> => {
  try {
    const resolved = await fs.realpath(filePath);
    return `file://${resolved}`;
  } catch {
    return `file://${filePath}`;
  }
};

const currentFileUrl = import.meta.url;
const argvFileUrl = await resolveFileUrl(process.argv[1]);

if (currentFileUrl === argvFileUrl) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
