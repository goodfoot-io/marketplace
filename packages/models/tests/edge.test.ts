import { getTestSql } from '@productivity-bot/test-utilities/sql';
import { initializeDatabase } from '../src/database.js';
import { createEdgeHandlers } from '../src/edge.js';
import { NotFoundError, InvalidParameterError, InvalidIdError } from '../src/lib/errors.js';
import { createListHandlers } from '../src/list.js';
import { createNoteHandlers } from '../src/note.js';
import { createReminderHandlers } from '../src/reminder.js';
import { createTaskHandlers } from '../src/task.js';

describe('Edge model', () => {
  describe('linkEdges', () => {
    it('creates a single edge successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteId, description: 'Test edge' }],
        workspaceId: 'default'
      });

      // Verify edge was created
      const [edge] = await sql<Array<{ id: string; srcId: string; dstId: string; description: string | null }>>`
        SELECT * FROM edges WHERE src_id = ${listId} AND dst_id = ${noteId}
      `;
      expect(edge.srcId).toBe(listId);
      expect(edge.dstId).toBe(noteId);
      expect(edge.description).toBe('Test edge');
    });

    it('creates multiple edges successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'List 1' }, { title: 'List 2' }], workspaceId: 'default' });
      const noteIds = await addNotes({ notesData: [{ title: 'Note 1' }, { title: 'Note 2' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [
          { srcId: listIds[0], dstId: noteIds[0], description: 'Edge 1' },
          { srcId: listIds[1], dstId: noteIds[1], description: 'Edge 2' }
        ],
        workspaceId: 'default'
      });

      const edges = await sql<Array<{ srcId: string; dstId: string; description: string }>>`
        SELECT src_id, dst_id, description FROM edges ORDER BY description
      `;

      expect(edges).toHaveLength(2);
      expect(edges[0].srcId).toBe(listIds[0]);
      expect(edges[0].dstId).toBe(noteIds[0]);
      expect(edges[0].description).toBe('Edge 1');
      expect(edges[1].srcId).toBe(listIds[1]);
      expect(edges[1].dstId).toBe(noteIds[1]);
      expect(edges[1].description).toBe('Edge 2');
    });

    it('creates edge without description', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      await linkEdges({ edgesData: [{ srcId: listId, dstId: noteId }], workspaceId: 'default' });

      const [edge] = await sql<Array<{ description: string | null }>>`
        SELECT description FROM edges WHERE src_id = ${listId} AND dst_id = ${noteId}
      `;
      expect(edge.description).toBeNull();
    });

    it('updates existing edge description when linking same nodes again', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      // Create initial edge
      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteId, description: 'Original description' }],
        workspaceId: 'default'
      });

      // Link again with different description
      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteId, description: 'Updated description' }],
        workspaceId: 'default'
      });

      const edges = await sql<Array<{ description: string }>>`
        SELECT description FROM edges WHERE src_id = ${listId} AND dst_id = ${noteId}
      `;

      expect(edges).toHaveLength(1);
      expect(edges[0].description).toBe('Updated description');
    });

    it('does not update existing edge when description is undefined', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      // Create initial edge with description
      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteId, description: 'Original description' }],
        workspaceId: 'default'
      });

      // Link again without description (undefined)
      await linkEdges({ edgesData: [{ srcId: listId, dstId: noteId }], workspaceId: 'default' });

      const [edge] = await sql<Array<{ description: string }>>`
        SELECT description FROM edges WHERE src_id = ${listId} AND dst_id = ${noteId}
      `;

      expect(edge.description).toBe('Original description');
    });

    it('links between different node types', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addTasks } = createTaskHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Test List' }], workspaceId: 'default' });
      const [taskId] = await addTasks({ tasksData: [{ listId, title: 'Test Task' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Test Note' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [
          { srcId: listId, dstId: taskId, description: 'List to Task' },
          { srcId: taskId, dstId: noteId, description: 'Task to Note' },
          { srcId: noteId, dstId: listId, description: 'Note to List' }
        ],
        workspaceId: 'default'
      });

      const edges = await sql<Array<{ src_id: string; dst_id: string }>>`
        SELECT src_id, dst_id FROM edges ORDER BY created_at
      `;

      expect(edges).toHaveLength(3);
    });

    it('links edges with reminders', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { createOneTimeReminder } = createReminderHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Project List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Context Note' }], workspaceId: 'default' });

      // Create a future reminder
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const reminder = await createOneTimeReminder({
        title: 'Project Deadline',
        body: 'Submit final project deliverables',
        dateTime: futureDate.toISOString(),
        timezone: 'UTC',
        workspaceId: 'default'
      });

      await linkEdges({
        edgesData: [
          { srcId: listId, dstId: reminder.id, description: 'List to Reminder' },
          { srcId: reminder.id, dstId: noteId, description: 'Reminder to Note' },
          { srcId: noteId, dstId: reminder.id, description: 'Note to Reminder' }
        ],
        workspaceId: 'default'
      });

      const edges = await sql<Array<{ srcId: string; dstId: string; description: string }>>`
        SELECT src_id as "srcId", dst_id as "dstId", description FROM edges ORDER BY created_at
      `;

      expect(edges).toHaveLength(3);
      expect(edges[0].srcId).toBe(listId);
      expect(edges[0].dstId).toBe(reminder.id);
      expect(edges[0].description).toBe('List to Reminder');

      expect(edges[1].srcId).toBe(reminder.id);
      expect(edges[1].dstId).toBe(noteId);
      expect(edges[1].description).toBe('Reminder to Note');

      expect(edges[2].srcId).toBe(noteId);
      expect(edges[2].dstId).toBe(reminder.id);
      expect(edges[2].description).toBe('Note to Reminder');
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { linkEdges } = createEdgeHandlers({ sql });

      await expect(linkEdges({ edgesData: [], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for non-array input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { linkEdges } = createEdgeHandlers({ sql });

      await expect(
        linkEdges({
          edgesData: null as unknown as Array<{ srcId: string; dstId: string; description?: string }>,
          workspaceId: 'default'
        })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidIdError for invalid source ID format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      await expect(
        linkEdges({ edgesData: [{ srcId: 'invalid-id', dstId: noteId }], workspaceId: 'default' })
      ).rejects.toThrow(InvalidIdError);
    });

    it('throws InvalidIdError for invalid destination ID format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });

      await expect(
        linkEdges({ edgesData: [{ srcId: listId, dstId: 'invalid-id' }], workspaceId: 'default' })
      ).rejects.toThrow(InvalidIdError);
    });

    it('throws NotFoundError for non-existent source node', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      await expect(
        linkEdges({ edgesData: [{ srcId: 'list:999999', dstId: noteId }], workspaceId: 'default' })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for non-existent destination node', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { linkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });

      await expect(
        linkEdges({ edgesData: [{ srcId: listId, dstId: 'note:999999' }], workspaceId: 'default' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateEdges', () => {
    it('updates edge description successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges, updateEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteId, description: 'Original description' }],
        workspaceId: 'default'
      });

      const [edge] = await sql<Array<{ id: string }>>`
        SELECT id FROM edges WHERE src_id = ${listId} AND dst_id = ${noteId}
      `;

      const invalidIds = await updateEdges({
        updates: [{ edgeId: edge.id, description: 'Updated description' }],
        workspaceId: 'default'
      });

      expect(invalidIds).toEqual([]);

      const [updatedEdge] = await sql<Array<{ description: string }>>`
        SELECT description FROM edges WHERE id = ${edge.id}
      `;
      expect(updatedEdge.description).toBe('Updated description');
    });

    it('updates multiple edges successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges, updateEdges } = createEdgeHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'List 1' }, { title: 'List 2' }], workspaceId: 'default' });
      const noteIds = await addNotes({ notesData: [{ title: 'Note 1' }, { title: 'Note 2' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [
          { srcId: listIds[0], dstId: noteIds[0], description: 'Edge 1' },
          { srcId: listIds[1], dstId: noteIds[1], description: 'Edge 2' }
        ],
        workspaceId: 'default'
      });

      const edges = await sql<Array<{ id: string }>>`
        SELECT id FROM edges ORDER BY created_at
      `;

      const invalidIds = await updateEdges({
        updates: [
          { edgeId: edges[0].id, description: 'Updated Edge 1' },
          { edgeId: edges[1].id, description: 'Updated Edge 2' }
        ],
        workspaceId: 'default'
      });

      expect(invalidIds).toEqual([]);

      const updatedEdges = await sql<Array<{ description: string }>>`
        SELECT description FROM edges ORDER BY created_at
      `;
      expect(updatedEdges[0].description).toBe('Updated Edge 1');
      expect(updatedEdges[1].description).toBe('Updated Edge 2');
    });

    it('sets description to null when empty string is provided', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges, updateEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteId, description: 'Original description' }],
        workspaceId: 'default'
      });

      const [edge] = await sql<Array<{ id: string }>>`
        SELECT id FROM edges WHERE src_id = ${listId} AND dst_id = ${noteId}
      `;

      await updateEdges({ updates: [{ edgeId: edge.id, description: '' }], workspaceId: 'default' });

      const [updatedEdge] = await sql<Array<{ description: string | null }>>`
        SELECT description FROM edges WHERE id = ${edge.id}
      `;
      expect(updatedEdge.description).toBeNull();
    });

    it('returns invalid IDs for non-existent edges', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateEdges } = createEdgeHandlers({ sql });

      const invalidIds = await updateEdges({
        updates: [{ edgeId: 'edge:999999', description: 'New description' }],
        workspaceId: 'default'
      });

      expect(invalidIds).toEqual(['edge:999999']);
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateEdges } = createEdgeHandlers({ sql });

      await expect(updateEdges({ updates: [], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for non-array input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateEdges } = createEdgeHandlers({ sql });

      await expect(
        updateEdges({
          updates: null as unknown as Array<{ edgeId: string; description: string }>,
          workspaceId: 'default'
        })
      ).rejects.toThrow(InvalidParameterError);
    });

    it('returns invalid IDs for invalid edge ID format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { updateEdges } = createEdgeHandlers({ sql });

      const invalidIds = await updateEdges({
        updates: [{ edgeId: 'invalid-id', description: 'New description' }],
        workspaceId: 'default'
      });

      expect(invalidIds).toEqual(['invalid-id']);
    });
  });

  describe('unlinkEdges', () => {
    it('deletes a single edge successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges, unlinkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteId, description: 'Test edge' }],
        workspaceId: 'default'
      });

      const [edge] = await sql<Array<{ id: string }>>`
        SELECT id FROM edges WHERE src_id = ${listId} AND dst_id = ${noteId}
      `;

      const invalidIds = await unlinkEdges({ edgeIds: [edge.id], workspaceId: 'default' });

      expect(invalidIds).toEqual([]);

      const remainingEdges = await sql<Array<{ id: string }>>`
        SELECT id FROM edges WHERE id = ${edge.id}
      `;
      expect(remainingEdges).toHaveLength(0);
    });

    it('deletes multiple edges successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges, unlinkEdges } = createEdgeHandlers({ sql });

      const listIds = await addLists({ lists: [{ title: 'List 1' }, { title: 'List 2' }], workspaceId: 'default' });
      const noteIds = await addNotes({ notesData: [{ title: 'Note 1' }, { title: 'Note 2' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [
          { srcId: listIds[0], dstId: noteIds[0], description: 'Edge 1' },
          { srcId: listIds[1], dstId: noteIds[1], description: 'Edge 2' }
        ],
        workspaceId: 'default'
      });

      const edges = await sql<Array<{ id: string }>>`
        SELECT id FROM edges ORDER BY created_at
      `;

      const invalidIds = await unlinkEdges({ edgeIds: edges.map((e) => e.id), workspaceId: 'default' });

      expect(invalidIds).toEqual([]);

      const remainingEdges = await sql<Array<{ id: string }>>`
        SELECT id FROM edges
      `;
      expect(remainingEdges).toHaveLength(0);
    });

    it('returns invalid IDs for non-existent edges', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges, unlinkEdges } = createEdgeHandlers({ sql });

      const [listId] = await addLists({ lists: [{ title: 'Source List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Target Note' }], workspaceId: 'default' });

      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteId, description: 'Test edge' }],
        workspaceId: 'default'
      });

      const [edge] = await sql<Array<{ id: string }>>`
        SELECT id FROM edges WHERE src_id = ${listId} AND dst_id = ${noteId}
      `;

      const invalidIds = await unlinkEdges({ edgeIds: [edge.id, 'edge:999999'], workspaceId: 'default' });

      expect(invalidIds).toEqual(['edge:999999']);
    });

    it('throws InvalidParameterError for empty array', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { unlinkEdges } = createEdgeHandlers({ sql });

      await expect(unlinkEdges({ edgeIds: [], workspaceId: 'default' })).rejects.toThrow(InvalidParameterError);
    });

    it('throws InvalidParameterError for non-array input', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { unlinkEdges } = createEdgeHandlers({ sql });

      await expect(unlinkEdges({ edgeIds: null as unknown as string[], workspaceId: 'default' })).rejects.toThrow(
        InvalidParameterError
      );
    });

    it('returns invalid IDs for invalid edge ID format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { unlinkEdges } = createEdgeHandlers({ sql });

      const invalidIds = await unlinkEdges({ edgeIds: ['invalid-id'], workspaceId: 'default' });

      expect(invalidIds).toEqual(['invalid-id']);
    });
  });

  describe('CRUD operations', () => {
    it('performs complete CRUD cycle', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges, updateEdges, unlinkEdges } = createEdgeHandlers({ sql });

      // Create nodes
      const [listId] = await addLists({ lists: [{ title: 'Integration List' }], workspaceId: 'default' });
      const [noteId] = await addNotes({ notesData: [{ title: 'Integration Note' }], workspaceId: 'default' });

      // Create edge
      await linkEdges({
        edgesData: [{ srcId: listId, dstId: noteId, description: 'Original description' }],
        workspaceId: 'default'
      });

      // Read edge
      const [edge] = await sql<Array<{ id: string; description: string }>>`
        SELECT id, description FROM edges WHERE src_id = ${listId} AND dst_id = ${noteId}
      `;
      expect(edge.description).toBe('Original description');

      // Update edge
      await updateEdges({ updates: [{ edgeId: edge.id, description: 'Updated description' }], workspaceId: 'default' });

      const [updatedEdge] = await sql<Array<{ description: string }>>`
        SELECT description FROM edges WHERE id = ${edge.id}
      `;
      expect(updatedEdge.description).toBe('Updated description');

      // Delete edge
      const invalidIds = await unlinkEdges({ edgeIds: [edge.id], workspaceId: 'default' });
      expect(invalidIds).toEqual([]);

      const remainingEdges = await sql<Array<{ id: string }>>`
        SELECT id FROM edges WHERE id = ${edge.id}
      `;
      expect(remainingEdges).toHaveLength(0);
    });
  });

  describe('workspace isolation', () => {
    it('isolates edges between workspaces', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const { addLists } = createListHandlers({ sql });
      const { addNotes } = createNoteHandlers({ sql });
      const { linkEdges, updateEdges, unlinkEdges } = createEdgeHandlers({ sql });

      // Create nodes in different workspaces
      const [listId_w1] = await addLists({ lists: [{ title: 'W1 List' }], workspaceId: 'w1' });
      const [noteId_w1] = await addNotes({ notesData: [{ title: 'W1 Note' }], workspaceId: 'w1' });

      await linkEdges({
        edgesData: [{ srcId: listId_w1, dstId: noteId_w1, description: 'W1 Edge' }],
        workspaceId: 'w1'
      });

      // Create nodes in different workspace
      const [listId_w2] = await addLists({ lists: [{ title: 'W2 List' }], workspaceId: 'w2' });
      const [noteId_w2] = await addNotes({ notesData: [{ title: 'W2 Note' }], workspaceId: 'w2' });

      await linkEdges({
        edgesData: [{ srcId: listId_w2, dstId: noteId_w2, description: 'W2 Edge' }],
        workspaceId: 'w2'
      });

      // Verify isolation
      const w1Edges = await sql<Array<{ id: string }>>`
        SELECT id FROM edges WHERE workspace_id = 'w1'
      `;
      const w2Edges = await sql<Array<{ id: string }>>`
        SELECT id FROM edges WHERE workspace_id = 'w2'
      `;

      expect(w1Edges).toHaveLength(1);
      expect(w2Edges).toHaveLength(1);

      // Test update isolation
      const invalidIds = await updateEdges({
        updates: [{ edgeId: w1Edges[0].id, description: 'Updated from W2' }],
        workspaceId: 'w2'
      });
      expect(invalidIds).toEqual([w1Edges[0].id]);

      // Test delete isolation
      const deleteInvalidIds = await unlinkEdges({ edgeIds: [w1Edges[0].id], workspaceId: 'w2' });
      expect(deleteInvalidIds).toEqual([w1Edges[0].id]);

      // Verify edge still exists in w1
      const w1EdgesAfterDelete = await sql<Array<{ id: string }>>`
        SELECT id FROM edges WHERE workspace_id = 'w1'
      `;
      expect(w1EdgesAfterDelete).toHaveLength(1);
    });
  });
});
