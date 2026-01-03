---
description: Trace code paths from UI interaction to side effects
argument-hint: <action-or-function> [perspectives: type,state,message,effect]
---

# Code Path Tracing

Trace the complete execution path of a user interaction, function call, or message through the codebase. Produces a structured analysis showing how data flows, types transform, state changes, and side effects occur.

**Target:** $ARGUMENTS

## Philosophy: Understanding Through Tracing

Code behavior emerges from the interaction of many components. A button click may trigger a callback, construct a message, cross a process boundary, dispatch through a switch statement, mutate state, and produce side effects. Understanding this flow is essential for debugging, refactoring, and onboarding.

**The principle**: Follow the data, not the abstractions. Types tell you what *can* happen; traces tell you what *does* happen. When tracing, prioritize concrete file paths and line numbers over conceptual descriptions.

---

## Phase 0: Classify Target Type

Before tracing, identify which category the target falls into. This determines which sections apply and what to emphasize.

| Target Type | Characteristics | Key Sections |
|-------------|-----------------|--------------|
| **Message/Action** | Crosses webview↔extension boundary, has type discriminant | Message Flow, Type Flow, both sides of boundary |
| **Pure Function** | No side effects, all state via parameters, returns data | Type Flow, Input/Output contract, Caller context |
| **VS Code Command** | Registered or implicit command, invoked via `executeCommand` | Entry points, Command registration, Effects |
| **Event/Pub-Sub** | One producer, multiple subscribers, fan-out pattern | All subscribers, Consumption patterns, Fan-out diagram |
| **UI Component** | React/DOM, renders output, may have hooks/effects | Props flow, Hook inventory, Child components |
| **Method on Class** | Exists on singleton/class, called from multiple contexts | Disambiguation, all callers, delegation chain |
| **Internal Method** | Called by many public APIs, not directly exposed | Fan-in diagram, caller summary, error propagation |
| **Error/Recovery Path** | Retry logic, circuit breakers, failure handling | State machine, retry checklist, notification channels |

**After classification**, skip sections that don't apply. For example:
- Pure functions: Skip "Side Effect Perspective" (document "NONE" briefly)
- Events: Use fan-out diagram instead of linear diagram
- Commands: Document implicit registration patterns

---

## Phase 0.5: Disambiguate Target (When Multiple Matches Exist)

When searching for the target yields multiple results:

### 1. Search and Classify All Occurrences

```bash
grep -r "targetName" --include="*.ts" -l
```

Classify each occurrence:
| Classification | Description | Action |
|----------------|-------------|--------|
| **TYPE** | Interface/type definition | Document but don't trace |
| **IMPL** | Core implementation | Primary trace target |
| **WRAPPER** | Thin delegation layer | Show relationship, trace briefly |
| **USAGE** | Call site | Document as entry point |

### 2. Identify Primary Implementation

For **methods**: The implementation that performs the core logic (usually on a state manager or service class).

For **functions**: The definition file, not declarations or re-exports.

### 3. Decide Trace Scope

| Scope | When to Use |
|-------|-------------|
| **FOCUSED** | Trace only primary implementation, summarize callers |
| **COMPREHENSIVE** | Trace all implementations showing relationships |

### 4. Document the Relationship

If multiple implementations exist (e.g., wrapper + core), show how they relate:

```
┌─ API Wrapper ─────────────────────┐
│  handler.updateIssue()            │
│  (adds mutationSource, logging)   │
└───────────────┬───────────────────┘
                │ delegates to
                ▼
┌─ Core Implementation ─────────────┐
│  manager.updateIssue()            │
│  (state mutation, persistence)    │
└───────────────────────────────────┘
```

---

## Phase 1: Identify Entry Point

Locate the starting point of the trace based on target type:

| Entry Type | Search Strategy |
|------------|-----------------|
| **UI action** | Search for button text, handler name, or onClick in component files |
| **Message type** | Grep for the type string. Entry point is where the message is **constructed**, not where the type is defined |
| **Pure function** | The function signature itself is the entry point. Document callers briefly, don't trace from each |
| **Explicit command** | Search `package.json` contributes.commands AND grep for `registerCommand` |
| **Implicit command** | VS Code auto-generates commands for views: `{viewId}.focus`, `{viewId}.reveal`. Search for `createTreeView` or `registerWebviewViewProvider` with that ID |
| **Event producer** | Search for `.fire(` or `.emit(` on the EventEmitter |
| **Event subscribers** | Search for `.on(eventName)` or `.onEventName(` across codebase |
| **Keyboard shortcut** | Search for `keybindings` in package.json, or Monaco `addAction` with keybinding |
| **Method with multiple callers** | Identify the method, then enumerate callers. Use convergence diagram |

### For Message Types

