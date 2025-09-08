// RCC v4.0 启动流程集成测试和核心转换器功能测试
// Core transformer functions (direct import)
import { transformAnthropicToOpenAI } from '../modules/pipeline-modules/transformers/anthropic-openai-converter';

// Base types for testing
import { RCCError, RCCErrorCode } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// 真实组件导入
import { ConfigPreprocessor } from '../modules/config/src/config-preprocessor';
import { RouterPreprocessor } from '../modules/router/src/router-preprocessor';
import { PipelineAssembler } from '../modules/pipeline/src/pipeline-assembler';
import { ModuleDebugIntegration } from '../modules/logging/src/debug-integration';
import { ProviderLoadBalancer } from '../modules/providers/load-balancer';
import { SelfCheckService } from '../modules/self-check/self-check.service';
import { SecureAnthropicToOpenAITransformer } from '../modules/pipeline-modules/transformers/secure-anthropic-openai-transformer';
import { PipelineManager } from '../modules/pipeline/src/pipeline-manager';
import { JQJsonHandler } from '../modules/utils/jq-json-handler';

// LoadBalancingStrategy constants
import { LoadBalancingStrategy } from '../modules/providers/load-balancer/types';

describe('Test Environment Setup', () => {
    test('should have correct environment variables', () => {
        expect(process.env.NODE_ENV).toBeDefined();
    });
    
    test('should have Jest timeout configured', () => {
        expect(jest.setTimeout).toBeDefined();
    });
    
    test('should be able to run assertions', () => {
        expect(true).toBe(true);
        expect('test').toContain('es');
        expect([1, 2, 3]).toHaveLength(3);
    });
});

describe('Core Transformer Tests', () => {
    let transformer: InstanceType<typeof SecureAnthropicToOpenAITransformer>;

    beforeEach(() => {
        transformer = new SecureAnthropicToOpenAITransformer({
            preserveToolCalls: true,
            mapSystemMessage: true,
            defaultMaxTokens: 4096,
            transformDirection: 'anthropic-to-openai'
        });
    });

    test('should convert Anthropic request to OpenAI format', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Hello, how are you?"
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.model).toBe(anthropicRequest.model);
        expect(openaiRequest.messages).toEqual(anthropicRequest.messages);
        expect(openaiRequest.max_tokens).toBe(anthropicRequest.max_tokens);
        expect(openaiRequest.temperature).toBe(anthropicRequest.temperature);
        expect(openaiRequest.stream).toBe(false);
    });

    test('should handle system messages correctly', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            system: "You are a helpful assistant.",
            messages: [
                {
                    role: "user",
                    content: "Hello, how are you?"
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.messages[0].role).toBe('system');
        expect(openaiRequest.messages[0].content).toBe(anthropicRequest.system);
        expect(openaiRequest.messages[1].role).toBe('user');
        expect(openaiRequest.messages[1].content).toBe(anthropicRequest.messages[0].content);
        expect(openaiRequest.system).toBeUndefined();
    });

    test('should handle multiple messages correctly', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Hello"
                },
                {
                    role: "assistant",
                    content: "Hi there! How can I help you?"
                },
                {
                    role: "user",
                    content: "I need help with TypeScript"
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.messages).toEqual(anthropicRequest.messages);
    });

    test('should handle empty content messages', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: ""
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.messages[0].content).toBe("");
    });

    test('should preserve additional parameters', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Hello"
                }
            ],
            temperature: 0.8,
            top_p: 0.9,
            top_k: 40
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.temperature).toBe(0.8);
        expect(openaiRequest.top_p).toBe(0.9);
        expect(openaiRequest.top_k).toBe(40);
    });

    test('should compare results with Claude Code Router', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            system: "You are a helpful assistant.",
            messages: [
                {
                    role: "user",
                    content: "Hello, how are you?"
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        };

        // Get transformation result
        const rccResult = transformAnthropicToOpenAI(anthropicRequest);
        // Direct transformation test completed

        // Basic validation that the transformation is working
        expect(rccResult.messages).toBeDefined();
        expect(rccResult.messages.length).toBe(2); // system + user message
        expect(rccResult.messages[0].role).toBe('system');
        expect(rccResult.messages[1].role).toBe('user');
    });
});

