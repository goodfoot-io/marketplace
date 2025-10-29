import * as fs from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';

/**
 * Creates a temporary workspace directory for testing
 */
export async function createTestWorkspace(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'parser-test-'));
  return tempDir;
}

/**
 * Cleans up a test workspace
 */
export async function cleanupTestWorkspace(workspacePath: string): Promise<void> {
  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Creates a directory structure in the test workspace
 */
export async function createDirectory(workspacePath: string, relativePath: string): Promise<void> {
  const fullPath = path.join(workspacePath, relativePath);
  await fs.mkdir(fullPath, { recursive: true });
}

/**
 * Creates a file with content in the test workspace
 */
export async function createFile(workspacePath: string, relativePath: string, content: string = ''): Promise<void> {
  const fullPath = path.join(workspacePath, relativePath);
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
}

/**
 * Creates a standard story structure
 */
export async function createStory(workspacePath: string, rootDir: string, storySlug: string): Promise<void> {
  const storyPath = path.join(rootDir, storySlug);

  // Create all required directories
  const directories = [
    'agents',
    'agents/messages',
    'agents/performance-reviews',
    'sources',
    'sources/documents',
    'sources/interviews',
    'sources/data',
    'sources/synthesis',
    'sources/archives',
    'essay'
  ];

  for (const dir of directories) {
    await createDirectory(workspacePath, path.join(storyPath, dir));
  }

  // Create default version directory
  await createDirectory(workspacePath, path.join(storyPath, 'essay/2501130945-initial-draft'));
  await createDirectory(workspacePath, path.join(storyPath, 'essay/2501130945-initial-draft/workspace'));
  await createDirectory(workspacePath, path.join(storyPath, 'essay/2501130945-initial-draft/reviews'));

  // Create required version files
  await createFile(
    workspacePath,
    path.join(storyPath, 'essay/2501130945-initial-draft/essay.md'),
    `---\ntitle: "Test Essay"\nstatus: draft\ncontributors: [writer-specialist]\ntarget_audience: general-educated\n---\n\n# Essay Title\n\nEssay content.`
  );
  await createFile(
    workspacePath,
    path.join(storyPath, 'essay/2501130945-initial-draft/rubric.md'),
    `# Style Rubric\n\n## Tone\n- Professional\n- Engaging\n\n## Structure\n- Clear introduction\n- Logical flow`
  );
  await createFile(
    workspacePath,
    path.join(storyPath, 'essay/2501130945-initial-draft/user-feedback.md'),
    `## Request\nWrite an informative article about the topic.\n\n## Intent Analysis\n- Literal request: Create an article\n- Underlying goal: Educate readers\n- Success criteria: Clear and informative\n\n## Implementation\n- Priorities: Clarity and accuracy\n- Specialists needed: Writer and researcher\n- Key context: General audience`
  );

  // Create required workspace files
  await createFile(
    workspacePath,
    path.join(storyPath, 'essay/2501130945-initial-draft/workspace/research-notes.md'),
    `---\nphase: initial-discovery\nsources_reviewed: 5\nkey_gaps: [regional-data, youth-perspectives]\nnext_priorities: [expand-sources, expert-interviews]\n---\n\n# Research Notes\n\nInitial research findings.`
  );
  await createFile(
    workspacePath,
    path.join(storyPath, 'essay/2501130945-initial-draft/workspace/outline.md'),
    `---\nphase: structure-planning\nsources_reviewed: 10\nkey_gaps: [conclusion-weak]\nnext_priorities: [strengthen-conclusion, add-examples]\n---\n\n# Story Outline\n\n## Introduction\n- Hook\n- Context\n\n## Main Body\n- Point 1\n- Point 2\n\n## Conclusion`
  );
  await createFile(
    workspacePath,
    path.join(storyPath, 'essay/2501130945-initial-draft/workspace/research-synthesis.md'),
    `---\nphase: pattern-analysis\nsources_reviewed: 12\nkey_gaps: [cross-reference-needed]\nnext_priorities: [narrative-threads, theme-connections]\n---\n\n# Research Synthesis\n\n## Key Patterns\n- Pattern 1: Recurring theme across sources\n- Pattern 2: Conflicting perspectives\n\n## Narrative Threads\n- Main thread: Central story arc\n- Supporting thread: Background context`
  );

  const blackboardContent = `project_metadata:
  primary_topic: test
  latest_version: 2501130945-initial-draft
  latest_file: essay/2501130945-initial-draft/essay.md

shared_knowledge:
  key_insights: []
  open_questions: []
  resource_links: []

agent_activity:
  active_agents: []
  
specialist_requests:
  pending: []
  completed: []`;

  await createFile(workspacePath, path.join(storyPath, 'agents/blackboard.yaml'), blackboardContent);
}

/**
 * Checks if a file exists
 */
export async function fileExists(workspacePath: string, relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(workspacePath, relativePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads file content
 */
export async function readFile(workspacePath: string, relativePath: string): Promise<string> {
  return await fs.readFile(path.join(workspacePath, relativePath), 'utf-8');
}

/**
 * Deletes a file from the test workspace
 */
export async function deleteFile(workspacePath: string, relativePath: string): Promise<void> {
  try {
    await fs.unlink(path.join(workspacePath, relativePath));
  } catch {
    // Ignore errors if file doesn't exist
  }
}
