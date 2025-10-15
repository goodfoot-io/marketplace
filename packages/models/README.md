# @productivity-bot/models

A TypeScript package that provides data models and database operations for a productivity bot system designed to help users with ADHD manage tasks, notes, reminders, and conversations through a conversational AI interface.

## Overview

This package implements a graph-based data model where **lists**, **tasks**, **notes**, **questions**, **reminders**, and **conversations** are nodes that can be connected through directional **edges** with semantic descriptions. The system is designed to dump all data into an AI context window for conversational task management, prioritization, and knowledge management.

## Core Concepts

### Node Types

- **Lists**: Collections of tasks with a title and optional description
- **Tasks**: Individual items within lists that can be completed, with position-based ordering
- **Notes**: Standalone information that can reference or be referenced by other nodes
- **Questions**: Queries attached to any node that can have answers, supporting knowledge capture
- **Reminders**: Time-based notifications with flexible recurrence patterns (daily, weekly, monthly, etc.)
- **Conversations**: Voice interaction sessions with message history and tool call tracking
- **Edges**: Directional relationships between any nodes with optional semantic descriptions

### Key Features

- **Graph Structure**: All entities can link to each other through directional edges
- **AI-Optimized**: Data structures designed for LLM context window consumption
- **ADHD-Friendly**: Supports dynamic prioritization and task management patterns
- **Reminder System**: Flexible scheduling with recurrence patterns and timezone support
- **Conversation Tracking**: Complete history of voice interactions with tool call metadata
- **Knowledge Management**: Questions and answers can be attached to any node
- **Real-time Updates**: PostgreSQL LISTEN/NOTIFY for live graph updates
- **Audit Trail**: All changes are timestamped with created/updated metadata
- **Type Safety**: Full TypeScript support with comprehensive error handling
- **Workspace Isolation**: Multi-tenant support with workspace-based data separation

## Architecture

### Database Schema

The package uses PostgreSQL with the following tables:

- `lists` - To-do lists with titles and descriptions
- `tasks` - Individual tasks belonging to lists with completion status and position
- `notes` - Standalone notes with titles and content
- `questions` - Questions attached to nodes with optional answers
- `reminders` - Scheduled notifications with recurrence patterns
- `reminder_announcements` - Tracking for reminder delivery
- `conversations` - Voice interaction sessions
- `conversation_messages` - Individual messages within conversations
- `edges` - Directional relationships between any nodes

### ID System

All entities use prefixed sequential IDs:

- Lists: `list:1`, `list:2`, etc.
- Tasks: `task:1`, `task:2`, etc.
- Notes: `note:1`, `note:2`, etc.
- Questions: `question:1`, `question:2`, etc.
- Reminders: `reminder:1`, `reminder:2`, etc.
- Conversations: `conversation:1`, `conversation:2`, etc.
- Messages: `conversation_message:1`, `conversation_message:2`, etc.
- Edges: `edge:1`, `edge:2`, etc.

### Error Handling

Custom error types provide specific feedback:

- `ValidationError` - Input validation failures
- `NotFoundError` - Entity not found
- `TitleConflictError` - Duplicate titles (lists and notes must be unique)
- `InvalidIdError` - Malformed entity IDs
- `InvalidParameterError` - Invalid function parameters

## Usage

### Import Paths

This package provides three entry points for different environments:

```typescript
// Server-side imports (Node.js only, includes database operations)
import { initializeDatabase, createListHandlers, ... } from '@productivity-bot/models/server';
// or
import { ... } from '@productivity-bot/models'; // Default export is server-side

// Client-side imports (browser-safe, types and utilities only)
import { List, Task, Note, validateNodeId, TitleConflictError } from '@productivity-bot/models/client';
```

### Basic Setup

```typescript
import {
  initializeDatabase,
  createListHandlers,
  createTaskHandlers,
  createNoteHandlers,
  createQuestionHandlers,
  createEdgeHandlers,
  createGraphHandlers,
  createReminderHandlers,
  createConversationHandlers
} from '@productivity-bot/models';
import postgres from 'postgres';

// Initialize database connection
const sql = postgres('postgresql://...');
await initializeDatabase(sql);

// Create handlers
const { addLists, updateLists, deleteLists, getList } = createListHandlers({ sql });
const { addTasks, updateTasks, deleteTasks, getTask, reorderTasks } = createTaskHandlers({ sql });
const { addNotes, updateNotes, deleteNotes, getNote } = createNoteHandlers({ sql });
const { addQuestions, updateQuestions, deleteQuestions, getQuestion } = createQuestionHandlers({ sql });
const { linkEdges, unlinkEdges } = createEdgeHandlers({ sql });
const { dumpActiveGraph, listenForGraphUpdates } = createGraphHandlers({ sql });
const { createOneTimeReminder, createRecurringReminder, getDueReminders } = createReminderHandlers({ sql });
const { addConversation, endConversation, addConversationMessages } = createConversationHandlers({ sql });
```

