/**
 * Intelligent Routing Engine
 * Routes requests to appropriate providers based on model, content, and configuration
 */

import { BaseRequest, RoutingCategory, RoutingConfig, RoutingRule } from '@/types';
import { logger } from '@/utils/logger';
import { calculateTokenCount } from '@/utils/tokenizer';

export class RoutingEngine {
  constructor(private config: RoutingConfig) {}

  /**
   * Route a request to the appropriate provider
   */
  async route(request: BaseRequest, requestId: string): Promise<string> {
    try {
      logger.trace(requestId, 'routing', 'Starting request routing', {
        model: request.model,
        messageCount: request.messages.length
      });

      // Determine routing category
      const category = this.determineCategory(request);
      logger.debug(`Determined routing category: ${category}`, { requestId }, requestId, 'routing');

      // Try category-based routing first (for object-based config)
      const categoryProvider = this.routeByCategory(request, category);
      if (categoryProvider) {
        logger.info(`Routing by category to provider: ${categoryProvider}`, { category }, requestId, 'routing');
        
        // Apply model mapping for the selected provider
        this.applyModelMapping(request, categoryProvider, category);
        
        return categoryProvider;
      }

      // Find matching rule (for array-based config)
      const rule = this.findMatchingRule(request, category);
      if (rule) {
        logger.info(`Routing via rule to provider: ${rule.provider}`, { 
          category: rule.category, 
          priority: rule.priority 
        }, requestId, 'routing');
        
        // Apply model mapping for the selected provider
        this.applyModelMapping(request, rule.provider, category);
        
        return rule.provider;
      }

      // Final fallback to default provider
      const defaultProvider = this.config.defaultProvider;
      logger.info(`Using default provider: ${defaultProvider}`, { category }, requestId, 'routing');
      
      // Apply model mapping for the selected provider
      this.applyModelMapping(request, defaultProvider, category);
      
      return defaultProvider;

    } catch (error) {
      logger.error('Error during routing, falling back to default provider', error, requestId, 'routing');
      return this.config.defaultProvider;
    }
  }

  /**
   * Determine the routing category based on request characteristics
   */
  private determineCategory(request: BaseRequest): RoutingCategory {
    // Check for explicit thinking mode
    if (request.metadata?.thinking) {
      return 'thinking';
    }

    // Check for long context based on token count
    const tokenCount = this.calculateRequestTokens(request);
    if (tokenCount > 60000) {
      return 'longcontext';
    }

    // Check for background processing (typically haiku models)
    if (request.model.includes('haiku')) {
      return 'background';
    }

    // Check for search/web tools
    if (request.metadata?.tools) {
      const tools = request.metadata.tools;
      if (Array.isArray(tools) && tools.some((tool: any) => 
        tool.name && (
          tool.name.includes('search') || 
          tool.name.includes('web') ||
          tool.name.includes('browse')
        )
      )) {
        return 'search';
      }
    }

    // Default category
    return 'default';
  }

  /**
   * Find the highest priority matching rule
   */
  private findMatchingRule(request: BaseRequest, category: RoutingCategory): RoutingRule | null {
    const matchingRules = this.config.rules
      .filter(rule => {
        try {
          // Check category match
          if (rule.category !== category) return false;
          
          // Check custom condition
          return rule.condition(request);
        } catch (error) {
          logger.warn('Error evaluating routing rule condition', error);
          return false;
        }
      })
      .sort((a, b) => b.priority - a.priority); // Sort by priority descending

    return matchingRules[0] || null;
  }

  /**
   * Route based on category using provider configuration
   */
  private routeByCategory(request: BaseRequest, category: RoutingCategory): string | null {
    // First, check if we have object-based routing rules
    const configRules = (this.config as any).routing?.rules || (this.config as any).rules;
    if (configRules && typeof configRules === 'object' && !Array.isArray(configRules)) {
      const categoryRule = configRules[category];
      if (categoryRule && categoryRule.provider) {
        return categoryRule.provider;
      }
    }

    // Fallback: Look for providers that support this category
    for (const [providerId, providerConfig] of Object.entries(this.config.providers)) {
      const categoryMappings = providerConfig.settings?.categoryMappings;
      if (categoryMappings && categoryMappings[category]) {
        return providerId;
      }
    }

    return null;
  }

  /**
   * Calculate approximate token count for routing decisions
   */
  private calculateRequestTokens(request: BaseRequest): number {
    try {
      return calculateTokenCount(
        request.messages,
        request.metadata?.system,
        request.metadata?.tools
      );
    } catch (error) {
      logger.warn('Failed to calculate token count, using message length estimation', error);
      
      // Fallback: rough estimation based on character count
      let totalChars = 0;
      request.messages.forEach(msg => {
        if (typeof msg.content === 'string') {
          totalChars += msg.content.length;
        } else if (Array.isArray(msg.content)) {
          msg.content.forEach((block: any) => {
            if (block.text) totalChars += block.text.length;
          });
        }
      });
      
      // Rough conversion: ~4 characters per token
      return Math.ceil(totalChars / 4);
    }
  }

  /**
   * Update routing configuration
   */
  updateConfig(config: RoutingConfig) {
    this.config = config;
    logger.info('Routing configuration updated', {
      rulesCount: config.rules.length,
      providersCount: Object.keys(config.providers).length,
      defaultProvider: config.defaultProvider
    });
  }

  /**
   * Apply model mapping based on routing configuration
   */
  private applyModelMapping(request: BaseRequest, providerId: string, category: RoutingCategory): void {
    // Check if we have object-based routing rules with model specification
    const configRules = (this.config as any).routing?.rules || (this.config as any).rules;
    if (configRules && typeof configRules === 'object' && !Array.isArray(configRules)) {
      const categoryRule = configRules[category];
      if (categoryRule && categoryRule.model) {
        const originalModel = request.model;
        request.model = categoryRule.model;
        logger.debug(`Model mapped from ${originalModel} to ${request.model} for ${providerId}`, {
          category,
          providerId,
          originalModel,
          newModel: request.model
        });
        return;
      }
    }

    // Fallback: Check provider configuration for default model mapping
    const providerConfig = this.config.providers[providerId];
    if (providerConfig?.settings?.models && providerConfig.settings.models.length > 0) {
      const originalModel = request.model;
      request.model = providerConfig.settings.models[0]; // Use first available model
      logger.debug(`Model mapped to provider default: ${originalModel} -> ${request.model}`, {
        category,
        providerId,
        originalModel,
        newModel: request.model
      });
    }
  }

  /**
   * Get routing statistics for monitoring
   */
  getStats(): Record<string, any> {
    return {
      rulesCount: this.config.rules.length,
      providersCount: Object.keys(this.config.providers).length,
      defaultProvider: this.config.defaultProvider,
      categories: ['default', 'background', 'thinking', 'longcontext', 'search']
    };
  }
}