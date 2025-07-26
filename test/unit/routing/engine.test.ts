/**
 * Unit tests for Routing Engine
 */

import { RoutingEngine } from '../../../src/routing';
import { RoutingConfig, BaseRequest } from '../../../src/types';

describe('RoutingEngine', () => {
  let engine: RoutingEngine;
  let mockConfig: RoutingConfig;

  beforeEach(() => {
    mockConfig = {
      rules: [],
      defaultProvider: 'default-provider',
      providers: {
        'default-provider': {
          type: 'codewhisperer',
          endpoint: 'test',
          authentication: { type: 'bearer', credentials: {} },
          settings: {}
        },
        'thinking-provider': {
          type: 'codewhisperer',
          endpoint: 'test',
          authentication: { type: 'bearer', credentials: {} },
          settings: {
            categoryMappings: {
              thinking: true
            }
          }
        }
      }
    };

    engine = new RoutingEngine(mockConfig);
  });

  describe('route', () => {
    it('should return default provider for simple requests', async () => {
      const request: BaseRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      const provider = await engine.route(request, 'test-id');
      expect(provider).toBe('default-provider');
    });

    it('should route thinking requests correctly', async () => {
      const request: BaseRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        metadata: {
          requestId: 'test-request-id',
          thinking: true
        }
      };

      const provider = await engine.route(request, 'test-id');
      expect(provider).toBe('thinking-provider');
    });

    it('should route haiku models to background', async () => {
      mockConfig.providers['background-provider'] = {
        type: 'codewhisperer',
        endpoint: 'test',
        authentication: { type: 'bearer', credentials: {} },
        settings: {
          categoryMappings: {
            background: true
          }
        }
      };

      engine.updateConfig(mockConfig);

      const request: BaseRequest = {
        model: 'claude-3-5-haiku-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      const provider = await engine.route(request, 'test-id');
      expect(provider).toBe('background-provider');
    });

    it('should handle errors gracefully', async () => {
      const request: BaseRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      // Simulate error in routing
      const brokenEngine = new RoutingEngine({
        ...mockConfig,
        defaultProvider: 'nonexistent'
      });

      const provider = await brokenEngine.route(request, 'test-id');
      expect(provider).toBe('nonexistent'); // Should still return the configured default
    });
  });

  describe('getStats', () => {
    it('should return routing statistics', () => {
      const stats = engine.getStats();

      expect(stats).toMatchObject({
        rulesCount: 0,
        providersCount: 2,
        defaultProvider: 'default-provider',
        categories: ['default', 'background', 'thinking', 'longcontext', 'search']
      });
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = {
        ...mockConfig,
        defaultProvider: 'new-default'
      };

      engine.updateConfig(newConfig);
      const stats = engine.getStats();

      expect(stats.defaultProvider).toBe('new-default');
    });
  });
});