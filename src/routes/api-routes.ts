/**
 * API路由定义
 *
 * 定义RCC v4.0的核心API端点
 *
 * @author Jason Zhang
 */

import { Router, RouteGroup } from './router';
import { IMiddlewareManager } from '../interfaces/core/middleware-interface';
import { SERVER_DEFAULTS, getCorsConfig, getRateLimitConfig } from '../constants';

// 导入模块管理API函数
import {
  createModule,
  startModule,
  stopModule,
  configureModule,
  processWithModule,
  getModuleStatus,
  destroyModule,
  getAllModulesStatus
} from '../api/modules/module-management-api';

// 导入常量
import { API_DEFAULTS } from '../constants/api-defaults';
import { ERROR_MESSAGES } from '../constants/error-messages';
import { TIMEOUT_DEFAULTS } from '../constants/timeout-defaults';

// 导入CLIProxyAPI转换逻辑
import { SecureAnthropicToOpenAITransformer } from '../modules/transformers/secure-anthropic-openai-transformer';
import { SecureGeminiTransformer } from '../modules/transformers/secure-gemini-transformer';
import { QwenCompatibilityModule } from '../modules/pipeline-modules/server-compatibility/qwen-compatibility';
import { PassthroughCompatibilityModule } from '../modules/pipeline-modules/server-compatibility/passthrough-compatibility';

// 声明Pipeline层处理函数
async function processRouterLayer(input: any, context: any): Promise<any> {
  return { 
    provider: 'qwen', 
    endpoint: process.env.QWEN_ENDPOINT || API_DEFAULTS.PROVIDERS.OPENAI.BASE_URL,
    targetModel: input.model,
    virtualModel: input.model
  };
}

async function processTransformerLayer(input: any, routingDecision: any, context: any): Promise<any> {
  const transformer = new SecureAnthropicToOpenAITransformer();
  return await transformer.process(input);
}

async function processProtocolLayer(input: any, routingDecision: any, context: any): Promise<any> {
  return { ...input, model: routingDecision.targetModel };
}

async function processServerLayer(input: any, routingDecision: any, context: any): Promise<any> {
  return { id: 'test-response', choices: [{ message: { role: 'assistant', content: 'Test response' } }] };
}

/**
 * 配置API路由
 */
