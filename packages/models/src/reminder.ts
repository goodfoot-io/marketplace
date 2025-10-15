import type { PostgresConnection, PostgresTransactionConnection } from './database.js';
import { InvalidParameterError, NotFoundError } from './lib/errors.js';
import { generateNodeId, validateNodeId } from './lib/ids.js';

export type RecurrenceType = 'once' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type ReminderStatus = 'active' | 'completed' | 'cancelled';

export interface Reminder {
  id: string;
  title: string;
  body: string | null;
  timeOfDay: string; // TIME format: "15:00"
  timezone: string;
  startDate: Date;
  endDate: Date | null;
  recurrenceType: RecurrenceType;
  weeklyDays: DayOfWeek[] | null;
  monthlyDay: number | null;
  status: ReminderStatus;
  lastTriggered: Date | null;
  nextOccurrence: Date;
  createdBy: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderAnnouncement {
  id: number;
  reminderId: string;
  announcedAt: Date;
  workspaceId: string;
  delivered: boolean;
  deliveredAt: Date | null;
  agentId: string | null;
  missedReason: string | null;
}

export interface CreateOneTimeReminderParams {
  title: string;
  body?: string | null;
  dateTime: string; // ISO 8601
  timezone: string;
  workspaceId?: string;
  createdBy?: string;
}

export interface CreateRecurringReminderParams {
  title: string;
  body?: string | null;
  timeOfDay: string; // "15:00"
  startDate: string; // ISO 8601
  timezone: string;
  pattern: RecurrencePattern;
  endDate?: string; // ISO 8601
  workspaceId?: string;
  createdBy?: string;
}

export type RecurrencePattern =
  | { type: 'daily' }
  | { type: 'weekdays' }
  | { type: 'weekends' }
  | { type: 'weekly'; days: DayOfWeek[] }
  | { type: 'monthly'; dayOfMonth: number };

export function createReminderHandlers({ sql }: { sql: PostgresConnection }) {
  async function createOneTimeReminder(
    params: CreateOneTimeReminderParams,
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Reminder> {
    const workspaceId = params.workspaceId || 'default';
    const createdBy = params.createdBy || 'voice_agent';

    // Validate inputs
    if (!params.title || params.title.trim().length < 1 || params.title.trim().length > 200) {
      throw new InvalidParameterError(`Reminder title must be between 1 and 200 characters: "${params.title}"`);
    }
    const trimmedTitle = params.title.trim();

    const reminderDate = new Date(params.dateTime);
    if (isNaN(reminderDate.getTime())) {
      throw new InvalidParameterError('Invalid dateTime format');
    }

    if (reminderDate <= new Date()) {
      throw new InvalidParameterError('Reminder time must be in the future');
    }

    // Validate timezone
    const [tzResult] = await _sql<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${params.timezone}) as exists
    `;
    if (!tzResult?.exists) {
      throw new InvalidParameterError(`Invalid timezone: ${params.timezone}`);
    }

    const reminderId = await generateNodeId(_sql, 'reminder');
    const timeOfDay = reminderDate.toTimeString().slice(0, 5); // Extract HH:mm

    const [reminder] = await _sql<Reminder[]>`
      INSERT INTO reminders (
        id, title, body, time_of_day, timezone, start_date, 
        recurrence_type, status, next_occurrence, created_by, workspace_id
      ) VALUES (
        ${reminderId}, 
        ${trimmedTitle}, 
        ${params.body || null},
        ${timeOfDay}::TIME,
        ${params.timezone},
        ${reminderDate.toISOString().split('T')[0]}::DATE,
        'once',
        'active',
        ${params.dateTime}::TIMESTAMP WITH TIME ZONE,
        ${createdBy},
        ${workspaceId}
      )
      RETURNING 
        id, title, body, 
        time_of_day::TEXT,
        timezone,
        start_date,
        end_date,
        recurrence_type,
        array_to_json(weekly_days) as weekly_days,
        monthly_day,
        status,
        last_triggered,
        next_occurrence,
        created_by,
        workspace_id,
        created_at,
        updated_at
    `;

    return reminder;
  }

  async function createRecurringReminder(
    params: CreateRecurringReminderParams,
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Reminder> {
    const workspaceId = params.workspaceId || 'default';
    const createdBy = params.createdBy || 'voice_agent';

    // Validate inputs
    if (!params.title || params.title.trim().length < 1 || params.title.trim().length > 200) {
      throw new InvalidParameterError(`Reminder title must be between 1 and 200 characters: "${params.title}"`);
    }
    const trimmedTitle = params.title.trim();

    // Validate time format
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(params.timeOfDay)) {
      throw new InvalidParameterError('Time must be in 24-hour format: HH:mm');
    }

    const startDate = new Date(params.startDate);
    if (isNaN(startDate.getTime())) {
      throw new InvalidParameterError('Invalid startDate format');
    }

    let endDate: Date | null = null;
    if (params.endDate) {
      endDate = new Date(params.endDate);
      if (isNaN(endDate.getTime())) {
        throw new InvalidParameterError('Invalid endDate format');
      }
      if (endDate <= startDate) {
        throw new InvalidParameterError('End date must be after start date');
      }
    }

    // Validate timezone
    const [tzResult] = await _sql<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${params.timezone}) as exists
    `;
    if (!tzResult?.exists) {
      throw new InvalidParameterError(`Invalid timezone: ${params.timezone}`);
    }

    // Parse pattern
    let recurrenceType: RecurrenceType;
    let weeklyDays: DayOfWeek[] | null = null;
    let monthlyDay: number | null = null;

    switch (params.pattern.type) {
      case 'daily':
        recurrenceType = 'daily';
        break;
      case 'weekdays':
        recurrenceType = 'weekdays';
        break;
      case 'weekends':
        recurrenceType = 'weekends';
        break;
      case 'weekly':
        recurrenceType = 'weekly';
        weeklyDays = params.pattern.days;
        if (!weeklyDays || weeklyDays.length === 0) {
          throw new InvalidParameterError('Weekly pattern requires at least one day');
        }
        break;
      case 'monthly':
        recurrenceType = 'monthly';
        monthlyDay = params.pattern.dayOfMonth;
        if (monthlyDay < 1 || monthlyDay > 31) {
          throw new InvalidParameterError('Monthly day must be between 1 and 31');
        }
        break;
      default:
        throw new InvalidParameterError('Invalid recurrence pattern');
    }

    const reminderId = await generateNodeId(_sql, 'reminder');

    // Calculate initial next occurrence
    const [nextOccurrenceResult] = await _sql<{ next: Date }[]>`
      SELECT calculate_next_reminder(
        ${params.timeOfDay}::TIME,
        ${params.timezone},
        ${recurrenceType}::recurrence_type,
        ${weeklyDays ? _sql.array(weeklyDays) : null}::day_of_week[],
        ${monthlyDay}::INTEGER,
        ${startDate.toISOString().split('T')[0]}::DATE
      ) as next
    `;

    const [reminder] = await _sql<Reminder[]>`
      INSERT INTO reminders (
        id, title, body, time_of_day, timezone, start_date, end_date,
        recurrence_type, weekly_days, monthly_day, status, next_occurrence, 
        created_by, workspace_id
      ) VALUES (
        ${reminderId}, 
        ${trimmedTitle}, 
        ${params.body || null},
        ${params.timeOfDay}::TIME,
        ${params.timezone},
        ${startDate.toISOString().split('T')[0]}::DATE,
        ${endDate ? endDate.toISOString().split('T')[0] : null}::DATE,
        ${recurrenceType}::recurrence_type,
        ${weeklyDays ? _sql.array(weeklyDays) : null}::day_of_week[],
        ${monthlyDay},
        'active',
        ${nextOccurrenceResult.next},
        ${createdBy},
        ${workspaceId}
      )
      RETURNING 
        id, title, body, 
        time_of_day::TEXT,
        timezone,
        start_date,
        end_date,
        recurrence_type,
        array_to_json(weekly_days) as weekly_days,
        monthly_day,
        status,
        last_triggered,
        next_occurrence,
        created_by,
        workspace_id,
        created_at,
        updated_at
    `;

    return reminder;
  }

  async function deleteReminder(
    reminderId: string,
    workspaceId: string = 'default',
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    validateNodeId(reminderId, 'reminder');

    const result = await _sql`
      DELETE FROM reminders 
      WHERE id = ${reminderId} 
        AND workspace_id = ${workspaceId}
    `;

    if (result.count === 0) {
      throw new NotFoundError('Reminder', reminderId);
    }
  }

  async function getReminder(
    reminderId: string,
    workspaceId: string = 'default',
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Reminder | null> {
    validateNodeId(reminderId, 'reminder');

    const [reminder] = await _sql<Reminder[]>`
      SELECT 
        id, title, body, 
        time_of_day::TEXT,
        timezone,
        start_date,
        end_date,
        recurrence_type,
        array_to_json(weekly_days) as weekly_days,
        monthly_day,
        status,
        last_triggered,
        next_occurrence,
        created_by,
        workspace_id,
        created_at,
        updated_at
      FROM reminders
      WHERE id = ${reminderId} 
        AND workspace_id = ${workspaceId}
    `;

    return reminder || null;
  }

  async function getDueReminders(
    limit: number = 100,
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Reminder[]> {
    const reminders = await _sql<Reminder[]>`
      SELECT 
        id, title, body, 
        time_of_day::TEXT,
        timezone,
        start_date,
        end_date,
        recurrence_type,
        array_to_json(weekly_days) as weekly_days,
        monthly_day,
        status,
        last_triggered,
        next_occurrence,
        created_by,
        workspace_id,
        created_at,
        updated_at
      FROM reminders
      WHERE status = 'active'
        AND next_occurrence <= NOW()
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      ORDER BY next_occurrence ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    return reminders;
  }

  async function markReminderTriggered(
    reminderId: string,
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    validateNodeId(reminderId, 'reminder');

    const result = await _sql`
      UPDATE reminders 
      SET 
        last_triggered = NOW(),
        status = CASE 
          WHEN recurrence_type = 'once' THEN 'completed'::reminder_status
          ELSE status
        END
      WHERE id = ${reminderId}
      RETURNING recurrence_type
    `;

    if (result.count === 0) {
      throw new NotFoundError('Reminder', reminderId);
    }
  }

  async function createAnnouncement(
    params: {
      reminderId: string;
      workspaceId: string;
      agentId?: string;
      delivered?: boolean;
      missedReason?: string;
    },
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<ReminderAnnouncement> {
    validateNodeId(params.reminderId, 'reminder');

    const [announcement] = await _sql<ReminderAnnouncement[]>`
      INSERT INTO reminder_announcements (
        reminder_id, workspace_id, announced_at, delivered, 
        delivered_at, agent_id, missed_reason
      ) VALUES (
        ${params.reminderId},
        ${params.workspaceId},
        CURRENT_TIMESTAMP,
        ${params.delivered || false},
        CASE WHEN ${params.delivered || false} THEN CURRENT_TIMESTAMP ELSE NULL END,
        ${params.agentId || null},
        ${params.missedReason || null}
      )
      RETURNING 
        id,
        reminder_id,
        announced_at,
        workspace_id,
        delivered,
        delivered_at,
        agent_id,
        missed_reason
    `;

    return announcement;
  }

  async function getMissedReminders(
    workspaceId: string,
    agentId: string,
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<Array<{ reminder: Reminder; announcement: ReminderAnnouncement }>> {
    const results = await _sql<(Reminder & ReminderAnnouncement & { announcementId: number })[]>`
      SELECT 
        r.id, r.title, r.body, 
        r.time_of_day::TEXT,
        r.timezone,
        r.start_date,
        r.end_date,
        r.recurrence_type,
        array_to_json(r.weekly_days) as weekly_days,
        r.monthly_day,
        r.status,
        r.last_triggered,
        r.next_occurrence,
        r.created_by,
        r.workspace_id,
        r.created_at,
        r.updated_at,
        ra.id as announcement_id,
        ra.reminder_id,
        ra.announced_at,
        ra.delivered,
        ra.delivered_at,
        ra.agent_id,
        ra.missed_reason
      FROM reminder_announcements ra
      JOIN reminders r ON r.id = ra.reminder_id
      WHERE ra.workspace_id = ${workspaceId}
        AND ra.delivered = false
        AND ra.agent_id = ${agentId}
      ORDER BY ra.announced_at ASC
    `;

    return results.map((row) => ({
      reminder: {
        id: row.id,
        title: row.title,
        body: row.body,
        timeOfDay: row.timeOfDay,
        timezone: row.timezone,
        startDate: row.startDate,
        endDate: row.endDate,
        recurrenceType: row.recurrenceType,
        weeklyDays: row.weeklyDays,
        monthlyDay: row.monthlyDay,
        status: row.status,
        lastTriggered: row.lastTriggered,
        nextOccurrence: row.nextOccurrence,
        createdBy: row.createdBy,
        workspaceId: row.workspaceId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      },
      announcement: {
        id: row.announcementId,
        reminderId: row.reminderId,
        announcedAt: row.announcedAt,
        workspaceId: row.workspaceId,
        delivered: row.delivered,
        deliveredAt: row.deliveredAt,
        agentId: row.agentId,
        missedReason: row.missedReason
      }
    }));
  }

  async function markAnnouncementDelivered(
    announcementId: number,
    _sql: PostgresConnection | PostgresTransactionConnection = sql
  ): Promise<void> {
    const result = await _sql`
      UPDATE reminder_announcements
      SET 
        delivered = true,
        delivered_at = NOW()
      WHERE id = ${announcementId}
    `;

    if (result.count === 0) {
      throw new NotFoundError('Announcement', announcementId.toString());
    }
  }

  return {
    createOneTimeReminder,
    createRecurringReminder,
    deleteReminder,
    getReminder,
    getDueReminders,
    markReminderTriggered,
    createAnnouncement,
    getMissedReminders,
    markAnnouncementDelivered
  };
}
