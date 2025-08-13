/**
 * 真实系统逻辑验证测试
 * 确保测试调用的是真实系统逻辑，而非模拟逻辑
 * 测试框架用于发现和修正系统问题
 * 
 * Project owner: Jason Zhang
 */

import { RouterServer } from '../../dist/v3/server/router-server.js';
import { loadUserConfig } from '../../src/v3/config/config-merger.js';
import { LMStudioToolCompatibility } from '../../src/v3/preprocessor/lmstudio-tool-compatibility.js';
import { PreprocessingPipeline } from '../../src/v3/preprocessor/preprocessing-pipeline.js';
import fs from 'fs';
import path from 'path';

class RealSystemLogicTest {
  constructor() {
    this.testResults = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      results: []
    };
  }

  async runAllTests() {
    console.log('🧪 开始真实系统逻辑验证测试...\n');

    const tests = [
      {
        name: '验证ConfigMerger真实解析逻辑',
        test: () => this.testRealConfigMergerLogic()
      },
      {
        name: '验证RouterServer真实路由逻辑',
        test: () => this.testRealRouterServerLogic()
      },
      {
        name: '验证PreprocessingPipeline真实预处理逻辑',
        test: () => this.testRealPreprocessingLogic()
      },
      {
        name: '验证LMStudio工具兼容性真实转换逻辑',
        test: () => this.testRealToolCompatibilityLogic()
      },
      {
        name: '验证端到端真实API调用流',
        test: () => this.testRealEndToEndFlow()
      },
      {
        name: '验证配置文件真实加载和验证',
        test: () => this.testRealConfigFileValidation()
      }
    ];

    for (const test of tests) {
      try {
        console.log(`   🔧 ${test.name}...`);
        await test.test();
        this.recordResult(test.name, true);
        console.log(`   ✅ ${test.name} 通过`);
      } catch (error) {
        this.recordResult(test.name, false, error.message);
        console.log(`   ❌ ${test.name} 失败: ${error.message}`);
      }
    }

    this.printSummary();
    return this.testResults.failed === 0;
  }

  testRealConfigMergerLogic() {
    // 测试真实ConfigMerger解析逻辑
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    
    // 验证文件真实存在
    if (!fs.existsSync(userConfigPath)) {
      throw new Error(`用户配置文件不存在: ${userConfigPath}`);
    }

    // 调用真实的配置加载逻辑
    const mergedConfig = loadUserConfig(userConfigPath);

    // 验证真实解析结果的完整性
    if (!mergedConfig.server || !mergedConfig.providers || !mergedConfig.routing) {
      throw new Error('真实ConfigMerger解析结果缺少必要字段');
    }

    // 验证六层架构真实生成
    if (!mergedConfig.architecture || !mergedConfig.architecture.layers) {
      throw new Error('真实ConfigMerger未生成六层架构配置');
    }

    // 验证预处理配置真实生成
    if (!mergedConfig.preprocessing || !mergedConfig.preprocessing.enabled) {
      throw new Error('真实ConfigMerger未启用预处理配置');
    }

    // 验证LMStudio自动检测逻辑
    const hasLMStudioProcessor = mergedConfig.preprocessing.processors['lmstudio-tool-compatibility'];
    if (!hasLMStudioProcessor || !hasLMStudioProcessor.enabled) {
      throw new Error('真实ConfigMerger未自动启用LMStudio工具兼容性');
    }

    console.log('     ✓ ConfigMerger真实解析逻辑验证通过');
  }

  testRealRouterServerLogic() {
    // 测试真实RouterServer初始化逻辑
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const config = loadUserConfig(userConfigPath);

    // 调用真实RouterServer构造函数
    const server = new RouterServer(config);

    // 验证真实组件初始化
    if (!server.inputProcessor) {
      throw new Error('RouterServer未初始化inputProcessor');
    }

    if (!server.routingEngine) {
      throw new Error('RouterServer未初始化routingEngine');
    }

    if (!server.outputProcessor) {
      throw new Error('RouterServer未初始化outputProcessor');
    }

    if (!server.preprocessingPipeline) {
      throw new Error('RouterServer未初始化preprocessingPipeline');
    }

    // 验证真实providers初始化
    const providerCount = server.providers.size;
    if (providerCount === 0) {
      throw new Error('RouterServer未初始化任何providers');
    }

    // 验证真实路由配置
    console.log('     🔍 调试路由配置...');
    console.log(`     - routingEngine.routingConfig类型: ${typeof server.routingEngine.routingConfig}`);
    console.log(`     - routingEngine.routingConfig内容: ${JSON.stringify(server.routingEngine.routingConfig, null, 2)}`);
    
    const routingConfig = server.routingEngine.routingConfig;
    if (!routingConfig || Object.keys(routingConfig).length === 0) {
      throw new Error('RouterServer路由配置为空');
    }

    console.log(`     ✓ RouterServer真实逻辑验证通过，初始化了${providerCount}个providers`);
  }

  testRealPreprocessingLogic() {
    // 测试真实PreprocessingPipeline逻辑
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const config = loadUserConfig(userConfigPath);

    // 调用真实PreprocessingPipeline构造函数
    const pipeline = new PreprocessingPipeline(config);

    // 验证真实处理器注册
    const pipelineInfo = pipeline.getInfo();
    if (pipelineInfo.totalProcessors === 0) {
      throw new Error('PreprocessingPipeline未注册任何处理器');
    }

    // 验证LMStudio处理器真实注册
    const lmStudioProcessor = pipelineInfo.processors.find(p => 
      p.name === 'lmstudio-tool-compatibility'
    );
    if (!lmStudioProcessor || !lmStudioProcessor.enabled) {
      throw new Error('PreprocessingPipeline未注册LMStudio工具兼容性处理器');
    }

    // 测试真实预处理调用
    const testRequest = {
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }],
      tools: [{
        name: 'test_tool',
        description: 'Test tool',
        input_schema: {
          type: 'object',
          properties: { param: { type: 'string' } }
        }
      }]
    };

    const processedRequest = pipeline.preprocessRequest(testRequest, 'lmstudio');
    
    // 验证真实预处理结果
    if (!processedRequest.tools || processedRequest.tools.length === 0) {
      throw new Error('PreprocessingPipeline预处理后工具丢失');
    }

    const processedTool = processedRequest.tools[0];
    if (processedTool.type !== 'function') {
      throw new Error('PreprocessingPipeline未正确转换工具格式');
    }

    console.log('     ✓ PreprocessingPipeline真实逻辑验证通过');
  }

  testRealToolCompatibilityLogic() {
    // 测试真实LMStudio工具兼容性处理器逻辑
    const processor = new LMStudioToolCompatibility();

    // 验证真实处理器信息
    const info = processor.getInfo();
    if (!info.name || !info.version) {
      throw new Error('LMStudioToolCompatibility处理器信息不完整');
    }

    // 测试真实Anthropic格式转换
    const anthropicTool = {
      name: 'get_weather_data',
      description: 'Get weather information for a location',
      input_schema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
          units: { type: 'string', description: 'Temperature units' }
        },
        required: ['location']
      }
    };

    const request = { tools: [anthropicTool] };
    const processed = processor.preprocessRequest(request);

    // 验证真实转换结果
    if (!processed.tools || processed.tools.length !== 1) {
      throw new Error('工具兼容性处理器转换失败');
    }

    const convertedTool = processed.tools[0];
    if (convertedTool.type !== 'function') {
      throw new Error('工具类型转换失败');
    }

    if (convertedTool.function.name !== 'get_weather_data') {
      throw new Error('工具名称转换失败');
    }

    if (!convertedTool.function.parameters.properties.location) {
      throw new Error('工具参数转换失败');
    }

    // 测试真实工具名称清理逻辑
    const testCases = [
      { input: 'get-weather', expected: 'get_weather' },
      { input: '123invalid', expected: '_123invalid' },
      { input: 'UPPERCASE', expected: 'uppercase' }
    ];

    for (const testCase of testCases) {
      const result = processor.sanitizeToolName(testCase.input);
      if (result !== testCase.expected) {
        throw new Error(`工具名称清理逻辑错误: ${testCase.input} -> ${result}, 期望: ${testCase.expected}`);
      }
    }

    console.log('     ✓ LMStudio工具兼容性真实逻辑验证通过');
  }

  async testRealEndToEndFlow() {
    // 测试真实端到端流程
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const config = loadUserConfig(userConfigPath);
    const server = new RouterServer(config);

    // 模拟真实请求流程
    const testRequest = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'Get weather for Beijing' }
      ],
      tools: [{
        name: 'get_weather',
        description: 'Get weather information',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          },
          required: ['location']
        }
      }],
      max_tokens: 1000
    };

    // 测试真实输入处理
    console.log('     🔍 调试输入处理...');
    const processedInput = await server.inputProcessor.process(testRequest);
    console.log(`     - 输入处理结果: ${JSON.stringify(processedInput, null, 2)}`);
    
    if (!processedInput || !processedInput.messages || processedInput.messages.length === 0) {
      throw new Error('真实输入处理失败');
    }

    // 测试真实路由逻辑
    const providerId = await server.routingEngine.route(processedInput, 'test-request-id');
    if (!providerId) {
      throw new Error('真实路由逻辑失败');
    }

    // 测试真实预处理
    const preprocessedRequest = server.preprocessingPipeline.preprocessRequest(
      processedInput, 
      providerId,
      { requestId: 'test-request-id' }
    );

    if (!preprocessedRequest.tools || preprocessedRequest.tools.length === 0) {
      throw new Error('真实预处理失败');
    }

    // 验证真实转换结果
    const tool = preprocessedRequest.tools[0];
    if (tool.type !== 'function' || !tool.function.name) {
      throw new Error('真实端到端工具转换失败');
    }

    console.log(`     ✓ 端到端真实流程验证通过，路由到Provider: ${providerId}`);
  }

  testRealConfigFileValidation() {
    // 测试真实配置文件加载和验证
    const configFiles = [
      '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json',
      '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-mixed-providers.json'
    ];

    for (const configFile of configFiles) {
      if (!fs.existsSync(configFile)) {
        throw new Error(`配置文件不存在: ${configFile}`);
      }

      try {
        // 测试真实配置加载
        const config = loadUserConfig(configFile);
        
        // 验证真实配置结构
        if (!config.server || !config.providers || !config.routing) {
          throw new Error(`配置文件结构不完整: ${path.basename(configFile)}`);
        }

        // 验证真实providers配置
        const providerCount = Object.keys(config.providers).length;
        if (providerCount === 0) {
          throw new Error(`配置文件无有效providers: ${path.basename(configFile)}`);
        }

        // 验证真实路由配置
        const categories = config.routing.categories || config.routing;
        if (!categories.default) {
          throw new Error(`配置文件缺少default路由: ${path.basename(configFile)}`);
        }

        console.log(`     ✓ 配置文件真实验证通过: ${path.basename(configFile)} (${providerCount}个providers)`);

      } catch (error) {
        throw new Error(`配置文件验证失败 ${path.basename(configFile)}: ${error.message}`);
      }
    }
  }

  recordResult(testName, passed, error = null) {
    this.testResults.totalTests++;
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }

    this.testResults.results.push({
      name: testName,
      passed,
      error,
      timestamp: new Date().toISOString()
    });
  }

  printSummary() {
    console.log('\n📊 真实系统逻辑验证测试结果汇总:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 总测试数: ${this.testResults.totalTests}`);
    console.log(`✅ 通过: ${this.testResults.passed}`);
    console.log(`❌ 失败: ${this.testResults.failed}`);
    console.log(`🎯 成功率: ${((this.testResults.passed / this.testResults.totalTests) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (this.testResults.failed > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`   • ${result.name}: ${result.error}`);
        });
    } else {
      console.log('\n🎉 所有真实系统逻辑验证通过！');
      console.log('✅ 测试框架确实调用的是真实系统逻辑');
      console.log('✅ 没有发现模拟逻辑问题');
      console.log('✅ 系统解析逻辑工作正常');
    }

    console.log('\n🔍 验证项目:');
    console.log('  • ConfigMerger真实配置合并逻辑');
    console.log('  • RouterServer真实路由和初始化逻辑');
    console.log('  • PreprocessingPipeline真实预处理逻辑');
    console.log('  • LMStudio工具兼容性真实转换逻辑');
    console.log('  • 端到端真实API调用流');
    console.log('  • 配置文件真实加载和验证逻辑');
  }

  getResults() {
    return this.testResults;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new RealSystemLogicTest();
  tester.runAllTests();
}

export default RealSystemLogicTest;