### Creating Entities

```typescript
// Create lists
const listIds = await addLists([{ title: 'Work Tasks', body: 'Important work items' }, { title: 'Personal Tasks' }]);

// Create tasks
const taskIds = await addTasks([
  { listId: listIds[0], title: 'Review PR', body: 'Check the new feature implementation' },
  { listId: listIds[0], title: 'Update documentation' }
]);

// Create notes
const noteIds = await addNotes([{ title: 'Meeting Notes', body: "Key decisions from today's standup" }]);
```

### Linking Entities

```typescript
// Create relationships between entities
await linkEdges([
  {
    srcId: taskIds[0],
    dstId: noteIds[0],
    description: 'Task references meeting decisions'
  },
  {
    srcId: listIds[0],
    dstId: noteIds[0],
    description: 'Work list relates to meeting context'
  }
]);
```

### Updating Entities

```typescript
// Update task completion
await updateTasks([{ taskId: taskIds[0], completed: true }]);

// Update list details
await updateLists([{ listId: listIds[0], title: 'Updated Work Tasks', body: 'New description' }]);

// Reorder tasks within a list
await reorderTasks({
  listId: listIds[0],
  taskIds: [taskIds[1], taskIds[0]] // New order
});
```

### Working with Questions

```typescript
// Add questions to any node
await addQuestions([
  {
    srcId: taskIds[0],
    title: 'What is the acceptance criteria?',
    body: 'Need more details about what constitutes completion'
  },
  {
    srcId: noteIds[0],
    title: 'Who were the attendees?'
  }
]);

// Answer questions
await updateQuestions([
  {
    questionId: questionIds[0],
    answer: 'PR must pass all tests and have 2 approvals'
  }
]);
```

### Managing Reminders

```typescript
// Create a one-time reminder
const reminder = await createOneTimeReminder({
  title: 'Team standup',
  body: 'Daily sync with the team',
  dateTime: '2024-01-15T09:00:00Z',
  timezone: 'America/New_York'
});

// Create a recurring reminder
const recurringReminder = await createRecurringReminder({
  title: 'Weekly review',
  body: 'Review completed tasks and plan next week',
  timeOfDay: '16:00',
  startDate: '2024-01-01',
  timezone: 'America/New_York',
  pattern: { type: 'weekly', days: ['FRI'] },
  endDate: '2024-12-31'
});

// Get due reminders
const dueReminders = await getDueReminders({
  windowMinutes: 15 // Get reminders due in next 15 minutes
});
```

### Tracking Conversations

```typescript
// Start a conversation session
const conversationId = await addConversation({
  voiceSessionId: 'session_123',
  userId: 'user_456',
  agentName: 'TaskBot'
});

// Add messages to the conversation
await addConversationMessages([
  {
    conversationId,
    messageId: 'msg_1',
    role: 'user',
    content: 'Create a task to review the PR',
    timestamp: new Date(),
    audioTranscript: true
  },
  {
    conversationId,
    messageId: 'msg_2',
    role: 'assistant',
    content: 'I\'ll create that task for you',
    timestamp: new Date(),
    audioTranscript: false,
    toolCall: {
      name: 'addTasks',
      arguments: { title: 'Review PR' },
      result: { taskId: 'task:123' }
    }
  }
]);

// End the conversation
await endConversation({ conversationId });
```

### Getting AI Context Data

```typescript
// Dump all data for AI context
const contextData = await dumpActiveGraph();

// contextData contains:
// - lists: Array of lists with embedded tasks, questions, and edge information
// - notes: Array of notes with questions and edge information
// - reminders: Array of active reminders with edge information
// - All edges include source/destination metadata for easy traversal

// Listen for real-time graph updates
const unsubscribe = await listenForGraphUpdates('default', (graphData) => {
  console.log('Graph updated:', graphData);
  // React to changes in the graph
});

// Later: stop listening
await unsubscribe();
```

### Deleting Entities

```typescript
// Delete with safety checks
await deleteTasks([taskIds[0]]); // Requires no incoming edges

// Force delete (removes edges automatically)
await deleteLists([listIds[0]], { force: true });
```

## Data Structures

### LLM Context Format

The `dumpActiveGraph()` function returns data optimized for AI consumption:

