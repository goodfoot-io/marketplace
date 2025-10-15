---
description: Add or update world-class JSDoc documentation to TypeScript files
allowed-tools: *
argument-hint: <file-or-directory-path> [additional-paths...]
---

<user-message>
$ARGUMENTS
</user-message>

<input-format>
`<user-message>` should contain one or more file or directory paths:
- File paths: Single TypeScript files (e.g., `src/utils/auth.ts`)
- Directory paths: Directories to process recursively (e.g., `src/services/`)
- Multiple paths: Space-separated paths (e.g., `src/auth.ts src/utils/ packages/api/`)

Extract the following from `<user-message>`:
- [PATHS] = One or more file or directory paths to document (required)

Variables derived during execution:
- [TARGET_FILES] = List of all TypeScript files to document (Phase 1.1)
- [FILE_CONTEXT] = Code understanding including purpose, usage, dependencies (Phase 2)
- [DOCUMENTATION] = Generated JSDoc content (Phase 3)
</input-format>

## World-Class JSDoc Characteristics

Documentation must include:

1. **Clear Purpose**: Concise summary explaining what the code does (verb-based for methods)
2. **Complete Parameters**: All parameters with types, descriptions, constraints, and optional indicators
3. **Return Values**: Clear explanation of what's returned, including edge cases
4. **Examples**: Real-world usage examples from tests or typical use cases
5. **Error Documentation**: Exceptions thrown and conditions using `@throws`
6. **Behavioral Notes**: Side effects, performance, async behavior using `@remarks`
7. **API Lifecycle**: Maturity indicators (`@beta`, `@alpha`, `@deprecated`, `@internal`)
8. **Cross-References**: Links to related code using `@see`
9. **Type Context**: Semantic meaning beyond what TypeScript types provide
10. **Markdown Formatting**: Lists, code blocks, and emphasis for clarity

## Phase 1: Identify Target Files

### Step 1.1: Resolve Paths to Files

For each path in [PATHS]:

<tool-use-template>
// If path is a specific file
Read(
  file_path="[PATH]"
)

// If path is a directory, find all TypeScript files
Glob(
  pattern="**/*.ts",
  path="[PATH]"
)

// Exclude test files, type definitions, and generated files
Glob(
  pattern="**/*.{test,spec}.ts",
  path="[PATH]"
)
// Filter these out from documentation targets
</tool-use-template>

Create [TARGET_FILES] list, excluding:
- Test files (`*.test.ts`, `*.spec.ts`)
- Type-only files that are just interfaces/types with no implementation
- Generated files (check for generation headers)
- Declaration files (`*.d.ts`)

## Phase 2: Research and Understand Code

For each file in [TARGET_FILES], gather comprehensive context:

### Step 2.1: Read Current State

<tool-use-template>
Read(
  file_path="packages/api/src/services/user.ts"
)
</tool-use-template>

Identify:
- Exported functions, classes, methods, interfaces
- Existing JSDoc (to preserve or enhance)
- Complexity indicators (long functions, many parameters, complex types)

### Step 2.2: Understand Purpose and Behavior

Use codebase analysis to understand what the code does:

<tool-use-template>
mcp__codebase__ask({
  question: "What does the UserService class in packages/api/src/services/user.ts do? Show:
  - Primary purpose and responsibilities
  - Key methods and their execution flow
  - Dependencies on other services or utilities
  - Data transformations performed"
})

mcp__codebase__ask({
  question: "For the createUser function in packages/api/src/services/user.ts:
  - What are all the parameters and their valid ranges/constraints?
  - What does it return and under what conditions?
  - What errors can it throw and when?
  - What side effects does it have (database writes, cache updates, etc.)?"
})
</tool-use-template>

### Step 2.3: Find Usage Examples

Find test files and real-world usage:

<tool-use-template>
// Find test files for this module
Glob(
  pattern="**/*.{test,spec}.ts"
)

