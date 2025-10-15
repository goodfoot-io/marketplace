import { getTestSql } from '@productivity-bot/test-utilities/sql';
import { initializeDatabase } from '../src/database.js';
import { InvalidParameterError, NotFoundError } from '../src/lib/errors.js';
import { createReminderHandlers, type RecurrencePattern } from '../src/reminder.js';

describe('Reminder model', () => {
  describe('createOneTimeReminder', () => {
    it('creates a one-time reminder successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      const params = {
        title: 'Doctor appointment',
        body: 'Annual checkup at Dr. Smith',
        dateTime: futureDate.toISOString(),
        timezone: 'America/New_York',
        workspaceId: 'test-workspace'
      };

      const reminder = await reminderHandlers.createOneTimeReminder(params);

      expect(reminder).toBeDefined();
      expect(reminder.id).toMatch(/^reminder:\d+$/);
      expect(reminder.title).toBe('Doctor appointment');
      expect(reminder.body).toBe('Annual checkup at Dr. Smith');
      expect(reminder.recurrenceType).toBe('once');
      expect(reminder.status).toBe('active');
      expect(reminder.timezone).toBe('America/New_York');
      expect(reminder.workspaceId).toBe('test-workspace');
    });

    it('creates reminder without body', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const params = {
        title: 'Quick reminder',
        dateTime: futureDate.toISOString(),
        timezone: 'America/Los_Angeles'
      };

      const reminder = await reminderHandlers.createOneTimeReminder(params);

      expect(reminder.body).toBeNull();
      expect(reminder.title).toBe('Quick reminder');
    });

    it('throws error for past date', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const params = {
        title: 'Past reminder',
        dateTime: pastDate.toISOString(),
        timezone: 'America/New_York'
      };

      await expect(reminderHandlers.createOneTimeReminder(params)).rejects.toThrow(InvalidParameterError);
    });

    it('throws error for invalid timezone', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const params = {
        title: 'Invalid timezone',
        dateTime: futureDate.toISOString(),
        timezone: 'Invalid/Timezone'
      };

      await expect(reminderHandlers.createOneTimeReminder(params)).rejects.toThrow(InvalidParameterError);
    });
  });

  describe('createRecurringReminder', () => {
    it('creates daily recurring reminder', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const params = {
        title: 'Take medication',
        body: 'Morning pills',
        timeOfDay: '08:00',
        startDate: new Date().toISOString(),
        timezone: 'America/New_York',
        pattern: { type: 'daily' } as RecurrencePattern
      };

      const reminder = await reminderHandlers.createRecurringReminder(params);

      expect(reminder.recurrenceType).toBe('daily');
      expect(reminder.timeOfDay).toBe('08:00:00'); // PostgreSQL TIME includes seconds
      expect(reminder.weeklyDays).toBeNull();
      expect(reminder.monthlyDay).toBeNull();
    });

    it('creates weekly recurring reminder', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const params = {
        title: 'Team meeting',
        timeOfDay: '10:00',
        startDate: new Date().toISOString(),
        timezone: 'America/New_York',
        pattern: {
          type: 'weekly',
          days: ['MON', 'WED', 'FRI']
        } as RecurrencePattern
      };

      const reminder = await reminderHandlers.createRecurringReminder(params);

      expect(reminder.recurrenceType).toBe('weekly');
      expect(reminder.weeklyDays).toEqual(['MON', 'WED', 'FRI']);
    });

    it('creates monthly recurring reminder', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const params = {
        title: 'Pay rent',
        timeOfDay: '09:00',
        startDate: new Date().toISOString(),
        timezone: 'America/New_York',
        pattern: {
          type: 'monthly',
          dayOfMonth: 1
        } as RecurrencePattern
      };

      const reminder = await reminderHandlers.createRecurringReminder(params);

      expect(reminder.recurrenceType).toBe('monthly');
      expect(reminder.monthlyDay).toBe(1);
    });

    it('validates time format', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const params = {
        title: 'Invalid time',
        timeOfDay: '25:00', // Invalid time
        startDate: new Date().toISOString(),
        timezone: 'America/New_York',
        pattern: { type: 'daily' } as RecurrencePattern
      };

      await expect(reminderHandlers.createRecurringReminder(params)).rejects.toThrow(InvalidParameterError);
    });
  });

  describe('deleteReminder', () => {
    it('deletes reminder successfully', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      // Create a reminder first
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const reminder = await reminderHandlers.createOneTimeReminder({
        title: 'To be deleted',
        dateTime: futureDate.toISOString(),
        timezone: 'America/New_York'
      });

      // Delete it
      await reminderHandlers.deleteReminder(reminder.id);

      // Verify it's deleted
      const retrieved = await reminderHandlers.getReminder(reminder.id);
      expect(retrieved).toBeNull();
    });

    it('throws error for non-existent reminder', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      await expect(reminderHandlers.deleteReminder('reminder:99999')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getDueReminders', () => {
    it('retrieves due reminders', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      // Create a reminder that's due now
      // First create it in the future, then we'll mark it as triggered
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 1);

      const reminder = await reminderHandlers.createOneTimeReminder({
        title: 'Due reminder',
        dateTime: futureDate.toISOString(),
        timezone: 'America/New_York'
      });

      // Manually update it to be due (for testing purposes)
      await sql`
        UPDATE reminders 
        SET next_occurrence = NOW() - INTERVAL '1 minute'
        WHERE id = ${reminder.id}
      `;

      const dueReminders = await reminderHandlers.getDueReminders();

      expect(dueReminders.length).toBeGreaterThan(0);
      expect(dueReminders[0].title).toBe('Due reminder');
    });

    it('does not retrieve future reminders', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      // Create a reminder that's due in the future
      const future = new Date();
      future.setHours(future.getHours() + 24);

      await reminderHandlers.createOneTimeReminder({
        title: 'Future reminder',
        dateTime: future.toISOString(),
        timezone: 'America/New_York'
      });

      const dueReminders = await reminderHandlers.getDueReminders();

      const futureReminder = dueReminders.find((r) => r.title === 'Future reminder');
      expect(futureReminder).toBeUndefined();
    });
  });

  describe('markReminderTriggered', () => {
    it('marks one-time reminder as completed', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 1);

      const reminder = await reminderHandlers.createOneTimeReminder({
        title: 'One-time reminder',
        dateTime: futureDate.toISOString(),
        timezone: 'America/New_York'
      });

      // Manually update it to be due (for testing purposes)
      await sql`
        UPDATE reminders 
        SET next_occurrence = NOW() - INTERVAL '1 minute'
        WHERE id = ${reminder.id}
      `;

      await reminderHandlers.markReminderTriggered(reminder.id);

      const updated = await reminderHandlers.getReminder(reminder.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.lastTriggered).toBeDefined();
    });

    it('keeps recurring reminder active', async () => {
      const { sql } = await getTestSql();
      await initializeDatabase(sql);
      const reminderHandlers = createReminderHandlers({ sql });

      const reminder = await reminderHandlers.createRecurringReminder({
        title: 'Daily reminder',
        timeOfDay: '08:00',
        startDate: new Date().toISOString(),
        timezone: 'America/New_York',
        pattern: { type: 'daily' } as RecurrencePattern
      });

      await reminderHandlers.markReminderTriggered(reminder.id);

      const updated = await reminderHandlers.getReminder(reminder.id);
      expect(updated?.status).toBe('active');
      expect(updated?.lastTriggered).toBeDefined();
    });
  });
});