```typescript
interface LLMContextData {
  lists: LLMList[]; // Lists with embedded tasks, questions, and edge metadata
  notes: LLMNote[]; // Notes with questions and edge metadata
  reminders: LLMReminder[]; // Active reminders with edge metadata
}

interface LLMList {
  id: string;
  title: string;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: LLMTask[]; // All tasks in the list (including completed)
  questions: LLMQuestion[]; // Questions attached to this list
  outgoingEdges: LLMDstEdge[]; // Edges from this list to other nodes
  incomingEdges: LLMSrcEdge[]; // Edges from other nodes to this list
}

interface LLMTask {
  id: string;
  title: string;
  body: string | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  questions: LLMQuestion[]; // Questions attached to this task
  outgoingEdges: LLMDstEdge[];
  incomingEdges: LLMSrcEdge[];
}

interface LLMQuestion {
  id: string;
  title: string;
  body: string | null;
  answer: string | null;
  createdAt: Date;
  updatedAt: Date;
  outgoingEdges: LLMDstEdge[];
  incomingEdges: LLMSrcEdge[];
}

interface LLMReminder {
  id: string;
  title: string;
  body: string | null;
  timeOfDay: string;
  timezone: string;
  startDate: Date;
  endDate: Date | null;
  recurrenceType: 'once' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly';
  weeklyDays: DayOfWeek[] | null;
  monthlyDay: number | null;
  status: 'active' | 'completed' | 'cancelled';
  nextOccurrence: Date;
  outgoingEdges: LLMDstEdge[];
  incomingEdges: LLMSrcEdge[];
}
```

### Edge Metadata

Edges include rich metadata for AI understanding:

```typescript
interface LLMDstEdge {
  id: string;
  dstId: string;
  dstType: 'list' | 'task' | 'note' | 'question' | 'reminder';
  dstTitle: string; // Title of destination node
  description: string | null; // Semantic relationship description
  createdAt: Date;
  updatedAt: Date;
}

interface LLMSrcEdge {
  id: string;
  srcId: string;
  srcType: 'list' | 'task' | 'note' | 'question' | 'reminder';
  srcTitle: string; // Title of source node
  description: string | null; // Semantic relationship description
  createdAt: Date;
  updatedAt: Date;
}
```

## Validation Rules

### Titles

- Must be 1-200 characters
- Automatically trimmed of whitespace
- Must be unique for lists and notes within a workspace
- Tasks can have duplicate titles across different lists
- Questions must be unique per source node

### Tasks

- Must belong to an existing list
- Position is automatically managed
- Active tasks cannot have duplicate titles within the same list
- Completed tasks allow title duplication

### Questions

- Must be attached to an existing node via `srcId`
- Can have optional answers that can be updated later
- Title must be unique per source node

### Reminders

- Time must be in the future for one-time reminders
- Timezone must be valid (checked against PostgreSQL timezone names)
- Recurrence patterns:
  - `once`: Single occurrence
  - `daily`: Every day
  - `weekdays`: Monday through Friday
  - `weekends`: Saturday and Sunday
  - `weekly`: Specific days of the week
  - `monthly`: Specific day of the month (handles months with fewer days)

### Conversations

- Must have a unique voice session ID
- Messages must include timestamp and role
- Tool calls are stored as JSON metadata
- Conversations can be ended only once

### Edges

- Source and destination must exist
- Duplicate edges (same src, dst, workspace) update the description
- Edges are automatically cleaned up when nodes are force-deleted

## Development

### Running Tests

```bash
# Run all tests
yarn test

# Run specific test files
yarn test list.test.ts task.test.ts

# Run with inspection (debugging)
INSPECT=1 yarn test
```

### Linting and Type Checking

```bash
# Run all checks
yarn lint

# Individual checks
yarn prettier  # Format code
yarn eslint    # Lint code
yarn typecheck # Type check
```

### Building

```bash
yarn build
```

## Advanced Usage

### Transaction Support

All handlers support transactions for atomic operations:

```typescript
await sql.begin(async (tx) => {
  const listIds = await addLists([{ title: 'Project Alpha' }], tx);
  const taskIds = await addTasks([
    { listId: listIds[0], title: 'Design phase' },
    { listId: listIds[0], title: 'Implementation' }
  ], tx);
  await linkEdges([
    { srcId: taskIds[0], dstId: taskIds[1], description: 'blocks' }
  ], tx);
  // All operations commit together or rollback on error
});
```

### Workspace Isolation

All operations support workspace isolation for multi-tenant scenarios:

```typescript
const workspaceId = 'team-alpha';

// All operations scoped to workspace
await addLists([{ title: 'Team Tasks' }], { workspaceId });
const contextData = await dumpActiveGraph({ workspaceId });
```

### Real-time Graph Monitoring

Monitor graph changes in real-time using PostgreSQL LISTEN/NOTIFY:

