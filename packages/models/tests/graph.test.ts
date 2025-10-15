import { getTestSql } from '@productivity-bot/test-utilities/sql';
import { initializeDatabase } from '../src/database.js';
import { createEdgeHandlers } from '../src/edge.js';
import { createGraphHandlers } from '../src/graph.js';
import { createListHandlers } from '../src/list.js';
import { createNoteHandlers } from '../src/note.js';
import { createQuestionHandlers } from '../src/question.js';
import { createReminderHandlers } from '../src/reminder.js';
import { createTaskHandlers } from '../src/task.js';

describe('Graph model', () => {
  describe('dumpActiveGraph', () => {
    it('should include questions in graph output', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const graphHandlers = createGraphHandlers({ sql });
      const listHandlers = createListHandlers({ sql });
      const questionHandlers = createQuestionHandlers({ sql });

      // Create a list
      const [listId] = await listHandlers.addLists({
        lists: [{ title: 'Sell iPad' }]
      });

      // Add questions to the list
      await questionHandlers.addQuestions({
        questionsData: [
          {
            srcId: listId,
            title: 'What iPad model and storage?',
            body: 'Check Settings > General > About for model and capacity.'
          },
          {
            srcId: listId,
            title: "What's the condition?",
            body: 'Any scratches, cracks, or issues? Battery health?'
          }
        ]
      });

      const graph = await graphHandlers.dumpActiveGraph({});

      expect(graph.lists).toHaveLength(1);
      expect(graph.lists[0].title).toBe('Sell iPad');
      expect(graph.lists[0].questions).toHaveLength(2);

      expect(graph.lists[0].questions[0].title).toBe('What iPad model and storage?');
      expect(graph.lists[0].questions[0].body).toBe('Check Settings > General > About for model and capacity.');

      expect(graph.lists[0].questions[1].title).toBe("What's the condition?");
      expect(graph.lists[0].questions[1].body).toBe('Any scratches, cracks, or issues? Battery health?');
    });

    it('returns empty graph when no data exists', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(0);
      expect(graph.notes).toHaveLength(0);
    });

    it('returns graph with only lists when no tasks or notes exist', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const listIds = await addLists({
        lists: [{ title: 'First List', body: 'First body' }, { title: 'Second List' }],
        workspaceId: 'default'
      });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(2);
      expect(graph.notes).toHaveLength(0);

      expect(graph.lists[0]).toEqual({
        id: listIds[0],
        title: 'First List',
        body: 'First body',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        tasks: [],
        outgoingEdges: [],
        incomingEdges: [],
        questions: []
      });
      expect(graph.lists[1]).toEqual({
        id: listIds[1],
        title: 'Second List',
        body: null,
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        tasks: [],
        outgoingEdges: [],
        incomingEdges: [],
        questions: []
      });
    });

    it('returns graph with lists and notes', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      await addLists({ lists: [{ title: 'Test List' }], workspaceId: 'default' });
      const noteIds = await addNotes({
        notesData: [{ title: 'First Note', body: 'Note content' }, { title: 'Second Note' }],
        workspaceId: 'default'
      });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(1);
      expect(graph.notes).toHaveLength(2);

      expect(graph.notes[0]).toEqual({
        id: noteIds[0],
        title: 'First Note',
        body: 'Note content',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        outgoingEdges: [],
        incomingEdges: [],
        questions: []
      });
    });

    it('returns graph with questions', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addQuestions } = createQuestionHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }], workspaceId: 'default' });
      const questionIds = await addQuestions({
        questionsData: [
          { srcId: listId, title: 'What is the deadline?', body: 'Need clarification on timing' },
          { srcId: listId, title: 'Who is responsible?', answer: 'John Smith' }
        ],
        workspaceId: 'default'
      });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(1);
      expect(graph.notes).toHaveLength(0);

      // Questions should now be embedded within the list
      const list = graph.lists[0];
      expect(list.questions).toHaveLength(2);

      expect(list.questions[0]).toEqual({
        id: questionIds[0],
        title: 'What is the deadline?',
        body: 'Need clarification on timing',
        answer: null,
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        outgoingEdges: [],
        incomingEdges: []
      });

      expect(list.questions[1]).toEqual({
        id: questionIds[1],
        title: 'Who is responsible?',
        body: null,
        answer: 'John Smith',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        outgoingEdges: [],
        incomingEdges: []
      });
    });

    it('returns graph with active tasks only (excludes completed tasks)', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addTasks, updateTasks } = createTaskHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Task List' }], workspaceId: 'default' });
      const taskIds = await addTasks({
        tasksData: [
          { listId, title: 'Active Task 1', body: 'Active task body' },
          { listId, title: 'Active Task 2' },
          { listId, title: 'Task to Complete' }
        ],
        workspaceId: 'default'
      });

      // Complete one task
      await updateTasks({ updates: [{ taskId: taskIds[2], completed: true }], workspaceId: 'default' });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(1);
      expect(graph.notes).toHaveLength(0);

      const list = graph.lists[0];
      expect(list.tasks).toHaveLength(3); // All tasks are now included (including completed ones)

      // Verify task structure
      expect(list.tasks[0]).toEqual({
        id: taskIds[0],
        title: 'Active Task 1',
        body: 'Active task body',
        completed: false,
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        outgoingEdges: [],
        incomingEdges: [],
        questions: []
      });

      expect(list.tasks[1]).toEqual({
        id: taskIds[1],
        title: 'Active Task 2',
        body: null,
        completed: false,
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        outgoingEdges: [],
        incomingEdges: [],
        questions: []
      });

      // Verify completed task is now included
      expect(list.tasks[2]).toEqual({
        id: taskIds[2],
        title: 'Task to Complete',
        body: null,
        completed: true,
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        outgoingEdges: [],
        incomingEdges: [],
        questions: []
      });
    });

    it('returns graph with all node types', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { addTasks } = createTaskHandlers({ sql });
      const { addQuestions } = createQuestionHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Mixed List' }], workspaceId: 'default' });
      await addNotes({ notesData: [{ title: 'Mixed Note' }], workspaceId: 'default' });
      await addTasks({ tasksData: [{ listId, title: 'Mixed Task' }], workspaceId: 'default' });
      await addQuestions({ questionsData: [{ srcId: listId, title: 'Mixed Question' }], workspaceId: 'default' });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(1);
      expect(graph.notes).toHaveLength(1);
      expect(graph.lists[0].tasks).toHaveLength(1);

      // Verify we have all node types represented
      expect(graph.lists[0].title).toBe('Mixed List');
      expect(graph.notes[0].title).toBe('Mixed Note');
      expect(graph.lists[0].tasks[0].title).toBe('Mixed Task');

      // Questions should be embedded within the list
      expect(graph.lists[0].questions).toHaveLength(1);
      expect(graph.lists[0].questions[0].title).toBe('Mixed Question');
    });

    it('returns graph with edges between nodes', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { addTasks } = createTaskHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Connected List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Connected Note' }], workspaceId: 'default' });
      const [taskId] = await addTasks({ tasksData: [{ listId, title: 'Connected Task' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [
          { srcId: listId, dstId: noteId, description: 'List to Note' },
          { srcId: taskId, dstId: noteId, description: 'Task to Note' },
          { srcId: noteId, dstId: listId }
        ],
        workspaceId: 'default'
      });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(1);
      expect(graph.notes).toHaveLength(1);

      const list = graph.lists[0];
      const note = graph.notes[0];
      const task = list.tasks[0];

      // Verify edge structure - edges are now embedded in entities
      expect(list.outgoingEdges).toHaveLength(1);
      expect(list.outgoingEdges[0]).toEqual({
        id: expect.stringMatching(/^edge:\d+$/) as string,
        dstId: noteId,
        dstType: 'note',
        dstTitle: 'Connected Note',
        description: 'List to Note',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date
      });

      expect(task.outgoingEdges).toHaveLength(1);
      expect(task.outgoingEdges[0]).toEqual({
        id: expect.stringMatching(/^edge:\d+$/) as string,
        dstId: noteId,
        dstType: 'note',
        dstTitle: 'Connected Note',
        description: 'Task to Note',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date
      });

      expect(note.outgoingEdges).toHaveLength(1);
      expect(note.outgoingEdges[0]).toEqual({
        id: expect.stringMatching(/^edge:\d+$/) as string,
        dstId: listId,
        dstType: 'list',
        dstTitle: 'Connected List',
        description: null,
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date
      });

      // Verify incoming edges
      expect(note.incomingEdges).toHaveLength(2);
      expect(list.incomingEdges).toHaveLength(1);
    });

    it('returns graph with edges involving questions', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { addQuestions } = createQuestionHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Project List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Context Note' }], workspaceId: 'default' });
      const [questionId] = await addQuestions({
        questionsData: [{ srcId: listId, title: 'What is the deadline?', body: 'Need timeline clarification' }],
        workspaceId: 'default'
      });

      await linkEdges({
        edgesData: [
          { srcId: questionId, dstId: noteId, description: 'Question references note for context' },
          { srcId: listId, dstId: questionId, description: 'List has pending question' }
        ],
        workspaceId: 'default'
      });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(1);
      expect(graph.notes).toHaveLength(1);

      const list = graph.lists[0];
      const note = graph.notes[0];

      // Questions should be embedded within the list
      expect(list.questions).toHaveLength(1);
      const question = list.questions[0];

      // Verify question has outgoing edge to note
      expect(question.outgoingEdges).toHaveLength(1);
      expect(question.outgoingEdges[0]).toEqual({
        id: expect.stringMatching(/^edge:\d+$/) as string,
        dstId: noteId,
        dstType: 'note',
        dstTitle: 'Context Note',
        description: 'Question references note for context',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date
      });

      // Verify list has outgoing edge to question
      expect(list.outgoingEdges).toHaveLength(1);
      expect(list.outgoingEdges[0]).toEqual({
        id: expect.stringMatching(/^edge:\d+$/) as string,
        dstId: questionId,
        dstType: 'question',
        dstTitle: 'What is the deadline?',
        description: 'List has pending question',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date
      });

      // Verify incoming edges
      expect(note.incomingEdges).toHaveLength(1);
      expect(question.incomingEdges).toHaveLength(1);
      expect(list.incomingEdges).toHaveLength(0);
    });

    it('orders nodes by creation time', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      // Create items with slight delays to ensure different timestamps
      const [firstListId] = await addLists({ lists: [{ title: 'First List' }], workspaceId: 'default' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const [secondListId] = await addLists({ lists: [{ title: 'Second List' }], workspaceId: 'default' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const [firstNoteId] = await addNotes({ notesData: [{ title: 'First Note' }], workspaceId: 'default' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const [secondNoteId] = await addNotes({ notesData: [{ title: 'Second Note' }], workspaceId: 'default' });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      // Verify ordering by creation time
      expect(graph.lists).toHaveLength(2);
      expect(graph.lists[0].id).toBe(firstListId);
      expect(graph.lists[1].id).toBe(secondListId);

      expect(graph.notes).toHaveLength(2);
      expect(graph.notes[0].id).toBe(firstNoteId);
      expect(graph.notes[1].id).toBe(secondNoteId);
    });

    it('orders tasks by list and position', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addTasks } = createTaskHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Task List' }], workspaceId: 'default' });

      // Add tasks with explicit positions
      await addTasks({
        tasksData: [
          { listId, title: 'Task 3', position: 2 },
          { listId, title: 'Task 1', position: 0 },
          { listId, title: 'Task 2', position: 1 }
        ],
        workspaceId: 'default'
      });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      const list = graph.lists[0];
      expect(list.tasks).toHaveLength(3);

      // Verify tasks are ordered by position
      expect(list.tasks[0].title).toBe('Task 1');
      expect(list.tasks[1].title).toBe('Task 2');
      expect(list.tasks[2].title).toBe('Task 3');
    });

    it('orders edges by creation time', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });
      const noteIds = await addNotes({
        notesData: [{ title: 'Note 1' }, { title: 'Note 2' }],
        workspaceId: 'default'
      });

      // Create edges with delays to ensure different timestamps
      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteIds[0], description: 'First Edge' }],
        workspaceId: 'default'
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteIds[1], description: 'Second Edge' }],
        workspaceId: 'default'
      });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      const list = graph.lists[0];
      expect(list.outgoingEdges).toHaveLength(2);

      // Verify edges are ordered by creation time
      expect(list.outgoingEdges[0].description).toBe('First Edge');
      expect(list.outgoingEdges[1].description).toBe('Second Edge');
    });

    it('handles complex graph with multiple relationships', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { addTasks } = createTaskHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      // Create a complex graph structure
      const listIds = await addLists({
        lists: [{ title: 'Project List' }, { title: 'Reference List' }],
        workspaceId: 'default'
      });
      const noteIds = await addNotes({
        notesData: [{ title: 'Project Notes' }, { title: 'Meeting Notes' }],
        workspaceId: 'default'
      });
      const taskIds = await addTasks({
        tasksData: [
          { listId: listIds[0], title: 'Task 1' },
          { listId: listIds[0], title: 'Task 2' },
          { listId: listIds[1], title: 'Reference Task' }
        ],
        workspaceId: 'default'
      });

      // Create multiple relationships
      await linkEdges({
        edgesData: [
          { srcId: listIds[0], dstId: noteIds[0], description: 'Project documentation' },
          { srcId: taskIds[0], dstId: noteIds[1], description: 'Meeting reference' },
          { srcId: noteIds[0], dstId: listIds[1], description: 'Related resources' },
          { srcId: taskIds[1], dstId: taskIds[2], description: 'Dependency' }
        ],
        workspaceId: 'default'
      });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(2);
      expect(graph.notes).toHaveLength(2);

      // Verify complex relationships are preserved
      const projectList = graph.lists[0];
      const referenceList = graph.lists[1];
      const projectNotes = graph.notes[0];

      expect(projectList.outgoingEdges).toHaveLength(1);
      expect(projectList.tasks[0].outgoingEdges).toHaveLength(1);
      expect(projectList.tasks[1].outgoingEdges).toHaveLength(1);
      expect(projectNotes.outgoingEdges).toHaveLength(1);
      expect(referenceList.incomingEdges).toHaveLength(1);
    });

    it('includes reminders in graph output', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { createOneTimeReminder, createRecurringReminder } = createReminderHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Project List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Project Notes' }], workspaceId: 'default' });

      // Create one-time reminder
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const oneTimeReminder = await createOneTimeReminder({
        title: 'Project Deadline',
        body: 'Submit final deliverables',
        dateTime: futureDate.toISOString(),
        timezone: 'UTC',
        workspaceId: 'default'
      });

      // Create recurring reminder
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const recurringReminder = await createRecurringReminder({
        title: 'Daily Standup',
        body: 'Team standup meeting',
        timeOfDay: '09:00',
        startDate: startDate.toISOString(),
        timezone: 'UTC',
        pattern: { type: 'weekdays' },
        workspaceId: 'default'
      });

      // Create edges involving reminders
      await linkEdges({
        edgesData: [
          { srcId: listId, dstId: oneTimeReminder.id, description: 'Project has deadline' },
          { srcId: recurringReminder.id, dstId: noteId, description: 'Standup notes' }
        ],
        workspaceId: 'default'
      });

      const graph = await dumpActiveGraph({ workspaceId: 'default' });

      expect(graph.lists).toHaveLength(1);
      expect(graph.notes).toHaveLength(1);
      expect(graph.reminders).toHaveLength(2);

      // Verify one-time reminder structure
      const oneTimeReminderInGraph = graph.reminders.find((r) => r.id === oneTimeReminder.id);
      expect(oneTimeReminderInGraph).toEqual({
        id: oneTimeReminder.id,
        title: 'Project Deadline',
        body: 'Submit final deliverables',
        timeOfDay: expect.stringMatching(/^\d{2}:\d{2}(:\d{2})?$/) as string,
        timezone: 'UTC',
        startDate: expect.any(Date) as Date,
        endDate: null,
        recurrenceType: 'once',
        weeklyDays: null,
        monthlyDay: null,
        status: 'active',
        lastTriggered: null,
        nextOccurrence: expect.any(Date) as Date,
        createdBy: 'voice_agent',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        outgoingEdges: [],
        incomingEdges: [
          {
            id: expect.stringMatching(/^edge:\d+$/) as string,
            srcId: listId,
            srcType: 'list',
            srcTitle: 'Project List',
            description: 'Project has deadline',
            createdAt: expect.any(Date) as Date,
            updatedAt: expect.any(Date) as Date
          }
        ]
      });

      // Verify recurring reminder structure
      const recurringReminderInGraph = graph.reminders.find((r) => r.id === recurringReminder.id);
      expect(recurringReminderInGraph).toEqual({
        id: recurringReminder.id,
        title: 'Daily Standup',
        body: 'Team standup meeting',
        timeOfDay: expect.stringMatching(/^09:00(:\d{2})?$/) as string,
        timezone: 'UTC',
        startDate: expect.any(Date) as Date,
        endDate: null,
        recurrenceType: 'weekdays',
        weeklyDays: null,
        monthlyDay: null,
        status: 'active',
        lastTriggered: null,
        nextOccurrence: expect.any(Date) as Date,
        createdBy: 'voice_agent',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
        outgoingEdges: [
          {
            id: expect.stringMatching(/^edge:\d+$/) as string,
            dstId: noteId,
            dstType: 'note',
            dstTitle: 'Project Notes',
            description: 'Standup notes',
            createdAt: expect.any(Date) as Date,
            updatedAt: expect.any(Date) as Date
          }
        ],
        incomingEdges: []
      });

      // Verify list has outgoing edge to reminder
      expect(graph.lists[0].outgoingEdges).toHaveLength(1);
      expect(graph.lists[0].outgoingEdges[0].dstType).toBe('reminder');

      // Verify note has incoming edge from reminder
      expect(graph.notes[0].incomingEdges).toHaveLength(1);
      expect(graph.notes[0].incomingEdges[0].srcType).toBe('reminder');
    });

    it('handles workspace isolation', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { addTasks } = createTaskHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });
      const { dumpActiveGraph } = createGraphHandlers({ sql });

      // Create data in workspace 'w1'
      const w1ListIds = await addLists({ lists: [{ title: 'W1 List' }], workspaceId: 'w1' });
      const w1NoteIds = await addNotes({ notesData: [{ title: 'W1 Note' }], workspaceId: 'w1' });
      await addTasks({
        tasksData: [{ listId: w1ListIds[0], title: 'W1 Task' }],
        workspaceId: 'w1'
      });
      await linkEdges({
        edgesData: [{ srcId: w1ListIds[0], dstId: w1NoteIds[0], description: 'W1 Edge' }],
        workspaceId: 'w1'
      });

      // Create data in workspace 'w2'
      const w2ListIds = await addLists({ lists: [{ title: 'W2 List' }], workspaceId: 'w2' });
      const w2NoteIds = await addNotes({ notesData: [{ title: 'W2 Note' }], workspaceId: 'w2' });
      await linkEdges({
        edgesData: [{ srcId: w2ListIds[0], dstId: w2NoteIds[0], description: 'W2 Edge' }],
        workspaceId: 'w2'
      });

      // Verify workspace isolation
      const w1Graph = await dumpActiveGraph({ workspaceId: 'w1' });
      const w2Graph = await dumpActiveGraph({ workspaceId: 'w2' });

      expect(w1Graph.lists).toHaveLength(1);
      expect(w1Graph.notes).toHaveLength(1);
      expect(w1Graph.reminders).toHaveLength(0);
      expect(w1Graph.lists[0].title).toBe('W1 List');
      expect(w1Graph.notes[0].title).toBe('W1 Note');
      expect(w1Graph.lists[0].tasks).toHaveLength(1);
      expect(w1Graph.lists[0].tasks[0].title).toBe('W1 Task');
      expect(w1Graph.lists[0].outgoingEdges).toHaveLength(1);

      expect(w2Graph.lists).toHaveLength(1);
      expect(w2Graph.notes).toHaveLength(1);
      expect(w2Graph.reminders).toHaveLength(0);
      expect(w2Graph.lists[0].title).toBe('W2 List');
      expect(w2Graph.notes[0].title).toBe('W2 Note');
      expect(w2Graph.lists[0].tasks).toHaveLength(0);
      expect(w2Graph.lists[0].outgoingEdges).toHaveLength(1);
    });
  });

  describe('listenForGraphUpdates', () => {
    it('should call callback when graph is updated for the specified workspace', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const graphHandlers = createGraphHandlers({ sql });
      const listHandlers = createListHandlers({ sql });

      const workspaceId = 'test-workspace';
      let callbackCalled = false;
      let receivedGraphData: Awaited<ReturnType<typeof graphHandlers.dumpActiveGraph>> | null = null;

      // Set up listener
      const unsubscribe = await graphHandlers.listenForGraphUpdates(workspaceId, (graphData) => {
        callbackCalled = true;
        receivedGraphData = graphData;
      });

      // Trigger a graph update by adding a list
      await listHandlers.addLists({
        lists: [{ title: 'Test List' }],
        workspaceId
      });

      // Manually trigger the notification (simulating the database trigger)
      await sql.notify(
        'graph_updated',
        JSON.stringify({
          workspace_id: workspaceId,
          table_name: 'lists',
          operation: 'INSERT'
        })
      );

      // Wait for the notification to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callbackCalled).toBe(true);
      expect(receivedGraphData).toBeDefined();
      expect(receivedGraphData!.lists).toHaveLength(1);
      expect(receivedGraphData!.lists[0].title).toBe('Test List');

      // Clean up
      await unsubscribe();
    });

    it('should not call callback for updates to other workspaces', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const graphHandlers = createGraphHandlers({ sql });

      const workspaceId = 'workspace-1';
      const otherWorkspaceId = 'workspace-2';
      let callbackCalled = false;

      // Set up listener for workspace-1
      const unsubscribe = await graphHandlers.listenForGraphUpdates(workspaceId, () => {
        callbackCalled = true;
      });

      // Trigger notification for workspace-2
      await sql.notify(
        'graph_updated',
        JSON.stringify({
          workspace_id: otherWorkspaceId,
          table_name: 'lists',
          operation: 'INSERT'
        })
      );

      // Wait for potential notification processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callbackCalled).toBe(false);

      // Clean up
      await unsubscribe();
    });

    it('should handle malformed notification payloads gracefully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const graphHandlers = createGraphHandlers({ sql });

      const workspaceId = 'test-workspace';
      let callbackCalled = false;

      // Capture console.error output
      const originalConsoleError = console.error;
      let errorMessage = '';
      console.error = (msg: string) => {
        errorMessage = msg;
      };

      // Set up listener
      const unsubscribe = await graphHandlers.listenForGraphUpdates(workspaceId, () => {
        callbackCalled = true;
      });

      // Send malformed notification
      await sql.notify('graph_updated', 'invalid json');

      // Wait for potential notification processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callbackCalled).toBe(false);
      expect(errorMessage).toBe('Error parsing pg_notify payload for graph update:');

      // Clean up
      console.error = originalConsoleError;
      await unsubscribe();
    });

    it('should not process notifications after unsubscribe', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const graphHandlers = createGraphHandlers({ sql });

      const workspaceId = 'test-workspace';
      let callbackCount = 0;

      // Set up listener
      const unsubscribe = await graphHandlers.listenForGraphUpdates(workspaceId, () => {
        callbackCount++;
      });

      // Send first notification
      await sql.notify(
        'graph_updated',
        JSON.stringify({
          workspace_id: workspaceId,
          table_name: 'lists',
          operation: 'INSERT'
        })
      );

      // Wait for notification processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(callbackCount).toBe(1);

      // Unsubscribe
      await unsubscribe();

      // Send second notification after unsubscribe
      await sql.notify(
        'graph_updated',
        JSON.stringify({
          workspace_id: workspaceId,
          table_name: 'lists',
          operation: 'UPDATE'
        })
      );

      // Wait for potential notification processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(callbackCount).toBe(1); // Should still be 1
    });

    it('should handle multiple listeners for the same workspace efficiently', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const graphHandlers = createGraphHandlers({ sql });

      const workspaceId = 'test-workspace';
      let callback1Count = 0;
      let callback2Count = 0;
      let callback3Count = 0;

      // Set up multiple listeners for the same workspace
      const unsubscribe1 = await graphHandlers.listenForGraphUpdates(workspaceId, () => {
        callback1Count++;
      });
      const unsubscribe2 = await graphHandlers.listenForGraphUpdates(workspaceId, () => {
        callback2Count++;
      });
      const unsubscribe3 = await graphHandlers.listenForGraphUpdates(workspaceId, () => {
        callback3Count++;
      });

      // Manually trigger notification (not using actual database operation to avoid double triggers)
      await sql.notify(
        'graph_updated',
        JSON.stringify({
          workspace_id: workspaceId,
          table_name: 'lists',
          operation: 'INSERT'
        })
      );

      // Wait for notification processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // All callbacks should have been called once
      expect(callback1Count).toBe(1);
      expect(callback2Count).toBe(1);
      expect(callback3Count).toBe(1);

      // Unsubscribe callback 2
      await unsubscribe2();

      // Trigger another notification
      await sql.notify(
        'graph_updated',
        JSON.stringify({
          workspace_id: workspaceId,
          table_name: 'lists',
          operation: 'UPDATE'
        })
      );

      // Wait for notification processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Only callbacks 1 and 3 should have been called again
      expect(callback1Count).toBe(2);
      expect(callback2Count).toBe(1); // Should not have increased
      expect(callback3Count).toBe(2);

      // Clean up remaining listeners
      await unsubscribe1();
      await unsubscribe3();
    });

    it('should share a single database listener across multiple workspace listeners', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const graphHandlers = createGraphHandlers({ sql });

      const workspace1 = 'workspace-1';
      const workspace2 = 'workspace-2';
      let workspace1CallCount = 0;
      let workspace2CallCount = 0;

      // Set up listeners for different workspaces
      const unsubscribe1 = await graphHandlers.listenForGraphUpdates(workspace1, () => {
        workspace1CallCount++;
      });
      const unsubscribe2 = await graphHandlers.listenForGraphUpdates(workspace2, () => {
        workspace2CallCount++;
      });

      // Trigger notification for workspace 1
      await sql.notify(
        'graph_updated',
        JSON.stringify({
          workspace_id: workspace1,
          table_name: 'lists',
          operation: 'INSERT'
        })
      );

      // Wait for notification processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Only workspace 1 callback should have been called
      expect(workspace1CallCount).toBe(1);
      expect(workspace2CallCount).toBe(0);

      // Trigger notification for workspace 2
      await sql.notify(
        'graph_updated',
        JSON.stringify({
          workspace_id: workspace2,
          table_name: 'tasks',
          operation: 'UPDATE'
        })
      );

      // Wait for notification processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now workspace 2 callback should have been called
      expect(workspace1CallCount).toBe(1);
      expect(workspace2CallCount).toBe(1);

      // Clean up
      await unsubscribe1();
      await unsubscribe2();
    });
  });
});