// Read relevant test file
Read(
  file_path="packages/api/src/services/user.test.ts"
)

// Find all places this code is used
mcp__codebase__ask({
  question: "What files import and use the UserService from packages/api/src/services/user.ts? Show concrete usage examples with context."
})
</tool-use-template>

Extract:
- Real-world usage patterns for `@example` tags
- Edge cases being tested
- Expected inputs and outputs
- Error scenarios

### Step 2.4: Trace Dependencies and Impact

<tool-use-template>
// What does this file depend on?
Bash(
  command="print-dependencies packages/api/src/services/user.ts",
  description="List all files that user.ts imports"
)

// What depends on this file?
Bash(
  command="print-inverse-dependencies packages/api/src/services/user.ts",
  description="Show files that import this code - helps understand usage context"
)

// For complex functions, check complexity
Bash(
  command="print-type-analysis packages/api/src/services/user.ts | grep -A 1 'complexity:'",
  description="Show function complexity scores"
)
</tool-use-template>

High complexity (>10) indicates need for detailed remarks about algorithm complexity or behavior.

### Step 2.5: Research Type Information

<tool-use-template>
// Find type definitions
mcp__codebase__ask({
  question: "What is the complete type definition for User in packages/api/src/types/user.ts? Show all properties, their types, and whether they're optional."
})

// Understand generic constraints
mcp__codebase__ask({
  question: "For the generic function processData<T extends BaseEntity> in packages/api/src/utils/processor.ts, what constraints exist on T and why?"
})
</tool-use-template>

## Phase 3: Generate Documentation

### Step 3.1: Draft JSDoc Comments

For each exported function, class, method, or interface, create documentation following this template:

```typescript
/**
 * [Clear, concise summary - verb-based for methods, noun-based for classes]
 *
 * @remarks
 * [Additional context - when to use this, performance characteristics, side effects]
 * [For async functions: When promises resolve/reject]
 * [For complex algorithms: Time/space complexity]
 * [For stateful code: What state is modified]
 *
 * @param paramName - [Description including purpose, valid values, constraints]
 * @param optionalParam - [Description with default behavior] (Optional)
 * @param genericParam - [Description of type parameter constraints]
 *
 * @returns [Description of return value]
 * [Include special cases: null, undefined, empty arrays, etc.]
 * [For async: What the promise resolves to]
 *
 * @throws {ErrorType} [Specific condition that triggers this error]
 * @throws {AnotherError} [Another error condition]
 *
 * @example
 * ```typescript
 * // [Description of what this example shows]
 * const result = await functionName(validInput);
 * console.log(result); // Expected: { id: 1, name: "example" }
 * ```
 *
 * @example
 * ```typescript
 * // [Error handling example]
 * try {
 *   await functionName(invalidInput);
 * } catch (error) {
 *   console.error('Expected error:', error);
 * }
 * ```
 *
 * @see {@link relatedFunction} for alternative approach
 * @see {@link RelatedClass} for usage context
 *
 * @beta
 */
```

**Documentation Guidelines:**

1. **Summary**: First sentence, clear and concise. For methods, start with a verb (e.g., "Validates", "Creates", "Fetches"). For classes, describe what it represents.

2. **@remarks**: Use for:
   - When to use this code vs alternatives
   - Performance notes (e.g., "O(n log n) due to sorting")
   - Side effects (e.g., "Modifies the global cache")
   - Async behavior (e.g., "Resolves after database transaction commits")
   - Important behavioral notes (e.g., "Thread-safe", "Idempotent")

3. **@param**: For each parameter:
   - Purpose and how it's used
   - Valid values or constraints (e.g., "Must be positive", "Valid ISO date string")
   - Defaults if applicable
   - Mark optional with "(Optional)" suffix

4. **@returns**:
   - What's returned in the success case
   - Special values (null, undefined, empty array) and when they occur
   - For promises, what the resolved value contains

