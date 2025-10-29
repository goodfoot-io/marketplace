import rule from '../../src/rules/INVALID_BLACKBOARD_STRUCTURE.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('INVALID_BLACKBOARD_STRUCTURE Rule', () => {
  it('returns null when blackboard has valid structure', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const validBlackboard = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', validBlackboard);
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing required top-level sections', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const incompleteBlackboard = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
shared_knowledge:
  key_insights: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', incompleteBlackboard);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(
      violations!.some((v) => v.description.includes('missing required sections: agent_activity, specialist_requests'))
    ).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing required project_metadata fields', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const incompleteMetadata = `project_metadata:
  primary_topic: Test Topic
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', incompleteMetadata);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(
      violations!.some((v) =>
        v.description.includes('project_metadata missing required fields: latest_version, latest_file')
      )
    ).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('detects invalid shared_knowledge array fields', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidArrays = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: "not an array"
  open_questions: []
  resource_links: 123
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', invalidArrays);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(
      violations!.some((v) =>
        v.description.includes('Blackboard shared_knowledge fields must be arrays: key_insights, resource_links')
      )
    ).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('detects invalid YAML syntax', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidYaml = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  invalid_yaml: [unclosed array
shared_knowledge:
  key_insights: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', invalidYaml);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(violations!.some((v) => v.description.includes('invalid YAML'))).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores stories without blackboard files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-without-blackboard');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    const dirs = ['active', 'published', 'archive'];
    for (const dir of dirs) {
      await createStory(workspace, dir, `${dir}-story`);
      // Create blackboard with missing sections
      await createFile(
        workspace,
        `${dir}/${dir}-story/agents/blackboard.yaml`,
        'project_metadata:\n  primary_topic: incomplete\n'
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(3);
    await cleanupTestWorkspace(workspace);
  });
  it('allows optional fields to be missing', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const minimalValid = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', minimalValid);
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', 'incomplete: structure');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'INVALID_BLACKBOARD_STRUCTURE',
      location: 'active/test-story/agents/blackboard.yaml'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('detects forbidden derivable fields in project_metadata', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithForbiddenFields = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
  story_slug: test-story
  created: 2025-01-10T10:00:00Z
  current_version: working
  working_file: essay/working/draft.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithForbiddenFields);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(
      violations!.some((v) =>
        v.description.includes(
          'Blackboard project_metadata contains derivable fields that should not be stored: story_slug, created, current_version, working_file'
        )
      )
    ).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('detects forbidden fields in agent_activity', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithForbiddenActivity = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
agent_activity:
  active_agents: []
  last_updated: 2025-01-10T11:00:00Z
  version_context: some_version
specialist_requests:
  pending: []
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithForbiddenActivity);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(
      violations!.some((v) =>
        v.description.includes(
          'Blackboard agent_activity contains derivable fields that should not be stored: last_updated, version_context'
        )
      )
    ).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('detects forbidden fields in specialist_requests items', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithForbiddenRequests = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
agent_activity:
  active_agents: []
specialist_requests:
  pending:
    - request: "Review draft"
      timestamp: 2025-01-10T12:00:00Z
      version: 2501130945-initial-research
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithForbiddenRequests);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(
      violations!.some((v) =>
        v.description.includes(
          'Blackboard specialist_requests.pending[0] contains derivable fields (timestamp/version) that should not be stored'
        )
      )
    ).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('validates provisional_sources structure when present', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithProvisional = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []
provisional_sources:
  - source_url: "https://example.com/article"
    claim_to_support: "Example supports main thesis"
    status: "pending_vetting"
    requesting_specialist: "writer-specialist"`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithProvisional);
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects invalid provisional_sources entries', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithInvalidProvisional = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []
provisional_sources:
  - source_url: "https://example.com/article"
    claim_to_support: "Example supports main thesis"
    status: "invalid_status"
  - claim_to_support: "Missing source_url"
    status: "pending_vetting"
    requesting_specialist: "writer-specialist"`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithInvalidProvisional);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expect(violations![0].description).toContain('missing required fields: requesting_specialist');
    expect(violations![1].description).toContain('invalid status');
    expect(violations![2].description).toContain('missing required fields: source_url');
    await cleanupTestWorkspace(workspace);
  });
  it('allows empty provisional_sources array', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithEmptyProvisional = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []
provisional_sources: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithEmptyProvisional);
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('validates all provisional_sources status transitions', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithAllStatuses = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []
provisional_sources:
  - source_url: "https://example.com/pending"
    claim_to_support: "Pending vetting"
    status: "pending_vetting"
    requesting_specialist: "writer-specialist"
  - source_url: "https://example.com/approved"
    claim_to_support: "Approved source"
    status: "approved"
    requesting_specialist: "researcher-specialist"
  - source_url: "https://example.com/rejected"
    claim_to_support: "Rejected source"
    status: "rejected"
    requesting_specialist: "fact-checker-specialist"`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithAllStatuses);
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects provisional_sources with non-array value', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithNonArrayProvisional = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []
provisional_sources: "not an array"`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithNonArrayProvisional);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.some((v) => v.description.includes('provisional_sources must be an array'))).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('validates provisional_sources with extra fields are allowed', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithExtraFields = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending: []
  completed: []
provisional_sources:
  - source_url: "https://example.com/article"
    claim_to_support: "Example supports main thesis"
    status: "pending_vetting"
    requesting_specialist: "writer-specialist"
    notes: "Additional context about this source"
    date_requested: "2025-01-13"`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithExtraFields);
    const violations = await rule.check(workspace);
    // Extra fields should be allowed
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('validates specialist request required fields', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithInvalidRequests = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending:
    - specialist: researcher-specialist
      needs: "Find more sources"
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithInvalidRequests);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(violations!.some((v) => v.description.includes('missing required fields: blocking, work_location'))).toBe(
      true
    );
    await cleanupTestWorkspace(workspace);
  });
  it('validates writer requests have narrative_purpose field', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithWriterRequest = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending:
    - specialist: writer-specialist
      needs: "Write initial draft"
      blocking: false
      work_location: "essay/2501130945-initial-research/essay.md"
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithWriterRequest);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(2);
    expect(
      violations!.some((v) => v.description.includes("writer requests must include 'narrative_purpose' field"))
    ).toBe(true);
    expect(violations!.some((v) => v.description.includes("writer requests must have 'blocking: true'"))).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('validates blocking requests have blocking_issue field', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithBlockingRequest = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending:
    - specialist: researcher-specialist
      needs: "Find economic data"
      blocking: true
      work_location: "sources/data/"
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithBlockingRequest);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(
      violations!.some((v) => v.description.includes("blocking requests must include 'blocking_issue' field"))
    ).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('allows valid specialist requests with all fields', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithValidRequests = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending:
    - specialist: writer-specialist
      needs: "Write climate impact section"
      blocking: true
      blocking_issue: "Need synthesis of research data"
      narrative_purpose: "To establish baseline understanding of climate effects"
      work_location: "essay/2501130945-initial-research/essay.md"
      specific_gaps:
        - "Regional climate variations"
        - "Economic impact projections"
  completed:
    - specialist: researcher-specialist
      needs: "Find academic sources"
      blocking: false
      work_location: "sources/documents/"
      outcome: "Found 15 relevant papers"
      performance: "High - comprehensive coverage"`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithValidRequests);
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects writer requests without narrative_purpose field', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithWriterMissingNarrative = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending:
    - specialist: writer-specialist
      needs: "Write introduction"
      blocking: true
      blocking_issue: "Need research synthesis"
      work_location: "essay/2501130945-initial-research/essay.md"
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithWriterMissingNarrative);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(
      violations!.some((v) => v.description.includes("writer requests must include 'narrative_purpose' field"))
    ).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('detects writer requests with blocking: false', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithWriterNotBlocking = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending:
    - specialist: writer-specialist
      needs: "Write introduction"
      blocking: false
      narrative_purpose: "Set context for the essay"
      work_location: "essay/2501130945-initial-research/essay.md"
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithWriterNotBlocking);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    expect(violations!.some((v) => v.description.includes("writer requests must have 'blocking: true'"))).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('validates multiple writer requests independently', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const blackboardWithMultipleWriterRequests = `project_metadata:
  primary_topic: Test Topic
  latest_version: 2501130945-initial-research
  latest_file: essay/2501130945-initial-research/essay.md
shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []
agent_activity:
  active_agents: []
specialist_requests:
  pending:
    - specialist: writer-specialist
      needs: "Write introduction"
      blocking: false
      work_location: "essay/2501130945-initial-research/essay.md"
    - specialist: writer-specialist
      needs: "Write conclusion"
      blocking: true
      blocking_issue: "Need final synthesis"
      work_location: "essay/2501130945-initial-research/essay.md"
  completed: []`;
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', blackboardWithMultipleWriterRequests);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(3); // Each writer request should have 2 violations
    expect(violations!.filter((v) => v.description.includes('narrative_purpose')).length).toBe(2);
    expect(violations!.filter((v) => v.description.includes('blocking: true')).length).toBe(1);
    await cleanupTestWorkspace(workspace);
  });
});
