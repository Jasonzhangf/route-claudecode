/**
 * Intelligent Routing Engine
 * Routes requests to appropriate providers based on model, content, and configuration
 */

import { BaseRequest, RoutingCategory, CategoryRouting } from '@/types';
import { logger } from '@/utils/logger';
import { calculateTokenCount } from '@/utils/tokenizer';

export class RoutingEngine {
  constructor(private routingConfig: Record<RoutingCategory, CategoryRouting>) {
    logger.info('Routing engine initialized with category-based configuration', {
      categories: Object.keys(routingConfig)
    });
  }

  /**
   * Route a request to the appropriate provider
   */
  async route(request: BaseRequest, requestId: string): Promise<string> {
    try {
      logger.trace(requestId, 'routing', 'Starting request routing', {
        model: request.model,
        messageCount: request.messages.length
      });

      // Step 1: Determine routing category based on request characteristics
      const category = this.determineCategory(request);
      logger.debug(`Determined routing category: ${category}`, { requestId }, requestId, 'routing');

      // Step 2: Get provider and model from category configuration
      const categoryRule = this.routingConfig[category];
      if (!categoryRule) {
        throw new Error(`No routing configuration found for category: ${category}`);
      }

      // Step 3: Apply model mapping and return provider
      this.applyModelMapping(request, categoryRule.provider, categoryRule.model, category);
      
      logger.info(`Routing ${category} to ${categoryRule.provider}`, {
        category,
        provider: categoryRule.provider,
        targetModel: categoryRule.model,
        originalModel: request.model
      }, requestId, 'routing');

      return categoryRule.provider;

    } catch (error) {
      logger.error('Error during routing', error, requestId, 'routing');
      throw error;
    }
  }

  /**
   * Determine the routing category based on request characteristics
   */
  private determineCategory(request: BaseRequest): RoutingCategory {
    // Check for background models (haiku models for lightweight tasks)
    if (request.model.includes('haiku')) {
      return 'background';
    }

    // Check for explicit thinking mode
    if (request.metadata?.thinking) {
      return 'thinking';
    }

    // Check for long context based on token count
    const tokenCount = this.calculateRequestTokens(request);
    if (tokenCount > 45000) {
      return 'longcontext';
    }

    // Check for search tools
    if (request.metadata?.tools && Array.isArray(request.metadata.tools)) {
      const hasSearchTools = request.metadata.tools.some((tool: any) => 
        typeof tool === 'object' && tool.name && (
          tool.name.toLowerCase().includes('search') ||
          tool.name.toLowerCase().includes('web') ||
          tool.name === 'WebSearch'
        )
      );
      
      if (hasSearchTools) {
        return 'search';
      }
    }

    // Default category for all other cases
    return 'default';
  }

  /**
   * Apply model mapping based on routing configuration
   */
  private applyModelMapping(request: BaseRequest, providerId: string, targetModel: string, category: RoutingCategory): void {
    // Initialize metadata if not present
    if (!request.metadata) {
      request.metadata = { requestId: 'routing-generated' };
    }
    
    // Store original model for reference
    request.metadata.originalModel = request.model;
    request.metadata.targetProvider = providerId;
    request.metadata.routingCategory = category;
    
    // CRITICAL: Replace the model name directly in the request
    // This ensures all downstream processing uses the correct target model
    const originalModel = request.model;
    request.model = targetModel;
    
    logger.info(`Model routing applied: ${originalModel} -> ${targetModel}`, {
      category,
      providerId,
      originalModel,
      targetModel: targetModel,
      transformation: `${originalModel} -> ${targetModel} via ${providerId}`
    });
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
  updateConfig(routingConfig: Record<RoutingCategory, CategoryRouting>) {
    this.routingConfig = routingConfig;
    logger.info('Routing configuration updated', {
      categories: Object.keys(routingConfig)
    });
  }

  /**
   * Get current routing configuration summary
   */
  getConfigSummary() {
    const summary: Record<string, any> = {};
    
    for (const [category, config] of Object.entries(this.routingConfig)) {
      summary[category] = {
        provider: config.provider,
        model: config.model
      };
    }
    
    return {
      categories: Object.keys(this.routingConfig),
      routing: summary
    };
  }

  /**
   * Get routing engine statistics (for compatibility)
   */
  getStats() {
    return {
      categories: Object.keys(this.routingConfig),
      routing: this.routingConfig
    };
  }
}