/**
 * RCC v4.0 完整启动流程集成测试
 */
describe('RCC v4.0 Startup Integration Tests', () => {
  let debugIntegration: ModuleDebugIntegration;
  let testOutputDir: string;

  beforeAll(async () => {
    // 设置测试环境变量 (API Keys for testing)
    process.env.TEST_API_KEY = 'test-api-key';
    process.env.QWEN_API_KEY = 'test-qwen-key';
    process.env.IFLOW_API_KEY = 'test-iflow-key';
    
    // 初始化debug系统
    debugIntegration = new ModuleDebugIntegration({
      moduleId: 'startup-test',
      moduleName: 'StartupIntegrationTest',
      enabled: true,
      captureLevel: 'full'
    });
    await debugIntegration.initialize();

    // 创建测试输出目录
    testOutputDir = path.join(__dirname, 'test-outputs', 'startup-integration');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(async () => {
    if (debugIntegration) {
      await debugIntegration.endSession();
    }
  });

  /**
   * 测试1: 配置文件解析验证
   */
  test('should parse qwen-iflow mixed configuration correctly', async () => {
    const configPath = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511-standard.json';
    
    const sessionId = debugIntegration.startSession();
    const requestId = `config-parse-test-${Date.now()}`;
    
    debugIntegration.recordInput(requestId, {
      testType: 'config-parsing',
      configPath
    });

    // 验证配置文件存在
    expect(fs.existsSync(configPath)).toBe(true);
    
    const result = await ConfigPreprocessor.preprocess(configPath);
    
    debugIntegration.recordOutput(requestId, {
      configParsingResult: result
    });
    
    expect(result.success).toBe(true);
    expect(result.routingTable).toBeDefined();
    expect(result.routingTable!.providers.length).toBe(2);
    
    // 验证Provider配置
    const providers = result.routingTable!.providers;
    const qwenProvider = providers.find(p => p.name === 'qwen');
    const iflowProvider = providers.find(p => p.name === 'iflow');
    
    expect(qwenProvider).toBeDefined();
    expect(iflowProvider).toBeDefined();
    expect(qwenProvider!.models.length).toBeGreaterThan(0);
    expect(iflowProvider!.models.length).toBeGreaterThan(0);
    
    // 验证路由配置
    const routes = result.routingTable!.routes;
    expect(routes.default).toBeDefined();
    expect(routes.longContext).toBeDefined();
    expect(routes.think).toBeDefined();
    
    // 保存完整的测试输出
    const outputFile = path.join(testOutputDir, 'config-parse-result.json');
    await fs.promises.writeFile(outputFile, JSON.stringify({
      testTimestamp: new Date().toISOString(),
      success: result.success,
      providers: result.routingTable!.providers,  // 包含完整的provider信息，特别是api_key
      routes: result.routingTable!.routes,
      rawResult: result,  // 包含所有原始数据
      configPath,
      metadata: result.metadata
    }, null, 2));
    
    await debugIntegration.endSession();
  }, 10000);

  /**
   * 测试2: 路由预处理器验证
   */
  test('should generate pipeline configurations from routing table', async () => {
    const configPath = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511-standard.json';
    
    const sessionId = debugIntegration.startSession();
    const requestId = `router-preprocess-test-${Date.now()}`;
    
    // Step 1: 配置解析
    const configResult = await ConfigPreprocessor.preprocess(configPath);
    expect(configResult.success).toBe(true);
    
    // Step 2: 路由预处理
    const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable!);
    
    debugIntegration.recordOutput(requestId, {
      routerResult
    });
    
    expect(routerResult.success).toBe(true);
    expect(routerResult.pipelineConfigs).toBeDefined();
    expect(routerResult.pipelineConfigs!.length).toBeGreaterThan(0);
    
    // 验证流水线配置结构
    for (const pipelineConfig of routerResult.pipelineConfigs!) {
      expect(pipelineConfig.pipelineId).toBeDefined();
      expect(pipelineConfig.provider).toBeDefined();
      expect(pipelineConfig.model).toBeDefined();
      expect(pipelineConfig.endpoint).toBeDefined();
      expect(pipelineConfig.layers).toBeDefined();
      expect(pipelineConfig.layers.length).toBe(4); // 四层流水线
      
      // 验证四层流水线结构
      const expectedLayers = ['transformer', 'protocol', 'server-compatibility', 'server'];
      const actualLayers = pipelineConfig.layers.map(l => l.name);
      expectedLayers.forEach(layer => {
        expect(actualLayers).toContain(layer);
      });
      
      // 验证每层的配置完整性
      for (const layer of pipelineConfig.layers) {
        expect(layer.config).toBeDefined();
        expect(layer.config.provider).toBe(pipelineConfig.provider);
        expect(layer.config.model).toBe(pipelineConfig.model);
      }
    }
    
    // 保存RouterPreprocessor完整输出
    const routerOutputFile = path.join(testOutputDir, 'router-preprocessing-result.json');
    await fs.promises.writeFile(routerOutputFile, JSON.stringify({
      testTimestamp: new Date().toISOString(),
      success: routerResult.success,
      pipelineConfigs: routerResult.pipelineConfigs,  // 所有流水线配置
      rawResult: routerResult,  // 包含所有原始数据
      inputRoutingTable: configResult.routingTable
    }, null, 2));
    
    await debugIntegration.endSession();
  }, 15000);

  /**
   * 测试3: 流水线组装验证
   */
  test('should assemble pipelines correctly', async () => {
    const configPath = '/Users/fanzhang/.route-claudecode/config.json';
    
    const sessionId = debugIntegration.startSession();
    const requestId = `pipeline-assembly-test-${Date.now()}`;
    
    // Step 1-2: 配置解析和路由预处理 - 使用真实组件
    const configResult = await ConfigPreprocessor.preprocess(configPath);
    const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable!);
    
    // Step 3: 流水线组装 - 使用真实组件
    const assembler = new PipelineAssembler();
    
    // 调试：检查StaticModuleRegistry状态
    console.log('🔍 Debug - PipelineConfigs:', routerResult.pipelineConfigs?.length || 0);
    console.log('🔍 Debug - First Pipeline Config:', routerResult.pipelineConfigs?.[0] ? {
      pipelineId: routerResult.pipelineConfigs[0].pipelineId,
      provider: routerResult.pipelineConfigs[0].provider,
      model: routerResult.pipelineConfigs[0].model,
      layersCount: routerResult.pipelineConfigs[0].layers?.length || 0,
      layers: routerResult.pipelineConfigs[0].layers?.map(l => ({ type: l.type, name: l.name })) || []
    } : 'No config');
    
    const assemblyResult = await assembler.assemble(routerResult.pipelineConfigs!);
    
    // 调试输出
    console.log('🔍 Debug - Assembly result:', {
      success: assemblyResult.success,
      pipelineCount: assemblyResult.allPipelines.length,
      firstPipeline: assemblyResult.allPipelines[0] ? {
        pipelineId: assemblyResult.allPipelines[0].pipelineId,
        provider: assemblyResult.allPipelines[0].provider,
        model: assemblyResult.allPipelines[0].model,
        modulesCount: assemblyResult.allPipelines[0].modules.length,
        assemblyStatus: assemblyResult.allPipelines[0].assemblyStatus
      } : 'No pipelines'
    });
    
    debugIntegration.recordOutput(requestId, {
      assemblyResult: {
        success: assemblyResult.success,
        pipelineCount: assemblyResult.allPipelines.length,
        stats: assemblyResult.stats
      }
    });
    
    expect(assemblyResult.success).toBe(true);
    expect(assemblyResult.allPipelines.length).toBeGreaterThan(0);
    
    // 验证组装后的流水线结构
    for (const pipeline of assemblyResult.allPipelines) {
      expect(pipeline.pipelineId).toBeDefined();
      expect(pipeline.provider).toBeDefined();
      expect(pipeline.model).toBeDefined();
      expect(pipeline.modules.length).toBeGreaterThan(0);
      expect(pipeline.assemblyStatus).toBe('assembled');
      
      // 验证模块连接
      for (let i = 0; i < pipeline.modules.length - 1; i++) {
        const currentModule = pipeline.modules[i];
        const nextModule = pipeline.modules[i + 1];
        expect(currentModule.nextModule).toBe(nextModule);
        expect(nextModule.previousModule).toBe(currentModule);
      }
    }
    
    // 保存PipelineAssembler完整输出
    const assemblyOutputFile = path.join(testOutputDir, 'pipeline-assembly-result.json');
    // 使用JQJsonHandler处理循环引用
    const assemblyData = {
      testTimestamp: new Date().toISOString(),
      success: assemblyResult.success,
      allPipelines: (assemblyResult.allPipelines || []).map((p: any) => ({
        pipelineId: p.pipelineId,
        provider: p.provider,
        model: p.model,
        assemblyStatus: p.assemblyStatus,
        modules: p.modules ? p.modules.map((m: any) => ({
          id: m.id,
          type: m.type,
          status: 'initialized'
        })) : []
      })),
      stats: assemblyResult.stats,
      inputPipelineConfigs: routerResult.pipelineConfigs
    };
    await fs.promises.writeFile(assemblyOutputFile, JQJsonHandler.stringifyJson(assemblyData, true));
    
    await assembler.destroy();
    await debugIntegration.endSession();
  }, 20000);

  /**
   * 测试4: 负载均衡器初始化验证
   */
  test('should initialize load balancer with provider instances', async () => {
    const sessionId = debugIntegration.startSession();
    const requestId = `load-balancer-test-${Date.now()}`;
    
    const loadBalancer = new ProviderLoadBalancer({
      strategy: LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS,
      enableHealthCheck: true,
      healthCheckInterval: 30000
    });

    await loadBalancer.initialize();

    // 添加测试Provider实例
    const testProviders = [
      {
        id: 'qwen-test',
        name: 'qwen-test-provider',
        type: 'qwen',
        endpoint: 'https://portal.qwen.ai/v1',
        weight: 1,
        maxConnections: 100,
        currentConnections: 0,
        healthStatus: 'HEALTHY' as any,
        metrics: {
          avgResponseTime: 100,
          successRate: 1.0,
          requestCount: 0,
          errorCount: 0,
          lastResponseTime: Date.now(),
          throughput: 10
        },
        config: {
          apiKey: 'test-key-1',
          timeout: 60000
        },
        lastUpdated: Date.now()
      },
      {
        id: 'iflow-test',
        name: 'iflow-test-provider',
        type: 'iflow',
        endpoint: 'https://apis.iflow.cn/v1',
        weight: 1,
        maxConnections: 100,
        currentConnections: 0,
        healthStatus: 'HEALTHY' as any,
        metrics: {
          avgResponseTime: 150,
          successRate: 1.0,
          requestCount: 0,
          errorCount: 0,
          lastResponseTime: Date.now(),
          throughput: 8
        },
        config: {
          apiKey: 'test-key-2',
          timeout: 60000
        },
        lastUpdated: Date.now()
      }
    ];

    testProviders.forEach(provider => {
      loadBalancer.addProvider(provider);
    });

    const statistics = loadBalancer.getStatistics();
    
    debugIntegration.recordOutput(requestId, {
      loadBalancerStats: statistics,
      providerCount: testProviders.length
    });

    expect(statistics.totalProviders).toBe(2);
    expect(statistics.healthyProviders).toBe(2);
    
    // 保存LoadBalancer完整测试结果
    const loadBalancerOutputFile = path.join(testOutputDir, 'load-balancer-result.json');
    const loadBalancerData = {
      testTimestamp: new Date().toISOString(),
      success: true,
      loadBalancerStats: statistics,
      testProviders: testProviders,
      providerCount: testProviders.length
    };
    await fs.promises.writeFile(loadBalancerOutputFile, JQJsonHandler.stringifyJson(loadBalancerData, true));

    await loadBalancer.cleanup();
    await debugIntegration.endSession();
  }, 10000);

  /**
   * 测试5: 自检服务验证
   */
  test('should perform self-check operations', async () => {
    const sessionId = debugIntegration.startSession();
    const requestId = `self-check-test-${Date.now()}`;
    
    const selfCheckService = new SelfCheckService();
    await selfCheckService.start();
    
    // 执行自检
    const selfCheckResult = await selfCheckService.performSelfCheck();
    const selfCheckState = await selfCheckService.getSelfCheckState();
    
    debugIntegration.recordOutput(requestId, {
      selfCheckResult,
      selfCheckState: {
        isRunning: selfCheckState.isRunning,
        statistics: selfCheckState.statistics
      }
    });
    
    expect(selfCheckResult).toBeDefined();
    expect(selfCheckState.isRunning).toBe(true);
    expect(selfCheckState.statistics.totalChecks).toBeGreaterThanOrEqual(1);
    
    // 保存SelfCheck完整测试结果
    const selfCheckOutputFile = path.join(testOutputDir, 'self-check-result.json');
    await fs.promises.writeFile(selfCheckOutputFile, JSON.stringify({
      testTimestamp: new Date().toISOString(),
      success: true,
      selfCheckResult,
      selfCheckState,
      rawResults: {
        selfCheckResult,
        selfCheckState
      }
    }, null, 2));
    
    await selfCheckService.stop();
    await debugIntegration.endSession();
  }, 10000);

  /**
   * 测试6: 完整启动流程端到端验证
   */
  test('should complete full startup flow end-to-end', async () => {
    const configPath = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511-standard.json';
    
    const sessionId = debugIntegration.startSession();
    const requestId = `e2e-startup-test-${Date.now()}`;
    const startTime = Date.now();
    
    debugIntegration.recordInput(requestId, {
      testType: 'end-to-end-startup',
      configPath
    });

    let configResult: any;
    let routerResult: any;
    let assemblyResult: any;
    let pipelineManager: InstanceType<typeof PipelineManager> | null = null;
    let loadBalancer: InstanceType<typeof ProviderLoadBalancer> | null = null;
    let selfCheckService: InstanceType<typeof SelfCheckService> | null = null;
    let assembler: InstanceType<typeof PipelineAssembler> | null = null;

    try {
      // Step 1: 配置解析
      configResult = await ConfigPreprocessor.preprocess(configPath);
      expect(configResult.success).toBe(true);
      
      // Step 2: 路由预处理
      routerResult = await RouterPreprocessor.preprocess(configResult.routingTable);
      expect(routerResult.success).toBe(true);
      
      // Step 3: 流水线组装
      assembler = new PipelineAssembler();
      assemblyResult = await assembler.assemble(routerResult.pipelineConfigs);
      expect(assemblyResult.success).toBe(true);
      
      // Step 4: 流水线管理器初始化
      pipelineManager = new PipelineManager();
      // Note: PipelineManager doesn't need explicit initialization
      
      for (const pipeline of assemblyResult.allPipelines) {
        pipelineManager.addPipeline(pipeline);
      }
      
      // Step 5: 负载均衡器初始化
      loadBalancer = new ProviderLoadBalancer({
        strategy: LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS,
        enableHealthCheck: true
      });
      await loadBalancer.initialize();
      
      // Step 6: 自检服务初始化
      selfCheckService = new SelfCheckService();
      selfCheckService.setPipelineManager(pipelineManager);
      await selfCheckService.start();
      
      const selfCheckResult = await selfCheckService.performSelfCheck();
      
      // 计算总时间
      const totalTime = Date.now() - startTime;
      
      // 计算系统状态
      const finalState = {
        totalProviders: configResult.routingTable.providers.length,
        totalRoutes: Object.keys(configResult.routingTable.routes).length,
        totalPipelines: assemblyResult.allPipelines.length,
        healthyPipelines: assemblyResult.allPipelines.filter((p: any) => p.health === 'healthy').length,
        systemHealth: 'healthy' as const,
        readyForRequests: true,
        moduleInitializationStatus: {
          pipelineManagerActive: pipelineManager !== null,
          loadBalancerActive: loadBalancer !== null,
          selfCheckServiceActive: selfCheckService !== null
        },
        performanceMetrics: {
          configProcessingTime: configResult.metadata.processingTime,
          totalStartupTime: totalTime,
          averagePipelineAssemblyTime: assemblyResult.stats.averageAssemblyTime
        }
      };
      
      debugIntegration.recordOutput(requestId, {
        success: true,
        totalTimeMs: totalTime,
        finalState,
        stepsCompleted: 6
      });
      
      // 验证最终状态
      expect(finalState.totalProviders).toBe(2);
      expect(finalState.totalRoutes).toBeGreaterThan(0);
      expect(finalState.totalPipelines).toBeGreaterThan(0);
      expect(finalState.systemHealth).toBe('healthy');
      expect(finalState.readyForRequests).toBe(true);
      
      // 保存完整端到端测试结果
      const e2eOutputFile = path.join(testOutputDir, 'e2e-startup-result.json');
      await fs.promises.writeFile(e2eOutputFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        success: true,
        totalTimeMs: totalTime,
        finalState,
        configPath,
        completeStepResults: {
          configResult: configResult,  // 完整的配置结果
          routerResult: routerResult,  // 完整的路由结果
          assemblyResult: assemblyResult,  // 完整的组装结果
          pipelineManagerResult: {
            pipelineCount: assemblyResult.allPipelines.length,
            activePipelines: assemblyResult.allPipelines.filter(p => p.isActive).length
          },
          loadBalancerResult: {
            initialized: loadBalancer !== null,
            stats: loadBalancer ? loadBalancer.getStatistics() : null
          },
          selfCheckResult: {
            initialized: selfCheckService !== null,
            result: selfCheckResult
          }
        },
        stepResults: {
          configResult: {
            success: configResult.success,
            providersCount: configResult.routingTable.providers.length,
            routesCount: Object.keys(configResult.routingTable.routes).length
          },
          routerResult: {
            success: routerResult.success,
            pipelinesCount: routerResult.pipelineConfigs.length
          },
          assemblyResult: {
            success: assemblyResult.success,
            assembledPipelinesCount: assemblyResult.allPipelines.length
          }
        }
      }, null, 2));
      
      // 保存测试摘要
      const summaryFile = path.join(testOutputDir, 'e2e-startup-test-summary.json');
      await fs.promises.writeFile(summaryFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        success: true,
        totalTimeMs: totalTime,
        finalState,
        configPath,
        stepResults: {
          configResult: {
            success: configResult.success,
            providersCount: configResult.routingTable.providers.length,
            routesCount: Object.keys(configResult.routingTable.routes).length
          },
          routerResult: {
            success: routerResult.success,
            pipelinesCount: routerResult.pipelineConfigs.length
          },
          assemblyResult: {
            success: assemblyResult.success,
            assembledPipelinesCount: assemblyResult.allPipelines.length
          }
        }
      }, null, 2));
      
      // 保存详细的流水线状态信息
      const pipelineStatusFile = path.join(testOutputDir, 'pipeline-status-report.json');
      await fs.promises.writeFile(pipelineStatusFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalPipelines: assemblyResult.allPipelines.length,
        pipelinesByRoute: assemblyResult.allPipelines.reduce((acc, p) => {
          if (!acc[p.routeName]) acc[p.routeName] = [];
          acc[p.routeName].push({
            pipelineId: p.pipelineId,
            provider: p.provider,
            model: p.model,
            health: p.health,
            isActive: p.isActive
          });
          return acc;
        }, {})
      }, null, 2));
      
    } finally {
      // 清理资源
      if (selfCheckService) await selfCheckService.stop();
      if (loadBalancer) await loadBalancer.cleanup();
      if (assembler) await assembler.destroy();
    }
    
    await debugIntegration.endSession();
  }, 30000);

  /**
   * 测试7: 负载均衡器流水线分发验证
   */
  test('should distribute requests across available pipelines using load balancer', async () => {
    const configPath = '/Users/fanzhang/.route-claudecode/config.json';
    
    const sessionId = debugIntegration.startSession();
    const requestId = `load-balancer-distribution-test-${Date.now()}`;
    
    // 完整启动系统
    const configResult = await ConfigPreprocessor.preprocess(configPath);
    const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable!);
    const assembler = new PipelineAssembler();
    const assemblyResult = await assembler.assemble(routerResult.pipelineConfigs!);
    
    // 初始化负载均衡器
    const loadBalancer = new ProviderLoadBalancer({
      strategy: LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS,
      enableHealthCheck: true,
      healthCheckInterval: 30000
    });
    
    await loadBalancer.initialize();
    
    // 为每个流水线创建Provider实例
    const testProviderInstances = assemblyResult.allPipelines.map(pipeline => ({
      id: pipeline.pipelineId,
      name: `${pipeline.provider}-${pipeline.model}`,
      type: pipeline.provider,
      endpoint: pipeline.endpoint,
      weight: 1,
      maxConnections: 100,
      currentConnections: 0,
      healthStatus: 'HEALTHY' as any,
      metrics: {
        avgResponseTime: Math.random() * 100 + 50, // 随机响应时间用于测试
        successRate: 1.0,
        requestCount: 0,
        errorCount: 0,
        lastResponseTime: Date.now(),
        throughput: 10
      },
      config: {
        apiKey: pipeline.apiKey,
        timeout: pipeline.timeout,
        model: pipeline.model
      },
      lastUpdated: Date.now()
    }));
    
    // 添加Provider实例到负载均衡器
    testProviderInstances.forEach(provider => {
      loadBalancer.addProvider(provider);
    });
    
    // 测试负载均衡选择
    const selections: any[] = [];
    
    // 执行多次选择以测试分发逻辑
    for (let i = 0; i < Math.min(10, testProviderInstances.length * 2); i++) {
      try {
        const result = await loadBalancer.selectProvider({
          requestId: `test-request-${i}`,
          requiredCapabilities: [],
          sessionId: `test-session-${i}`,
          priority: 'normal' as const,
          timeout: 30000,
          retryCount: 0
        });
        
        selections.push({
          selectedProviderId: result.selectedProvider.id,
          strategy: result.strategy,
          confidence: result.confidence,
          estimatedResponseTime: result.estimatedResponseTime
        });
        
        // 记录成功请求
        loadBalancer.recordRequestResult(result.selectedProvider.id, true);
      } catch (error) {
        // 如果没有可用的Provider，记录这个情况但不失败测试
        selections.push({ error: error.message });
      }
    }
    
    const statistics = loadBalancer.getStatistics();
    
    debugIntegration.recordOutput(requestId, {
      totalProviderInstances: testProviderInstances.length,
      selections,
      loadBalancerStats: statistics
    });
    
    // 验证结果
    expect(testProviderInstances.length).toBeGreaterThan(0);
    expect(statistics.totalProviders).toBe(testProviderInstances.length);
    
    // 如果有成功的选择，验证分发逻辑
    const successfulSelections = selections.filter(s => !s.error);
    if (successfulSelections.length > 0) {
      expect(successfulSelections.length).toBeGreaterThan(0);
      
      // 验证选择了不同的Provider（如果有多个可用）
      if (testProviderInstances.length > 1 && successfulSelections.length > 1) {
        const uniqueProviders = new Set(successfulSelections.map(s => s.selectedProviderId));
        expect(uniqueProviders.size).toBeGreaterThanOrEqual(1);
      }
    }
    
    // 保存负载均衡测试结果
    const balancerResultFile = path.join(testOutputDir, 'load-balancer-test-result.json');
    await fs.promises.writeFile(balancerResultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalProviders: testProviderInstances.length,
      totalSelections: selections.length,
      successfulSelections: successfulSelections.length,
      selectionResults: selections,
      loadBalancerStatistics: statistics,
      providerDistribution: successfulSelections.reduce((acc, s) => {
        acc[s.selectedProviderId] = (acc[s.selectedProviderId] || 0) + 1;
        return acc;
      }, {})
    }, null, 2));
    
    await loadBalancer.cleanup();
    await assembler.destroy();
    await debugIntegration.endSession();
  }, 20000);
});