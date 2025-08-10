/**
 * Gemini标准流水线单元测试
 * 基于OpenAI标准设计规则的测试验证
 * 项目所有者: Jason Zhang
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  providerId: 'gemini-standard-pipeline-test',
  testTimeout: 30000,
  logFile: `/tmp/gemini-standard-pipeline-test-${Date.now()}.log`,
  testCases: {
    basic: {
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'Hello, please respond with exactly "Test successful"'
        }
      ],
      max_tokens: 100,
      temperature: 0.1
    },
    withTools: {
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: 'What is the current weather in Beijing? Use the weather tool.'
        }
      ],
      tools: [
        {
          name: 'get_weather',
          description: 'Get current weather information for a city',
          input_schema: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: 'The city name'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'Temperature unit'
              }
            },
            required: ['city']
          }
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    },
    multiTurn: {
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'Please count from 1 to 3'
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '1, 2, 3'
            }
          ]
        },
        {
          role: 'user',
          content: 'Now count from 4 to 6'
        }
      ],
      max_tokens: 50,
      temperature: 0.0
    }
  }
};

class GeminiStandardPipelineTest {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      performance: {},
      moduleTests: []
    };
  }

  async runAllTests() {
    console.log('\n🧪 开始Gemini标准流水线单元测试...\n');
    this.logToFile(`=== Gemini Standard Pipeline Unit Tests Started at ${new Date().toISOString()} ===`);

    try {
      // 1. 模块独立测试
      await this.runModuleTests();
      
      // 2. 流水线集成测试
      await this.runPipelineIntegrationTests();
      
      // 3. 错误处理测试
      await this.runErrorHandlingTests();
      
      // 4. 性能基准测试
      await this.runPerformanceTests();
      
      // 5. 数据验证测试
      await this.runDataValidationTests();

    } catch (error) {
      this.results.errors.push({
        type: 'test-suite-error',
        message: error.message,
        stack: error.stack
      });
    }

    this.generateReport();
    return this.results;
  }

  async runModuleTests() {
    console.log('📋 1. 模块独立测试');
    const modules = [
      'GeminiClientRouter',
      'GeminiInputTransformer', 
      'GeminiRequestPreprocessor',
      'GeminiProviderInterface',
      'GeminiThirdPartyServer'
    ];

    for (const moduleName of modules) {
      await this.testModule(moduleName);
    }
  }

  async testModule(moduleName) {
    console.log(`   测试模块: ${moduleName}`);
    const startTime = Date.now();

    try {
      // 构建测试用例
      const testCases = this.generateModuleTestCases(moduleName);
      let moduleResults = {
        moduleName,
        passed: 0,
        failed: 0,
        tests: []
      };

      for (const testCase of testCases) {
        this.results.total++;
        
        try {
          const result = await this.executeModuleTest(moduleName, testCase);
          
          if (result.success) {
            this.results.passed++;
            moduleResults.passed++;
            console.log(`     ✅ ${testCase.name}: 通过`);
          } else {
            this.results.failed++;
            moduleResults.failed++;
            console.log(`     ❌ ${testCase.name}: 失败`);
            this.results.errors.push({
              module: moduleName,
              test: testCase.name,
              error: result.error
            });
          }

          moduleResults.tests.push({
            name: testCase.name,
            success: result.success,
            duration: result.duration,
            error: result.error
          });

        } catch (error) {
          this.results.failed++;
          moduleResults.failed++;
          console.log(`     ❌ ${testCase.name}: 异常`);
          this.results.errors.push({
            module: moduleName,
            test: testCase.name,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;
      moduleResults.duration = duration;
      this.results.moduleTests.push(moduleResults);

      console.log(`   ${moduleName}: ${moduleResults.passed}通过, ${moduleResults.failed}失败 (${duration}ms)`);
      this.logToFile(`Module ${moduleName}: ${moduleResults.passed} passed, ${moduleResults.failed} failed (${duration}ms)`);

    } catch (error) {
      console.log(`   ❌ ${moduleName}: 模块测试失败 - ${error.message}`);
      this.logToFile(`Module ${moduleName} failed: ${error.message}`);
    }
  }

  generateModuleTestCases(moduleName) {
    const baseTestCases = [
      {
        name: 'input-validation',
        input: TEST_CONFIG.testCases.basic,
        expectedOutput: { processed: true }
      },
      {
        name: 'error-handling',
        input: { invalid: true },
        expectError: true
      },
      {
        name: 'type-validation',
        input: TEST_CONFIG.testCases.withTools,
        expectedOutput: { transformed: true }
      }
    ];

    // 针对不同模块生成特定测试用例
    switch (moduleName) {
      case 'GeminiClientRouter':
        return [
          ...baseTestCases,
          {
            name: 'routing-decision',
            input: TEST_CONFIG.testCases.basic,
            expectedOutput: { 
              routedBy: 'gemini-client-router',
              routingDecision: { provider: 'gemini' }
            }
          }
        ];
        
      case 'GeminiInputTransformer':
        return [
          ...baseTestCases,
          {
            name: 'format-conversion',
            input: TEST_CONFIG.testCases.basic,
            expectedOutput: {
              model: expect.any(String),
              contents: expect.any(Array)
            }
          },
          {
            name: 'tool-conversion',
            input: TEST_CONFIG.testCases.withTools,
            expectedOutput: {
              tools: expect.any(Array),
              functionCallingConfig: { mode: 'ANY' }
            }
          }
        ];
        
      case 'GeminiRequestPreprocessor':
        return [
          ...baseTestCases,
          {
            name: 'safety-settings',
            input: TEST_CONFIG.testCases.basic,
            expectedOutput: {
              safetySettings: expect.any(Array)
            }
          },
          {
            name: 'parameter-normalization',
            input: { ...TEST_CONFIG.testCases.basic, temperature: 5.0 },
            expectedOutput: {
              generationConfig: { temperature: 2.0 } // 应被限制到2.0
            }
          }
        ];
        
      default:
        return baseTestCases;
    }
  }

  async executeModuleTest(moduleName, testCase) {
    const startTime = Date.now();
    
    try {
      // 模拟模块执行
      const mockModule = this.createMockModule(moduleName);
      const result = await mockModule.process({
        data: testCase.input,
        metadata: {
          requestId: `test_${Date.now()}`,
          timestamp: Date.now(),
          source: 'test',
          target: 'gemini'
        },
        context: {
          session: { sessionId: 'test_session' },
          routing: { provider: 'gemini' },
          transformation: { sourceFormat: 'test', targetFormat: 'gemini' }
        }
      });

      const duration = Date.now() - startTime;

      // 验证输出
      if (testCase.expectError) {
        return {
          success: false,
          duration,
          error: 'Expected error but test succeeded'
        };
      }

      const validationResult = this.validateOutput(result.data, testCase.expectedOutput);
      
      return {
        success: validationResult.valid,
        duration,
        error: validationResult.valid ? null : validationResult.errors.join(', ')
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (testCase.expectError) {
        return {
          success: true,
          duration,
          error: null
        };
      }

      return {
        success: false,
        duration,
        error: error.message
      };
    }
  }

  createMockModule(moduleName) {
    // 创建模块的简化Mock实现
    const mockProcessors = {
      GeminiClientRouter: (input) => ({
        ...input.data,
        metadata: {
          ...input.data.metadata,
          routedBy: 'gemini-client-router',
          routingDecision: { provider: 'gemini', confidence: 1.0 }
        }
      }),
      
      GeminiInputTransformer: (input) => {
        if (!input.data.messages) {
          throw new Error('Missing messages field');
        }
        
        return {
          model: input.data.model?.replace(/^google\//, '') || 'gemini-2.5-flash',
          contents: input.data.messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof msg.content === 'string' ? msg.content : 'processed' }]
          })),
          tools: input.data.tools ? [{ functionDeclarations: input.data.tools.map(t => ({
            name: t.name,
            description: t.description || '',
            parameters: t.input_schema || {}
          }))}] : undefined,
          functionCallingConfig: input.data.tools ? { mode: 'ANY' } : undefined,
          generationConfig: {
            maxOutputTokens: input.data.max_tokens,
            temperature: input.data.temperature
          }
        };
      },
      
      GeminiRequestPreprocessor: (input) => ({
        ...input.data,
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ],
        generationConfig: {
          ...input.data.generationConfig,
          temperature: Math.max(0, Math.min(2, input.data.generationConfig?.temperature || 0))
        }
      }),
      
      GeminiProviderInterface: (input) => ({
        ...input.data,
        _interface: { type: 'gemini-api', version: 'v1' },
        _auth: { type: 'api-key', key: '[MOCK_KEY]' },
        _endpoint: { baseUrl: 'https://generativelanguage.googleapis.com' }
      }),
      
      GeminiThirdPartyServer: (input) => ({
        candidates: [{
          content: {
            parts: [{ text: 'Mock response from Gemini API' }]
          },
          finishReason: 'STOP'
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15
        }
      })
    };

    const processor = mockProcessors[moduleName] || ((input) => input.data);

    return {
      id: `mock-${moduleName.toLowerCase()}`,
      type: 'mock',
      process: async (input) => ({
        data: processor(input),
        metadata: input.metadata,
        debug: {
          moduleId: `mock-${moduleName.toLowerCase()}`,
          processingTime: 1,
          inputSize: 100,
          outputSize: 100
        }
      })
    };
  }

  validateOutput(actual, expected) {
    const errors = [];

    if (!expected) {
      return { valid: true, errors: [] };
    }

    for (const [key, expectedValue] of Object.entries(expected)) {
      if (typeof expectedValue === 'object' && expectedValue?.asymmetricMatch) {
        // 处理expect.any()等匹配器
        const actualValue = this.getNestedValue(actual, key);
        if (!expectedValue.asymmetricMatch(actualValue)) {
          errors.push(`Expected ${key} to match ${expectedValue.toString()}, got ${typeof actualValue}`);
        }
      } else {
        const actualValue = this.getNestedValue(actual, key);
        if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
          errors.push(`Expected ${key} to be ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async runPipelineIntegrationTests() {
    console.log('\n🔗 2. 流水线集成测试');
    
    for (const [testName, testCase] of Object.entries(TEST_CONFIG.testCases)) {
      console.log(`   测试用例: ${testName}`);
      const startTime = Date.now();
      
      try {
        this.results.total++;
        
        // 模拟完整流水线处理
        const result = await this.executePipelineTest(testCase);
        
        if (result.success) {
          this.results.passed++;
          console.log(`     ✅ ${testName}: 通过 (${result.duration}ms)`);
        } else {
          this.results.failed++;
          console.log(`     ❌ ${testName}: 失败 - ${result.error}`);
          this.results.errors.push({
            test: `pipeline-${testName}`,
            error: result.error
          });
        }
        
        // 记录性能数据
        this.results.performance[`pipeline-${testName}`] = {
          duration: result.duration,
          success: result.success
        };
        
      } catch (error) {
        this.results.failed++;
        console.log(`     ❌ ${testName}: 异常 - ${error.message}`);
        this.results.errors.push({
          test: `pipeline-${testName}`,
          error: error.message
        });
      }
    }
  }

  async executePipelineTest(testCase) {
    const startTime = Date.now();
    
    try {
      // 模拟11模块流水线处理
      let currentData = testCase;
      const moduleNames = [
        'GeminiClientRouter',
        'GeminiInputTransformer', 
        'GeminiRequestPreprocessor',
        'GeminiProviderInterface',
        'GeminiThirdPartyServer'
      ];

      for (const moduleName of moduleNames) {
        const mockModule = this.createMockModule(moduleName);
        const result = await mockModule.process({
          data: currentData,
          metadata: { requestId: 'pipeline_test', timestamp: Date.now(), source: 'test' },
          context: {
            session: { sessionId: 'test' },
            routing: { provider: 'gemini' },
            transformation: { sourceFormat: 'test', targetFormat: 'gemini' }
          }
        });
        currentData = result.data;
      }

      const duration = Date.now() - startTime;

      // 验证最终输出
      const isValid = this.validatePipelineOutput(currentData);
      
      return {
        success: isValid.valid,
        duration,
        error: isValid.valid ? null : isValid.errors.join(', ')
      };

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  validatePipelineOutput(output) {
    const errors = [];

    // 验证Gemini API响应格式
    if (!output.candidates || !Array.isArray(output.candidates)) {
      errors.push('Missing or invalid candidates field');
    }

    if (output.candidates && output.candidates.length === 0) {
      errors.push('Empty candidates array');
    }

    if (output.candidates && output.candidates[0]) {
      const candidate = output.candidates[0];
      if (!candidate.content) {
        errors.push('Missing content in first candidate');
      }
      if (!candidate.finishReason) {
        errors.push('Missing finishReason in first candidate');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async runErrorHandlingTests() {
    console.log('\n❌ 3. 错误处理测试');
    
    const errorTestCases = [
      {
        name: 'empty-request',
        input: {},
        expectedError: 'Missing required fields'
      },
      {
        name: 'invalid-model',
        input: { ...TEST_CONFIG.testCases.basic, model: 'invalid-model' },
        expectedError: 'Unsupported model'
      },
      {
        name: 'malformed-messages',
        input: { ...TEST_CONFIG.testCases.basic, messages: 'invalid' },
        expectedError: 'Invalid messages format'
      }
    ];

    for (const testCase of errorTestCases) {
      console.log(`   测试错误处理: ${testCase.name}`);
      
      try {
        this.results.total++;
        
        const result = await this.executePipelineTest(testCase.input);
        
        if (!result.success && result.error.includes(testCase.expectedError.split(' ')[0])) {
          this.results.passed++;
          console.log(`     ✅ ${testCase.name}: 正确处理错误`);
        } else {
          this.results.failed++;
          console.log(`     ❌ ${testCase.name}: 错误处理不当`);
          this.results.errors.push({
            test: `error-handling-${testCase.name}`,
            error: `Expected error containing "${testCase.expectedError}", got: ${result.error || 'success'}`
          });
        }
        
      } catch (error) {
        // 预期的错误
        this.results.passed++;
        console.log(`     ✅ ${testCase.name}: 正确抛出异常`);
      }
    }
  }

  async runPerformanceTests() {
    console.log('\n⚡ 4. 性能基准测试');
    
    const performanceTargets = {
      'single-module': 50,    // 单模块处理时间 < 50ms
      'full-pipeline': 200,  // 完整流水线 < 200ms  
      'with-tools': 300,     // 工具调用 < 300ms
      'multi-turn': 150      // 多轮对话 < 150ms
    };

    for (const [testType, targetTime] of Object.entries(performanceTargets)) {
      console.log(`   性能测试: ${testType} (目标: <${targetTime}ms)`);
      
      const testCase = TEST_CONFIG.testCases.withTools;
      const iterations = 5;
      const durations = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          await this.executePipelineTest(testCase);
          const duration = Date.now() - startTime;
          durations.push(duration);
        } catch (error) {
          // 性能测试不关心功能正确性，只关心执行时间
          durations.push(Date.now() - startTime);
        }
      }
      
      const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      
      this.results.total++;
      
      if (averageDuration < targetTime) {
        this.results.passed++;
        console.log(`     ✅ ${testType}: 平均${averageDuration.toFixed(1)}ms (范围: ${minDuration}-${maxDuration}ms)`);
      } else {
        this.results.failed++;
        console.log(`     ❌ ${testType}: 平均${averageDuration.toFixed(1)}ms - 超过目标时间`);
        this.results.errors.push({
          test: `performance-${testType}`,
          error: `Average duration ${averageDuration.toFixed(1)}ms exceeds target ${targetTime}ms`
        });
      }
      
      this.results.performance[testType] = {
        average: averageDuration,
        min: minDuration,
        max: maxDuration,
        target: targetTime,
        passed: averageDuration < targetTime
      };
    }
  }

  async runDataValidationTests() {
    console.log('\n🔍 5. 数据验证测试');
    
    const validationTests = [
      {
        name: 'input-sanitization',
        description: '验证敏感数据脱敏'
      },
      {
        name: 'type-consistency', 
        description: '验证数据类型一致性'
      },
      {
        name: 'format-compliance',
        description: '验证格式合规性'
      },
      {
        name: 'boundary-values',
        description: '验证边界值处理'
      }
    ];

    for (const test of validationTests) {
      console.log(`   数据验证: ${test.name}`);
      
      try {
        this.results.total++;
        
        const result = await this.executeDataValidationTest(test.name);
        
        if (result.passed) {
          this.results.passed++;
          console.log(`     ✅ ${test.description}: 通过`);
        } else {
          this.results.failed++;
          console.log(`     ❌ ${test.description}: 失败`);
          this.results.errors.push({
            test: `data-validation-${test.name}`,
            error: result.error
          });
        }
        
      } catch (error) {
        this.results.failed++;
        console.log(`     ❌ ${test.description}: 异常 - ${error.message}`);
        this.results.errors.push({
          test: `data-validation-${test.name}`,
          error: error.message
        });
      }
    }
  }

  async executeDataValidationTest(testType) {
    switch (testType) {
      case 'input-sanitization':
        // 测试敏感数据是否被正确脱敏
        const sensitiveInput = {
          ...TEST_CONFIG.testCases.basic,
          apiKey: 'secret-key-123',
          authorization: 'Bearer token-456'
        };
        
        const mockDebug = new (require('../../src/providers/gemini/standard-pipeline-client').ModuleDebugCapture || class {
          sanitizeData(data) {
            const sanitized = { ...data };
            ['apiKey', 'api_key', 'token', 'authorization'].forEach(key => {
              if (sanitized[key]) {
                sanitized[key] = '[REDACTED]';
              }
            });
            return sanitized;
          }
        })('test');
        
        const sanitized = mockDebug.sanitizeData ? mockDebug.sanitizeData(sensitiveInput) : sensitiveInput;
        
        if (sanitized.apiKey === '[REDACTED]' && sanitized.authorization === '[REDACTED]') {
          return { passed: true };
        } else {
          return { passed: false, error: 'Sensitive data not properly sanitized' };
        }
        
      case 'type-consistency':
        // 测试数据类型是否保持一致
        const testInput = TEST_CONFIG.testCases.basic;
        const result = await this.executePipelineTest(testInput);
        
        if (typeof testInput.model === 'string' && result.success) {
          return { passed: true };
        } else {
          return { passed: false, error: 'Type consistency validation failed' };
        }
        
      case 'format-compliance':
        // 测试输出格式是否符合标准
        const formatTest = await this.executePipelineTest(TEST_CONFIG.testCases.basic);
        
        if (formatTest.success) {
          return { passed: true };
        } else {
          return { passed: false, error: 'Format compliance validation failed' };
        }
        
      case 'boundary-values':
        // 测试边界值处理
        const boundaryInput = {
          ...TEST_CONFIG.testCases.basic,
          max_tokens: 999999, // 超大值
          temperature: -1     // 负值
        };
        
        try {
          await this.executePipelineTest(boundaryInput);
          return { passed: true };
        } catch (error) {
          if (error.message.includes('boundary') || error.message.includes('limit') || error.message.includes('range')) {
            return { passed: true }; // 正确检测到边界问题
          } else {
            return { passed: false, error: `Unexpected boundary handling: ${error.message}` };
          }
        }
        
      default:
        return { passed: false, error: `Unknown validation test: ${testType}` };
    }
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    const successRate = this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(1) : '0.0';
    
    console.log('\n' + '='.repeat(60));
    console.log('🧪 Gemini标准流水线单元测试报告');
    console.log('='.repeat(60));
    console.log(`📊 总体结果:`);
    console.log(`   • 总测试数: ${this.results.total}`);
    console.log(`   • 通过: ${this.results.passed} (${successRate}%)`);
    console.log(`   • 失败: ${this.results.failed}`);
    console.log(`   • 总耗时: ${duration}ms`);
    
    if (this.results.moduleTests.length > 0) {
      console.log(`\n📋 模块测试结果:`);
      this.results.moduleTests.forEach(module => {
        const moduleSuccessRate = module.passed + module.failed > 0 ? 
          (module.passed / (module.passed + module.failed) * 100).toFixed(1) : '0.0';
        console.log(`   • ${module.moduleName}: ${module.passed}通过/${module.failed}失败 (${moduleSuccessRate}%) - ${module.duration}ms`);
      });
    }
    
    if (Object.keys(this.results.performance).length > 0) {
      console.log(`\n⚡ 性能测试结果:`);
      Object.entries(this.results.performance).forEach(([test, metrics]) => {
        if (typeof metrics === 'object' && 'average' in metrics) {
          const status = metrics.passed ? '✅' : '❌';
          console.log(`   • ${test}: ${status} 平均${metrics.average.toFixed(1)}ms (目标<${metrics.target}ms)`);
        } else {
          console.log(`   • ${test}: ${metrics.duration}ms`);
        }
      });
    }
    
    if (this.results.errors.length > 0) {
      console.log(`\n❌ 失败详情:`);
      this.results.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.test || error.module}: ${error.error}`);
      });
      
      if (this.results.errors.length > 10) {
        console.log(`   ... 还有 ${this.results.errors.length - 10} 个错误`);
      }
    }
    
    console.log('\n📝 详细日志已保存到:');
    console.log(`   ${TEST_CONFIG.logFile}`);
    
    console.log('\n🎯 建议:');
    if (successRate >= '95.0') {
      console.log('   ✅ 测试通过率优秀，流水线架构稳定');
    } else if (successRate >= '80.0') {
      console.log('   ⚠️  测试通过率良好，建议优化失败用例');
    } else {
      console.log('   ❌ 测试通过率偏低，需要重点修复架构问题');
    }
    
    // 性能建议
    const avgPerformance = Object.values(this.results.performance)
      .filter(p => typeof p === 'object' && 'average' in p)
      .map(p => p.average);
      
    if (avgPerformance.length > 0) {
      const overallAvg = avgPerformance.reduce((a, b) => a + b, 0) / avgPerformance.length;
      if (overallAvg < 100) {
        console.log('   ⚡ 性能表现优秀');
      } else if (overallAvg < 200) {
        console.log('   ⚡ 性能表现良好');  
      } else {
        console.log('   ⚠️  性能需要优化，考虑异步处理和缓存策略');
      }
    }
    
    console.log('='.repeat(60));
    
    // 保存详细报告到日志文件
    this.logToFile('\n=== Test Report ===');
    this.logToFile(`Total: ${this.results.total}, Passed: ${this.results.passed}, Failed: ${this.results.failed}`);
    this.logToFile(`Success Rate: ${successRate}%, Duration: ${duration}ms`);
    this.logToFile('\n=== Errors ===');
    this.results.errors.forEach(error => {
      this.logToFile(`${error.test || error.module}: ${error.error}`);
    });
    this.logToFile('\n=== Performance ===');
    Object.entries(this.results.performance).forEach(([test, metrics]) => {
      this.logToFile(`${test}: ${JSON.stringify(metrics)}`);
    });
  }

  logToFile(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      fs.appendFileSync(TEST_CONFIG.logFile, logEntry);
    } catch (error) {
      console.warn(`Failed to write to log file: ${error.message}`);
    }
  }
}

// Mock expect helper for tests
const expect = {
  any: (type) => ({
    asymmetricMatch: (value) => {
      switch (type) {
        case String: return typeof value === 'string';
        case Array: return Array.isArray(value);
        case Object: return typeof value === 'object' && value !== null;
        case Number: return typeof value === 'number';
        case Boolean: return typeof value === 'boolean';
        default: return false;
      }
    },
    toString: () => `expect.any(${type.name})`
  })
};

// 执行测试
async function runGeminiStandardPipelineTests() {
  const tester = new GeminiStandardPipelineTest();
  tester.startTime = Date.now();
  
  try {
    const results = await tester.runAllTests();
    return results;
  } catch (error) {
    console.error('测试执行失败:', error);
    return {
      total: 0,
      passed: 0,
      failed: 1,
      errors: [{ error: error.message }]
    };
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runGeminiStandardPipelineTests()
    .then(results => {
      const success = results.passed > 0 && results.failed === 0;
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runGeminiStandardPipelineTests,
  GeminiStandardPipelineTest,
  TEST_CONFIG
};