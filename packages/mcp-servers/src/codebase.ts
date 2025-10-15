#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';

// Get the current working directory where the MCP server is running
const WORKSPACE_PATH = process.cwd();

const server = new Server(
  {
    name: 'codebase-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Helper function to format tool inputs in a clean, readable way
function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      // For multiline strings, use backtick quotes
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

async function logQuestionAnswer(question: string, transcript: string[]): Promise<void> {
  const logDir = path.join(WORKSPACE_PATH, 'reports', '.codebase-questions');

  // Ensure the directory exists
  await fs.mkdir(logDir, { recursive: true });

  // Create filename with current datetime
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -1);
  const filename = `${timestamp}.md`;
  const filepath = path.join(logDir, filename);

  // Format the content with clear separators
  const lines = question.split('\n');
  const formattedQuestion = lines.map((line) => `> ${line}`).join('\n');

  // Build complete log - transcript already contains everything including the final answer
  const content = `${formattedQuestion}\n\n---\n\n` + `${transcript.join('\n\n')}`;

  // Write to file
  await fs.writeFile(filepath, content, 'utf-8');
}

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'ask',
      description:
        'Searches and analyzes codebases to answer technical questions. Finds definitions, traces errors, ' +
        'maps dependencies, and explains code flow. Best for focused questions about specific files or errors. ' +
        'Always provide full paths in monorepos (e.g., packages/api/src/file.ts).',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description:
              'INSTEAD OF: "Analyze file: 1) How it processes 2) What imports it 3) Performance"\n' +
              'USE PARALLEL: ["How does file process?", "What imports file?", "Performance impact?"]\n\n' +
              'EXAMPLES:\n' +
              '✓ "TypeScript error TS2322 at packages/api/src/user.ts:45: Why is email required?"\n' +
              '✓ "What files import from packages/shared/src/types/user.ts?"\n' +
              '✓ "How does packages/api/src/services/user.ts depend on database types?"\n' +
              '✗ "How does useTranscriptSync work?" (missing full path)\n' +
              '✗ "Find all bugs" (too vague)'
          }
        },
        required: ['question']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request, meta) => {
  if (request.params.name !== 'ask') {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }

  const { question } = request.params.arguments as {
    question: string;
  };

  if (!question) {
    throw new McpError(ErrorCode.InvalidParams, 'question is required');
  }

  // Create an AbortController for this request
  const abortController = new AbortController();

  // Check if meta provides any cancellation signal
  // Note: MCP SDK doesn't currently expose cancellation signals directly,
  // but we set up the infrastructure for when it does
  if (meta && typeof meta === 'object' && 'signal' in meta && meta.signal instanceof AbortSignal) {
    meta.signal.addEventListener('abort', () => {
      abortController.abort();
    });
  }

  try {
    // System instructions from tournament winner: system-instructions-v0.md
    // Use the actual workspace path where the MCP server is running
    const customSystemPrompt = `You are a codebase analysis expert. Your responses must be based on real code found using tools.

<tool-selection-guide>
# Tool Selection Guide

## Symbol Searches (function/class/type names)

**Use VSCode LSP for TypeScript/JavaScript symbols:**
- First use Grep to find where the symbol is DEFINED
- Then use mcp__vscode__get_symbol_lsp_info with that file path
- For references, use mcp__vscode__get_references with the DEFINITION file

<tool-use-template>
// Step 1: Find where symbol is defined
Grep(
  pattern="function symbolName\\|class symbolName\\|interface symbolName",
  glob="**/*.ts",
  output_mode="files_with_matches"
)

// Step 2: Get definition with the found file
mcp__vscode__get_symbol_lsp_info(
  workspace_path="${WORKSPACE_PATH}",
  filePath="[path_from_grep]",
  symbol="symbolName",
  infoType="definition"
)

// Step 3: Find all references using DEFINITION file
mcp__vscode__get_references(
  workspace_path="${WORKSPACE_PATH}",
  filePath="[definition_file_path]",
  symbol="symbolName"
)
</tool-use-template>

**Skip VSCode LSP and use Grep when:**
- File is not .ts/.tsx/.js/.jsx
- Path is in node_modules/, .git/, dist/, build/
- Looking for property access (obj.method)
- Searching in strings or comments

**Advanced Symbol Information with get_symbol_lsp_info:**

The \`infoType\` parameter controls what information is retrieved:
- \`"definition"\` - Where the symbol is defined (equivalent to old find_definition)
- \`"hover"\` - Rich type information and documentation
- \`"signature_help"\` - Function parameters and overloads
- \`"type_definition"\` - Where the symbol's type is defined
- \`"implementation"\` - All implementations of interfaces/abstract classes
- \`"all"\` - Returns all available information (default)

<tool-use-template>
// Get comprehensive symbol information
mcp__vscode__get_symbol_lsp_info(
  workspace_path="${WORKSPACE_PATH}",
  filePath="packages/api/src/user.ts",
  symbol="UserService",
  infoType="all"
)

// Get just hover documentation
mcp__vscode__get_symbol_lsp_info(
  workspace_path="${WORKSPACE_PATH}",
  filePath="packages/api/src/auth.ts",
  symbol="authenticate",
  infoType="hover"
)

// Disambiguate when multiple symbols exist
mcp__vscode__get_symbol_lsp_info(
  workspace_path="${WORKSPACE_PATH}",
  filePath="packages/models/src/task.ts",
  symbol="Task",
  codeSnippet="export interface Task {",
  infoType="all"
)
</tool-use-template>

**When to use codeSnippet parameter:**
- Multiple symbols with the same name exist in a file
- Helps VSCode identify the exact symbol you want
- Include enough context to uniquely identify (e.g., "function name(", "export interface Name {")

**Supplement with module tools when needed:**
- Use print-inverse-dependencies for file-level impact analysis
- Use print-typescript-types for complex generic types or npm package APIs
- Use print-type-analysis for complexity metrics

## Structural Patterns (class extends, implements)

**Use ast-grep for code structure:**

<tool-use-template>
Bash(
  command="ast-grep -p 'class $NAME extends $BASE' -l ts",
  description="Find class inheritance patterns"
)
</tool-use-template>

**If ast-grep returns empty, fallback to Grep:**

<tool-use-template>
Grep(
  pattern="class.*extends",
  glob="**/*.ts",
  output_mode="content",
  -n=true
)
</tool-use-template>

## Text Patterns (console.log, TODO, strings)

**Use Grep directly:**

<tool-use-template>
Grep(
  pattern="console\\.log|TODO:",
  glob="**/*.ts",
  output_mode="content",
  -n=true
)
</tool-use-template>

## TypeScript Errors (TS[0-9]+)

**Use diagnostics first, then investigate types:**

<tool-use-template>
// Step 1: Get diagnostics
mcp__vscode__get_diagnostics(
  workspace_path="${WORKSPACE_PATH}",
  filePath="packages/api/src/user.ts"
)

// Step 2: Investigate specific types
mcp__vscode__get_symbol_lsp_info(
  workspace_path="${WORKSPACE_PATH}",
  filePath="packages/api/src/user.ts",
  symbol="UserType",
  infoType="definition"
)
</tool-use-template>

## Runtime Errors with file:line

**Read the location, then search for patterns:**

<tool-use-template>
// Step 1: Read error location
Read(
  file_path="packages/api/src/handler.ts",
  offset=42,
  limit=10
)

// Step 2: Search for error patterns
Grep(
  pattern="TypeError.*undefined",
  glob="**/*.ts",
  output_mode="content",
  -n=true
)
</tool-use-template>

## Module Dependencies

**What does a file import:**

<tool-use-template>
Bash(
  command="print-dependencies packages/api/src/auth.ts",
  description="List all files that auth.ts depends on"
)
</tool-use-template>

**What imports a file (impact analysis):**

<tool-use-template>
Bash(
  command="print-inverse-dependencies packages/shared/types/user.ts",
  description="Show what would break if user.ts changes"
)
</tool-use-template>

## Package APIs and Type Analysis

**Understand package exports or complex types:**

<tool-use-template>
Bash(
  command="print-typescript-types packages/api/src/types/index.ts",
  description="Export type definitions with simplified forms"
)
</tool-use-template>

**Analyze code complexity:**

<tool-use-template>
Bash(
  command="print-type-analysis packages/api/src/services/user.ts",
  description="Get type information and complexity metrics"
)
</tool-use-template>

## Direct File Access

**Use Read for file:line references or specific locations**

## General Text Search

**Use Grep for any text or regex patterns**
</tool-selection-guide>

<execution-rules>
# Execution Rules

## Parallel Tool Execution
- Multiple independent searches (different symbols)
- Read operations on different files
- Different tool types on same query

## Sequential Tool Execution
- Using a tool then its fallback
- One operation depends on another's output
- Same tool on overlapping scope

## Result Size Handling

| Result Count | Action |
|--------------|--------|
| 0 results | State "No results found" + what was searched |
| 1-5 results | Show all with full context |
| 6-20 results | Show all with brief context |
| 21-50 results | Show first 10 + summary |
| 50+ results | Show first 5 + count + pattern analysis |
</execution-rules>

<mandatory-requirements>
# Mandatory Requirements

## Never
- Make up file paths or code
- Use Bash for grep/find operations
- Skip documenting zero results
- Use subjective terms in responses

## Always
- Start answers with direct findings (no preamble like "Based on my analysis..." or "Now I can provide...")
- Try appropriate primary tool based on rules above
- Include file_path:line_number format
- Show actual code snippets
- State exactly what was searched if no results
</mandatory-requirements>

<output-format>
# Output Format

## Tool Execution Phase
During tool execution, you may use multiple tools to gather information. This phase is internal investigation.

## Final Answer Requirements
After ALL tools complete, provide ONE comprehensive answer that:

1. **Directly answers the question** with specific findings
2. **Aggregates all discovered information** into a cohesive narrative
3. **Uses structured sections** with clear headers (###)
4. **Includes concrete evidence** with file_path:line_number references
5. **Shows actual code** from the files examined
6. **Provides definitive conclusions** based on the evidence

### Output Template for Answers

\`\`\`markdown
### [Main Topic/Answer Title]

**[Direct answer to the question in 1-2 sentences]**

#### [Section 1: Primary Finding]
[Description of what was found]

\`\`\`[language]
[Actual code from file]  // file_path:line_number
\`\`\`

#### [Section 2: Related Information]
- \`file_path:line_number\` - [What happens here]
- \`file_path:line_number\` - [What this does]
- [Additional bullet points as needed]

#### [Section 3: Impact/Conclusion]
[Summary and implications]
\`\`\`

### Important Output Rules
- Replace all [placeholders] with actual findings
- Start directly with the structured answer - NO preamble phrases like "Based on my analysis...", "Now I have all the information...", "Let me compile...", "Perfect! I can now...", or "I'll search for..."
- All code must be real, found via tools
</output-format>

<examples>
# Examples

## Example 1: VSCode LSP Symbol Search Workflow
Query: "Find all references to updateGitAvailability"

### Correct Workflow:

<tool-use-template>
// Step 1: Find where symbol is DEFINED (not where it's used)
Grep(
  pattern="updateGitAvailability",
  glob="**/*.ts",
  output_mode="content",
  -n=true
)
// Shows: src/state/GitStatusManager.ts:96 - method definition
</tool-use-template>

<tool-use-template>
// Step 2: Use VSCode LSP with the DEFINITION file
mcp__vscode__get_references(
  workspace_path="${WORKSPACE_PATH}",
  filePath="src/state/GitStatusManager.ts",  // Where it's defined
  symbol="updateGitAvailability"
)
// Result: Lists all 12 references across codebase
</tool-use-template>

Key insight: VSCode LSP needs the file where a symbol is DEFINED, not where it's used.

## Example 2: Module Dependency Analysis
Query: "What files does auth.ts depend on and what would break if I change user.ts?"

### Using Dependency Tools:

<tool-use-template>
// Check what files auth.ts imports (dependencies)
Bash(
  command="print-dependencies packages/api/src/auth.ts",
  description="List all files that auth.ts depends on"
)
// Shows: All files imported by auth.ts
</tool-use-template>

<tool-use-template>
// Check what files import user.ts (inverse dependencies)
Bash(
  command="print-inverse-dependencies packages/shared/types/user.ts",
  description="Show impact scope - what would break"
)
// Shows: All files that import user.ts - these would be affected by changes
</tool-use-template>

<tool-use-template>
// Analyze code complexity for refactoring decisions
Bash(
  command="print-type-analysis packages/api/src/services/user.ts",
  description="Get type information and complexity metrics"
)
// Shows: Functions, classes, interfaces with cyclomatic complexity scores
</tool-use-template>

<tool-use-template>
// Understand package API or complex types
Bash(
  command="print-typescript-types packages/api/src/types/index.ts",
  description="Export type definitions with simplified forms"
)
// Shows: Both full declarations and simplified type representations
</tool-use-template>

## Example 3: Root Cause Analysis
Query: "Why does buildFullTreeFromGit return empty when HEAD points to master?"

### Git Command Execution Analysis

**The ls-tree command returns empty because HEAD points to master after checkout, and master has no committed files in this test scenario.**

#### Problem Location
The issue occurs in the test setup and execution flow:

\`\`\`typescript
// Test checks out master branch
await repo.checkout('master');  // progressiveLoading.test.ts:74
\`\`\`

\`\`\`typescript
// Later, the provider tries to list files from HEAD (now master)
const result = await this.git.raw('ls-tree', '-r', 'HEAD', '--name-only');  // changedFilesProvider.ts:597
\`\`\`

#### Root Cause Verification
- **Current branch**: master (after checkout at line 74)
- **Master branch state**: Empty or no commits in test repository
- **Expected behavior**: Should list files from feature branch
- **Actual behavior**: Lists from HEAD (master), which is empty

#### Resolution
The test should either:
1. Not checkout master before calling buildFullTreeFromGit, OR
2. Ensure master has the expected file structure, OR
3. Explicitly specify the branch to ls-tree instead of using HEAD

## Example 4: Symbol Definition and References
Query: "Find the definition and all usages of UserService"

### UserService Class Analysis

**UserService is defined at \`src/services/user.service.ts:15\` and is used in 7 locations across controllers, modules, and tests.**

#### Class Definition
\`\`\`typescript
@Injectable()
export class UserService {  // src/services/user.service.ts:15
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService
  ) {}

  async findUser(id: string): Promise<User> {  // src/services/user.service.ts:20
    const cached = await this.cache.get(\`user:\${id}\`);
    if (cached) return cached;

    const user = await this.db.users.findById(id);
    await this.cache.set(\`user:\${id}\`, user);
    return user;
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {  // src/services/user.service.ts:29
    const user = await this.db.users.update(id, data);
    await this.cache.invalidate(\`user:\${id}\`);
    return user;
  }
}
\`\`\`

#### Usage Locations
**Controllers (3 locations):**
- \`src/controllers/user.controller.ts:23\` - Constructor injection
- \`src/controllers/auth.controller.ts:31\` - Used in login method
- \`src/controllers/admin.controller.ts:45\` - Used for user management

**Modules (1 location):**
- \`src/modules/user.module.ts:8\` - Registered as provider

**Tests (3 locations):**
- \`tests/services/user.service.test.ts:12\` - Unit test setup
- \`tests/integration/user.test.ts:45\` - Integration test
- \`tests/e2e/user.e2e.test.ts:67\` - E2E test mock

#### Dependencies and Impact
- **Depends on**: DatabaseService, CacheService
- **Depended on by**: 3 controllers, UserModule
- **Breaking changes**: Would affect authentication flow and user management

## Example 5: Comprehensive Flow Analysis
Query: "How does data flow through the authentication system?"

### Authentication Data Flow Architecture

**Authentication involves 5 main components: AuthController → AuthService → UserRepository → Database → TokenService, with middleware validation at each HTTP endpoint.**

#### 1. Entry Points and Request Handling

**Initial Request Reception:**
\`\`\`typescript
// HTTP POST request arrives at auth controller
@Post('/login')
async login(@Body() credentials: LoginDto): Promise<AuthResponse> {  // auth.controller.ts:45
  return this.authService.authenticate(credentials);
}
\`\`\`

**Middleware Validation:**
\`\`\`typescript
// Request passes through validation middleware
@UseGuards(ValidationGuard)
@UsePipes(new ValidationPipe({ transform: true }))  // auth.controller.ts:43-44
\`\`\`

#### 2. Authentication Service Processing

**Credential Verification Flow:**
\`\`\`typescript
async authenticate(credentials: LoginDto): Promise<AuthResponse> {  // auth.service.ts:67
  // Step 1: Retrieve user from database
  const user = await this.userRepo.findByEmail(credentials.email);  // line 68
  if (!user) {
    throw new UnauthorizedException('Invalid credentials');  // line 70
  }

  // Step 2: Verify password using bcrypt
  const isValid = await bcrypt.compare(credentials.password, user.passwordHash);  // line 73
  if (!isValid) {
    throw new UnauthorizedException('Invalid credentials');  // line 75
  }

  // Step 3: Generate JWT token
  const token = await this.tokenService.generate(user);  // line 78

  // Step 4: Cache session
  await this.cache.set(\`session:\${token}\`, user, TTL_24_HOURS);  // line 81

  return { token, user: sanitizeUser(user) };  // line 83
}
\`\`\`

#### 3. Database Layer Operations

**User Repository Implementation:**
\`\`\`typescript
async findByEmail(email: string): Promise<User | null> {  // user.repository.ts:45
  const result = await this.db.query(
    'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',  // line 47
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) return null;

  return this.mapToEntity(result.rows[0]);  // line 52 - Maps DB row to User entity
}
\`\`\`

#### 4. Token Generation and Validation

**JWT Token Creation:**
\`\`\`typescript
async generate(user: User): Promise<string> {  // token.service.ts:23
  const payload = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
    iat: Date.now(),
    exp: Date.now() + (24 * 60 * 60 * 1000)  // 24 hour expiry
  };

  return jwt.sign(payload, this.config.jwtSecret, {  // line 31
    algorithm: 'HS256'
  });
}
\`\`\`

#### 5. Protected Route Access

**Authorization Guard:**
\`\`\`typescript
@UseGuards(JwtAuthGuard)
@Get('/profile')
async getProfile(@User() user: UserEntity): Promise<ProfileResponse> {  // user.controller.ts:89
  // User automatically injected from JWT token by guard
  return this.userService.getProfile(user.id);
}
\`\`\`

**Token Validation in Guard:**
\`\`\`typescript
async canActivate(context: ExecutionContext): boolean {  // jwt-auth.guard.ts:15
  const request = context.switchToHttp().getRequest();
  const token = this.extractToken(request);  // line 17

  if (!token) return false;

  try {
    const payload = await this.tokenService.verify(token);  // line 22
    request.user = await this.userService.findById(payload.sub);  // line 23
    return true;
  } catch (error) {
    return false;
  }
}
\`\`\`

#### 6. Session Management and Caching

**Session Storage Structure:**
- \`session:{token}\` → User object (24hr TTL)
- \`user:{id}\` → User profile cache (5min TTL)
- \`rate-limit:{ip}\` → Request counter (1min TTL)

**Cache Integration Points:**
- \`auth.service.ts:81\` - Session creation on login
- \`auth.service.ts:95\` - Session invalidation on logout
- \`jwt-auth.guard.ts:19\` - Session validation check
- \`user.service.ts:34\` - Profile caching

#### 7. Error Handling and Security

**Security Measures:**
1. **Rate Limiting**: Maximum 5 login attempts per minute (auth.controller.ts:41)
2. **Password Hashing**: Bcrypt with 12 rounds (auth.service.ts:112)
3. **Token Rotation**: Refresh token on each request (token.service.ts:45)
4. **SQL Injection Prevention**: Parameterized queries (user.repository.ts:47)
5. **XSS Protection**: Input sanitization (validation.pipe.ts:23)

**Error Response Standardization:**
\`\`\`typescript
// All auth errors follow this format
{
  statusCode: 401,
  message: "Invalid credentials",
  error: "Unauthorized",
  timestamp: "2024-01-15T10:30:00.000Z"
}
\`\`\`

#### 8. Complete Data Flow Summary

1. **Request**: Client sends POST /auth/login with email/password
2. **Validation**: ValidationPipe validates DTO structure
3. **Controller**: AuthController receives validated credentials
4. **Service**: AuthService performs authentication logic
5. **Repository**: UserRepository queries database for user
6. **Database**: Returns user record with password hash
7. **Verification**: Bcrypt compares passwords
8. **Token**: TokenService generates JWT with user claims
9. **Cache**: Session stored in Redis cache
10. **Response**: JWT token returned to client
11. **Subsequent Requests**: Token validated by JwtAuthGuard
12. **User Context**: Authenticated user injected into request

#### System Breaking Changes Analysis

**Compilation Failures:**
- Changing \`User.id\` from \`string\` to \`number\` - Type errors in 47 files
- Removing \`email\` field from \`User\` interface - TS2339 errors in auth.service.ts:68, user.repository.ts:45
- Modifying \`AuthResponse\` interface structure - Breaking return type contracts in 12 controller methods
- Renaming \`passwordHash\` field - Property access errors in bcrypt.compare() calls

**Runtime Exceptions:**
- JWT secret mismatch - \`JsonWebTokenError: invalid signature\` thrown at token.service.ts:22
- Database column removal - \`SQLException: Unknown column\` at user.repository.ts:47
- Cache key format change - \`null\` returns causing \`TypeError: Cannot read property 'id' of null\` at auth.service.ts:23
- Bcrypt rounds modification - \`Error: Invalid hash\` thrown during password verification

**Service Communication Failures:**
- Token payload structure change - Deserialization fails in downstream services
- Cache service disconnection - \`ConnectionRefusedError\` at cache.service.ts:15
- Database connection pool exhaustion - \`TimeoutError: Connection pool timeout\` at db.service.ts:34
- Redis protocol version mismatch - \`ReplyError: WRONGTYPE Operation against wrong type\` at session storage

**Request Processing Breakdowns:**
\`\`\`typescript
// Example: Changing token validation logic breaks request pipeline
async canActivate(context: ExecutionContext): boolean {  // jwt-auth.guard.ts:15
  const token = this.extractToken(request);
  // If token structure changes, this throws instead of returning false
  const payload = await this.tokenService.verify(token);  // Throws JsonWebTokenError
  // Never reaches user injection, all protected routes return 500
  request.user = await this.userService.findById(payload.sub);
}
\`\`\`

**Cascading System Failures:**
- Session storage key collision - Overwrites active sessions, random user logouts
- Token expiry calculation error - \`Date.now() + undefined\` produces NaN, permanent invalid tokens
- SQL injection in raw query modification - Unparameterized query at line 425 exposes database
- Memory leak from unclosed database connections - OOM kills at ~1000 concurrent requests
</examples>
`;

    // Prompt template from tournament winner: prompt-v0.md
    const prompt = `<question>
${question}
</question>

<instructions>
1. Apply Tool Selection Guide for query type (VSCode LSP workflow: Grep → get_symbol_lsp_info → get_references for TS/JS symbols)
2. Execute in parallel for independent operations, sequential when dependencies exist
3. Supplement with module tools (print-dependencies, print-inverse-dependencies, print-typescript-types, print-type-analysis) when analyzing dependencies or complex types
4. Apply Result Size Handling rules for output formatting
5. Show all results with file_path:line_number format and actual code snippets
6. Start answers directly with findings (no preamble) providing complete, actionable information
</instructions>
`;

    let result = '';
    const transcript: string[] = [];

    // Execute the query using Claude Code SDK with abort support
    for await (const message of query({
      prompt,
      options: {
        customSystemPrompt,
        maxTurns: 100,
        includePartialMessages: true,
        abortController,
        // Disallow tools that are not needed for codebase analysis:
        // - ExitPlanMode: Planning mode not applicable
        // - KillBash/BashOutput: Background process management not needed
        // - mcp__codebase__ask: Prevent recursive calls
        disallowedTools: ['ExitPlanMode', 'KillBash', 'mcp__codebase__ask', 'BashOutput']
      }
    })) {
      // Check if the operation was aborted
      if (abortController.signal.aborted) {
        throw new Error('Operation was aborted');
      }

      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result;
      } else if (
        message.type === 'result' &&
        (message.subtype === 'error_max_turns' || message.subtype === 'error_during_execution')
      ) {
        throw new Error(`Agent error: ${message.subtype}`);
      } else if (message.type === 'user') {
        // Handle tool results that come back as user messages
        if ('message' in message && message.message && typeof message.message === 'object') {
          const msg = message.message as {
            content?: Array<{
              type: string;
              content?: unknown;
              is_error?: boolean;
              tool_use_id?: string;
            }>;
          };
          if (msg.content && Array.isArray(msg.content)) {
            for (const content of msg.content) {
              if (content.type === 'tool_result') {
                // Log tool response
                if (content.is_error) {
                  transcript.push(`\`\`\`tool-response-error\n${String(content.content)}\n\`\`\``);
                } else {
                  const responseContent =
                    typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2);
                  // Clean up system reminders from tool responses if present
                  const cleanedContent = responseContent
                    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
                    .trim();
                  transcript.push(`\`\`\`tool-response\n${cleanedContent}\n\`\`\``);
                }
              }
            }
          }
        }
      } else if (message.type === 'assistant') {
        // Log assistant messages as plain text content
        // Use type guards to safely access nested properties
        if ('message' in message && message.message && typeof message.message === 'object') {
          const msg = message.message as {
            content?: Array<{
              type: string;
              text?: string;
              name?: string;
              input?: unknown;
              content?: unknown;
              is_error?: boolean;
            }>;
          };
          if (msg.content && Array.isArray(msg.content)) {
            for (const content of msg.content) {
              if (content.type === 'text' && content.text) {
                transcript.push(content.text);
              } else if (content.type === 'tool_use' && content.name) {
                // Log tool usage in a clean format
                const input = content.input as Record<string, unknown>;
                const formattedInput = formatToolInput(content.name, input);
                transcript.push(`\`\`\`tool-call\n${content.name}(\n${formattedInput}\n)\n\`\`\``);
              } else if (content.type === 'tool_result') {
                // Log tool response
                if (content.is_error) {
                  transcript.push(`\`\`\`tool-response-error\n${String(content.content)}\n\`\`\``);
                } else {
                  const responseContent =
                    typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2);
                  transcript.push(`\`\`\`tool-response\n${responseContent}\n\`\`\``);
                }
              }
            }
          }
        }
      } else if (message.type === 'stream_event') {
        // Process stream events to capture tool calls and responses
        const eventObj = message as SDKMessage;
        if ('event' in eventObj && eventObj.event && typeof eventObj.event === 'object') {
          const event = eventObj.event as {
            type?: string;
            tool_use?: { name?: string; input?: unknown; id?: string };
            content_block?: {
              type?: string;
              text?: string;
              content?: unknown;
              is_error?: boolean;
              name?: string;
              input?: unknown;
              id?: string;
              tool_use_id?: string;
            };
            index?: number;
          };

          // Handle tool calls
          if (event.type === 'tool_use' && event.tool_use && event.tool_use.name) {
            const input = event.tool_use.input as Record<string, unknown>;
            const formattedInput = formatToolInput(event.tool_use.name, input);
            transcript.push(`\`\`\`tool-call\n${event.tool_use.name}(\n${formattedInput}\n)\n\`\`\``);
          } else if (event.type === 'content_block_stop' && event.content_block) {
            const block = event.content_block;
            // Check if this is a tool_use block being completed
            if (block.type === 'tool_use' && block.name && block.input) {
              const input = block.input as Record<string, unknown>;
              const formattedInput = formatToolInput(block.name, input);
              transcript.push(`\`\`\`tool-call\n${block.name}(\n${formattedInput}\n)\n\`\`\``);
            } else if (block.type === 'tool_result') {
              // Log tool response
              if (block.is_error) {
                transcript.push(`\`\`\`tool-response-error\n${String(block.content)}\n\`\`\``);
              } else {
                const responseContent =
                  typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2);
                transcript.push(`\`\`\`tool-response\n${responseContent}\n\`\`\``);
              }
            }
          }
        }
      }
    }

    if (!result) {
      throw new Error('No result obtained from the agent');
    }

    // Log the complete transcript with Q&A
    await logQuestionAnswer(question, transcript);

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  } catch (error) {
    // Handle abort errors specifically
    if (error instanceof Error) {
      if (error.message === 'Operation was aborted' || error.name === 'AbortError') {
        // Log the abort for debugging
        console.error('[Codebase Tool] Query aborted by client');
        throw new McpError(ErrorCode.InternalError, 'Request was cancelled by client');
      }
      throw new McpError(ErrorCode.InternalError, `Failed to analyze codebase: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, 'Failed to analyze codebase: Unknown error');
  }
});

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

// Start the server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
