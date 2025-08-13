/**
 * 测试更新后的V3配置文件
 * 验证新的六层架构配置能否正常工作
 * 
 * Project owner: Jason Zhang
 */

import { loadUserConfig } from '../../src/v3/config/config-merger.js';
import { RouterServer } from '../../dist/v3/server/router-server.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

class UpdatedV3ConfigTest {
  constructor() {
    this.v3ConfigDir = path.join(os.homedir(), '.route-claudecode/config/v3');
    this.testResults = {
      totalFiles: 0,
      passed: 0,
      failed: 0,
      results: []
    };
  }

  async runAllTests() {
    console.log('🧪 开始测试更新后的V3配置文件...\n');

    if (!fs.existsSync(this.v3ConfigDir)) {
      console.log('❌ V3配置目录不存在');
      return false;
    }

    // 扫描并测试所有配置文件
    await this.scanAndTestDirectory(this.v3ConfigDir);

    this.printSummary();
    return this.testResults.failed === 0;
  }

  async scanAndTestDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        await this.scanAndTestDirectory(itemPath);
      } else if (item.endsWith('.json') && item.includes('config') && !item.includes('backup')) {
        await this.testConfigFile(itemPath);
      }
    }
  }

  async testConfigFile(configPath) {
    this.testResults.totalFiles++;
    const relativePath = path.relative(this.v3ConfigDir, configPath);
    
    try {
      console.log(`🔧 测试配置文件: ${relativePath}`);
      
      // 测试1: 直接JSON解析
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      this.validateNewConfigStructure(rawConfig, relativePath);
      
      // 测试2: ConfigMerger加载
      const mergedConfig = loadUserConfig(configPath);
      this.validateMergedConfig(mergedConfig, relativePath);
      
      // 测试3: RouterServer初始化
      const server = new RouterServer(mergedConfig);
      this.validateServerInitialization(server, relativePath);
      
      this.testResults.passed++;
      this.testResults.results.push({
        file: relativePath,
        status: 'passed',
        tests: ['JSON解析', 'ConfigMerger', 'RouterServer']
      });
      
      console.log(`   ✅ ${relativePath} 测试通过`);
      
    } catch (error) {
      this.testResults.failed++;
      this.testResults.results.push({
        file: relativePath,
        status: 'failed',
        error: error.message
      });
      
      console.log(`   ❌ ${relativePath} 测试失败: ${error.message}`);
    }
  }

  validateNewConfigStructure(config, relativePath) {
    // 验证基本结构
    if (!config.server || !config.providers || !config.routing) {
      throw new Error('缺少必要的配置段: server, providers, routing');
    }

    // 验证服务器配置
    if (config.server.architecture !== 'v3.0-six-layer') {
      throw new Error(`架构版本错误: ${config.server.architecture}`);
    }

    // 验证版本信息
    if (config.version !== '3.0.0') {
      throw new Error(`配置版本错误: ${config.version}`);
    }

    // 验证providers配置是用户格式
    for (const [providerName, providerConfig] of Object.entries(config.providers)) {
      if (!providerConfig.endpoint) {
        throw new Error(`Provider ${providerName} 缺少endpoint`);
      }
      if (!providerConfig.models || !Array.isArray(providerConfig.models)) {
        throw new Error(`Provider ${providerName} 缺少models配置`);
      }
    }

    // 验证路由配置
    const requiredCategories = ['default', 'background', 'thinking', 'longcontext', 'search'];
    for (const category of requiredCategories) {
      if (!config.routing[category]) {
        throw new Error(`路由配置缺少 ${category} 类别`);
      }
      if (!config.routing[category].provider || !config.routing[category].model) {
        throw new Error(`路由配置 ${category} 缺少provider或model`);
      }
    }

    // 验证元数据
    if (!config.metadata || !config.metadata.updateInfo) {
      throw new Error('缺少更新元数据');
    }

    console.log(`   ✓ ${relativePath} 配置结构验证通过`);
  }

  validateMergedConfig(config, relativePath) {
    // 验证ConfigMerger生成的完整配置
    if (!config.preprocessing || !config.preprocessing.enabled) {
      throw new Error('ConfigMerger未启用预处理');
    }

    if (!config.architecture || !config.architecture.layers) {
      throw new Error('ConfigMerger未生成六层架构配置');
    }

    if (!config.routing.categories) {
      throw new Error('ConfigMerger未生成路由categories');
    }

    // 验证LMStudio自动检测
    const hasLMStudio = Object.values(config.providers).some(p => 
      p.endpoint?.includes('localhost:1234') || p.endpoint?.includes('127.0.0.1:1234')
    );

    if (hasLMStudio) {
      const lmStudioProcessor = config.preprocessing.processors['lmstudio-tool-compatibility'];
      if (!lmStudioProcessor || !lmStudioProcessor.enabled) {
        throw new Error('LMStudio provider存在但未启用工具兼容性预处理');
      }
    }

    console.log(`   ✓ ${relativePath} ConfigMerger验证通过`);
  }

  validateServerInitialization(server, relativePath) {
    // 验证RouterServer组件
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

    // 验证providers初始化
    if (server.providers.size === 0) {
      throw new Error('RouterServer未初始化任何providers');
    }

    // 验证路由配置
    if (!server.routingEngine.routingConfig) {
      throw new Error('RouterServer路由配置为空');
    }

    const routingCategories = Object.keys(server.routingEngine.routingConfig);
    if (routingCategories.length === 0) {
      throw new Error('RouterServer没有路由类别');
    }

    // 验证预处理管道
    const pipelineInfo = server.preprocessingPipeline.getInfo();
    if (pipelineInfo.totalProcessors === 0) {
      console.log(`   ⚠️  ${relativePath} 没有注册预处理器（可能是正常的）`);
    }

    console.log(`   ✓ ${relativePath} RouterServer验证通过 (${server.providers.size} providers, ${routingCategories.length} categories)`);
  }

  printSummary() {
    console.log('\n📊 更新后的V3配置文件测试结果汇总:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📁 总文件数: ${this.testResults.totalFiles}`);
    console.log(`✅ 测试通过: ${this.testResults.passed}`);
    console.log(`❌ 测试失败: ${this.testResults.failed}`);
    console.log(`🎯 成功率: ${((this.testResults.passed / this.testResults.totalFiles) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (this.testResults.passed > 0) {
      console.log('\n✅ 测试通过的文件:');
      this.testResults.results
        .filter(r => r.status === 'passed')
        .forEach(result => {
          console.log(`   • ${result.file} (${result.tests.join(', ')})`);
        });
    }

    if (this.testResults.failed > 0) {
      console.log('\n❌ 测试失败的文件:');
      this.testResults.results
        .filter(r => r.status === 'failed')
        .forEach(result => {
          console.log(`   • ${result.file}: ${result.error}`);
        });
    } else {
      console.log('\n🎉 所有V3配置文件测试通过！');
      console.log('✅ 新配置文件符合六层架构标准');
      console.log('✅ ConfigMerger能正确处理新配置');
      console.log('✅ RouterServer能正确初始化');
      console.log('✅ 预处理功能自动启用');
    }

    console.log('\n🔧 测试验证项目:');
    console.log('  • JSON配置结构完整性');
    console.log('  • 六层架构版本标识');
    console.log('  • 用户配置格式简化');
    console.log('  • ConfigMerger合并处理');
    console.log('  • RouterServer组件初始化');
    console.log('  • 预处理管道配置');
    console.log('  • LMStudio自动检测功能');
  }

  getResults() {
    return this.testResults;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new UpdatedV3ConfigTest();
  tester.runAllTests();
}

export default UpdatedV3ConfigTest;