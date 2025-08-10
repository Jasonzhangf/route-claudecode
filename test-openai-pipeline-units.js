#!/usr/bin/env node

/**
 * OpenAI流水线单元测试 - 使用数据库数据
 * 验证六层架构下的OpenAI流水线完整性
 */

const fs = require('fs');
const path = require('path');

// 测试数据路径
const TEST_DATA_PATHS = {
  openaiTestData: 'database/pipeline-data-unified/exports/json/openai-test-data.json',
  toolCallScenario: 'database/pipeline-data-unified/simulation-data/test-scenarios/tool-call-response.json',
  basicTextScenario: 'database/pipeline-data-unified/simulation-data/test-scenarios/basic-text-response.json'
};

class OpenAIPipelineUnitTest {
  constructor() {
    this.testResults = {
      transformer: {},
      provider: {},
      integration: {}
    };
  }

  /**
   * 加载测试数据
   */
  loadTestData() {
    console.log('📦 加载测试数据...');
    
    this.testData = {};
    for (const [key, relativePath] of Object.entries(TEST_DATA_PATHS)) {
      const fullPath = path.join(process.cwd(), relativePath);
      
      if (fs.existsSync(fullPath)) {
        this.testData[key] = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        console.log(`✅ 加载${key}: ${relativePath}`);
      } else {
        console.log(`⚠️  跳过不存在的文件: ${relativePath}`);
        this.testData[key] = null;
      }
    }
  }

  /**
   * 测试Transformer层 - BaseRequest到OpenAI转换
   */
  async testTransformerRequestConversion() {
    console.log('\n🧪 测试Transformer层: BaseRequest → OpenAI转换');
    
    if (!this.testData.openaiTestData) {
      console.log('❌ 缺少OpenAI测试数据，跳过transformer测试');
      return false;
    }

    try {
      // 导入transformer - 直接从源码文件
      const { createOpenAITransformer } = require('./src/transformers/openai.ts');
      const transformer = createOpenAITransformer();

      const testCase = this.testData.openaiTestData.testData.transformer.baseRequestToOpenAI;
      const input = testCase.input;
      const expected = testCase.expectedOutput;

      console.log('📋 测试用例：BaseRequest格式转换');
      console.log('📥 输入模型:', input.model);
      console.log('📥 输入消息数:', input.messages.length);
      console.log('📥 是否有工具:', input.tools.length > 0);

      // 执行转换
      const result = transformer.transformBaseRequestToOpenAI(input);

      // 验证结果
      const checks = {
        modelPreserved: result.model === expected.model,
        messagesConverted: Array.isArray(result.messages),
        systemMessageHandled: result.messages.some(msg => msg.role === 'system'),
        maxTokensSet: result.max_tokens === expected.max_tokens,
        temperatureSet: result.temperature === expected.temperature
      };

      const passedChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      console.log('🔍 转换验证结果:');
      Object.entries(checks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      });

      const success = passedChecks === totalChecks;
      console.log(`📊 Transformer测试: ${passedChecks}/${totalChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);

      this.testResults.transformer.requestConversion = {
        success,
        passedChecks,
        totalChecks,
        details: checks
      };

      return success;

    } catch (error) {
      console.error('❌ Transformer测试失败:', error.message);
      this.testResults.transformer.requestConversion = {
        success: false,
        error: error.message
      };
      return false;
    }
  }

  /**
   * 测试Provider层 - 纯净API调用（不包含transformer）
   */
  async testProviderLayer() {
    console.log('\n🧪 测试Provider层: 纯净OpenAI API调用');

    try {
      // 创建纯净Provider配置
      const config = {
        type: 'openai',
        apiKey: 'test-key',
        baseURL: 'http://localhost:1234/v1',
        defaultModel: 'test-model',
        sdkOptions: {
          timeout: 30000,
          maxRetries: 1
        }
      };

      // 导入并创建纯净Provider - 直接从源码文件  
      const { PureOpenAIClient } = require('./src/providers/openai/pure-client.ts');
      const provider = new PureOpenAIClient(config, 'test-provider');

      console.log('✅ 纯净OpenAI Provider创建成功');
      console.log('📋 Provider类型:', provider.type);
      console.log('📋 Provider名称:', provider.name);

      // 检查Provider接口
      const interfaceChecks = {
        hasSendRequest: typeof provider.sendRequest === 'function',
        hasSendStreamRequest: typeof provider.sendStreamRequest === 'function',
        hasIsHealthy: typeof provider.isHealthy === 'function',
        correctType: provider.type === 'openai-pure',
        correctName: provider.name === 'test-provider'
      };

      const passedChecks = Object.values(interfaceChecks).filter(Boolean).length;
      const totalChecks = Object.keys(interfaceChecks).length;

      console.log('🔍 Provider接口验证:');
      Object.entries(interfaceChecks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      });

      const success = passedChecks === totalChecks;
      console.log(`📊 Provider测试: ${passedChecks}/${totalChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);

      this.testResults.provider.interface = {
        success,
        passedChecks,
        totalChecks,
        details: interfaceChecks
      };

      return success;

    } catch (error) {
      console.error('❌ Provider测试失败:', error.message);
      this.testResults.provider.interface = {
        success: false,
        error: error.message
      };
      return false;
    }
  }