export function setupApiRoutes(router: Router, middlewareManager: IMiddlewareManager): void {
  // API v1路由组
  const apiV1Routes: RouteGroup = {
    prefix: '/api/v1',
    middleware: [
      middlewareManager.createCors({
        origin: getCorsConfig().origin as any,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
      }),
      middlewareManager.createLogger({ level: 2, format: 'detailed' }),
      middlewareManager.createRateLimit({ maxRequests: 1000, windowMs: 60000 }), // 1000 req/min
    ],
    routes: [
      // 系统信息
      {
        method: 'GET',
        path: '/info',
        handler: async (req, res, params) => {
          res.body = {
            name: 'RCC (Route Claude Code)',
            version: '4.0.0-alpha.1',
            description: 'Modular AI routing proxy system',
            features: [
              'Multi-provider routing',
              'Request transformation',
              'Rate limiting',
              'Authentication',
              'Debug system',
              'Pipeline management',
            ],
            endpoints: {
              health: '/health',
              status: '/status',
              version: '/version',
              providers: '/api/v1/providers',
              pipelines: '/api/v1/pipelines',
              config: '/api/v1/config',
              modules: '/api/v1/modules'
            },
          };
        },
        name: 'api-info',
        description: 'Get API information',
      },

      // Provider管理
      {
        method: 'GET',
        path: '/providers',
        handler: async (req, res, params) => {
          try {
            // 从全局服务获取Provider管理器
            const { getGlobalProviderManager } = null as any /* TODO: 重构为API调用 */;
            const providerManager = getGlobalProviderManager();

            if (!providerManager) {
              res.statusCode = 503;
              res.body = {
                error: 'Service Unavailable',
                message: 'Provider manager not initialized',
              };
              return;
            }

            const providerStatuses = providerManager.getProviderStatuses();
            const providers = providerStatuses.map(status => ({
              id: status.routeInfo.id,
              name: status.name,
              type: status.routeInfo.type,
              status: status.status,
              healthy: status.routeInfo.healthy,
              currentLoad: status.routeInfo.currentLoad,
              priority: status.routeInfo.priority,
              weight: status.routeInfo.weight,
              uptime: (status as any).uptime || 0,
              lastUpdated: (status as any).lastUpdated || new Date(),
            }));

            res.body = {
              providers,
              total: providers.length,
              healthy: providers.filter(p => p.healthy).length,
              unhealthy: providers.filter(p => !p.healthy).length,
            };
          } catch (error) {
            console.error('Failed to get providers:', error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: 'Failed to retrieve provider list',
            };
          }
        },
        name: 'list-providers',
        description: 'List all available providers',
      },

      {
        method: 'GET',
        path: '/providers/:id',
        handler: async (req, res, params) => {
          const providerId = params.id;

          if (!providerId) {
            res.statusCode = 400;
            res.body = {
              error: 'Bad Request',
              message: 'Provider ID is required',
            };
            return;
          }

          try {
            const { getGlobalProviderManager } = null as any /* TODO: 重构为API调用 */;
            const providerManager = getGlobalProviderManager();

            if (!providerManager) {
              res.statusCode = 503;
              res.body = {
                error: 'Service Unavailable',
                message: 'Provider manager not initialized',
              };
              return;
            }

            const providerStatuses = providerManager.getProviderStatuses();
            const providerStatus = providerStatuses.find(s => s.routeInfo.id === providerId);

            if (!providerStatus) {
              res.statusCode = 404;
              res.body = {
                error: 'Not Found',
                message: `Provider '${providerId}' not found`,
              };
              return;
            }

            res.body = {
              id: providerStatus.routeInfo.id,
              name: providerStatus.name,
              type: providerStatus.routeInfo.type,
              status: providerStatus.status,
              healthy: providerStatus.routeInfo.healthy,
              currentLoad: providerStatus.routeInfo.currentLoad,
              priority: providerStatus.routeInfo.priority,
              weight: providerStatus.routeInfo.weight,
              uptime: (providerStatus as any).uptime || 0,
              lastUpdated: (providerStatus as any).lastUpdated || new Date(),
              stats: {
                memoryUsage: (providerStatus as any).memoryUsage || 0,
                cpuUsage: (providerStatus as any).cpuUsage || 0,
              },
            };
          } catch (error) {
            console.error(`Failed to get provider ${providerId}:`, error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: 'Failed to retrieve provider details',
            };
          }
        },
        name: 'get-provider',
        description: 'Get provider details',
      },

      // Pipeline管理
      {
        method: 'GET',
        path: '/pipelines',
        handler: async (req, res, params) => {
          try {
            const { getGlobalPipelineManager } = null as any /* TODO: 重构为API调用 */;
            const pipelineManager = getGlobalPipelineManager();

            if (!pipelineManager) {
              res.statusCode = 503;
              res.body = {
                error: 'Service Unavailable',
                message: 'Pipeline manager not initialized',
              };
              return;
            }

            const allPipelineStatus = pipelineManager.getAllPipelineStatus();
            const activeExecutions = pipelineManager.getActiveExecutions();

            const pipelines = Object.entries(allPipelineStatus).map(([id, status]) => {
              const pipelineActiveExecutions = activeExecutions.filter(exec => exec.pipelineId === id);
              const executionHistory = pipelineManager.getExecutionHistory(id);

              // 计算统计信息
              const completedExecutions = executionHistory.filter(exec => exec.status === 'completed');
              const avgProcessingTime =
                completedExecutions.length > 0
                  ? Math.round(
                      completedExecutions.reduce((sum, exec) => sum + (exec.totalTime || 0), 0) /
                        completedExecutions.length
                    )
                  : 0;

              return {
                id,
                status: (status as any)?.status || 'unknown',
                moduleCount: (status as any).moduleCount || 0,
                activeRequests: pipelineActiveExecutions.length,
                totalProcessed: executionHistory.length,
                avgProcessingTime,
                lastExecuted:
                  executionHistory.length > 0 ? executionHistory[executionHistory.length - 1].startTime : null,
                errorRate:
                  executionHistory.length > 0
                    ? Math.round(
                        (executionHistory.filter(exec => exec.status === 'failed').length / executionHistory.length) *
                          100 *
                          100
                      ) / 100
                    : 0,
              };
            });

            res.body = {
              pipelines,
              total: pipelines.length,
              running: pipelines.filter(p => p.status === 'running').length,
              stopped: pipelines.filter(p => p.status === 'stopped').length,
              totalActiveRequests: pipelines.reduce((sum, p) => sum + p.activeRequests, 0),
            };
          } catch (error) {
            console.error('Failed to get pipelines:', error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: 'Failed to retrieve pipeline list',
            };
          }
        },
        name: 'list-pipelines',
        description: 'List all active pipelines',
      },

      {
        method: 'GET',
        path: '/pipelines/:id',
        handler: async (req, res, params) => {
          const pipelineId = params.id;

          if (!pipelineId) {
            res.statusCode = 400;
            res.body = {
              error: 'Bad Request',
              message: 'Pipeline ID is required',
            };
            return;
          }

          try {
            const { getGlobalPipelineManager } = null as any /* TODO: 重构为API调用 */;
            const pipelineManager = getGlobalPipelineManager();

            if (!pipelineManager) {
              res.statusCode = 503;
              res.body = {
                error: 'Service Unavailable',
                message: 'Pipeline manager not initialized',
              };
              return;
            }

            const pipeline = pipelineManager.getPipeline(pipelineId);
            if (!pipeline) {
              res.statusCode = 404;
              res.body = {
                error: 'Not Found',
                message: `Pipeline '${pipelineId}' not found`,
              };
              return;
            }

            const status = pipelineManager.getPipelineStatus(pipelineId);
            const activeExecutions = pipelineManager
              .getActiveExecutions()
              .filter(exec => exec.pipelineId === pipelineId);
            const executionHistory = pipelineManager.getExecutionHistory(pipelineId);

            // 获取模块状态信息
            const modules =
              (status as any)?.modules?.map((module: any) => ({
                name: module.name,
                id: module.id,
                type: module.type,
                status: module.status,
                version: module.version,
                uptime: module.uptime,
              })) || [];

            // 计算统计信息
            const completedExecutions = executionHistory.filter(exec => exec.status === 'completed');
            const failedExecutions = executionHistory.filter(exec => exec.status === 'failed');
            const avgProcessingTime =
              completedExecutions.length > 0
                ? Math.round(
                    completedExecutions.reduce((sum, exec) => sum + (exec.totalTime || 0), 0) /
                      completedExecutions.length
                  )
                : 0;

            res.body = {
              id: pipelineId,
              status: status?.status || 'unknown',
              moduleCount: (status as any)?.moduleCount || 0,
              modules,
              stats: {
                activeRequests: activeExecutions.length,
                totalProcessed: executionHistory.length,
                successfulRequests: completedExecutions.length,
                failedRequests: failedExecutions.length,
                avgProcessingTime,
                errorRate:
                  executionHistory.length > 0
                    ? Math.round((failedExecutions.length / executionHistory.length) * 100 * 100) / 100
                    : 0,
                lastExecuted:
                  executionHistory.length > 0 ? executionHistory[executionHistory.length - 1].startTime : null,
              },
            };
          } catch (error) {
            console.error(`Failed to get pipeline ${pipelineId}:`, error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: 'Failed to retrieve pipeline details',
            };
          }
        },
        name: 'get-pipeline',
        description: 'Get pipeline details',
      },

      // 配置管理
      {
        method: 'GET',
        path: '/config',
        handler: async (req, res, params) => {
          try {
            const { getGlobalConfigManager } = null as any /* TODO: 重构为API调用 */;
            const configManager = getGlobalConfigManager();

            if (!configManager) {
              res.statusCode = 503;
              res.body = {
                error: 'Service Unavailable',
                message: 'Configuration manager not initialized',
              };
              return;
            }

            const config = await configManager.getCurrentConfig();

            // 过滤敏感信息（如API密钥）
            const safeConfig = {
              server: {
                port: config.server?.port || SERVER_DEFAULTS.HTTP.PORT,
                host: config.server?.host || SERVER_DEFAULTS.HTTP.HOST,
                debug: config.server?.debug || false,
                maxRequestSize: config.server?.maxRequestSize,
                timeout: config.server?.timeout,
              },
              routing: {
                defaultStrategy: config.routing?.defaultStrategy,
                loadBalancing: config.routing?.loadBalancing,
                healthCheckInterval: config.routing?.healthCheckInterval,
                maxRetries: config.routing?.maxRetries,
                strictErrorReporting: config.routing?.strictErrorReporting,
              },
              middleware: {
                rateLimit: {
                  enabled: config.middleware?.rateLimit?.enabled,
                  maxRequests: config.middleware?.rateLimit?.maxRequests,
                  windowMs: config.middleware?.rateLimit?.windowMs,
                },
                cors: {
                  enabled: config.middleware?.cors?.enabled,
                  origin: config.middleware?.cors?.origin,
                  credentials: config.middleware?.cors?.credentials,
                },
                auth: {
                  enabled: config.middleware?.auth?.enabled,
                  type: config.middleware?.auth?.type,
                  // 不返回实际的密钥
                },
              },
              providers: Object.keys(config.providers || {}),
              pipelines: Object.keys(config.pipelines || {}),
            };

            res.body = safeConfig;
          } catch (error) {
            console.error('Failed to get configuration:', error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: 'Failed to retrieve configuration',
            };
          }
        },
        name: 'get-config',
        description: 'Get current configuration',
      },

      {
        method: 'PUT',
        path: '/config',
        handler: async (req, res, params) => {
          const newConfig = req.body;

          if (!newConfig) {
            res.statusCode = 400;
            res.body = {
              error: 'Bad Request',
              message: 'Configuration data required',
            };
            return;
          }

          try {
            const { getGlobalConfigManager } = null as any /* TODO: 重构为API调用 */;
            const configManager = getGlobalConfigManager();

            if (!configManager) {
              res.statusCode = 503;
              res.body = {
                error: 'Service Unavailable',
                message: 'Configuration manager not initialized',
              };
              return;
            }

            // 验证配置格式
            const validationResult = await configManager.validateConfig(newConfig);
            if (!validationResult.valid) {
              res.statusCode = 400;
              res.body = {
                error: 'Bad Request',
                message: 'Invalid configuration',
                details: validationResult.errors,
              };
              return;
            }

            // 应用配置更新
            await configManager.updateConfig(newConfig);

            res.body = {
              success: true,
              message: 'Configuration updated successfully',
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            console.error('Failed to update configuration:', error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to update configuration',
            };
          }
        },
        name: 'update-config',
        description: 'Update configuration',
      },

      // 模块管理API路由
      {
        method: 'POST',
        path: '/modules',
        handler: async (req, res, params) => {
          try {
            const request = req.body;
            if (!request || !request.type || !request.moduleType) {
              res.statusCode = 400;
              res.body = {
                error: 'Bad Request',
                message: 'Module type and moduleType are required',
              };
              return;
            }

            const result = await createModule(request);
            res.body = result;
          } catch (error) {
            console.error('Failed to create module:', error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to create module',
            };
          }
        },
        name: 'create-module',
        description: 'Create a new module instance',
      },

      {
        method: 'POST',
        path: '/modules/:id/start',
        handler: async (req, res, params) => {
          const moduleId = params.id;

          if (!moduleId) {
            res.statusCode = 400;
            res.body = {
              error: 'Bad Request',
              message: 'Module ID is required',
            };
            return;
          }

          try {
            const result = await startModule({ id: moduleId });
            res.body = result;
          } catch (error) {
            console.error(`Failed to start module ${moduleId}:`, error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to start module',
            };
          }
        },
        name: 'start-module',
        description: 'Start a module instance',
      },

      {
        method: 'POST',
        path: '/modules/:id/stop',
        handler: async (req, res, params) => {
          const moduleId = params.id;

          if (!moduleId) {
            res.statusCode = 400;
            res.body = {
              error: 'Bad Request',
              message: 'Module ID is required',
            };
            return;
          }

          try {
            const result = await stopModule({ id: moduleId });
            res.body = result;
          } catch (error) {
            console.error(`Failed to stop module ${moduleId}:`, error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to stop module',
            };
          }
        },
        name: 'stop-module',
        description: 'Stop a module instance',
      },

      {
        method: 'PUT',
        path: '/modules/:id/configure',
        handler: async (req, res, params) => {
          const moduleId = params.id;
          const config = req.body;

          if (!moduleId) {
            res.statusCode = 400;
            res.body = {
              error: 'Bad Request',
              message: 'Module ID is required',
            };
            return;
          }

          try {
            const result = await configureModule({ id: moduleId, config });
            res.body = result;
          } catch (error) {
            console.error(`Failed to configure module ${moduleId}:`, error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to configure module',
            };
          }
        },
        name: 'configure-module',
        description: 'Configure a module instance',
      },

      {
        method: 'POST',
        path: '/modules/:id/process',
        handler: async (req, res, params) => {
          const moduleId = params.id;
          const input = req.body;

          if (!moduleId) {
            res.statusCode = 400;
            res.body = {
              error: 'Bad Request',
              message: 'Module ID is required',
            };
            return;
          }

          try {
            const result = await processWithModule({ id: moduleId, input });
            res.body = result;
          } catch (error) {
            console.error(`Failed to process with module ${moduleId}:`, error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to process with module',
            };
          }
        },
        name: 'process-module',
        description: 'Process input with a module instance',
      },

      {
        method: 'GET',
        path: '/modules/:id/status',
        handler: async (req, res, params) => {
          const moduleId = params.id;

          if (!moduleId) {
            res.statusCode = 400;
            res.body = {
              error: 'Bad Request',
              message: 'Module ID is required',
            };
            return;
          }

          try {
            const result = await getModuleStatus(moduleId);
            res.body = result;
          } catch (error) {
            console.error(`Failed to get module ${moduleId} status:`, error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to get module status',
            };
          }
        },
        name: 'get-module-status',
        description: 'Get module instance status',
      },

      {
        method: 'DELETE',
        path: '/modules/:id',
        handler: async (req, res, params) => {
          const moduleId = params.id;

          if (!moduleId) {
            res.statusCode = 400;
            res.body = {
              error: 'Bad Request',
              message: 'Module ID is required',
            };
            return;
          }

          try {
            await destroyModule(moduleId);
            res.body = {
              success: true,
              message: 'Module destroyed successfully',
            };
          } catch (error) {
            console.error(`Failed to destroy module ${moduleId}:`, error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to destroy module',
            };
          }
        },
        name: 'destroy-module',
        description: 'Destroy a module instance',
      },

      {
        method: 'GET',
        path: '/modules',
        handler: async (req, res, params) => {
          try {
            const result = await getAllModulesStatus();
            res.body = {
              modules: result,
              total: result.length,
            };
          } catch (error) {
            console.error('Failed to get all modules status:', error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to get modules status',
            };
          }
        },
        name: 'get-all-modules-status',
        description: 'Get status of all module instances',
      },

      // Pipeline API端点 - 六层流水线处理
      {
        method: 'POST',
        path: '/pipeline/router/process',
        handler: async (req, res, params) => {
          try {
            const { input, context } = req.body;
            if (!input || !context) {
              res.statusCode = 400;
              res.body = {
                error: 'Bad Request',
                message: 'Input and context are required',
              };
              return;
            }

            // Router层处理：路由决策和模型映射
            const routingDecision = await processRouterLayer(input, context);
            
            res.body = {
              success: true,
              data: {
                output: routingDecision
              }
            };
          } catch (error) {
            console.error('Router layer processing failed:', error);
            res.statusCode = 500;
            res.body = {
              success: false,
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Router processing failed',
            };
          }
        },
        name: 'pipeline-router-process',
        description: 'Process router layer of pipeline',
      },

      {
        method: 'POST',
        path: '/pipeline/transformer/process',
        handler: async (req, res, params) => {
          try {
            const { input, routingDecision, context } = req.body;
            if (!input || !routingDecision || !context) {
              res.statusCode = 400;
              res.body = {
                error: 'Bad Request',
                message: 'Input, routingDecision, and context are required',
              };
              return;
            }

            // Transformer层处理：Anthropic → OpenAI转换
            const transformedRequest = await processTransformerLayer(input, routingDecision, context);
            
            res.body = {
              success: true,
              data: {
                output: transformedRequest
              }
            };
          } catch (error) {
            console.error('Transformer layer processing failed:', error);
            res.statusCode = 500;
            res.body = {
              success: false,
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Transformer processing failed',
            };
          }
        },
        name: 'pipeline-transformer-process',
        description: 'Process transformer layer of pipeline',
      },

      {
        method: 'POST',
        path: '/pipeline/protocol/process',
        handler: async (req, res, params) => {
          try {
            const { input, routingDecision, context } = req.body;
            if (!input || !routingDecision || !context) {
              res.statusCode = 400;
              res.body = {
                error: 'Bad Request',
                message: 'Input, routingDecision, and context are required',
              };
              return;
            }

            // Protocol层处理：OpenAI格式处理
            const protocolRequest = await processProtocolLayer(input, routingDecision, context);
            
            res.body = {
              success: true,
              data: {
                output: protocolRequest
              }
            };
          } catch (error) {
            console.error('Protocol layer processing failed:', error);
            res.statusCode = 500;
            res.body = {
              success: false,
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Protocol processing failed',
            };
          }
        },
        name: 'pipeline-protocol-process',
        description: 'Process protocol layer of pipeline',
      },

      {
        method: 'POST',
        path: '/pipeline/server/process',
        handler: async (req, res, params) => {
          try {
            const { input, routingDecision, context } = req.body;
            if (!input || !routingDecision || !context) {
              res.statusCode = 400;
              res.body = {
                error: 'Bad Request',
                message: 'Input, routingDecision, and context are required',
              };
              return;
            }

            // Server层处理：HTTP API调用
            const serverResponse = await processServerLayer(input, routingDecision, context);
            
            res.body = {
              success: true,
              data: {
                output: serverResponse
              }
            };
          } catch (error) {
            console.error('Server layer processing failed:', error);
            res.statusCode = 500;
            res.body = {
              success: false,
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Server processing failed',
            };
          }
        },
        name: 'pipeline-server-process',
        description: 'Process server layer of pipeline',
      },
    ],
  };

  // 注册API路由组
  router.group(apiV1Routes);

  // 管理API路由组（需要认证）
  const adminRoutes: RouteGroup = {
    prefix: '/api/admin',
    middleware: [
      middlewareManager.createCors({ origin: false }), // 仅允许同源请求
      middlewareManager.createLogger({ level: 2, format: 'json' }),
      middlewareManager.createRateLimit({ maxRequests: 100, windowMs: 60000 }), // 更严格的限制
      middlewareManager.createAuth({ required: true }), // 需要管理员API密钥
    ],
    routes: [
      // 重启服务
      {
        method: 'POST',
        path: '/restart',
        handler: async (req, res, params) => {
          try {
            const { getGlobalServerManager } = null as any /* TODO: 重构为API调用 */;
            const serverManager = getGlobalServerManager();

            if (!serverManager) {
              res.statusCode = 503;
              res.body = {
                error: 'Service Unavailable',
                message: 'Server manager not initialized',
              };
              return;
            }

            // 执行服务重启
            const restartResult = await serverManager.restart();

            res.body = {
              success: true,
              message: 'Server restart initiated successfully',
              restartId: restartResult.restartId,
              estimatedDowntime: restartResult.estimatedDowntime,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            console.error('Failed to restart server:', error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to restart server',
            };
          }
        },
        name: 'restart-server',
        description: 'Restart the server',
      },

      // 清除缓存
      {
        method: 'POST',
        path: '/cache/clear',
        handler: async (req, res, params) => {
          try {
            const { getGlobalCacheManager } = null as any /* TODO: 重构为API调用 */;
            const cacheManager = getGlobalCacheManager();

            if (!cacheManager) {
              res.statusCode = 503;
              res.body = {
                error: 'Service Unavailable',
                message: 'Cache manager not initialized',
              };
              return;
            }

            // 执行缓存清除
            const clearResult = await cacheManager.clearAll();

            res.body = {
              success: true,
              message: 'Cache cleared successfully',
              itemsCleared: clearResult.itemsCleared,
              cacheTypes: clearResult.cacheTypes,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            console.error('Failed to clear cache:', error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to clear cache',
            };
          }
        },
        name: 'clear-cache',
        description: 'Clear all caches',
      },

      // 导出配置
      {
        method: 'GET',
        path: '/config/export',
        handler: async (req, res, params) => {
          try {
            const { getGlobalConfigManager } = null as any /* TODO: 重构为API调用 */;
            const configManager = getGlobalConfigManager();

            if (!configManager) {
              res.statusCode = 503;
              res.body = {
                error: 'Service Unavailable',
                message: 'Configuration manager not initialized',
              };
              return;
            }

            // 导出完整配置
            const fullConfig = await configManager.exportConfig();
            const exportData = {
              exportedAt: new Date().toISOString(),
              version: '4.0.0-alpha.1',
              exportType: 'full',
              config: fullConfig,
            };

            res.headers['Content-Type'] = 'application/json';
            res.headers['Content-Disposition'] =
              `attachment; filename="rcc-config-${new Date().toISOString().split('T')[0]}.json"`;
            res.body = exportData;
          } catch (error) {
            console.error('Failed to export configuration:', error);
            res.statusCode = 500;
            res.body = {
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'Failed to export configuration',
            };
          }
        },
        name: 'export-config',
        description: 'Export configuration as JSON',
      },
    ],
  };

  // 注册管理API路由组
  router.group(adminRoutes);
}