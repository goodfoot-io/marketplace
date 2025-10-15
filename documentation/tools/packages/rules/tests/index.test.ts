import { OrganizationParser } from '../src/index.js';
describe('OrganizationParser', () => {
  let parser: OrganizationParser;
  beforeEach(() => {
    parser = new OrganizationParser();
  });
  describe('constructor', () => {
    it('should create a parser instance', () => {
      expect(parser).toBeInstanceOf(OrganizationParser);
    });
  });
  describe('listRules', () => {
    it('should return all available rules', async () => {
      const rules = await parser.listRules();
      expect(rules).toContain('DUPLICATE_TEMPLATES_DIR');
      expect(rules).toContain('MISSING_BLACKBOARD');
      expect(rules).toContain('INVALID_STORY_SLUG');
      expect(rules).toContain('MISSING_REQUIRED_DIRECTORY');
      expect(rules).toContain('INVALID_VERSION_DIRECTORY_NAME');
    });
  });
  describe('addRule', () => {
    it('should add a custom rule', async () => {
      const customRule = {
        code: 'CUSTOM_RULE',
        title: 'Custom Rule',
        check: async () => Promise.resolve(null)
      };
      await parser.addRule(customRule);
      const rules = await parser.listRules();
      expect(rules).toContain('CUSTOM_RULE');
    });
  });
  describe('removeRule', () => {
    it('should remove a rule', async () => {
      await parser.removeRule('MISSING_BLACKBOARD');
      const rules = await parser.listRules();
      expect(rules).not.toContain('MISSING_BLACKBOARD');
    });
  });
  describe('checkRule', () => {
    it('should throw error for unknown rule', async () => {
      await expect(parser.checkRule('.', 'unknown-rule')).rejects.toThrow('Unknown rule: unknown-rule');
    });
  });
});
