import {
  type SessionState,
  isExecuteToolArguments,
  validateExecuteToolArguments,
  isTextContent,
  isToolUseContent,
  isToolResultContent,
  isSdkResultMessage,
  isSdkUserMessage,
  isSdkAssistantMessage,
  getEnvironmentAsRecord,
  validateEnvironment
} from '../src/types/browser.js';

describe('browser-types module', () => {
  describe('ExecuteToolArguments validation', () => {
    it('should validate valid arguments', () => {
      const valid: unknown = { prompt: 'test prompt', sessionId: 'session-123' };
      expect(isExecuteToolArguments(valid)).toBe(true);
      expect(() => validateExecuteToolArguments(valid)).not.toThrow();
    });

    it('should validate arguments without sessionId', () => {
      const valid: unknown = { prompt: 'test prompt' };
      expect(isExecuteToolArguments(valid)).toBe(true);
      expect(() => validateExecuteToolArguments(valid)).not.toThrow();
    });

    it('should reject arguments without prompt', () => {
      const invalid: unknown = { sessionId: 'session-123' };
      expect(isExecuteToolArguments(invalid)).toBe(false);
      expect(() => validateExecuteToolArguments(invalid)).toThrow('Invalid execute tool arguments');
    });

    it('should reject arguments with empty prompt', () => {
      const invalid: unknown = { prompt: '', sessionId: 'session-123' };
      expect(isExecuteToolArguments(invalid)).toBe(false);
      expect(() => validateExecuteToolArguments(invalid)).toThrow('Invalid execute tool arguments');
    });

    it('should reject arguments with whitespace-only prompt', () => {
      const invalid: unknown = { prompt: '   ', sessionId: 'session-123' };
      expect(isExecuteToolArguments(invalid)).toBe(false);
      expect(() => validateExecuteToolArguments(invalid)).toThrow('Invalid execute tool arguments');
    });

    it('should reject arguments with non-string prompt', () => {
      const invalid: unknown = { prompt: 123, sessionId: 'session-123' };
      expect(isExecuteToolArguments(invalid)).toBe(false);
      expect(() => validateExecuteToolArguments(invalid)).toThrow('Invalid execute tool arguments');
    });

    it('should reject arguments with non-string sessionId', () => {
      const invalid: unknown = { prompt: 'test', sessionId: 123 };
      expect(isExecuteToolArguments(invalid)).toBe(false);
      expect(() => validateExecuteToolArguments(invalid)).toThrow('Invalid execute tool arguments');
    });

    it('should reject null arguments', () => {
      const invalid: unknown = null;
      expect(isExecuteToolArguments(invalid)).toBe(false);
      expect(() => validateExecuteToolArguments(invalid)).toThrow('received: null');
    });

    it('should reject undefined arguments', () => {
      const invalid: unknown = undefined;
      expect(isExecuteToolArguments(invalid)).toBe(false);
      expect(() => validateExecuteToolArguments(invalid)).toThrow('received: undefined');
    });

    it('should handle objects with extra properties', () => {
      // Objects with extra properties should still be valid if they have the required fields
      const withExtra: unknown = { prompt: 'test', sessionId: 'abc', extra: 'field' };
      expect(isExecuteToolArguments(withExtra)).toBe(true);
      expect(() => validateExecuteToolArguments(withExtra)).not.toThrow();
    });

    it('should provide helpful error messages', () => {
      const stringValue: unknown = 'not an object';
      expect(() => validateExecuteToolArguments(stringValue)).toThrow('received: "not an object"');

      const numberValue: unknown = 42;
      expect(() => validateExecuteToolArguments(numberValue)).toThrow('received: 42');

      const booleanValue: unknown = true;
      expect(() => validateExecuteToolArguments(booleanValue)).toThrow('received: true');
    });
  });

  describe('Message content type guards', () => {
    it('should identify TextContent', () => {
      const text = { type: 'text', text: 'hello world' };
      expect(isTextContent(text)).toBe(true);
      expect(isToolUseContent(text)).toBe(false);
      expect(isToolResultContent(text)).toBe(false);
    });

    it('should identify ToolUseContent', () => {
      const toolUse = { type: 'tool_use', name: 'execute', input: { prompt: 'test' } };
      expect(isToolUseContent(toolUse)).toBe(true);
      expect(isTextContent(toolUse)).toBe(false);
      expect(isToolResultContent(toolUse)).toBe(false);
    });

    it('should identify ToolResultContent', () => {
      const toolResult = { type: 'tool_result', content: 'result data', is_error: false };
      expect(isToolResultContent(toolResult)).toBe(true);
      expect(isTextContent(toolResult)).toBe(false);
      expect(isToolUseContent(toolResult)).toBe(false);
    });

    it('should reject invalid content types', () => {
      const invalid = { type: 'unknown', data: 'test' };
      expect(isTextContent(invalid)).toBe(false);
      expect(isToolUseContent(invalid)).toBe(false);
      expect(isToolResultContent(invalid)).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(isTextContent(null)).toBe(false);
      expect(isTextContent(undefined)).toBe(false);
      expect(isToolUseContent(null)).toBe(false);
      expect(isToolUseContent(undefined)).toBe(false);
      expect(isToolResultContent(null)).toBe(false);
      expect(isToolResultContent(undefined)).toBe(false);
    });
  });

  describe('SDK message type guards', () => {
    it('should identify SdkResultMessage', () => {
      const resultMsg = { type: 'result', subtype: 'success', result: 'done' };
      expect(isSdkResultMessage(resultMsg)).toBe(true);
      expect(isSdkUserMessage(resultMsg)).toBe(false);
      expect(isSdkAssistantMessage(resultMsg)).toBe(false);
    });

    it('should identify SdkUserMessage', () => {
      const userMsg = { type: 'user', message: { content: [] } };
      expect(isSdkUserMessage(userMsg)).toBe(true);
      expect(isSdkResultMessage(userMsg)).toBe(false);
      expect(isSdkAssistantMessage(userMsg)).toBe(false);
    });

    it('should identify SdkAssistantMessage', () => {
      const assistantMsg = { type: 'assistant', message: { content: [] } };
      expect(isSdkAssistantMessage(assistantMsg)).toBe(true);
      expect(isSdkResultMessage(assistantMsg)).toBe(false);
      expect(isSdkUserMessage(assistantMsg)).toBe(false);
    });

    it('should handle error subtypes', () => {
      const errorMsg = { type: 'result', subtype: 'error_max_turns' };
      expect(isSdkResultMessage(errorMsg)).toBe(true);

      const errorMsg2 = { type: 'result', subtype: 'error_during_execution' };
      expect(isSdkResultMessage(errorMsg2)).toBe(true);
    });
  });

  describe('Environment variable validation', () => {
    it('should filter out undefined values', () => {
      const env: NodeJS.ProcessEnv = {
        VALID: 'value',
        UNDEFINED: undefined,
        ANOTHER: 'test'
      };

      const result = getEnvironmentAsRecord(env);
      expect(result).toEqual({
        VALID: 'value',
        ANOTHER: 'test'
      });
      expect('UNDEFINED' in result).toBe(false);
    });

    it('should handle empty environment', () => {
      const env: NodeJS.ProcessEnv = {};
      const result = getEnvironmentAsRecord(env);
      expect(result).toEqual({});
    });

    it('should validate environment variables', () => {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: 'test',
        PATH: '/usr/bin',
        MISSING: undefined
      };

      const validated = validateEnvironment(env);
      expect(validated.NODE_ENV).toBe('test');
      expect(validated.PATH).toBe('/usr/bin');
      expect('MISSING' in validated).toBe(false);
    });
  });

  describe('SessionState interface export', () => {
    it('should be able to use SessionState interface', () => {
      const session: SessionState = {
        id: 'test-123',
        sdkSessionId: 'sdk-456',
        createdAt: new Date(),
        lastActivity: new Date(),
        browserContextId: 'browser-789',
        conversationHistory: ['User: hello', 'Assistant: hi'],
        isFirstQuery: false
      };

      expect(session.id).toBe('test-123');
      expect(session.conversationHistory).toHaveLength(2);
    });

    it('should work with minimal required fields', () => {
      const session: SessionState = {
        id: 'test-123',
        createdAt: new Date(),
        lastActivity: new Date(),
        conversationHistory: [],
        isFirstQuery: true
      };

      expect(session.sdkSessionId).toBeUndefined();
      expect(session.browserContextId).toBeUndefined();
    });
  });
});