The entry point is the **UI component that constructs the message**, not:
- ❌ The type definition file
- ❌ The type guard function
- ❌ The switch case handler

Example: For `action:issueDetail:updateStatus`, entry point is the dropdown `onClick` in `IssueDetailHeader.tsx`, not `types.ts`.

### For Events with Multiple Entry Points

Document the single `fireChangeEvent()` or equivalent as the producer entry point, then trace to all subscribers.

### For Methods Called from Multiple Contexts

When a method (e.g., `updateIssue`) is called from webview handlers, API routes, and direct code:

1. List all call sites briefly
2. Pick one representative flow to trace in detail
3. Note differences in other flows (e.g., different `mutationSource` values)

**Output**: File path, line number, and the exact code that initiates the trace.

---

## Phase 2: Trace Forward

Follow the execution path from entry point to terminal effects.

### Step Granularity

A **step** represents one of:
- A significant data transformation
- A boundary crossing (process, async, type)
- A function call that changes module/file
- A state mutation

**Do NOT** create separate steps for:
- Sequential statements in the same function without transformation
- Trivial delegations (`return this.helper()`)
- Type-only operations (casts, assertions)

### Step Template

```markdown
### Step N: [Component/Function Name]

**File:** `path/to/file.ts:line`

**Code:**
```typescript
// Relevant code snippet (5-15 lines)
```

**Input:** What data/types enter this step
**Output:** What data/types exit this step
**Transformation:** How data changes (if any)
**Next:** What gets called/triggered next
```

### Trace Depth Guidelines

| Stop at | Continue through |
|---------|------------------|
| VS Code API calls (`vscode.*`) | Internal function calls within same module |
| Node.js/Browser APIs (`fs.*`, `fetch`) | Utility/helper functions |
| External library calls | Type guards and validation |
| Event emissions (document subscribers separately) | Async wrappers (`enqueueRequest`) |
| Persistence operations | Error handling branches |

### Boundary Markers

Flag these critical points inline in steps:

| Boundary | Significance | Example |
|----------|--------------|---------|
| **Type erasure** | Static types become `unknown` | `postMessage(message)` - typed to unknown |
| **Type restoration** | Type guards restore safety | `isDetailWebviewToExtensionMessage(msg)` |
| **Process boundary** | Execution crosses processes | Webview ↔ Extension Host |
| **Async boundary** | Execution becomes asynchronous | `setTimeout`, `enqueueRequest`, Promises |
| **State mutation** | Persistent state changes | `this.issues = newIssues` |
| **Side effect** | External systems affected | File write, API call, UI update |

---

## Phase 2.5: Trace Response (For Bidirectional Patterns)

For request/response patterns (e.g., clipboard request), trace the return path:

```markdown
### Response Flow

After the request is handled, trace how the response returns:

1. Response construction in extension
2. `postMessage` back to webview (BOUNDARY: type erasure)
3. Webview message listener
4. Type guard validation (BOUNDARY: type restoration)
5. State update or effect in webview
```

Include a bidirectional message diagram:

```
Webview                               Extension
   │                                      │
   │  { type: 'request:foo' }             │
   │ ────────────────────────────────────►│
   │                                      │ [processing]
   │  { type: 'response:foo', data }      │
   │ ◄────────────────────────────────────│
   │                                      │
   │  [state update / effect]             │
```

---

## Phase 3: Analyze Perspectives

Include perspectives based on target type and user request. Default: all applicable perspectives.

### Type Flow Perspective

Document how types propagate through the trace:

1. **Source types** — Where types are defined (interfaces, type aliases)
2. **Type sharing** — How types cross boundaries (shared imports, duplication)
3. **Type erasure points** — Where type information is lost
4. **Type validation** — Runtime checks that restore type safety
5. **Type narrowing** — Discriminated unions, type guards, switch statements

**Output format:**
```
┌─ Module A ──────────────────────┐
│  ConcreteType                   │
│    ↓ (function call)            │
│  ConcreteType                   │
└─────────────────────────────────┘
         │ serialization (TYPE ERASURE)
         ↓
┌─ Module B ──────────────────────┐
│  unknown                        │
│    ↓ (type guard)               │
│  UnionType (TYPE RESTORED)      │
│    ↓ (switch narrowing)         │
│  SpecificVariant                │
└─────────────────────────────────┘
```

### State Management Perspective

Document state access patterns:

1. **State sources** — Singletons, stores, context, props
2. **Read operations** — What state is accessed, by whom
3. **Write operations** — What state is mutated, when
4. **Derived state** — Computed/transformed state
5. **Synchronization** — How state stays consistent across boundaries
6. **Reactivity gaps** — Where state changes don't propagate