5. **@throws**:
   - Specific error types
   - Exact conditions that trigger each error
   - Based on actual error handling in the code

6. **@example**:
   - Real-world usage from tests or common patterns
   - Show at least one success case
   - Show error handling if relevant
   - Use actual code that would work, not pseudocode
   - Add comments explaining the example

7. **@see**:
   - Link related functions using `{@link functionName}`
   - Reference alternative approaches
   - Point to parent classes or interfaces

8. **Lifecycle tags**:
   - `@beta` for new features not yet stable
   - `@alpha` for experimental features
   - `@deprecated` with migration instructions
   - `@internal` for private APIs

### Step 3.2: Apply Documentation

For each file, use the Edit tool to add or update JSDoc:

<tool-use-template>
Edit(
  file_path="packages/api/src/services/user.ts",
  old_string="export class UserService {
  constructor(private db: Database) {}

  async createUser(data: CreateUserData): Promise<User> {",
  new_string="/**
 * Service for managing user lifecycle operations including creation, updates, and deletion.
 *
 * @remarks
 * This service handles all user-related database operations and enforces business
 * rules such as email uniqueness and password strength requirements. All methods
 * are async and operate within database transactions.
 */
export class UserService {
  constructor(private db: Database) {}

  /**
   * Creates a new user account with the provided data.
   *
   * @remarks
   * This method validates the user data, hashes the password, and creates the user
   * record within a database transaction. If any step fails, the transaction is
   * rolled back and no user is created.
   *
   * @param data - User creation data including email, password, and optional profile info
   * @param data.email - Must be a valid email format and unique in the system
   * @param data.password - Must meet minimum strength requirements (8+ chars, 1 uppercase, 1 number)
   * @param data.name - User's display name (Optional)
   *
   * @returns Promise resolving to the created user object with hashed password removed
   *
   * @throws {ValidationError} When email format is invalid or password is too weak
   * @throws {DuplicateError} When a user with the email already exists
   * @throws {DatabaseError} When the database transaction fails
   *
   * @example
   * ```typescript
   * // Create a basic user account
   * const user = await userService.createUser({
   *   email: 'user@example.com',
   *   password: 'SecurePass123',
   *   name: 'John Doe'
   * });
   * console.log(user); // { id: '123', email: 'user@example.com', name: 'John Doe' }
   * ```
   *
   * @example
   * ```typescript
   * // Handle validation errors
   * try {
   *   await userService.createUser({
   *     email: 'invalid-email',
   *     password: 'weak'
   *   });
   * } catch (error) {
   *   if (error instanceof ValidationError) {
   *     console.error('Invalid input:', error.message);
   *   }
   * }
   * ```
   *
   * @see {@link updateUser} for modifying existing users
   * @see {@link User} for the complete user type definition
   */
  async createUser(data: CreateUserData): Promise<User> {"
)
</tool-use-template>

**Preservation Rules:**
- Keep existing JSDoc if it's high quality; enhance it rather than replace
- Preserve custom tags or project-specific documentation conventions
- Maintain existing examples that are valuable
- Keep existing `@deprecated` tags with their migration instructions

### Step 3.3: Handle Special Cases

**For Interfaces and Types:**
```typescript
/**
 * [Description of what this type represents]
 *
 * @remarks
 * [When to use this type, relationship to other types]
 */
export interface User {
  /** Unique identifier generated by the database */
  id: string;

  /** User's email address - must be unique and valid format */
  email: string;

  /** User's display name (Optional) */
  name?: string;
}
```

**For Enums:**
```typescript
/**
 * [What this enum represents]
 *
 * @remarks
 * [Usage context and constraints]
 */
export enum UserRole {
  /** Standard user with basic permissions */
  USER = 'user',

  /** Administrator with full system access */
  ADMIN = 'admin',
}
```

**For Generic Functions:**
```typescript
/**
 * [Summary]
 *
 * @template T - [Description of type parameter and constraints]
 * @template K - [Another type parameter if applicable]
 *
 * @param {T} input - [Description]
 * @returns {K} [Description]
 */
```

**For Async Functions:**
Always mention in `@remarks` when the promise resolves and what triggers rejection.

**For Factory Functions:**
Document what instances are created and their initial state.

**For HOCs/Decorators:**
Document how they transform the input and what they add.

## Phase 4: Validate Documentation

### Step 4.1: Verify TypeScript Compilation

Ensure documentation doesn't break types:

<tool-use-template>
Bash(
  command="yarn tsc --noEmit",
  description="Check TypeScript compilation with new JSDoc"
)
</tool-use-template>

### Step 4.2: Check Documentation Quality

For each documented file, verify:

**Completeness Checklist:**
- [ ] All exported functions/classes/interfaces documented
- [ ] All parameters explained with constraints
- [ ] All return values documented including edge cases
- [ ] Error conditions documented with `@throws`
- [ ] At least one realistic `@example` per public function
- [ ] Side effects noted in `@remarks`
- [ ] Cross-references added with `@see` where relevant

**Clarity Checklist:**
- [ ] Summaries are concise (one sentence)
- [ ] Parameter descriptions explain *purpose*, not just type
- [ ] Examples use real, working code
- [ ] Technical terms are explained or linked
- [ ] Async behavior is clearly documented

**Accuracy Checklist:**
- [ ] Documentation matches actual code behavior
- [ ] Examples would actually work if run
- [ ] Error types match what's thrown in code
- [ ] Parameter constraints match validation logic

### Step 4.3: Run Linter

If ESLint with JSDoc plugin is configured:

<tool-use-template>
Bash(
  command="yarn lint",
  description="Check JSDoc formatting and completeness"
)
</tool-use-template>

### Step 4.4: Generate Preview

If TypeDoc or similar tool is available:

<tool-use-template>
Bash(
  command="yarn docs:generate",
  description="Generate documentation to preview rendered output"
)
</tool-use-template>

## Phase 5: Report Results

```
## JSDoc Documentation Complete

### Files Documented
- [file1.ts]: [N functions, M classes, K interfaces]
- [file2.ts]: [N functions, M classes, K interfaces]
...

### Documentation Added
- ✅ Function summaries: [count]
- ✅ Parameter descriptions: [count]
- ✅ Return value docs: [count]
- ✅ Examples: [count]
- ✅ Error documentation: [count]
- ✅ Cross-references: [count]

### Validation Results
- TypeScript: [✅ Pass | ❌ N errors]
- Linter: [✅ Pass | ❌ N issues]

[If errors exist, include details]

### Next Steps
- Review the generated documentation for accuracy
- Run `yarn docs:generate` to view rendered documentation
- Consider adding more examples for complex functions
```

## Important Notes

**Research Depth**: Use `mcp__codebase__ask` extensively to understand:
- What the code actually does (don't guess)
- Real usage patterns (find actual call sites)
- Error conditions (trace error handling)
- Dependencies and context (understand integration)

**Example Quality**: Examples should:
- Come from test files when possible
- Actually work if copy-pasted
- Show common use cases first
- Include error handling when relevant
- Have explanatory comments

**Type Redundancy**: JSDoc should add *semantic* value beyond types:
- ❌ `@param id - The user ID` (redundant with `id: string`)
- ✅ `@param id - Unique identifier from the database, formatted as UUID v4` (adds context)

**Preservation**: When documentation exists:
- Read carefully to understand existing conventions
- Enhance rather than replace good documentation
- Preserve project-specific tags or formats
- Keep valuable historical context

**Completeness**: Document ALL exported APIs:
- Public functions and methods
- Classes and their constructors
- Interfaces and type aliases
- Exported constants and enums
- Don't skip "simple" code - it still needs documentation
