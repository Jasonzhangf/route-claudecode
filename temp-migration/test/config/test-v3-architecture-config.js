/**
 * V3六层架构配置测试
 * 验证新架构配置合并和预处理集成
 * 
 * Project owner: Jason Zhang
 */

import { ConfigMerger, loadUserConfig } from '../../src/v3/config/config-merger.js';
import fs from 'fs';
import path from 'path';

class V3ArchitectureConfigTest {
  constructor() {
    this.testResults = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      results: []
    };
  }

  async runAllTests() {
    console.log('🧪 开始V3六层架构配置测试...\n');

    const tests = [
      {
        name: '测试LMStudio配置合并',
        test: () => this.testLMStudioConfigMerge()
      },
      {
        name: '测试混合Provider配置合并',
        test: () => this.testMixedProviderConfigMerge()
      },
      {
        name: '测试六层架构配置生成',
        test: () => this.testArchitectureLayersConfig()
      },
      {
        name: '测试预处理配置集成',
        test: () => this.testPreprocessingConfig()
      },
      {
        name: '测试LMStudio自动检测和预处理启用',
        test: () => this.testLMStudioAutoDetection()
      },
      {
        name: '测试配置验证',
        test: () => this.testConfigValidation()
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

  testLMStudioConfigMerge() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const mergedConfig = loadUserConfig(userConfigPath);

    // 验证基本结构
    if (!mergedConfig.server || !mergedConfig.providers || !mergedConfig.routing) {
      throw new Error('基本配置结构缺失');
    }

    // 验证LMStudio provider配置
    if (!mergedConfig.providers.lmstudio) {
      throw new Error('LMStudio provider配置缺失');
    }

    const lmStudioConfig = mergedConfig.providers.lmstudio;
    if (lmStudioConfig.type !== 'openai') {
      throw new Error(`LMStudio provider类型错误: ${lmStudioConfig.type}, 期望: openai`);
    }

    // 验证路由配置结构
    if (!mergedConfig.routing.categories) {
      throw new Error('路由配置应该包含categories结构');
    }

    console.log('     ✓ LMStudio配置合并正确');
  }

  testMixedProviderConfigMerge() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-mixed-providers.json';
    const mergedConfig = loadUserConfig(userConfigPath);

    // 验证多Provider配置
    const expectedProviders = ['lmstudio', 'shuaihong', 'modelscope', 'google'];
    for (const providerName of expectedProviders) {
      if (!mergedConfig.providers[providerName]) {
        throw new Error(`Provider ${providerName} 配置缺失`);
      }
    }

    // 验证每个provider都有正确的type
    const providerTypes = {
      'lmstudio': 'openai',
      'shuaihong': 'openai', 
      'modelscope': 'openai',
      'google': 'gemini'
    };

    for (const [providerName, expectedType] of Object.entries(providerTypes)) {
      const actualType = mergedConfig.providers[providerName].type;
      if (actualType !== expectedType) {
        throw new Error(`Provider ${providerName} 类型错误: ${actualType}, 期望: ${expectedType}`);
      }
    }

    console.log('     ✓ 混合Provider配置合并正确');
  }

  testArchitectureLayersConfig() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const mergedConfig = loadUserConfig(userConfigPath);

    // 验证六层架构配置
    if (!mergedConfig.layers) {
      throw new Error('六层架构配置缺失');
    }

    const expectedLayers = ['client', 'router', 'postProcessor', 'transformer', 'providerProtocol', 'preprocessor'];
    for (const layer of expectedLayers) {
      if (!mergedConfig.layers[layer]) {
        throw new Error(`架构层 ${layer} 配置缺失`);
      }
    }

    // 验证架构流配置
    if (!mergedConfig.architecture || !mergedConfig.architecture.flow) {
      throw new Error('架构流配置缺失');
    }

    const flow = mergedConfig.architecture.flow;
    if (!Array.isArray(flow) || flow.length !== 6) {
      throw new Error(`架构流应该包含6个层次，实际: ${flow.length}`);
    }

    // 验证架构版本
    if (mergedConfig.server.architecture !== 'v3.0-six-layer') {
      throw new Error(`架构版本错误: ${mergedConfig.server.architecture}`);
    }

    console.log('     ✓ 六层架构配置正确');
  }

  testPreprocessingConfig() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const mergedConfig = loadUserConfig(userConfigPath);

    // 验证预处理配置
    if (!mergedConfig.preprocessing) {
      throw new Error('预处理配置缺失');
    }

    if (!mergedConfig.preprocessing.enabled) {
      throw new Error('预处理应该启用');
    }

    // 验证LMStudio工具兼容性处理器配置
    const lmStudioProcessor = mergedConfig.preprocessing.processors['lmstudio-tool-compatibility'];
    if (!lmStudioProcessor) {
      throw new Error('LMStudio工具兼容性处理器配置缺失');
    }

    if (!lmStudioProcessor.enabled) {
      throw new Error('LMStudio工具兼容性处理器应该启用');
    }

    if (!Array.isArray(lmStudioProcessor.applyTo) || !lmStudioProcessor.applyTo.includes('lmstudio')) {
      throw new Error('LMStudio工具兼容性处理器应该适用于lmstudio');
    }

    console.log('     ✓ 预处理配置正确');
  }

  testLMStudioAutoDetection() {
    // 测试自动检测LMStudio并启用工具兼容性
    const merger = new ConfigMerger();
    
    const userConfig = {
      server: { port: 5506, host: "127.0.0.1" },
      providers: {
        "my-lmstudio": {
          endpoint: "http://localhost:1234/v1/chat/completions",
          models: ["test-model"]
        }
      },
      routing: {
        default: { provider: "my-lmstudio", model: "test-model" }
      }
    };

    const mergedConfig = merger.mergeConfigs(userConfig);

    // 验证自动检测和启用
    const processor = mergedConfig.preprocessing.processors['lmstudio-tool-compatibility'];
    if (!processor.enabled) {
      throw new Error('应该自动为LMStudio启用工具兼容性预处理');
    }

    console.log('     ✓ LMStudio自动检测功能正确');
  }

  testConfigValidation() {
    const userConfigPath = '/Users/fanzhang/Documents/github/route-claudecode/config/user/user-config-lmstudio.json';
    const merger = new ConfigMerger();
    const mergedConfig = merger.loadAndMerge(userConfigPath);

    // 验证合并后的配置通过验证
    const isValid = merger.validateMergedConfig(mergedConfig);
    if (!isValid) {
      throw new Error('合并后的配置验证失败');
    }

    console.log('     ✓ 配置验证通过');
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
    console.log('\n📊 V3六层架构配置测试结果汇总:');
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

    console.log('\n🎉 V3六层架构配置测试完成！');
  }

  getResults() {
    return this.testResults;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new V3ArchitectureConfigTest();
  tester.runAllTests();
}

export default V3ArchitectureConfigTest;