**For pure functions**, document:
```
State Access Pattern (PURE FUNCTION):
┌─────────────────────────────────────────────┐
│  functionName()                             │
│    ├─ READ:  NONE (all data via parameters) │
│    ├─ WRITE: NONE (returns new data)        │
│    └─ EVENTS: NONE (caller handles)         │
└─────────────────────────────────────────────┘
```

### Message Flow Perspective

Document inter-component communication:

1. **Message types** — The discriminated union of possible messages
2. **Message construction** — Where messages are created
3. **Serialization** — How messages cross boundaries
4. **Dispatch** — How messages are routed to handlers
5. **Response pattern** — Request/response vs fire-and-forget

### Side Effect Perspective

Document external effects:

1. **File system** — Reads, writes, deletes
2. **Network** — API calls, WebSocket messages
3. **UI** — Dialogs, notifications, editor changes
4. **Clipboard** — Read/write operations
5. **Process** — Spawning, IPC
6. **Telemetry** — Logging, metrics

**For pure functions**: State explicitly "NO SIDE EFFECTS" and document caller's effects if relevant.

### Purity Analysis (For Functions)

For function traces, document:

1. **Parameter mutation** — Does function modify its inputs?
2. **Global state access** — Does function read/write singletons or globals?
3. **Callback effects** — Could passed callbacks have side effects?
4. **Immutability strategy** — Spread operators, Object.assign, etc.

### React Component Perspective (For UI Components)

For React container components, document:

#### Hook Inventory

| Hook Type | Purpose | Example |
|-----------|---------|---------|
| `useState` | Local state | `const [issue, setIssue] = useState(null)` |
| `useEffect` | Side effects, subscriptions | Mount, message listener |
| `useCallback` | Memoized handlers | `handleDelete`, `handleUpdate` |
| `useMemo` | Derived/cached values | Computed props |
| `useRef` | DOM refs, mutable values | Input focus, previous value |

#### Props Flow Table

| Child Component | Props Passed | Handler Callbacks |
|-----------------|--------------|-------------------|
| `ChildA` | `issue`, `loading` | `onSave`, `onDelete` |
| `ChildB` | `comments` | `onAdd`, `onEdit` |

#### Effect Catalog

For each `useEffect`:
- **Dependencies**: What triggers re-run
- **Effect**: What side effect occurs
- **Cleanup**: What happens on unmount/re-run

---

## Phase 4: Generate Trace Diagram

Choose diagram type based on target:

### Linear Diagram (Default)

For sequential flows from entry to effect:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Entry Point]                                                       │
│  file.ts:123 — functionName()                                        │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ calls
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  [Intermediate Step]                                                 │
│  other.ts:456 — handlerName()                                        │
│  BOUNDARY: type erasure (postMessage)                                │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ async message
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  [Terminal Effect]                                                   │
│  provider.ts:789 — executeCommand()                                  │
│  EFFECT: opens virtual document                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Fan-Out Diagram (For Events/Pub-Sub)

For one producer with multiple subscribers:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Event Producer]                                                    │
│  StateManager.ts:100 — fireChangeEvent()                             │
│  EVENT: { issues, changedIssueIds }                                  │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ EventEmitter.fire() (synchronous fan-out)
         │
    ┌────┴────┬─────────┬─────────┬─────────┐
    ▼         ▼         ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Sub 1  │ │ Sub 2  │ │ Sub 3  │ │ Sub 4  │ │ Sub 5  │
│ Effect │ │ Effect │ │ Effect │ │ Effect │ │ Effect │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

### Convergence Diagram (For Methods with Multiple Callers)

For methods called from multiple entry points:

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Webview │  │ REST API│  │ Direct  │
│ Handler │  │ Route   │  │ Call    │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     │ { source:  │ { source:  │ (no source)
     │  'webview'}│  'api' }   │
     │            │            │
     └────────────┼────────────┘
                  ▼
          ┌──────────────┐
          │ Core Method  │
          │ manager.fn() │
          └──────────────┘
```

### State Machine Diagram (For Circuit Breakers/Retry Logic)

For error recovery patterns:

```
                    ┌─────────────┐
                    │   CLOSED    │◄────────────────┐
                    │ (normal op) │                 │
                    └──────┬──────┘                 │
                           │                        │
                     failure                    success
                           │                        │
                           ▼                        │
                    ┌─────────────┐                 │
            ┌──────►│   RETRY     │─────────────────┘
            │       │ (1,2,3...)  │
            │       └──────┬──────┘
            │              │
         retry         all retries
         delay          failed
            │              │
            └──────────────┼───────────────────────┐
                           │                       │
                           ▼                       │
                    ┌─────────────┐           ┌────┴────┐
                    │    OPEN     │──timeout──►│ CLOSED │
                    │ (rejecting) │           └─────────┘
                    └─────────────┘
