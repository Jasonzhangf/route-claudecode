#!/usr/bin/env node

/**
 * 流水线数据捕获系统初始化器
 * 基于新数据库设计，集成重新设计的数据捕获系统
 * Project owner: Jason Zhang
 */

const fs = require('fs').promises;
const path = require('path');

// 配置
const CONFIG = {
  databasePath: './database/pipeline-data-unified',
  configFile: './database/pipeline-data-unified/database-config.json',
  captureConfigFile: './database/pipeline-data-unified/capture-system-config.json',
  logFile: `/tmp/pipeline-capture-init-${Date.now()}.log`
};

// 日志函数
function log(message, data = '') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}`;
  console.log(logLine);
  require('fs').appendFileSync(CONFIG.logFile, logLine + '\n');
}

/**
 * 读取数据库配置
 */
async function loadDatabaseConfig() {
  try {
    const configData = await fs.readFile(CONFIG.configFile, 'utf8');
    const config = JSON.parse(configData);
    
    log('数据库配置加载成功', {
      version: config.version,
      created: config.created,
      pathsCount: Object.keys(config.paths).length
    });
    
    return config;
  } catch (error) {
    log('❌ 数据库配置加载失败', error.message);
    throw new Error(`Failed to load database config: ${error.message}`);
  }
}

/**
 * 创建数据捕获系统配置
 */
async function createCaptureSystemConfig(dbConfig) {
  log('创建数据捕获系统配置');
  
  try {
    const captureConfig = {
      version: '2.0.0',
      created: new Date().toISOString(),
      enabled: true,
      basePath: CONFIG.databasePath,
      retention: {
        days: dbConfig.retention.days || 30,
        maxSizeMB: dbConfig.retention.maxSizeMB || 500
      },
      compression: dbConfig.compression || true,
      validation: {
        strictMode: dbConfig.validation.strictMode || true,
        requiredFields: dbConfig.validation.requiredFields || [
          'requestId', 'sessionId', 'model', 'category', 'configPath'
        ]
      },
      capture: {
        dataPoints: {
          enabled: true,
          includeInputOutput: true,
          includeTiming: true,
          includeErrors: true
        },
        flows: {
          enabled: true,
          includeMetadata: true,
          includePerformanceMetrics: true
        },
        realTime: {
          enabled: true,
          flushInterval: 5000, // 5秒
          batchSize: 100
        }
      },
      providers: {
        codewhisperer: {
          enabled: true,
          captureLevel: 'detailed',
          endpoints: [5501, 5503, 5504, 5505]
        },
        openai: {
          enabled: true,
          captureLevel: 'detailed', 
          endpoints: [5506, 5507, 5508, 5509]
        },
        gemini: {
          enabled: true,
          captureLevel: 'detailed',
          endpoints: [5502]
        },
        anthropic: {
          enabled: true,
          captureLevel: 'detailed',
          endpoints: [3456]
        }
      },
      monitoring: {
        performance: {
          trackResponseTimes: true,
          trackThroughput: true,
          trackErrorRates: true
        },
        alerts: {
          slowRequests: 30000, // 30秒
          errorThreshold: 0.05, // 5%
          diskUsageThreshold: 0.8 // 80%
        }
      }
    };
    
    await fs.writeFile(
      CONFIG.captureConfigFile,
      JSON.stringify(captureConfig, null, 2),
      'utf8'
    );
    
    log('✅ 数据捕获系统配置创建成功');
    return captureConfig;
    
  } catch (error) {
    log('❌ 数据捕获系统配置创建失败', error.message);
    throw error;
  }
}

/**
 * 初始化数据捕获索引系统
 */
async function initializeCaptureIndexes() {
  log('初始化数据捕获索引系统');
  
  try {
    const indexesPath = path.join(CONFIG.databasePath, 'indexes');
    
    // 创建各种索引的初始文件
    const indexes = {
      'by-provider': {
        codewhisperer: {},
        openai: {},
        gemini: {},
        anthropic: {}
      },
      'by-date': {},
      'by-request-id': {},
      'by-step': {
        'step-1': {},
        'step-2': {},
        'step-3': {},
        'step-4': {},
        'step-5': {},
        'step-6': {},
        'step-7': {},
        'step-8': {}
      }
    };
    
    for (const [indexType, indexData] of Object.entries(indexes)) {
      const indexFile = path.join(indexesPath, indexType, 'index.json');
      await fs.mkdir(path.dirname(indexFile), { recursive: true });
      await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2), 'utf8');
      log(`✅ 创建索引: ${indexType}`);
    }
    
    // 创建主索引注册表
    const indexRegistry = {
      version: '2.0.0',
      created: new Date().toISOString(),
      indexes: Object.keys(indexes),
      lastUpdated: new Date().toISOString(),
      totalEntries: 0
    };
    
    await fs.writeFile(
      path.join(indexesPath, 'registry.json'),
      JSON.stringify(indexRegistry, null, 2),
      'utf8'
    );
    
    log('✅ 数据捕获索引系统初始化完成');
    
  } catch (error) {
    log('❌ 数据捕获索引系统初始化失败', error.message);
    throw error;
  }
}

/**
 * 创建测试场景模板
 */
async function createTestScenarioTemplates() {
  log('创建测试场景模板');
  
  try {
    const scenariosPath = path.join(CONFIG.databasePath, 'simulation-data', 'test-scenarios');
    
    // 基础测试场景
    const basicScenario = {
      scenarioId: 'basic-text-response',
      name: '基础文本响应测试',
      description: '测试基本的文本生成功能',
      providers: ['codewhisperer', 'openai', 'gemini', 'anthropic'],
      request: {
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?'
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      },
      expectedResponse: {
        contentType: 'text',
        stopReason: 'end_turn',
        minLength: 10
      }
    };
    
    // 工具调用测试场景
    const toolCallScenario = {
      scenarioId: 'tool-call-response',
      name: '工具调用响应测试',
      description: '测试工具调用功能和格式转换',
      providers: ['codewhisperer', 'openai', 'gemini', 'anthropic'],
      request: {
        messages: [
          {
            role: 'user',
            content: 'What time is it? Use the get_current_time tool.'
          }
        ],
        tools: [
          {
            function: {
              name: 'get_current_time',
              description: 'Get the current time',
              parameters: {
                type: 'object',
                properties: {
                  timezone: {
                    type: 'string',
                    description: 'The timezone'
                  }
                }
              }
            }
          }
        ],
        max_tokens: 500
      },
      expectedResponse: {
        contentType: 'tool_use',
        stopReason: 'tool_use',
        hasToolCalls: true
      }
    };
    
    // 流式响应测试场景
    const streamingScenario = {
      scenarioId: 'streaming-response',
      name: '流式响应测试',
      description: '测试流式响应处理和事件序列',
      providers: ['codewhisperer', 'openai', 'gemini', 'anthropic'],
      request: {
        messages: [
          {
            role: 'user',
            content: 'Tell me a short story about a robot.'
          }
        ],
        max_tokens: 200,
        stream: true
      },
      expectedResponse: {
        streamingEvents: [
          'message_start',
          'content_block_start',
          'content_block_delta',
          'content_block_stop',
          'message_delta',
          'message_stop'
        ],
        finalStopReason: 'end_turn'
      }
    };
    
    // 错误处理测试场景
    const errorScenario = {
      scenarioId: 'error-handling',
      name: '错误处理测试',
      description: '测试各种错误情况的处理',
      providers: ['codewhisperer', 'openai', 'gemini', 'anthropic'],
      request: {
        messages: [
          {
            role: 'user',
            content: 'A'.repeat(50000) // 过长请求触发错误
          }
        ],
        max_tokens: 100000 // 超出限制
      },
      expectedResponse: {
        shouldFail: true,
        expectedErrors: [
          'token_limit_exceeded',
          'request_too_large',
          'invalid_request'
        ]
      }
    };
    
    const scenarios = [
      basicScenario,
      toolCallScenario,
      streamingScenario,
      errorScenario
    ];
    
    for (const scenario of scenarios) {
      const scenarioFile = path.join(scenariosPath, `${scenario.scenarioId}.json`);
      await fs.writeFile(scenarioFile, JSON.stringify(scenario, null, 2), 'utf8');
      log(`✅ 创建测试场景: ${scenario.name}`);
    }
    
    // 创建场景索引
    const scenarioIndex = {
      version: '2.0.0',
      created: new Date().toISOString(),
      scenarios: scenarios.map(s => ({
        id: s.scenarioId,
        name: s.name,
        providers: s.providers,
        file: `${s.scenarioId}.json`
      })),
      totalScenarios: scenarios.length
    };
    
    await fs.writeFile(
      path.join(scenariosPath, 'index.json'),
      JSON.stringify(scenarioIndex, null, 2),
      'utf8'
    );
    
    log('✅ 测试场景模板创建完成');
    
  } catch (error) {
    log('❌ 测试场景模板创建失败', error.message);
    throw error;
  }
}

/**
 * 创建模块测试配置
 */
async function createModuleTestConfigs() {
  log('创建模块测试配置');
  
  try {
    const moduleTestsPath = path.join(CONFIG.databasePath, 'simulation-data', 'module-tests');
    
    // 各模块测试配置
    const moduleConfigs = {
      'input-processing': {
        module: 'InputProcessingStep',
        testType: 'module-logic',
        description: '输入处理模块逻辑测试',
        testCases: [
          'anthropic-format-validation',
          'openai-format-conversion',
          'tool-definition-parsing',
          'message-validation'
        ],
        mockData: {
          validAnthropicRequest: true,
          validOpenAIRequest: true,
          invalidRequest: true,
          toolCallRequest: true
        }
      },
      'routing-logic': {
        module: 'RoutingStep',
        testType: 'module-logic',
        description: '路由逻辑模块测试',
        testCases: [
          'provider-selection',
          'model-mapping',
          'load-balancing',
          'failover-handling'
        ],
        mockData: {
          multipleProviders: true,
          singleProvider: true,
          providerFailure: true,
          roundRobinScenario: true
        }
      },
      'transformation': {
        module: 'TransformationStep',
        testType: 'module-logic',
        description: '转换模块逻辑测试',
        testCases: [
          'anthropic-to-provider',
          'provider-to-anthropic',
          'tool-format-conversion',
          'streaming-conversion'
        ],
        mockData: {
          anthropicRequest: true,
          providerResponse: true,
          toolCallData: true,
          streamingData: true
        }
      },
      'api-interaction': {
        module: 'APIInteractionStep',
        testType: 'module-logic',
        description: 'API交互模块测试',
        testCases: [
          'successful-request',
          'rate-limit-handling',
          'timeout-handling',
          'error-recovery'
        ],
        mockData: {
          successfulResponse: true,
          rateLimitError: true,
          timeoutError: true,
          networkError: true
        }
      }
    };
    
    for (const [moduleId, config] of Object.entries(moduleConfigs)) {
      const configFile = path.join(moduleTestsPath, `${moduleId}.json`);
      await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
      log(`✅ 创建模块配置: ${config.module}`);
    }
    
    // 创建模块测试索引
    const moduleIndex = {
      version: '2.0.0',
      created: new Date().toISOString(),
      modules: Object.keys(moduleConfigs),
      testTypes: ['module-logic', 'integration', 'performance'],
      totalConfigurations: Object.keys(moduleConfigs).length
    };
    
    await fs.writeFile(
      path.join(moduleTestsPath, 'index.json'),
      JSON.stringify(moduleIndex, null, 2),
      'utf8'
    );
    
    log('✅ 模块测试配置创建完成');
    
  } catch (error) {
    log('❌ 模块测试配置创建失败', error.message);
    throw error;
  }
}

/**
 * 验证数据捕获系统初始化
 */
async function validateCaptureSystemInitialization() {
  log('验证数据捕获系统初始化');
  
  try {
    // 检查必需文件
    const requiredFiles = [
      'database-config.json',
      'capture-system-config.json',
      'pipeline-test-config.json',
      'indexes/registry.json',
      'simulation-data/test-scenarios/index.json',
      'simulation-data/module-tests/index.json'
    ];
    
    let validatedCount = 0;
    
    for (const file of requiredFiles) {
      const filePath = path.join(CONFIG.databasePath, file);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          validatedCount++;
          log(`✅ 文件存在: ${file}`);
        }
      } catch (error) {
        log(`❌ 文件缺失: ${file}`);
        throw new Error(`Missing required file: ${file}`);
      }
    }
    
    // 检查目录结构完整性
    const requiredDirectories = [
      'data-points/codewhisperer',
      'data-points/openai',
      'data-points/gemini',
      'data-points/anthropic',
      'flows/codewhisperer',
      'flows/openai',
      'flows/gemini',
      'flows/anthropic',
      'analytics/individual-module-logic',
      'analytics/pipeline-simulation',
      'analytics/real-pipeline-tests',
      'analytics/performance-metrics',
      'exports/json',
      'exports/csv',
      'exports/reports',
      'indexes/by-provider',
      'indexes/by-date',
      'indexes/by-request-id',
      'indexes/by-step',
      'simulation-data/module-tests',
      'simulation-data/pipeline-mock-data',
      'simulation-data/test-scenarios'
    ];
    
    for (const dir of requiredDirectories) {
      const dirPath = path.join(CONFIG.databasePath, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
          validatedCount++;
        }
      } catch (error) {
        log(`❌ 目录缺失: ${dir}`);
        throw new Error(`Missing required directory: ${dir}`);
      }
    }
    
    log(`✅ 数据捕获系统验证通过，共验证 ${validatedCount} 个项目`);
    
  } catch (error) {
    log('❌ 数据捕获系统验证失败', error.message);
    throw error;
  }
}

/**
 * 主执行函数
 */
async function main() {
  log('🚀 开始数据捕获系统初始化流程');
  log('配置', CONFIG);
  
  try {
    // 步骤 1: 加载数据库配置
    log('\n📖 加载数据库配置');
    const dbConfig = await loadDatabaseConfig();
    
    // 步骤 2: 创建数据捕获系统配置
    log('\n⚙️ 创建数据捕获系统配置');
    const captureConfig = await createCaptureSystemConfig(dbConfig);
    
    // 步骤 3: 初始化数据捕获索引系统
    log('\n📊 初始化数据捕获索引系统');
    await initializeCaptureIndexes();
    
    // 步骤 4: 创建测试场景模板
    log('\n🎯 创建测试场景模板');
    await createTestScenarioTemplates();
    
    // 步骤 5: 创建模块测试配置
    log('\n🧪 创建模块测试配置');
    await createModuleTestConfigs();
    
    // 步骤 6: 验证初始化
    log('\n✅ 验证数据捕获系统初始化');
    await validateCaptureSystemInitialization();
    
    // 完成报告
    log('\n🎉 数据捕获系统初始化完成');
    log('数据库路径', CONFIG.databasePath);
    log('捕获配置文件', CONFIG.captureConfigFile);
    log('日志文件', CONFIG.logFile);
    
    console.log('\n✅ 数据捕获系统初始化成功');
    console.log(`📁 数据库路径: ${CONFIG.databasePath}`);
    console.log(`⚙️ 捕获配置: ${CONFIG.captureConfigFile}`);
    console.log(`📄 执行日志: ${CONFIG.logFile}`);
    
  } catch (error) {
    log(`❌ 数据捕获系统初始化失败`, error.message);
    console.log('\n❌ 初始化失败:', error.message);
    console.log(`📄 详细日志: ${CONFIG.logFile}`);
    process.exit(1);
  }
}

// 执行脚本
if (require.main === module) {
  main();
}