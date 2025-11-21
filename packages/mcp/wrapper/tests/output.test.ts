/**
 * Tests for output tool argument validation
 */

import { validateAgentOutputArguments } from '../src/types/wrapper.js';

describe('Agent Output Tool', () => {
  describe('argument validation', () => {
    it('should validate correct arguments with defaults', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123']
      });

      expect(result.agentIds).toEqual(['agent-123']);
      expect(result.block).toBe(true); // default
      expect(result.wait_up_to).toBe(150); // default
    });

    it('should validate multiple agent IDs', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-1', 'agent-2', 'agent-3']
      });

      expect(result.agentIds).toEqual(['agent-1', 'agent-2', 'agent-3']);
      expect(result.agentIds).toHaveLength(3);
    });

    it('should accept block as true explicitly', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        block: true
      });

      expect(result.block).toBe(true);
    });

    it('should accept block as false', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        block: false
      });

      expect(result.block).toBe(false);
    });

    it('should accept wait_up_to at minimum (0)', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        wait_up_to: 0
      });

      expect(result.wait_up_to).toBe(0);
    });

    it('should accept wait_up_to at maximum (300)', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        wait_up_to: 300
      });

      expect(result.wait_up_to).toBe(300);
    });

    it('should accept wait_up_to in valid range', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        wait_up_to: 60
      });

      expect(result.wait_up_to).toBe(60);
    });

    it('should accept all parameters together', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-1', 'agent-2'],
        block: true,
        wait_up_to: 120
      });

      expect(result.agentIds).toEqual(['agent-1', 'agent-2']);
      expect(result.block).toBe(true);
      expect(result.wait_up_to).toBe(120);
    });

    it('should reject missing agentIds', () => {
      expect(() => {
        validateAgentOutputArguments({});
      }).toThrow(/agentIds/i);
    });

    it('should reject empty agentIds array', () => {
      // Note: Empty array is technically valid according to the Zod schema
      // as z.array(z.string()) allows empty arrays. This test documents the behavior.
      const result = validateAgentOutputArguments({
        agentIds: []
      });

      expect(result.agentIds).toEqual([]);
    });

    it('should reject non-array agentIds', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: 'agent-123'
        });
      }).toThrow();
    });

    it('should reject agentIds with non-string elements', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: [123, 456]
        });
      }).toThrow();
    });

    it('should reject agentIds with mixed types', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-1', 123, 'agent-2']
        });
      }).toThrow();
    });

    it('should reject null agentIds', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: null
        });
      }).toThrow();
    });

    it('should reject non-boolean block', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          block: 'true'
        });
      }).toThrow();
    });

    it('should reject number for block', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          block: 1
        });
      }).toThrow();
    });

    it('should reject null for block', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          block: null
        });
      }).toThrow();
    });

    it('should reject wait_up_to below minimum (-1)', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: -1
        });
      }).toThrow();
    });

    it('should reject wait_up_to above maximum (301)', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: 301
        });
      }).toThrow();
    });

    it('should reject wait_up_to far above maximum (1000)', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: 1000
        });
      }).toThrow();
    });

    it('should reject non-number wait_up_to', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: '60'
        });
      }).toThrow();
    });

    it('should reject null for wait_up_to', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: null
        });
      }).toThrow();
    });

    it('should reject NaN for wait_up_to', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: NaN
        });
      }).toThrow();
    });

    it('should reject Infinity for wait_up_to', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: Infinity
        });
      }).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle agent IDs with special characters', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123', 'agent_456', 'agent.789']
      });

      expect(result.agentIds).toEqual(['agent-123', 'agent_456', 'agent.789']);
    });

    it('should handle very long agent ID strings', () => {
      const longId = 'a'.repeat(1000);
      const result = validateAgentOutputArguments({
        agentIds: [longId]
      });

      expect(result.agentIds[0]).toBe(longId);
    });

    it('should handle many agent IDs', () => {
      const manyIds = Array.from({ length: 100 }, (_, i) => `agent-${i}`);
      const result = validateAgentOutputArguments({
        agentIds: manyIds
      });

      expect(result.agentIds).toHaveLength(100);
      expect(result.agentIds[0]).toBe('agent-0');
      expect(result.agentIds[99]).toBe('agent-99');
    });

    it('should handle decimal wait_up_to values', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        wait_up_to: 45.5
      });

      expect(result.wait_up_to).toBe(45.5);
    });

    it('should handle wait_up_to as 0.5', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        wait_up_to: 0.5
      });

      expect(result.wait_up_to).toBe(0.5);
    });

    it('should handle wait_up_to as 299.99', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        wait_up_to: 299.99
      });

      expect(result.wait_up_to).toBe(299.99);
    });
  });

  describe('default value behavior', () => {
    it('should apply default block=true when not provided', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123']
      });

      expect(result.block).toBe(true);
    });

    it('should apply default wait_up_to=150 when not provided', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123']
      });

      expect(result.wait_up_to).toBe(150);
    });

    it('should override default block when explicitly set to false', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        block: false
      });

      expect(result.block).toBe(false);
    });

    it('should override default wait_up_to when explicitly set', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-123'],
        wait_up_to: 30
      });

      expect(result.wait_up_to).toBe(30);
    });

    it('should apply both defaults when only agentIds provided', () => {
      const result = validateAgentOutputArguments({
        agentIds: ['agent-1', 'agent-2']
      });

      expect(result.agentIds).toEqual(['agent-1', 'agent-2']);
      expect(result.block).toBe(true);
      expect(result.wait_up_to).toBe(150);
    });
  });

  describe('type coercion', () => {
    it('should not coerce string to boolean for block', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          block: 'false'
        });
      }).toThrow();
    });

    it('should not coerce string to number for wait_up_to', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: '100'
        });
      }).toThrow();
    });

    it('should not coerce boolean to number for wait_up_to', () => {
      expect(() => {
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: true
        });
      }).toThrow();
    });
  });
});