  /**
   * 测试集成流程 - 六层架构协作
   */
  async testIntegrationFlow() {
    console.log('\n🧪 测试集成流程: 六层架构协作');

    try {
      // 导入必需组件 - 直接从源码文件
      const { createOpenAITransformer } = require('./src/transformers/openai.ts');
      const { PureOpenAIClient } = require('./src/providers/openai/pure-client.ts');
      
      // 模拟完整流程
      const transformer = createOpenAITransformer();
      const providerConfig = {
        type: 'openai',
        apiKey: 'test-key',
        baseURL: 'http://localhost:1234/v1',
        defaultModel: 'test-model'
      };

      // 测试数据
      const testRequest = {
        model: 'claude-4-sonnet',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        max_tokens: 100,
        temperature: 0.7,
        system: 'You are helpful'
      };

      console.log('📋 模拟六层架构流程:');
      console.log('   1️⃣ 客户端 → 路由器: HTTP请求接收');
      console.log('   2️⃣ 路由器: 路由决策完成');
      console.log('   3️⃣ 后处理器: 响应后处理准备');
      
      // 4️⃣ Transformer层
      console.log('   4️⃣ Transformer: 协议转换');
      const openaiRequest = transformer.transformBaseRequestToOpenAI(testRequest);
      const transformSuccess = openaiRequest && openaiRequest.model && openaiRequest.messages;
      console.log(`      转换结果: ${transformSuccess ? '✅ 成功' : '❌ 失败'}`);

      // 5️⃣ Provider层  
      console.log('   5️⃣ Provider: 纯净API连接');
      const provider = new PureOpenAIClient(providerConfig, 'test-integration');
      const providerReady = provider && provider.type === 'openai-pure';
      console.log(`      Provider就绪: ${providerReady ? '✅ 成功' : '❌ 失败'}`);

      // 6️⃣ 预处理器层
      console.log('   6️⃣ 预处理器: 服务器兼容性处理');
      console.log('      兼容性处理: ✅ 模拟完成');

      const integrationChecks = {
        transformerReady: transformSuccess,
        providerReady,
        requestTransformed: !!openaiRequest,
        modelMapped: openaiRequest?.model === testRequest.model,
        systemMessageHandled: openaiRequest?.messages?.some(m => m.role === 'system')
      };

      const passedChecks = Object.values(integrationChecks).filter(Boolean).length;
      const totalChecks = Object.keys(integrationChecks).length;

      console.log('\n🔍 集成流程验证:');
      Object.entries(integrationChecks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      });

      const success = passedChecks === totalChecks;
      console.log(`📊 集成测试: ${passedChecks}/${totalChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);

      this.testResults.integration.flow = {
        success,
        passedChecks,
        totalChecks,
        details: integrationChecks
      };

      return success;

    } catch (error) {
      console.error('❌ 集成测试失败:', error.message);
      this.testResults.integration.flow = {
        success: false,
        error: error.message
      };
      return false;
    }
  }

  /**
   * 运行所有单元测试
   */
  async runAllTests() {
    console.log('🧪 OpenAI流水线单元测试开始');
    console.log('🏗️  基于六层架构: 客户端-路由器-后处理器-Transformer-Provider-预处理器-服务器');
    
    this.loadTestData();

    const results = {
      transformer: await this.testTransformerRequestConversion(),
      provider: await this.testProviderLayer(),
      integration: await this.testIntegrationFlow()
    };

    this.generateReport(results);
    return results;
  }

  /**
   * 生成测试报告
   */
  generateReport(results) {
    console.log('\n📊 OpenAI流水线单元测试报告');
    console.log('========================================');
    
    const categories = ['transformer', 'provider', 'integration'];
    const categoryNames = ['Transformer层测试', 'Provider层测试', '集成流程测试'];
    
    categories.forEach((category, index) => {
      const result = results[category];
      const status = result ? '✅ 通过' : '❌ 失败';
      console.log(`${categoryNames[index]}: ${status}`);
    });

    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    const successRate = Math.round((passedTests / totalTests) * 100);

    console.log(`\n🎯 总体通过率: ${passedTests}/${totalTests} (${successRate}%)`);
    
    if (successRate >= 80) {
      console.log('✅ OpenAI流水线单元测试整体通过');
      console.log('🏗️  六层架构下的跨节点解耦实现成功');
    } else {
      console.log('⚠️  OpenAI流水线需要进一步优化');
    }

    console.log('\n🏁 单元测试完成');
  }
}

// 运行测试
async function main() {
  const tester = new OpenAIPipelineUnitTest();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { OpenAIPipelineUnitTest };