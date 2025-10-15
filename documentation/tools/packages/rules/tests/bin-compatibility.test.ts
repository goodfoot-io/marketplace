import { OrganizationParser } from '../src/index.js';
describe('Bin script compatibility', () => {
  it('should provide all fields expected by bin/rules-check.ts', async () => {
    const parser = new OrganizationParser();
    // Create a mock rule that returns a violation
    await parser.addRule({
      code: 'TEST_RULE',
      title: 'Test Rule',
      check: () => {
        return Promise.resolve([
          {
            code: 'TEST_RULE',
            title: 'Test Rule Title',
            description: 'This is a test violation description',
            location: 'test/location',
            severity: 'error' as const
          }
        ]);
      }
    });
    const result = await parser.parse('.', ['TEST_RULE']);
    expect(result.violations).toHaveLength(1);
    const violation = result.violations[0];
    // Check fields that bin/rules-check.ts now correctly uses
    expect(violation.code).toBe('TEST_RULE');
    expect(violation.title).toBe('Test Rule Title');
    expect(violation.description).toBe('This is a test violation description');
    expect(violation.location).toBe('test/location');
    // These fields should not exist on RuleViolation
    expect('message' in violation).toBe(false);
    expect('file' in violation).toBe(false);
  });
  it('should handle violations without optional fields', async () => {
    const parser = new OrganizationParser();
    await parser.addRule({
      code: 'MINIMAL_RULE',
      title: 'Minimal Rule',
      check: () => {
        return Promise.resolve([
          {
            code: 'MINIMAL_RULE',
            title: 'Minimal Violation',
            description: 'This violation has only required fields',
            location: 'some/path'
            // No severity specified - should have a default
          }
        ]);
      }
    });
    const result = await parser.parse('.', ['MINIMAL_RULE']);
    expect(result.violations).toHaveLength(1);
    const violation = result.violations[0];
    // Verify all required fields are present
    expect(violation.code).toBe('MINIMAL_RULE');
    expect(violation.title).toBe('Minimal Violation');
    expect(violation.description).toBe('This violation has only required fields');
    expect(violation.location).toBe('some/path');
  });
});