```typescript
// Subscribe to graph updates for a workspace
const unsubscribe = await listenForGraphUpdates('default', async (graphData) => {
  console.log(`Graph updated at ${new Date()}`);
  console.log(`Total lists: ${graphData.lists.length}`);
  console.log(`Total notes: ${graphData.notes.length}`);
  console.log(`Active reminders: ${graphData.reminders.filter(r => r.status === 'active').length}`);

  // Trigger AI analysis, UI updates, etc.
  await analyzeGraphChanges(graphData);
});

// Clean up when done
process.on('SIGINT', async () => {
  await unsubscribe();
  process.exit();
});
```

## API Reference

### Database Operations

#### `initializeDatabase(sql: PostgresConnection): Promise<void>`
Initializes the database schema. Must be called before using other functions.

### List Handlers

#### `createListHandlers({ sql })`
Returns handlers for list operations:
- `addLists(lists, workspaceId?)`: Create multiple lists with optional tasks
- `updateLists(updates, workspaceId?)`: Update list titles and descriptions
- `deleteLists(listIds, workspaceId?)`: Delete lists (cascades to tasks)
- `getList(id, workspaceId?)`: Retrieve a single list by ID

### Task Handlers

#### `createTaskHandlers({ sql })`
Returns handlers for task operations:
- `addTasks(tasksData, workspaceId?)`: Create multiple tasks
- `updateTasks(updates, workspaceId?)`: Update task properties
- `deleteTasks(taskIds, workspaceId?)`: Delete tasks
- `reorderTasks(listId, taskIds, workspaceId?)`: Reorder tasks within a list
- `getTask(id, workspaceId?)`: Retrieve a single task by ID

### Note Handlers

#### `createNoteHandlers({ sql })`
Returns handlers for note operations:
- `addNotes(notes, workspaceId?)`: Create multiple notes
- `updateNotes(updates, workspaceId?)`: Update note content
- `deleteNotes(noteIds, workspaceId?)`: Delete notes
- `getNote(id, workspaceId?)`: Retrieve a single note by ID

### Question Handlers

#### `createQuestionHandlers({ sql })`
Returns handlers for question operations:
- `addQuestions(questions, workspaceId?)`: Attach questions to nodes
- `updateQuestions(updates, workspaceId?)`: Update questions or add answers
- `deleteQuestions(questionIds, workspaceId?)`: Remove questions
- `getQuestion(id, workspaceId?)`: Retrieve a single question by ID

### Reminder Handlers

#### `createReminderHandlers({ sql })`
Returns handlers for reminder operations:
- `createOneTimeReminder(params)`: Create a single-occurrence reminder
- `createRecurringReminder(params)`: Create a recurring reminder
- `updateReminder(reminderId, updates, workspaceId?)`: Update reminder properties
- `cancelReminder(reminderId, workspaceId?)`: Cancel an active reminder
- `getDueReminders(windowMinutes, workspaceId?)`: Get reminders due within time window
- `markReminderAnnounced(reminderId, workspaceId?)`: Record reminder announcement

### Conversation Handlers

#### `createConversationHandlers({ sql })`
Returns handlers for conversation tracking:
- `addConversation(params)`: Start a new conversation session
- `endConversation(conversationId, workspaceId?)`: End an active conversation
- `addConversationMessages(messagesData, workspaceId?)`: Add messages to conversation
- `getConversation(id, workspaceId?)`: Retrieve conversation with messages

### Edge Handlers

#### `createEdgeHandlers({ sql })`
Returns handlers for graph edges:
- `linkEdges(edges, workspaceId?)`: Create or update edges between nodes
- `unlinkEdges(edgeIds, workspaceId?)`: Remove edges

### Graph Handlers

#### `createGraphHandlers({ sql })`
Returns handlers for graph operations:
- `dumpActiveGraph(workspaceId?)`: Get complete graph data for AI context
- `listenForGraphUpdates(workspaceId, callback)`: Subscribe to real-time updates

## Design Philosophy

This package is designed specifically for ADHD-friendly task management through conversational AI:

1. **Simple Schema**: Minimal metadata, maximum flexibility through text descriptions
2. **Graph Flexibility**: Any node can link to any other node with semantic meaning
3. **AI-First**: Data structures optimized for LLM context consumption
4. **Audit-Ready**: All changes are timestamped for pattern analysis
5. **Type Safety**: Comprehensive TypeScript support prevents runtime errors
6. **Batch Operations**: Efficient bulk operations for better performance
7. **Real-time Updates**: Live graph monitoring for reactive applications
8. **Multi-tenancy**: Built-in workspace isolation for team deployments

The goal is to provide a robust foundation for an AI agent that can understand, manipulate, and reason about a user's productivity data in a natural, conversational way.
