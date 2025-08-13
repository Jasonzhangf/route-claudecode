/**
 * V3六层架构端到端测试
 * 验证新架构下的预处理、路由和工具调用功能
 * 
 * Project owner: Jason Zhang
 */

import { RouterServer } from '../../dist/v3/server/router-server.js';
import { loadUserConfig } from '../../src/v3/config/config-merger.js';
import fetch from 'node-fetch';

class V3ArchitectureE2ETest {
  constructor() {
    this.testResults = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      results: []
    };
    this.servers = [];
  }

  async runAllTests() {
    console.log('🧪 开始V3六层架构端到端测试...\n');

    const tests = [
      {
        name: '测试LMStudio配置加载和服务器启动',
        test: () => this.testLMStudioServerStart()
      },
      {
        name: '测试预处理管道初始化',
        test: () => this.testPreprocessingPipelineInit()
      },
      {
        name: '测试工具调用预处理',
        test: () => this.testToolCallPreprocessing()
      },
      {
        name: '测试六层架构流水线',
        test: () => this.testSixLayerPipeline()
      },
      {
        name: '测试健康检查API',
        test: () => this.testHealthCheckAPI()
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

    await this.cleanup();
    this.printSummary();
    return this.testResults.failed === 0;
  }

  async testLMStudioServerStart() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const config = loadUserConfig(userConfigPath);

    // 验证配置完整性
    if (!config.preprocessing || !config.preprocessing.enabled) {
      throw new Error('预处理配置未启用');
    }

    if (!config.layers || !config.architecture) {
      throw new Error('六层架构配置缺失');
    }

    // 测试服务器初始化
    const server = new RouterServer(config);
    this.servers.push(server);

    // 验证服务器组件初始化
    if (!server.preprocessingPipeline) {
      throw new Error('预处理管道未初始化');
    }

    console.log('     ✓ LMStudio服务器初始化成功');
  }

  async testPreprocessingPipelineInit() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const config = loadUserConfig(userConfigPath);
    const server = new RouterServer(config);
    this.servers.push(server);

    // 测试预处理管道信息
    const pipelineInfo = server.preprocessingPipeline.getInfo();
    
    if (pipelineInfo.totalProcessors === 0) {
      throw new Error('预处理管道没有注册任何处理器');
    }

    if (pipelineInfo.enabledProcessors === 0) {
      throw new Error('没有启用的预处理器');
    }

    // 验证LMStudio工具兼容性处理器已注册
    const lmStudioProcessor = pipelineInfo.processors.find(p => 
      p.name === 'lmstudio-tool-compatibility'
    );

    if (!lmStudioProcessor || !lmStudioProcessor.enabled) {
      throw new Error('LMStudio工具兼容性处理器未启用');
    }

    console.log(`     ✓ 预处理管道初始化正确，共 ${pipelineInfo.totalProcessors} 个处理器`);
  }

  async testToolCallPreprocessing() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const config = loadUserConfig(userConfigPath);
    const server = new RouterServer(config);
    this.servers.push(server);

    // 测试Anthropic格式工具调用预处理
    const anthropicRequest = {
      model: 'qwen3-30b',
      messages: [
        { role: 'user', content: 'Test message' }
      ],
      tools: [
        {
          name: 'get_weather',
          description: 'Get weather information',
          input_schema: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            },
            required: ['location']
          }
        }
      ]
    };

    const processedRequest = server.preprocessingPipeline.preprocessRequest(
      anthropicRequest,
      'lmstudio',
      { requestId: 'test-123' }
    );

    // 验证工具格式转换
    if (!processedRequest.tools || processedRequest.tools.length === 0) {
      throw new Error('工具调用预处理失败，工具丢失');
    }

    const processedTool = processedRequest.tools[0];
    if (processedTool.type !== 'function') {
      throw new Error(`工具类型应该是function，实际: ${processedTool.type}`);
    }

    if (!processedTool.function || !processedTool.function.name) {
      throw new Error('工具function结构不正确');
    }

    if (processedTool.function.name !== 'get_weather') {
      throw new Error(`工具名称错误: ${processedTool.function.name}`);
    }

    console.log('     ✓ Anthropic格式工具调用预处理正确');
  }

  async testSixLayerPipeline() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const config = loadUserConfig(userConfigPath);

    // 验证六层架构流配置
    const expectedLayers = ['client', 'router', 'postProcessor', 'transformer', 'providerProtocol', 'preprocessor'];
    if (!config.architecture.flow || config.architecture.flow.length !== 6) {
      throw new Error(`六层架构流配置错误，期望6层，实际: ${config.architecture.flow?.length || 0}`);
    }

    for (let i = 0; i < expectedLayers.length; i++) {
      if (config.architecture.flow[i] !== expectedLayers[i]) {
        throw new Error(`架构流第${i+1}层错误: ${config.architecture.flow[i]}, 期望: ${expectedLayers[i]}`);
      }
    }

    // 验证每个层都有对应的配置
    for (const layer of expectedLayers) {
      if (!config.layers[layer]) {
        throw new Error(`架构层 ${layer} 配置缺失`);
      }
    }

    console.log('     ✓ 六层架构流水线配置正确');
  }

  async testHealthCheckAPI() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const config = loadUserConfig(userConfigPath);
    
    // 启动服务器
    const server = new RouterServer(config);
    this.servers.push(server);
    
    try {
      await server.start();
      
      // 等待服务器启动
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 测试健康检查
      const response = await fetch(`http://localhost:${config.server.port}/health`);
      if (!response.ok) {
        throw new Error(`健康检查失败: ${response.status}`);
      }

      const data = await response.json();
      if (data.status !== 'ok') {
        throw new Error(`健康检查状态错误: ${data.status}`);
      }

      console.log('     ✓ 健康检查API正常');
      
    } finally {
      await server.stop();
    }
  }

  async cleanup() {
    console.log('\n🧹 清理测试资源...');
    
    for (const server of this.servers) {
      try {
        if (server && typeof server.stop === 'function') {
          await server.stop();
        }
      } catch (error) {
        console.warn(`清理服务器失败: ${error.message}`);
      }
    }
    
    this.servers = [];
    console.log('✅ 清理完成');
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
    console.log('\n📊 V3六层架构端到端测试结果汇总:');
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
    }

    console.log('\n🎉 V3六层架构端到端测试完成！');
  }

  getResults() {
    return this.testResults;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new V3ArchitectureE2ETest();
  tester.runAllTests();
}

export default V3ArchitectureE2ETest;