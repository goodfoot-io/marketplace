Use this component when:
- Defining API contracts or data schemas
- Documenting configuration options
- Specifying validation rules
- Describing technical requirements
- Creating integration specifications

**Example user message:**
Document the request and response format for our user creation endpoint.

## Template

## [Feature/API] Implementation Specification

### Interface Definition
```typescript
interface [InterfaceName] {
  // Required fields
  [field1]: [type];                    // [Description, constraints]
  [field2]: [type];                    // [Min: X, Max: Y]

  // Optional fields
  [field3]?: [type];                   // [Default: value]
  [field4]?: [type][];                 // [Max items: N]

  // Nested objects
  [field5]: {
    [nestedField1]: [type];            // [Description]
    [nestedField2]: [type];            // [Description]
  };
}
```

### Request Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["[field1]", "[field2]"],
  "properties": {
    "[field1]": {
      "type": "[type]",
      "description": "[Description]",
      "minLength": [X],
      "maxLength": [Y],
      "pattern": "[regex]"
    },
    "[field2]": {
      "type": "[type]",
      "minimum": [X],
      "maximum": [Y]
    }
  }
}
```

### Validation Rules
```text
Field               Type        Required    Validation Rules
────────────────────────────────────────────────────────────────────
[field1]            string      Yes         • Length: 3-50 chars
                                           • Pattern: ^[a-zA-Z0-9_]+$
                                           • Unique in system

[field2]            number      Yes         • Range: 0-100
                                           • Integer only
                                           • Must be positive

[field3]            email       No          • Valid RFC 5322
                                           • Domain whitelist: [domains]
                                           • Max 255 chars

[field4]            array       No          • Max items: 10
                                           • Item type: string
                                           • No duplicates
```

### Configuration Parameters
```yaml
[component]:
  # Basic Settings (Required)
  [param1]: [type]                     # [Description]
                                       # Default: [value]
                                       # Range: [min-max]

  [param2]: [type]                     # [Description]
                                       # Options: [opt1, opt2, opt3]
                                       # Recommended: [opt1]

  # Advanced Settings (Optional)
  [advanced]:
    [param3]: [type]                   # [Description]
                                       # Impact: [What this affects]
                                       # Warning: [Potential issues]

    [param4]: [type]                   # [Description]
                                       # Dependencies: [param1] must be X
                                       # Performance impact: [High/Medium/Low]
```

### Database Schema
```sql
-- Table: [table_name]
-- Purpose: [Description]
CREATE TABLE [table_name] (
    -- Primary key
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Required fields
    [field1]        VARCHAR(255) NOT NULL,
    [field2]        INTEGER NOT NULL CHECK ([field2] > 0),

    -- Optional fields
    [field3]        TEXT,
    [field4]        JSONB DEFAULT '{}',

    -- Timestamps
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT [constraint_name] UNIQUE ([field1]),
    CONSTRAINT [constraint_name] CHECK ([complex_condition])
);

-- Indexes for performance
CREATE INDEX idx_[table]_[field] ON [table_name]([field1]);
CREATE INDEX idx_[table]_created ON [table_name](created_at DESC);
```

### State Transitions
```text
State           Allowed Transitions         Conditions
────────────────────────────────────────────────────────────────────────
[INITIAL]       → [STATE_A]                Always allowed
                → [STATE_B]                If [condition]

[STATE_A]       → [STATE_C]                After [duration]
                → [STATE_D]                On [event]
                → [INITIAL]                On error

[STATE_B]       → [STATE_C]                If [condition]
                ↛ [STATE_A]                Not allowed

[TERMINAL]      (No transitions)           Final state
```
