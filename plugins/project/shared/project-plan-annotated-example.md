# Annotated Project Plan Example

This document provides a comprehensive example of an excellent project plan with clear instructions for each section. The example demonstrates implementing a notification system with real-time updates and user preferences.

## Plan Versioning Convention

Project plans follow a versioning convention:
- Initial plan: `plan-v1.md`
- Revised plans: `plan-v2.md`, `plan-v3.md`, etc.
- Each version should be self-contained without references to other versions
- Version updates occur when assessment identifies issues or user provides feedback

## Front Matter (Optional but Powerful)

<example>
```yaml
---
dependencies: 
  - user-preferences-api     # Only list actual blocking dependencies
  - event-bus-setup         # Must complete before this project
preventAutoProgress: true   # Add only when user review is critical before code changes
---
```
</example>

<instructions>
The YAML front matter is optional. Only use it when:
- `dependencies`: Other projects that MUST complete before yours can start (true blockers only)
- `preventAutoProgress: true`: Critical production changes or user explicitly requests review

Most plans should NOT include front matter.
</instructions>

---

## Title Format

<example>
```markdown
# Implementation Project: Real-Time Notification System
```
</example>

<instructions>
Must follow: `# Implementation Project: [Clear, Specific Title]`
- Always use "Implementation Project" (not "Project" or "Plan")
- Keep title specific and concise (3-7 words after the colon)
- Never use generic terms like "Update" or "Feature"
- Don't include version numbers or dates
</instructions>

---

## Problem Statement

<example>
```markdown
## Problem Statement
The application currently lacks real-time notification capabilities, requiring users to manually refresh pages to see updates. This leads to delayed awareness of important events, reduced user engagement, and a subpar user experience compared to modern web applications.
```
</example>

<instructions>
Write 2-4 sentences that:
1. Explain the current state and its limitations
2. Describe the negative impact on users or the system
3. Make clear why this needs to be solved now
4. Avoid proposing solutions (save for Technical Approach)
</instructions>

---

## Goals & Objectives

<example>
```markdown
## Goals & Objectives
- [ ] Create notification queue with priority-based ordering
- [ ] Implement real-time delivery via WebSocket connections  
- [ ] Build notification center UI with read/unread states
- [ ] Add user preference controls for notification types
- [ ] Ensure notifications persist across page refreshes
- [ ] Support batching for high-frequency event streams
```
</example>

<instructions>
Write 3-7 specific, measurable goals using checkbox format: `- [ ]`

