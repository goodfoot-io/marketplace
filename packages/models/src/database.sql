CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SEQUENCE IF NOT EXISTS list_id_seq;
CREATE SEQUENCE IF NOT EXISTS task_id_seq;
CREATE SEQUENCE IF NOT EXISTS note_id_seq;
CREATE SEQUENCE IF NOT EXISTS question_id_seq;
CREATE SEQUENCE IF NOT EXISTS edge_id_seq;
CREATE SEQUENCE IF NOT EXISTS conversation_id_seq;
CREATE SEQUENCE IF NOT EXISTS conversation_message_id_seq;
CREATE SEQUENCE IF NOT EXISTS reminder_id_seq;

CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
  body TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  workspace_id VARCHAR(255) NOT NULL DEFAULT 'default'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_title_workspace_id ON lists(title, workspace_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  list_id TEXT REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
  body TEXT,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  "position" INTEGER NOT NULL, -- "position" needs to be quoted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  workspace_id VARCHAR(255) NOT NULL DEFAULT 'default'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_title_list_id_workspace_id ON tasks(title, list_id, workspace_id) WHERE completed = FALSE;

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
  body TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  workspace_id VARCHAR(255) NOT NULL DEFAULT 'default'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_title_workspace_id ON notes(title, workspace_id);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  src_id TEXT NOT NULL, -- No direct FK constraint to allow linking to different types of nodes
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
  body TEXT,
  answer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  workspace_id VARCHAR(255) NOT NULL DEFAULT 'default'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_title_src_id_workspace_id ON questions(title, src_id, workspace_id);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  src_id TEXT NOT NULL, -- No direct FK constraint to allow linking to different types of nodes
  dst_id TEXT NOT NULL, -- No direct FK constraint
  description TEXT, -- Renamed from 'label' to match existing, though plan said 'label'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
  UNIQUE(src_id, dst_id, workspace_id) -- An edge is uniquely defined by its source, destination, and workspace
);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lists_modtime
BEFORE UPDATE ON lists
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_tasks_modtime
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_notes_modtime
BEFORE UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_questions_modtime
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_edges_modtime
BEFORE UPDATE ON edges
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  voice_session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_name TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  workspace_id VARCHAR(255) NOT NULL DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_conversations_voice_session_id ON conversations(voice_session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON conversations(workspace_id);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  message_id TEXT NOT NULL, -- External message ID from transcript
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  audio_transcript BOOLEAN DEFAULT FALSE NOT NULL,
  tool_call JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  workspace_id VARCHAR(255) NOT NULL DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_message_id ON conversation_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON conversation_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_workspace_id ON conversation_messages(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_unique_message ON conversation_messages(conversation_id, message_id, workspace_id);

CREATE TRIGGER update_conversations_modtime
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_conversation_messages_modtime
BEFORE UPDATE ON conversation_messages
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE INDEX IF NOT EXISTS idx_lists_workspace_id ON lists(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notes_workspace_id ON notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_questions_workspace_id ON questions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_edges_workspace_id ON edges(workspace_id);

-- Reminder system types
CREATE TYPE reminder_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE recurrence_type AS ENUM ('once', 'daily', 'weekdays', 'weekends', 'weekly', 'monthly');
CREATE TYPE day_of_week AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
  body TEXT,
  
  -- Timing
  time_of_day TIME NOT NULL,
  timezone TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Recurrence
  recurrence_type recurrence_type DEFAULT 'once' NOT NULL,
  weekly_days day_of_week[],
  monthly_day INTEGER CHECK (monthly_day BETWEEN 1 AND 31),
  
  -- State
  status reminder_status DEFAULT 'active' NOT NULL,
  last_triggered TIMESTAMP WITH TIME ZONE,
  next_occurrence TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metadata
  created_by TEXT NOT NULL DEFAULT 'voice_agent',
  workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Announcement tracking for delivery guarantees
CREATE TABLE IF NOT EXISTS reminder_announcements (
  id SERIAL PRIMARY KEY,
  reminder_id TEXT REFERENCES reminders(id) ON DELETE CASCADE NOT NULL,
  announced_at TIMESTAMP WITH TIME ZONE NOT NULL,
  workspace_id VARCHAR(255) NOT NULL,
  delivered BOOLEAN DEFAULT FALSE NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE,
  agent_id TEXT,
  missed_reason TEXT
);

-- Indexes for reminders
CREATE INDEX IF NOT EXISTS idx_reminders_due 
  ON reminders(next_occurrence, status) 
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_reminders_workspace 
  ON reminders(workspace_id) 
  WHERE deleted_at IS NULL;

-- Function to calculate next reminder occurrence
CREATE OR REPLACE FUNCTION calculate_next_reminder(
  p_time TIME,
  p_timezone TEXT,
  p_recurrence recurrence_type,
  p_weekly_days day_of_week[],
  p_monthly_day INTEGER,
  p_from_date DATE DEFAULT CURRENT_DATE
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  v_next_date DATE;
  v_dow INTEGER;
BEGIN
  CASE p_recurrence
    WHEN 'once' THEN
      -- If time already passed today, use tomorrow
      IF (p_from_date + p_time) AT TIME ZONE p_timezone <= NOW() THEN
        v_next_date := p_from_date + 1;
      ELSE
        v_next_date := p_from_date;
      END IF;
      
    WHEN 'daily' THEN
      -- Next occurrence is tomorrow
      v_next_date := p_from_date + 1;
      
    WHEN 'weekdays' THEN
      -- Find next weekday (Mon-Fri)
      v_next_date := p_from_date + 1;
      WHILE EXTRACT(DOW FROM v_next_date) IN (0, 6) LOOP
        v_next_date := v_next_date + 1;
      END LOOP;
      
    WHEN 'weekends' THEN
      -- Find next weekend day (Sat-Sun)
      v_next_date := p_from_date + 1;
      WHILE EXTRACT(DOW FROM v_next_date) NOT IN (0, 6) LOOP
        v_next_date := v_next_date + 1;
      END LOOP;
      
    WHEN 'weekly' THEN
      -- Find next matching day from weekly_days array
      v_next_date := p_from_date + 1;
      LOOP
        v_dow := CASE EXTRACT(DOW FROM v_next_date)
          WHEN 0 THEN 7  -- Sunday
          ELSE EXTRACT(DOW FROM v_next_date)::INTEGER
        END;
        
        -- Check if current day matches any in the array
        IF EXISTS (
          SELECT 1 FROM unnest(p_weekly_days) AS day
          WHERE (day = 'MON' AND v_dow = 1)
             OR (day = 'TUE' AND v_dow = 2)
             OR (day = 'WED' AND v_dow = 3)
             OR (day = 'THU' AND v_dow = 4)
             OR (day = 'FRI' AND v_dow = 5)
             OR (day = 'SAT' AND v_dow = 6)
             OR (day = 'SUN' AND v_dow = 7)
        ) THEN
          EXIT;
        END IF;
        v_next_date := v_next_date + 1;
      END LOOP;
      
    WHEN 'monthly' THEN
      -- Next occurrence on specified day of next month
      v_next_date := (DATE_TRUNC('MONTH', p_from_date) + INTERVAL '1 MONTH')::DATE;
      -- Handle months with fewer days
      IF p_monthly_day > EXTRACT(DAY FROM (DATE_TRUNC('MONTH', v_next_date) + INTERVAL '1 MONTH - 1 DAY')::DATE) THEN
        v_next_date := (DATE_TRUNC('MONTH', v_next_date) + INTERVAL '1 MONTH - 1 DAY')::DATE;
      ELSE
        v_next_date := v_next_date + (p_monthly_day - 1);
      END IF;
  END CASE;
  
  -- Combine date and time in the specified timezone
  RETURN (v_next_date + p_time) AT TIME ZONE p_timezone;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger to update next_occurrence
CREATE OR REPLACE FUNCTION update_next_occurrence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.recurrence_type != 'once' THEN
    NEW.next_occurrence := calculate_next_reminder(
      NEW.time_of_day,
      NEW.timezone,
      NEW.recurrence_type,
      NEW.weekly_days,
      NEW.monthly_day,
      NEW.last_triggered::DATE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reminder_occurrence
BEFORE UPDATE ON reminders
FOR EACH ROW
WHEN (OLD.last_triggered IS DISTINCT FROM NEW.last_triggered)
EXECUTE FUNCTION update_next_occurrence();

-- Update trigger for reminders
CREATE TRIGGER update_reminders_modtime
BEFORE UPDATE ON reminders
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Graph update notification function
CREATE OR REPLACE FUNCTION notify_graph_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'graph_updated',
    json_build_object(
      'workspace_id', COALESCE(NEW.workspace_id, OLD.workspace_id),
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Graph update triggers
CREATE TRIGGER graph_update_lists
AFTER INSERT OR UPDATE OR DELETE ON lists
FOR EACH ROW
EXECUTE FUNCTION notify_graph_update();

CREATE TRIGGER graph_update_tasks
AFTER INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW
EXECUTE FUNCTION notify_graph_update();

CREATE TRIGGER graph_update_notes
AFTER INSERT OR UPDATE OR DELETE ON notes
FOR EACH ROW
EXECUTE FUNCTION notify_graph_update();

CREATE TRIGGER graph_update_questions
AFTER INSERT OR UPDATE OR DELETE ON questions
FOR EACH ROW
EXECUTE FUNCTION notify_graph_update();

CREATE TRIGGER graph_update_edges
AFTER INSERT OR UPDATE OR DELETE ON edges
FOR EACH ROW
EXECUTE FUNCTION notify_graph_update();

CREATE TRIGGER graph_update_reminders
AFTER INSERT OR UPDATE OR DELETE ON reminders
FOR EACH ROW
EXECUTE FUNCTION notify_graph_update();

