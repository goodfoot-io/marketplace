import rule from '../../src/rules/MISSING_WORKSPACE_FILE.js';
import { createTestWorkspace, cleanupTestWorkspace } from '../lib/test-workspace.js';
describe('MISSING_WORKSPACE_FILE Rule (Deprecated)', () => {
  it('always returns null - rule deprecated due to protocol conflict', async () => {
    const workspace = await createTestWorkspace();
    // Rule is deprecated because it contradicts organization protocol's
    // specialist autonomy principle - files should be created "when needed"
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
});
