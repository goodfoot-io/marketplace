import type { PostgresConnection, PostgresTransactionConnection } from './database.js';
import type { Edge } from './edge.js';
import type { List } from './list.js';
import type { Note } from './note.js';
import type { Question } from './question.js';
import type { Reminder } from './reminder.js';
import type { Task } from './task.js';
import { getNodeTypeFromId } from './lib/ids.js';

export interface GraphNodeBase {
  id: string;
  title: string;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphList extends GraphNodeBase {
  type: 'list';
}
export interface GraphTask extends GraphNodeBase {
  type: 'task';
  listId: string;
  completed: boolean;
  position: number;
}
export interface GraphNote extends GraphNodeBase {
  type: 'note';
}
export interface GraphQuestion extends GraphNodeBase {
  type: 'question';
  srcId: string;
  answer: string | null;
}

export interface GraphReminder extends GraphNodeBase {
  type: 'reminder';
  timeOfDay: string;
  timezone: string;
  startDate: Date;
  endDate: Date | null;
  recurrenceType: 'once' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly';
  weeklyDays: ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN')[] | null;
  monthlyDay: number | null;
  status: 'active' | 'completed' | 'cancelled';
  lastTriggered: Date | null;
  nextOccurrence: Date;
  createdBy: string;
}

export type GraphNode = GraphList | GraphTask | GraphNote | GraphQuestion | GraphReminder;

export interface GraphEdge {
  id: string;
  type: 'edge';
  srcId: string;
  dstId: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LLMContextData {
  lists: LLMList[];
  notes: LLMNote[];
  reminders: LLMReminder[];
}

export interface LLMList {
  id: string;
  title: string;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: LLMTask[];
  outgoingEdges: LLMDstEdge[];
  incomingEdges: LLMSrcEdge[];
  questions: LLMQuestion[];
}

export interface LLMTask {
  id: string;
  title: string;
  body: string | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  outgoingEdges: LLMDstEdge[];
  incomingEdges: LLMSrcEdge[];
  questions: LLMQuestion[];
}

export interface LLMNote {
  id: string;
  title: string;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  outgoingEdges: LLMDstEdge[];
  incomingEdges: LLMSrcEdge[];
  questions: LLMQuestion[];
}

export interface LLMQuestion {
  id: string;
  title: string;
  body: string | null;
  answer: string | null;
  createdAt: Date;
  updatedAt: Date;
  outgoingEdges: LLMDstEdge[];
  incomingEdges: LLMSrcEdge[];
}

export interface LLMReminder {
  id: string;
  title: string;
  body: string | null;
  timeOfDay: string;
  timezone: string;
  startDate: Date;
  endDate: Date | null;
  recurrenceType: 'once' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly';
  weeklyDays: ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN')[] | null;
  monthlyDay: number | null;
  status: 'active' | 'completed' | 'cancelled';
  lastTriggered: Date | null;
  nextOccurrence: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  outgoingEdges: LLMDstEdge[];
  incomingEdges: LLMSrcEdge[];
}

export interface LLMSrcEdge {
  id: string;
  srcId: string;
  srcType: 'list' | 'task' | 'note' | 'question' | 'reminder';
  srcTitle: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LLMDstEdge {
  id: string;
  dstId: string;
  dstType: 'list' | 'task' | 'note' | 'question' | 'reminder';
  dstTitle: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createGraphHandlers({ sql }: { sql: PostgresConnection }) {
  async function dumpActiveGraph(
    {
      workspaceId = 'default'
    }: {
      workspaceId?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<LLMContextData> {
    // Fetch all data in parallel, including all tasks (not just active ones)
    const [lists, tasks, notes, questions, reminders, edges] = await Promise.all([
      _sql<List[]>`SELECT * FROM lists WHERE workspace_id = ${workspaceId} ORDER BY created_at ASC`,
      _sql<Task[]>`SELECT * FROM tasks WHERE workspace_id = ${workspaceId} ORDER BY list_id ASC, "position" ASC`,
      _sql<Note[]>`SELECT * FROM notes WHERE workspace_id = ${workspaceId} ORDER BY created_at ASC`,
      _sql<Question[]>`SELECT * FROM questions WHERE workspace_id = ${workspaceId} ORDER BY created_at ASC`,
      _sql<
        Reminder[]
      >`SELECT *, time_of_day::TEXT, array_to_json(weekly_days) as weekly_days FROM reminders WHERE workspace_id = ${workspaceId} ORDER BY created_at ASC`,
      _sql<Edge[]>`SELECT * FROM edges WHERE workspace_id = ${workspaceId} ORDER BY created_at ASC`
    ]);

    // Create node lookup map for efficient edge enrichment
    const nodeMap = new Map<string, { type: 'list' | 'task' | 'note' | 'question' | 'reminder'; title: string }>();
    lists.forEach((list) => nodeMap.set(list.id, { type: 'list', title: list.title }));
    tasks.forEach((task) => nodeMap.set(task.id, { type: 'task', title: task.title }));
    notes.forEach((note) => nodeMap.set(note.id, { type: 'note', title: note.title }));
    questions.forEach((question) => nodeMap.set(question.id, { type: 'question', title: question.title }));
    reminders.forEach((reminder) => nodeMap.set(reminder.id, { type: 'reminder', title: reminder.title }));

    // Group edges by source and destination for efficient processing
    const outgoingEdgesBySource = new Map<string, Edge[]>();
    const incomingEdgesByDestination = new Map<string, Edge[]>();

    edges.forEach((edge) => {
      if (!outgoingEdgesBySource.has(edge.srcId)) {
        outgoingEdgesBySource.set(edge.srcId, []);
      }
      outgoingEdgesBySource.get(edge.srcId)!.push(edge);

      if (!incomingEdgesByDestination.has(edge.dstId)) {
        incomingEdgesByDestination.set(edge.dstId, []);
      }
      incomingEdgesByDestination.get(edge.dstId)!.push(edge);
    });

    // Edge transformation helpers
    const transformSrcEdge = (edge: Edge): LLMSrcEdge => {
      const srcNode = nodeMap.get(edge.srcId);
      const nodeType = srcNode?.type || getNodeTypeFromId(edge.srcId);
      const srcType: 'list' | 'task' | 'note' | 'question' | 'reminder' =
        nodeType === 'edge' || nodeType === 'conversation' || nodeType === 'conversation_message'
          ? 'note'
          : nodeType === 'reminder'
            ? 'reminder'
            : nodeType;
      const srcTitle = srcNode?.title || `[Deleted ${srcType}]`;

      return {
        id: edge.id,
        srcId: edge.srcId,
        srcType,
        srcTitle,
        description: edge.description,
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt
      };
    };

    const transformDstEdge = (edge: Edge): LLMDstEdge => {
      const dstNode = nodeMap.get(edge.dstId);
      const nodeType = dstNode?.type || getNodeTypeFromId(edge.dstId);
      const dstType: 'list' | 'task' | 'note' | 'question' | 'reminder' =
        nodeType === 'edge' || nodeType === 'conversation' || nodeType === 'conversation_message'
          ? 'note'
          : nodeType === 'reminder'
            ? 'reminder'
            : nodeType;
      const dstTitle = dstNode?.title || `[Deleted ${dstType}]`;

      return {
        id: edge.id,
        dstId: edge.dstId,
        dstType,
        dstTitle,
        description: edge.description,
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt
      };
    };

    // Edge helper functions
    const transformOutgoingEdges = (sourceId: string): LLMDstEdge[] => {
      const sourceEdges = outgoingEdgesBySource.get(sourceId) || [];
      return sourceEdges.map(transformDstEdge);
    };

    const transformIncomingEdges = (destinationId: string): LLMSrcEdge[] => {
      const destinationEdges = incomingEdgesByDestination.get(destinationId) || [];
      return destinationEdges.map(transformSrcEdge);
    };

    // Group questions by their source entity
    const questionsBySource = new Map<string, Question[]>();
    questions.forEach((question) => {
      if (!questionsBySource.has(question.srcId)) {
        questionsBySource.set(question.srcId, []);
      }
      questionsBySource.get(question.srcId)!.push(question);
    });

    // Helper function to transform questions for embedding
    const transformQuestions = (sourceId: string): LLMQuestion[] => {
      const sourceQuestions = questionsBySource.get(sourceId) || [];
      return sourceQuestions.map((question) => ({
        id: question.id,
        title: question.title,
        body: question.body,
        answer: question.answer,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        outgoingEdges: transformOutgoingEdges(question.id),
        incomingEdges: transformIncomingEdges(question.id)
      }));
    };

    // Group tasks by list
    const tasksByList = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (!tasksByList.has(task.listId)) {
        tasksByList.set(task.listId, []);
      }
      tasksByList.get(task.listId)!.push(task);
    });

    // Transform lists with embedded tasks and questions
    const llmLists: LLMList[] = lists.map((list) => {
      const listTasks = tasksByList.get(list.id) || [];
      const outgoingEdges = transformOutgoingEdges(list.id);
      const incomingEdges = transformIncomingEdges(list.id);
      const questions = transformQuestions(list.id);

      const transformedTasks = listTasks.map((task) => {
        const taskOutgoing = transformOutgoingEdges(task.id);
        const taskIncoming = transformIncomingEdges(task.id);
        const taskQuestions = transformQuestions(task.id);

        return {
          id: task.id,
          title: task.title,
          body: task.body,
          completed: task.completed,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          outgoingEdges: taskOutgoing,
          incomingEdges: taskIncoming,
          questions: taskQuestions
        };
      });

      return {
        id: list.id,
        title: list.title,
        body: list.body,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
        tasks: transformedTasks,
        outgoingEdges: outgoingEdges,
        incomingEdges: incomingEdges,
        questions: questions
      };
    });

    // Transform notes with embedded edges and questions
    const llmNotes: LLMNote[] = notes.map((note) => {
      const outgoingEdges = transformOutgoingEdges(note.id);
      const incomingEdges = transformIncomingEdges(note.id);
      const questions = transformQuestions(note.id);

      return {
        id: note.id,
        title: note.title,
        body: note.body,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        outgoingEdges: outgoingEdges,
        incomingEdges: incomingEdges,
        questions: questions
      };
    });

    // Transform reminders with embedded edges
    const llmReminders: LLMReminder[] = reminders.map((reminder) => {
      const outgoingEdges = transformOutgoingEdges(reminder.id);
      const incomingEdges = transformIncomingEdges(reminder.id);

      return {
        id: reminder.id,
        title: reminder.title,
        body: reminder.body,
        timeOfDay: reminder.timeOfDay,
        timezone: reminder.timezone,
        startDate: reminder.startDate,
        endDate: reminder.endDate,
        recurrenceType: reminder.recurrenceType,
        weeklyDays: reminder.weeklyDays,
        monthlyDay: reminder.monthlyDay,
        status: reminder.status,
        lastTriggered: reminder.lastTriggered,
        nextOccurrence: reminder.nextOccurrence,
        createdBy: reminder.createdBy,
        createdAt: reminder.createdAt,
        updatedAt: reminder.updatedAt,
        outgoingEdges: outgoingEdges,
        incomingEdges: incomingEdges
      };
    });

    // Return structure - always include lists, notes, and reminders arrays
    return {
      lists: llmLists,
      notes: llmNotes,
      reminders: llmReminders
    };
  }

  // Shared state for the consolidated listener
  const workspaceCallbacks = new Map<string, Set<(graphData: LLMContextData) => void>>();
  let sharedListener: Awaited<ReturnType<typeof sql.listen>> | null = null;
  let listenerCount = 0;

  async function listenForGraphUpdates(
    workspaceId: string,
    callback: (graphData: LLMContextData) => void
  ): Promise<() => Promise<void>> {
    // Add callback to the map
    if (!workspaceCallbacks.has(workspaceId)) {
      workspaceCallbacks.set(workspaceId, new Set());
    }
    workspaceCallbacks.get(workspaceId)!.add(callback);
    listenerCount++;

    // Create the shared listener if it doesn't exist
    if (!sharedListener) {
      sharedListener = await sql.listen('graph_updated', async (payloadStr) => {
        try {
          const payload = JSON.parse(payloadStr) as { workspace_id: string; table_name: string; operation: string };

          // Get callbacks for this workspace
          const callbacks = workspaceCallbacks.get(payload.workspace_id);
          if (callbacks && callbacks.size > 0) {
            // Fetch the updated graph data once for all callbacks
            const graphData = await dumpActiveGraph({ workspaceId: payload.workspace_id });

            // Call all callbacks for this workspace
            for (const cb of callbacks) {
              try {
                cb(graphData);
              } catch (e) {
                console.error('Error in graph update callback:', e);
              }
            }
          }
        } catch (e) {
          console.error('Error parsing pg_notify payload for graph update:', e);
        }
      });
    }

    // Return unsubscribe function
    return async () => {
      const callbacks = workspaceCallbacks.get(workspaceId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          workspaceCallbacks.delete(workspaceId);
        }
      }

      listenerCount--;

      // Clean up the shared listener if no more callbacks
      if (listenerCount === 0 && sharedListener) {
        await sharedListener.unlisten();
        sharedListener = null;
      }
    };
  }

  return { dumpActiveGraph, listenForGraphUpdates };
}
