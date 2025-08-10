#!/usr/bin/env node

/**
 * OpenAI流水线单元测试 - 简化版
 * 通过实际HTTP调用测试六层架构下的OpenAI流水线
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// 测试数据路径
const TEST_DATA_PATHS = {
  openaiTestData: 'database/pipeline-data-unified/exports/json/openai-test-data.json',
  toolCallScenario: 'database/pipeline-data-unified/simulation-data/test-scenarios/tool-call-response.json',
  basicTextScenario: 'database/pipeline-data-unified/simulation-data/test-scenarios/basic-text-response.json'
};

class OpenAIPipelineE2ETest {
  constructor() {
    this.testResults = {
      basicRequest: {},
      toolCallRequest: {},
      responseTransformation: {}
    };
    this.serverPort = 5506; // LMStudio配置端口
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
   * 检查服务器健康状态
   */
  async checkServerHealth() {
    console.log('\n🔍 检查服务器状态...');
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: this.serverPort,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ 服务器健康检查通过');
            resolve(true);
          } else {
            console.log(`❌ 服务器状态异常: ${res.statusCode}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', (err) => {
        console.log(`❌ 服务器连接失败: ${err.message}`);
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        console.log('❌ 服务器健康检查超时');
        resolve(false);
      });
      
      req.end();
    });
  }

  /**
   * 发送API请求到路由器
   */
  async sendAPIRequest(requestData) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestData);
      
      const req = http.request({
        hostname: 'localhost',
        port: this.serverPort,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Bearer any-key-works'
        },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: response
            });
          } catch (err) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              rawData: data,
              parseError: err.message
            });
          }
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(postData);
      req.end();
    });
  }

  /**
   * 测试基本文本请求
   */
  async testBasicTextRequest() {
    console.log('\n🧪 测试基本文本请求流水线');
    
    if (!this.testData.openaiTestData) {
      console.log('❌ 缺少测试数据，跳过测试');
      return false;
    }

    try {
      const testCase = this.testData.openaiTestData.testData.transformer.baseRequestToOpenAI;
      const requestData = {
        model: testCase.input.model,
        messages: testCase.input.messages,
        max_tokens: testCase.input.max_tokens,
        temperature: testCase.input.temperature,
        system: testCase.input.system
      };

      console.log('📋 发送基本文本请求...');
      console.log('📥 请求模型:', requestData.model);
      console.log('📥 消息数量:', requestData.messages.length);

      const response = await this.sendAPIRequest(requestData);

      const checks = {
        statusOk: response.statusCode === 200,
        hasResponse: !!response.data,
        hasContent: response.data?.content && Array.isArray(response.data.content),
        hasRole: response.data?.role === 'assistant',
        hasId: !!response.data?.id,
        hasUsage: !!response.data?.usage,
        noParseError: !response.parseError
      };

      const passedChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      console.log('🔍 基本请求验证结果:');
      Object.entries(checks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      });

      if (response.data?.content?.[0]?.text) {
        console.log('📝 响应内容预览:', response.data.content[0].text.substring(0, 100) + '...');
      }

      const success = passedChecks === totalChecks;
      console.log(`📊 基本文本测试: ${passedChecks}/${totalChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);

      this.testResults.basicRequest = {
        success,
        passedChecks,
        totalChecks,
        details: checks,
        responsePreview: response.data?.content?.[0]?.text?.substring(0, 100)
      };

      return success;

    } catch (error) {
      console.error('❌ 基本文本测试失败:', error.message);
      this.testResults.basicRequest = {
        success: false,
        error: error.message
      };
      return false;
    }
  }

  /**
   * 测试工具调用请求
   */
  async testToolCallRequest() {
    console.log('\n🧪 测试工具调用请求流水线');
    
    if (!this.testData.toolCallScenario) {
      console.log('❌ 缺少工具调用测试数据，跳过测试');
      return false;
    }

    try {
      const scenario = this.testData.toolCallScenario;
      const requestData = {
        model: 'claude-3-5-haiku-20241022',
        messages: scenario.request.messages,
        tools: scenario.request.tools,
        max_tokens: scenario.request.max_tokens
      };

      console.log('📋 发送工具调用请求...');
      console.log('📥 请求模型:', requestData.model);
      console.log('📥 工具数量:', requestData.tools.length);

      const response = await this.sendAPIRequest(requestData);

      const checks = {
        statusOk: response.statusCode === 200,
        hasResponse: !!response.data,
        hasContent: response.data?.content && Array.isArray(response.data.content),
        hasRole: response.data?.role === 'assistant',
        correctStopReason: response.data?.stop_reason === 'tool_use' || response.data?.stop_reason === 'end_turn',
        hasId: !!response.data?.id,
        noParseError: !response.parseError
      };

      const passedChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      console.log('🔍 工具调用验证结果:');
      Object.entries(checks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      });

      console.log('📊 Stop Reason:', response.data?.stop_reason);
      console.log('📊 Content Blocks:', response.data?.content?.length || 0);

      const success = passedChecks === totalChecks;
      console.log(`📊 工具调用测试: ${passedChecks}/${totalChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);

      this.testResults.toolCallRequest = {
        success,
        passedChecks,
        totalChecks,
        details: checks,
        stopReason: response.data?.stop_reason,
        contentBlockCount: response.data?.content?.length || 0
      };

      return success;

    } catch (error) {
      console.error('❌ 工具调用测试失败:', error.message);
      this.testResults.toolCallRequest = {
        success: false,
        error: error.message
      };
      return false;
    }
  }

  /**
   * 测试响应转换质量
   */
  async testResponseTransformation() {
    console.log('\n🧪 测试响应转换质量');

    try {
      // 发送一个简单请求以测试转换
      const requestData = {
        model: 'claude-3-5-haiku-20241022',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Respond with exactly: "Test successful"' }
            ]
          }
        ],
        max_tokens: 50
      };

      console.log('📋 测试响应格式转换...');
      const response = await this.sendAPIRequest(requestData);

      const checks = {
        anthropicFormat: response.data?.content && Array.isArray(response.data.content),
        hasTextBlock: response.data?.content?.[0]?.type === 'text',
        hasTextContent: !!response.data?.content?.[0]?.text,
        hasRole: response.data?.role === 'assistant',
        hasStopReason: !!response.data?.stop_reason,
        hasId: !!response.data?.id,
        hasUsage: response.data?.usage && typeof response.data.usage.input_tokens === 'number'
      };

      const passedChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      console.log('🔍 响应格式验证结果:');
      Object.entries(checks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      });

      console.log('📊 响应格式:', {
        role: response.data?.role,
        stop_reason: response.data?.stop_reason,
        content_type: response.data?.content?.[0]?.type,
        usage_tokens: response.data?.usage?.input_tokens
      });

      const success = passedChecks === totalChecks;
      console.log(`📊 响应转换测试: ${passedChecks}/${totalChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);

      this.testResults.responseTransformation = {
        success,
        passedChecks,
        totalChecks,
        details: checks,
        responseFormat: {
          role: response.data?.role,
          stop_reason: response.data?.stop_reason,
          content_type: response.data?.content?.[0]?.type
        }
      };

      return success;

    } catch (error) {
      console.error('❌ 响应转换测试失败:', error.message);
      this.testResults.responseTransformation = {
        success: false,
        error: error.message
      };
      return false;
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 OpenAI流水线端到端测试开始');
    console.log('🏗️  基于六层架构: 客户端-路由器-后处理器-Transformer-Provider-预处理器-服务器');
    console.log(`🔗 测试端点: http://localhost:${this.serverPort}`);
    
    this.loadTestData();

    // 检查服务器状态
    const serverHealthy = await this.checkServerHealth();
    if (!serverHealthy) {
      console.log('❌ 服务器不健康，无法继续测试');
      return { serverHealth: false };
    }

    const results = {
      serverHealth: true,
      basicRequest: await this.testBasicTextRequest(),
      toolCallRequest: await this.testToolCallRequest(),
      responseTransformation: await this.testResponseTransformation()
    };

    this.generateReport(results);
    return results;
  }

  /**
   * 生成测试报告
   */
  generateReport(results) {
    console.log('\n📊 OpenAI流水线端到端测试报告');
    console.log('==========================================');
    
    const categories = ['basicRequest', 'toolCallRequest', 'responseTransformation'];
    const categoryNames = ['基本文本请求', '工具调用请求', '响应格式转换'];
    
    categories.forEach((category, index) => {
      const result = results[category];
      const status = result ? '✅ 通过' : '❌ 失败';
      console.log(`${categoryNames[index]}: ${status}`);
    });

    const passedTests = Object.entries(results)
      .filter(([key, value]) => key !== 'serverHealth' && value).length;
    const totalTests = categories.length;
    const successRate = Math.round((passedTests / totalTests) * 100);

    console.log(`\n🎯 总体通过率: ${passedTests}/${totalTests} (${successRate}%)`);
    
    if (successRate >= 80) {
      console.log('✅ OpenAI流水线端到端测试整体通过');
      console.log('🏗️  六层架构下的完整流水线运行正常');
    } else if (successRate >= 60) {
      console.log('⚠️  OpenAI流水线基本可用，但需要优化');
    } else {
      console.log('❌ OpenAI流水线存在严重问题，需要立即修复');
    }

    console.log('\n📋 详细结果摘要:');
    Object.entries(this.testResults).forEach(([category, result]) => {
      if (result.success) {
        console.log(`✅ ${category}: ${result.passedChecks}/${result.totalChecks} 检查通过`);
      } else if (result.error) {
        console.log(`❌ ${category}: ${result.error}`);
      }
    });

    console.log('\n🏁 端到端测试完成');
  }
}

// 运行测试
async function main() {
  const tester = new OpenAIPipelineE2ETest();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { OpenAIPipelineE2ETest };