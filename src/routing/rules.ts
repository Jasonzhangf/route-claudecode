/**
 * Default Routing Rules
 * Provides built-in routing rules for common scenarios
 */

import { RoutingRule, BaseRequest } from '@/types';

/**
 * Default routing rules based on common patterns
 */
export const defaultRoutingRules: RoutingRule[] = [
  // High-priority thinking requests
  {
    category: 'thinking',
    priority: 100,
    provider: 'primary-codewhisperer',
    condition: (request: BaseRequest) => {
      return request.metadata?.thinking === true;
    }
  },

  // Long context requests
  {
    category: 'longcontext',
    priority: 90,
    provider: 'longcontext-provider',
    condition: (request: BaseRequest) => {
      // Check for explicit long context indicators
      const content = JSON.stringify(request.messages);
      return content.length > 200000 || // Very long messages
             request.messages.length > 50; // Many messages in conversation
    }
  },

  // Search and web browsing requests
  {
    category: 'search',
    priority: 80,
    provider: 'search-provider',
    condition: (request: BaseRequest) => {
      const tools = request.metadata?.tools || [];
      return tools.some((tool: any) => 
        tool.name && (
          tool.name.toLowerCase().includes('search') ||
          tool.name.toLowerCase().includes('web') ||
          tool.name.toLowerCase().includes('browse') ||
          tool.name.toLowerCase().includes('internet')
        )
      );
    }
  },

  // Background processing for simple requests
  {
    category: 'background',
    priority: 70,
    provider: 'background-provider',
    condition: (request: BaseRequest) => {
      // Check for haiku model or simple requests
      const isHaikuModel = request.model.toLowerCase().includes('haiku');
      const isSimpleRequest = request.messages.length === 1 && 
                             typeof request.messages[0].content === 'string' &&
                             request.messages[0].content.length < 1000;
      
      return isHaikuModel || isSimpleRequest;
    }
  },

  // Code-related requests
  {
    category: 'default',
    priority: 60,
    provider: 'codewhisperer-primary',
    condition: (request: BaseRequest) => {
      const content = JSON.stringify(request.messages).toLowerCase();
      const codeKeywords = [
        'function', 'class', 'import', 'export', 'const', 'let', 'var',
        'def ', 'public', 'private', 'async', 'await', 'return',
        'javascript', 'typescript', 'python', 'java', 'go', 'rust',
        'code', 'programming', 'debug', 'refactor', 'optimize'
      ];
      
      return codeKeywords.some(keyword => content.includes(keyword));
    }
  },

  // Model-specific routing
  {
    category: 'default',
    priority: 50,
    provider: 'sonnet-provider',
    condition: (request: BaseRequest) => {
      return request.model.toLowerCase().includes('sonnet');
    }
  },

  // High-volume requests (route to load-balanced pool)
  {
    category: 'default',
    priority: 40,
    provider: 'load-balanced-pool',
    condition: (request: BaseRequest) => {
      // This would typically check request rate or user tier
      // For now, route requests with many messages to load-balanced pool
      return request.messages.length > 10;
    }
  }
];

/**
 * Create routing rules from configuration
 */
export function createRoutingRules(config: any): RoutingRule[] {
  const rules: RoutingRule[] = [];

  // Add default rules
  rules.push(...defaultRoutingRules);

  // Add custom rules from configuration
  if (config.customRules && Array.isArray(config.customRules)) {
    config.customRules.forEach((customRule: any) => {
      try {
        const rule: RoutingRule = {
          category: customRule.category || 'default',
          priority: customRule.priority || 30,
          provider: customRule.provider,
          condition: createConditionFunction(customRule.condition)
        };
        rules.push(rule);
      } catch (error) {
        console.warn('Failed to create custom routing rule:', error);
      }
    });
  }

  return rules.sort((a, b) => b.priority - a.priority);
}

/**
 * Create a condition function from configuration
 */
function createConditionFunction(conditionConfig: any): (request: BaseRequest) => boolean {
  if (typeof conditionConfig === 'function') {
    return conditionConfig;
  }

  if (typeof conditionConfig === 'string') {
    // Simple string matching conditions
    return (request: BaseRequest) => {
      const content = JSON.stringify(request).toLowerCase();
      return content.includes(conditionConfig.toLowerCase());
    };
  }

  if (typeof conditionConfig === 'object' && conditionConfig !== null) {
    return (request: BaseRequest) => {
      // Object-based conditions
      if (conditionConfig.model) {
        if (!request.model.includes(conditionConfig.model)) return false;
      }

      if (conditionConfig.hasTools !== undefined) {
        const hasTools = !!(request.metadata?.tools && request.metadata.tools.length > 0);
        if (hasTools !== conditionConfig.hasTools) return false;
      }

      if (conditionConfig.messageCount) {
        const operator = conditionConfig.messageCount.operator || 'eq';
        const value = conditionConfig.messageCount.value;
        const actualCount = request.messages.length;

        switch (operator) {
          case 'gt': if (!(actualCount > value)) return false; break;
          case 'gte': if (!(actualCount >= value)) return false; break;
          case 'lt': if (!(actualCount < value)) return false; break;
          case 'lte': if (!(actualCount <= value)) return false; break;
          case 'eq': if (!(actualCount === value)) return false; break;
          default: return false;
        }
      }

      if (conditionConfig.contentKeywords && Array.isArray(conditionConfig.contentKeywords)) {
        const content = JSON.stringify(request.messages).toLowerCase();
        const hasKeyword = conditionConfig.contentKeywords.some((keyword: string) =>
          content.includes(keyword.toLowerCase())
        );
        if (!hasKeyword) return false;
      }

      return true;
    };
  }

  // Default: always true
  return () => true;
}

/**
 * Validate routing rules
 */
export function validateRoutingRules(rules: RoutingRule[]): string[] {
  const errors: string[] = [];

  rules.forEach((rule, index) => {
    if (!rule.category) {
      errors.push(`Rule at index ${index}: category is required`);
    }

    if (!rule.provider) {
      errors.push(`Rule at index ${index}: provider is required`);
    }

    if (typeof rule.priority !== 'number') {
      errors.push(`Rule at index ${index}: priority must be a number`);
    }

    if (typeof rule.condition !== 'function') {
      errors.push(`Rule at index ${index}: condition must be a function`);
    }
  });

  return errors;
}