Each goal must be:
- Verifiable (you can definitively check if it's done)
- An outcome, not a process (what will exist, not how to build)
- Directly addressing the user's request

❌ Bad: "Make notifications better", "Research libraries", "Try to add real-time"
✅ Good: "Process 100+ notifications/second without UI lag", "Unread count updates within 500ms"

Note: Goals and Objectives mean the same thing - we use both terms for clarity.
</instructions>

---

## Scope

<example>
```markdown
## Scope

### Include
- In-app notification delivery and display
- Real-time updates via WebSocket connections
- Notification center dropdown component
- User preference storage and enforcement
- Read/unread state management
- Sound/badge indicators for new notifications

### Exclude
- Email notification delivery
- Push notifications to mobile devices
- SMS or other external channels
- Notification scheduling/delayed delivery
- Rich media attachments (images, files)
- Notification analytics or tracking
```
</example>

<instructions>
Define clear boundaries for what is and isn't part of this project.

### Include
- List all features that WILL be built
- Be specific about technical limits (e.g., "100 notifications/second")
- Reference existing systems you'll integrate with

### Exclude (CRITICAL - prevents scope creep)
- Explicitly list what will NOT be built
- Features deferred to future versions
- Related functionality that's out of scope
- Platforms or use cases not being addressed

The Exclude section saves more time than any other part by preventing scope creep.
</instructions>

---

## Framework & Technology Stack

<example>
```markdown
## Framework & Technology Stack

### Core Technologies
- Node.js: v20.11.0
- React: react@18.2.0
- TypeScript: typescript@5.3.3

### Frameworks
- Next.js: next@14.1.0 (App Router)
- Express: express@4.18.2

### Testing
- Jest: jest@29.7.0
- Playwright: @playwright/test@1.41.0
- Testing Library: @testing-library/react@14.1.2

### Key Libraries
- WebSocket: socket.io@4.6.1 - Real-time communication
- State Management: zustand@4.5.0 - Client state management
- Validation: zod@3.22.4 - Schema validation
- Database: @prisma/client@5.8.0 - ORM

### Version-Specific Features Used
- React (react@18.2.0): Suspense boundaries, concurrent rendering
- Node.js v20.11.0: Native WebCrypto API, stable test runner
- TypeScript (typescript@5.3.3): satisfies operator, const type parameters
```
</example>

<instructions>
Document all framework and library versions that constrain the implementation.

### Required Structure
1. **Core Technologies**: Node.js, React, TypeScript versions
2. **Frameworks**: Next.js, Express, etc.
3. **Testing**: Test runners and libraries
4. **Key Libraries**: Important dependencies with purpose
5. **Version-Specific Features Used**: Features that depend on specific versions

### Common Formats (all acceptable)
- Node.js: v20.11.0 or 20.11.0
- React: react@18.2.0 or 18.2.0
- TypeScript: typescript@5.3.3 or 5.3.3
- Exact versions preferred over ranges for reproducibility
- Add purpose for key libraries when helpful (e.g., "- Git Operations: simple-git@3.20.0 - Execute git commands")

### Version-Specific Features Examples
- React 18+: Suspense, Server Components, use() hook
- React 19+: Actions, optimistic updates
- Node.js 18+: Native fetch API
- TypeScript 5+: Decorators, satisfies operator
- Next.js 13+: App Router vs Pages Router

Populate from technology stack identification in analysis phase.
</instructions>

---

## Assumption Testing (When Needed)

<example>
```markdown
## Assumption Testing Results

### WebSocket Event Ordering Test
- **Question**: Do WebSocket events maintain order during rapid-fire sequences?
- **Result**: YES - Events arrive in exact send order when using single connection
- **Evidence**: Scratchpad test sent 1000 numbered events, all received in sequence
- **Impact**: Can rely on event ordering for notification batching logic

### Browser Storage Limits Test  
- **Question**: What happens when localStorage approaches quota limit?
- **Result**: QuotaExceededError thrown at ~5MB (varies by browser)
- **Evidence**: Test filled storage incrementally, caught exception at 5,242,880 bytes
- **Impact**: Must implement LRU eviction before storing new notifications
```
</example>

<instructions>
Include this section ONLY when you have 2+ critical technical unknowns that could change your approach.

### When to Test Assumptions
Validate when dealing with:
- **External Dependencies**: Third-party library exports and APIs
- **Framework Behaviors**: Runtime behavior that differs from documentation
- **Environment Boundaries**: Module resolution, build tools, browser APIs
- **Integration Points**: How different systems actually interact
- **Edge Cases**: Undocumented or ambiguous behavior
- **Version Compatibility**: Features that may vary between versions

### When to Skip Testing
- Well-documented framework features
- Internal code you control
- Standard CRUD operations
- Simple UI components

### How to Document Results
1. State the specific question being tested
2. Provide the clear answer (YES/NO or specific value)
3. Include evidence from the scratchpad test
4. Explain how this impacts the implementation approach

Note: The project:assumption-tester agent creates test results in `scratchpad/[test-name]/findings.md`.
</instructions>

---

## Technical Approach

<example>
```markdown
## Technical Approach
1. **Create notification store interface** (packages/web/src/stores/notification-store.ts:12)
   - Add `notifications: Notification[]` array to state
   - Add `unreadCount: number` computed property
   - Implement queue management with priority sorting

2. **Define notification message types** (packages/shared/src/types/events.ts:45)
   - Create `NotificationEvent` interface with type, priority, payload
   - Add to existing EventType enum for type safety
   - Include timestamp and unique ID generation

3. **Build WebSocket subscription handler** (packages/web/src/hooks/use-notification-stream.ts)
   - Subscribe to user-specific notification channel
   - Handle reconnection with missed notification catch-up
   - Implement client-side deduplication by event ID

4. **Create notification center component** (packages/web/src/components/ui/notification-center.tsx)
   - Dropdown panel triggered by bell icon in header
   - Virtual scrolling for large notification lists
   - Mark-as-read on hover with debounce

5. **Add preference management** (packages/api/src/services/user-preferences.ts:78)
   - Store notification settings per category
   - Apply filters at event emission point
   - Cache preferences for performance

6. **Implement batching logic** (packages/api/src/services/notification-batcher.ts)
   - Collect events in 100ms windows
   - Group by recipient and notification type
   - Send as single WebSocket message per batch
```
</example>

<instructions>
Describe the implementation steps in concrete but flexible terms.

### Requirements
1. Number each major step sequentially
2. Include verified file paths where changes will occur
3. Add line numbers when referencing existing code (e.g., `:78`)
4. Describe WHAT to do, not HOW to implement it
5. Keep each step focused on a single concern

### Line Number Guidelines
- Skip line numbers for new files
- Include them when referencing specific existing code
- Use "around line X" if the exact line might shift

### Avoid
- Implementation details or algorithms
- Complete function signatures
- UI layout specifics
- Error handling details (unless critical to approach)
</instructions>

### Code Example Guidelines

Include code examples that **clarify complex structures** without dictating implementation:

<example>
```typescript
// Example: Notification data structure (clarifies format)
interface Notification {
  id: string;
  type: 'comment' | 'mention' | 'system';
  priority: 1 | 2 | 3;  // 1 = high, 3 = low
  timestamp: number;
  read: boolean;
  data: Record<string, unknown>;
}

// Example: WebSocket event format (defines contract)
type NotificationBatch = {
  type: 'notification.batch';
  notifications: Notification[];
  missedCount?: number;  // For reconnection scenarios
};
```
</example>

<instructions>
Include code examples ONLY when they clarify contracts or complex data structures.

Good code examples show:
1. Type definitions and interfaces for data structures
2. API contracts between systems
3. Expected data transformations (input → output format)
4. Integration points with existing code (with file references)
5. Configuration shapes or option objects

Never include:
1. Full function implementations
2. Step-by-step algorithms
3. UI component implementations
4. Error handling code
5. Business logic details

Keep examples minimal - just enough to clarify without constraining implementation choices.
</instructions>


---

## Dependency Analysis

<example>
```markdown
## Dependency Analysis

### High-Impact Files
- packages/shared/src/types/events.ts (743 imports) - Core event types used throughout system
- packages/web/src/hooks/use-websocket.ts (521 imports) - WebSocket connection hook all real-time features use
- packages/api/src/middleware/auth.ts (234 imports) - Auth required for notification filtering

### Key Integration Points  
- packages/web/src/components/layout/header.tsx - Where notification bell icon mounts
- packages/api/src/services/event-emitter.ts - Central event dispatch for notifications
- packages/web/src/stores/index.ts - Store registry for new notification store

### External Dependencies
- @supabase/ssr: ^0.0.10 (authentication)
- zod: ^3.22.0 (validation, already in package.json)
```
</example>

<instructions>
Identify files that are critical dependencies or integration points for your implementation.

### Structure Requirements
- **High-Impact Files**: List files with significant import counts that you'll modify
- **Key Integration Points**: Files where your new code connects to existing systems
- **External Dependencies**: Libraries needed (note if already in package.json)

Include actual import counts in parentheses (e.g., "auth.ts (234 imports)") to indicate risk level.
List files where your new code connects to existing systems with brief descriptions.
</instructions>

---

## Package Commands

<example>
```markdown
## Package Commands
- Lint: 'cd packages/web && yarn lint'
- Test: 'cd packages/web && yarn test'
- E2E: 'cd packages/web && yarn test:e2e'
- Type check: 'cd packages/web && yarn typecheck'
```
</example>

<instructions>
Provide validation commands for packages affected by your implementation.

Process:
1. Identify affected packages from your Technical Approach
2. Check each package's package.json for available scripts
3. Format as executable commands from workspace root

For multiple packages:
```markdown
## Package Commands
### packages/[package-1]
- Lint: 'cd packages/[package-1] && yarn lint'
- Test: 'cd packages/[package-1] && yarn test'

### packages/[package-2]  
- Lint: 'cd packages/[package-2] && yarn lint'
- Test: 'cd packages/[package-2] && yarn test:e2e'
```
</instructions>

---

## Risks & Mitigations

<example>
```markdown
## Risks & Mitigations
- **Risk**: Browser notification API permissions vary by browser
  **Mitigation**: Graceful degradation to in-app only when API unavailable

- **Risk**: High-frequency events could overwhelm clients
  **Mitigation**: Server-side rate limiting at 100 events/second per user

- **Risk**: Notifications lost during WebSocket reconnection
  **Mitigation**: Include last-received timestamp in reconnect, server replays missed

- **Risk**: Storage quota exceeded with too many notifications
  **Mitigation**: Implement rolling window keeping only last 1000 notifications
```
</example>

<instructions>
Identify technical risks that could cause the implementation to fail or perform poorly.

Focus on:
1. Technical risks only (not project management risks)
2. Specific, discovered concerns (not generic worries)
3. Actionable mitigations (not "be careful")

Common risk categories:
- Browser compatibility differences
- Performance degradation at scale
- Network reliability issues
- State synchronization problems
- Resource limitations (memory, storage)
- Security or permission constraints

Format each risk as:
- **Risk**: [Specific technical concern]
  **Mitigation**: [Concrete solution or approach]

Include 3-5 most significant risks. More than 5 suggests over-analysis.
</instructions>

---

## Implementation References (Optional)

<example>
```markdown
## Implementation References
- Event patterns: packages/api/src/services/analytics-events.ts:123 - Similar event batching
- WebSocket setup: packages/web/src/hooks/use-chat.ts:45 - Real-time subscription pattern
- Dropdown UI: packages/web/src/components/ui/dropdown-menu.tsx:12 - Reusable dropdown
- Virtual scroll: packages/web/src/components/tables/data-table.tsx:234 - Virtual rendering
- Storage: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas
```
</example>

<instructions>
Include this section ONLY when you have specific, helpful references.

Good references include:
1. Similar patterns in the codebase (with file:line references)
2. Reusable components or utilities
3. External documentation for complex APIs
4. Example implementations to follow

Guidelines:
- Include line numbers for precision
- Explain briefly why each reference is relevant
- Limit to 3-5 most helpful references
- Verify all file paths before including them

Skip this section if you don't have genuinely useful references.
</instructions>

---

## Common Mistakes to Avoid

<instructions>
### 1. Vague Goals
❌ "Improve notification system performance"
✅ "Process 100+ notifications/second without UI lag"

### 2. Over-Detailed Technical Approach
❌ "Create processNotification() function that takes a Notification object..."
✅ "Build notification processing pipeline with priority ordering"

### 3. Missing Scope Exclusions
❌ Only listing what's included
✅ Both Include AND Exclude sections

### 4. Generic Risks
❌ "Risk: Performance issues. Mitigation: Optimize the code"
✅ "Risk: High-frequency events could overwhelm clients. Mitigation: Server-side rate limiting at 100 events/second"

### 5. Guessed File Paths
❌ "Update notification service (probably in src/services/notifications.ts)"
✅ "Update notification dispatcher (packages/api/src/services/event-emitter.ts:234)"

### 6. Missing Version Information
❌ "React: latest" or "Node.js: current"
✅ "React: 18.2.0" or "React: react@18.2.0" (both acceptable)
</instructions>

---

## Key Principles

<instructions>
1. **Precision**: Use verified file paths with line numbers
2. **YAGNI**: Only features solving the immediate problem
3. **Integration Over Innovation**: Reuse existing patterns
4. **Examples Clarify, Not Constrain**: Show data shapes, not implementations
5. **Test the Risks**: Focus on what could actually fail
6. **Scope Exclusions Prevent Creep**: Explicitly state what's NOT included

The best plan answers "what" and "where" while leaving "how" to the implementer.
</instructions>

---

## Adapting for Different Project Types

<instructions>
### Bug Fixes
- Goals: What will be fixed/work correctly
- Scope: Smaller, but exclude related issues
- Risks: Include regression risks

### Refactoring
- Goals: Code quality improvements (e.g., "Reduce coupling between X and Y")
- Technical Approach: Emphasize transformation
- Testing: Ensure existing behavior unchanged

### Research/Investigation
- Goals: Questions to answer, not features to build
- Technical Approach: Investigation steps
- Risks: "May discover approach is not viable"

### Emergency Hotfixes
- Minimal plan for immediate fix
- `preventAutoProgress: false` for rapid deployment
- Add full plan retroactively after crisis

### Cross-Team Projects
- List dependencies in front matter
- Add "External Dependencies" section in Risks
- Include coordination points in Technical Approach
</instructions>

---

## Quick Reference

<instructions>
### Required Sections (in order)
1. **Title**: `# Implementation Project: [Title]`
2. **Problem Statement**: 2-4 sentences
3. **Goals & Objectives**: 3-7 checkbox items
4. **Scope**: Include AND Exclude sections
5. **Framework & Technology Stack**: package@version format
6. **Technical Approach**: Numbered steps with file paths
7. **Dependency Analysis**: High-impact files + integration points
8. **Package Commands**: Validation commands
9. **Risks & Mitigations**: 3-5 technical risks

### Optional Sections
- **Front Matter**: Dependencies or preventAutoProgress
- **Assumption Testing**: 2+ critical unknowns
- **Implementation References**: Helpful code examples

### Key Rules
✅ Verified file paths with line numbers
✅ WHAT to build, not HOW
✅ Exclude v2 features explicitly
❌ No implementation details
❌ No guessed file paths
❌ No vague goals
</instructions>