```

### Pure Function Diagram

For functions with no side effects:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Pure Function]                                                     │
│  operations.ts:50 — transformData(input: A): B                       │
│  PURE: No side effects, immutable transformation                     │
│                                                                      │
│  Input:  A { field1, field2 }                                        │
│  Output: B { derivedField, computedField }                           │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │ called by (context only)
         │
┌─────────────────────────────────────────────────────────────────────┐
│  [Impure Wrapper]                                                    │
│  manager.ts:200 — updateState()                                      │
│  EFFECTS: persistence, event emission                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Props Flow Diagram (For React Components)

For components with significant props drilling:

```
┌─ Container ─────────────────────────────────────────────────────────┐
│  STATE: issue, loading, clipboard                                    │
│  HANDLERS: handleSave, handleDelete, handleUpdate (20+)              │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ props drilling
         │
    ┌────┴────────────────┬─────────────────┬─────────────────────┐
    ▼                     ▼                 ▼                     ▼
┌───────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│ Header        │  │ Description  │  │ Comments    │  │ Actions      │
│ (19 props)    │  │ (2 props)    │  │ (10 props)  │  │ (4 props)    │
└───────────────┘  └──────────────┘  └──────┬──────┘  └──────────────┘
                                            │
                                            ▼
                                    ┌───────────────┐
                                    │ CommentCard   │
                                    │ (5 props each)│
                                    └───────────────┘
```

---

## Phase 5: Identify Trace Concerns

Use this checklist to systematically discover issues:

### Boundary Concerns
- [ ] Data crosses type boundary without validation?
- [ ] Missing type guard after `postMessage` reception?
- [ ] Request sent but no response handling?
- [ ] Response missing correlation ID (requestId)?

### State Concerns
- [ ] Component reads state but doesn't subscribe to changes?
- [ ] State mutation without event notification?
- [ ] Multiple sources of truth for same data?
- [ ] Stale closure capturing old state?

### Error Handling Concerns
- [ ] Empty catch blocks or `catch { return defaultValue }`?
- [ ] Async operation without error propagation?
- [ ] User-facing operation with no error feedback?
- [ ] Silent failure that masks real problems?

### Event/Subscription Concerns
- [ ] Subscriber ignores event payload and re-queries state?
- [ ] Missing disposal of subscription?
- [ ] Synchronous fan-out blocking on slow subscriber?
- [ ] Debounce needed but not implemented?

### Pattern Concerns
- [ ] Duplicate implementations of same logic?
- [ ] Implicit VS Code behavior not documented?
- [ ] Magic strings instead of constants?
- [ ] Inconsistent response patterns across similar handlers?
- [ ] Wrapper has different signature than core implementation?

### Retry/Recovery Concerns (For Error Paths)
- [ ] Retry count and delays documented?
- [ ] Backoff strategy clear (linear, exponential)?
- [ ] What happens after all retries exhausted?
- [ ] Circuit breaker thresholds defined?
- [ ] How does circuit close (timeout, manual)?
- [ ] State divergence when persistence fails?
- [ ] Multiple notification channels (VS Code + webview)?

### React Component Concerns
- [ ] Props drilling exceeds 3 levels?
- [ ] Handler recreated on every render (missing useCallback)?
- [ ] useEffect missing cleanup?
- [ ] Derived state not memoized?

---

## Execution Strategy

### For Simple Traces (single file/module)

Read the file directly and trace manually through function calls.

### For Complex Traces (cross-module, cross-process)

Use utilities and parallel analysis:

```bash
# Find what a file depends on
print-dependencies path/to/file.ts

# Find what depends on a file
print-inverse-dependencies path/to/file.ts

# Find all subscribers to an event
grep -r "\.onDidChange\(" --include="*.ts"

# Find all callers of a function
grep -r "functionName\(" --include="*.ts"

# Find all implementations of a method name
grep -r "methodName(" --include="*.ts" -A 2
```

For cross-boundary traces, launch parallel subagents for each side.

---

## Output Format

Present the trace as:

1. **Summary** — One-paragraph description of the complete flow
2. **Classification** — Target type and applicable sections
3. **Disambiguation** — (If multiple matches) Which implementation traced and why
4. **Trace Steps** — Numbered steps with file:line references
5. **Perspective Analysis** — Requested perspectives (type/state/message/effect)
6. **Diagram** — Visual flow representation (linear, fan-out, convergence, state machine, or pure)
7. **Concerns** — Issues discovered via checklist

---

## Example Invocations

```
/trace "View as JSON" button in issue-detail webview
/trace action:issueDetail:updateStatus message type,state
/trace updateIssueState pure function
/trace compareBranch.focus command
/trace IssueStateManager.onDidChange event
/trace action:issueDetail:requestClipboard message (round-trip)
/trace updateIssue (ambiguous - multiple implementations)
/trace IssueDetailView component
/trace saveIssues error handling and retry logic
```
