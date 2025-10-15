# Canonical Project Plan Section Order

## Overview

This document defines the canonical section order for all project implementation plans. Following this standardized structure ensures consistency across projects and improves integration between different components of the project creation workflow.

## Required Section Order

All project implementation plans MUST follow this exact section order:

```markdown
# Implementation Project: [Title]

## Executive Summary

## Problem Statement

## Success Criteria

## Technical Approach
### Core Implementation
### Integration Points
### Testing Strategy

## Assumptions and Risks

## Dependencies

## Implementation Roadmap

## Open Questions
```

## Section Descriptions

### 1. Implementation Project: [Title]
- Main title using the standardized format
- Title should be descriptive but concise
- Example: "Implementation Project: User Authentication System"

### 2. Executive Summary
- Brief overview of what will be implemented (2-4 sentences)
- Target audience: stakeholders who need quick understanding
- Should answer: What is being built and why?

### 3. Problem Statement
- Clear description of the problem being solved
- Context on why this problem needs solving now
- Impact of not solving the problem

### 4. Success Criteria
- Checkbox format with 3-7 specific, measurable goals
- Each criterion should be verifiable
- Format: `- [ ] Specific, measurable goal`
- Examples:
  - `- [ ] Users can log in with email and password`
  - `- [ ] Response time under 200ms for auth endpoints`
  - `- [ ] 100% test coverage for auth modules`

### 5. Technical Approach
Divided into three mandatory subsections:

#### Core Implementation
- Step-by-step implementation details
- Include specific file paths
- Use numbered list format
- Example:
  ```
  1. Create auth service at `packages/api/src/services/auth.ts`
  2. Implement JWT token generation in `packages/api/src/utils/jwt.ts`
  ```

#### Integration Points
- List all systems/components this will integrate with
- Include both incoming and outgoing integrations
- Specify interfaces and contracts

#### Testing Strategy
- Unit test approach and coverage goals
- Integration test scenarios
- E2E test requirements
- Performance testing needs (if applicable)

### 6. Assumptions and Risks
- **Assumptions**: Technical assumptions being made
  - Format: `**Assumption**: [Description]`
- **Risks**: Potential issues and their mitigations
  - Format: `**Risk**: [Description]`
  - Format: `**Mitigation**: [How to address]`

### 7. Dependencies
- External dependencies (libraries, services)
- Internal dependencies (other projects that must complete first)
- Use frontmatter for blocking dependencies:
  ```yaml
  ---
  dependencies: 
    - other-project-name
  ---
  ```

### 8. Implementation Roadmap
- High-level sequence of implementation
- Not time-based, but order-based
- Group related tasks together
- Example:
  ```
  1. Database schema and models
  2. Core authentication logic
  3. API endpoints
  4. Client integration
  5. Testing and validation
  ```

### 9. Open Questions
- Questions that need answers before or during implementation
- Format as bullet points
- Include who might have answers if known
- Example:
  - `- Should we support OAuth providers beyond Google?`
  - `- What session timeout should we enforce?`

## Flexibility and Parsing

### Allowed Variations
While the canonical order should be followed, parsers should handle minor variations:

1. **Section Name Variations** (map to canonical):
   - "Goals & Objectives" → "Success Criteria"
   - "Risks & Mitigations" → "Assumptions and Risks"
   - "Technical Design" → "Technical Approach"

2. **Optional Sections** (may be added after required sections):
   - "Performance Considerations"
   - "Security Considerations"
   - "Migration Plan"
   - "Rollback Plan"

### Validation Rules

1. **Required Sections**: All 9 sections must be present
2. **Section Order**: Must follow the canonical order
3. **Subsections**: Technical Approach must have all 3 subsections
4. **Format Compliance**: 
   - Success Criteria must use checkbox format
   - Technical Approach steps must include file paths
   - Assumptions and Risks must use bold labels

## Implementation Notes

### For Producers (Project Creators)
- Use the exact section names and order
- Include all required sections, even if minimal content
- Follow format requirements for each section
- Validate output before saving

### For Consumers (Assessors, Implementers)
- Expect sections in this order
- Handle minor naming variations gracefully
- Validate presence of all required sections
- Provide clear error messages for missing sections

## Migration Strategy

For existing project plans:
1. Identify non-compliant sections
2. Map old section names to canonical names
3. Reorder sections to match canonical order
4. Validate all required sections are present
5. Update content format where needed (e.g., checkbox format for Success Criteria)