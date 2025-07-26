#!/usr/bin/env node
/**
 * CodeWhisperer完整测试脚本
 * 基于shuaihong的配置构建对应的CodeWhisperer测试管道
 * 
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  server: {
    baseURL: 'http://127.0.0.1:3456',
    timeout: 30000
  },
  routing: {
    // 模拟与shuaihong相同的路由规则，但指向CodeWhisperer
    models: {
      'claude-3-5-haiku-20241022': {
        expectedProvider: 'codewhisperer-primary',
        expectedModel: 'CLAUDE_3_5_HAIKU_20241022_V1_0',
        category: 'background'
      },
      'claude-3-5-sonnet-20241022': {
        expectedProvider: 'codewhisperer-primary', 
        expectedModel: 'CLAUDE_SONNET_4_20250514_V1_0',
        category: 'default'
      },
      'claude-3-opus-20240229': {
        expectedProvider: 'codewhisperer-primary',
        expectedModel: 'CLAUDE_SONNET_4_20250514_V1_0',
        category: 'thinking'
      }
    }
  },
  codewhisperer: {
    endpoint: 'https://codewhisperer.us-east-1.amazonaws.com',
    profileArn: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/YOUR_PROFILE',
    tokenPath: '~/.aws/sso/cache/kiro-auth-token.json'
  }
};

// 测试用例
const TEST_CASES = [
  {
    name: 'simple-text-generation',
    description: '简单文本生成 - 对应shuaihong的基础测试',
    request: {
      model: 'claude-3-5-haiku-20241022',
      messages: [
        { role: 'user', content: 'Hello, please respond with "CodeWhisperer test successful"' }
      ],
      max_tokens: 50,
      stream: false
    },
    expectedCategory: 'background',
    expectedProvider: 'codewhisperer-primary'
  },
  {
    name: 'code-generation',
    description: '代码生成测试 - CodeWhisperer的专长',
    request: {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'user', content: 'Write a Python function to calculate fibonacci numbers' }
      ],
      max_tokens: 200,
      stream: false
    },
    expectedCategory: 'default',
    expectedProvider: 'codewhisperer-primary'
  },
  {
    name: 'streaming-response',
    description: '流式响应测试 - 验证SSE解析',
    request: {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'user', content: 'Count from 1 to 3, one number per line' }
      ],
      max_tokens: 100,
      stream: true
    },
    expectedCategory: 'default',
    expectedProvider: 'codewhisperer-primary'
  },
  {
    name: 'thinking-task',
    description: '复杂推理任务 - 对比shuaihong的thinking模式',
    request: {
      model: 'claude-3-opus-20240229',
      messages: [
        { role: 'user', content: 'Explain the differences between recursive and iterative approaches to solving problems, with code examples' }
      ],
      max_tokens: 300,
      stream: false
    },
    expectedCategory: 'thinking',
    expectedProvider: 'codewhisperer-primary'
  }
];

class CodeWhispererTester {
  constructor() {
    this.httpClient = axios.create({
      baseURL: TEST_CONFIG.server.baseURL,
      timeout: TEST_CONFIG.server.timeout,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key'
      }
    });
    
    this.testResults = [];
    this.debugData = {};
  }

  /**
   * 运行完整测试套件
   */
  async runFullTestSuite() {
    console.log('🧪 CodeWhisperer完整测试套件');
    console.log('=====================================');
    console.log(`🎯 基于shuaihong配置构建CodeWhisperer对应测试`);
    console.log(`🔗 测试服务器: ${TEST_CONFIG.server.baseURL}`);
    console.log('');

    // Step 1: 服务器健康检查
    console.log('📋 Step 1: 服务器健康检查');
    const healthStatus = await this.checkServerHealth();
    if (!healthStatus.success) {
      console.error('❌ 服务器健康检查失败，终止测试');
      return false;
    }
    console.log('✅ 服务器健康检查通过\n');

    // Step 2: 认证和token检查
    console.log('📋 Step 2: CodeWhisperer认证检查');
    const authStatus = await this.checkCodeWhispererAuth();
    console.log(`🔑 认证状态: ${authStatus.success ? '✅ 成功' : '❌ 失败'}`);
    if (authStatus.details) {
      console.log(`📝 详情: ${JSON.stringify(authStatus.details, null, 2)}`);
    }
    console.log('');

    // Step 3: 路由配置验证
    console.log('📋 Step 3: 路由配置验证');
    const routingStatus = await this.validateRoutingConfiguration();
    console.log(`🛣️  路由配置: ${routingStatus.success ? '✅ 正确' : '❌ 错误'}`);
    console.log('');

    // Step 4: 执行各个测试用例
    console.log('📋 Step 4: 执行测试用例');
    for (const testCase of TEST_CASES) {
      console.log(`\n🔍 执行测试: ${testCase.name}`);
      console.log(`📝 描述: ${testCase.description}`);
      
      const result = await this.executeTestCase(testCase);
      this.testResults.push(result);
      
      console.log(`📊 结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
      if (!result.success && result.error) {
        console.log(`❗ 错误: ${result.error}`);
      }
      
      // 保存调试数据
      if (result.debugData) {
        this.debugData[testCase.name] = result.debugData;
      }
    }

    // Step 5: 生成测试报告
    console.log('\n📋 Step 5: 生成测试报告');
    const report = this.generateTestReport();
    this.saveTestReport(report);
    
    console.log('\n📊 测试完成摘要:');
    console.log(`✅ 成功: ${report.summary.passed}/${report.summary.total}`);
    console.log(`❌ 失败: ${report.summary.failed}/${report.summary.total}`);
    console.log(`📈 成功率: ${report.summary.successRate}%`);
    
    return report.summary.successRate >= 75; // 75%成功率视为通过
  }

  /**
   * 检查服务器健康状态
   */
  async checkServerHealth() {
    try {
      const response = await this.httpClient.get('/health');
      return {
        success: response.status === 200,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检查CodeWhisperer认证状态
   */
  async checkCodeWhispererAuth() {
    try {
      // 检查token文件是否存在
      const tokenPath = path.expanduser(TEST_CONFIG.codewhisperer.tokenPath);
      const hasTokenFile = fs.existsSync(tokenPath);
      
      if (!hasTokenFile) {
        return {
          success: false,
          details: { error: 'Token文件不存在', path: tokenPath }
        };
      }

      // 读取token内容
      const tokenContent = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      const hasValidToken = !!(tokenContent.accessToken && tokenContent.refreshToken);
      
      return {
        success: hasValidToken,
        details: {
          hasTokenFile,
          hasAccessToken: !!tokenContent.accessToken,
          hasRefreshToken: !!tokenContent.refreshToken,
          tokenLength: tokenContent.accessToken ? tokenContent.accessToken.length : 0
        }
      };
    } catch (error) {
      return {
        success: false,
        details: { error: error.message }
      };
    }
  }

  /**
   * 验证路由配置
   */
  async validateRoutingConfiguration() {
    try {
      // 通过状态端点获取路由信息
      const response = await this.httpClient.get('/status');
      const providers = response.data.providers || [];
      
      // 检查是否有CodeWhisperer provider
      const hasCodeWhisperer = providers.some(p => 
        p.toLowerCase().includes('codewhisperer') || p.toLowerCase().includes('claude')
      );
      
      return {
        success: hasCodeWhisperer,
        providers,
        details: {
          totalProviders: providers.length,
          hasCodeWhisperer,
          providerList: providers
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 执行单个测试用例
   */
  async executeTestCase(testCase) {
    const startTime = Date.now();
    
    try {
      if (testCase.request.stream) {
        return await this.executeStreamingTest(testCase);
      } else {
        return await this.executeNonStreamingTest(testCase);
      }
    } catch (error) {
      return {
        name: testCase.name,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 执行非流式测试
   */
  async executeNonStreamingTest(testCase) {
    const startTime = Date.now();
    
    const response = await this.httpClient.post('/v1/messages', testCase.request);
    const duration = Date.now() - startTime;

    // 验证响应格式
    const validation = this.validateAnthropicResponse(response.data);
    
    return {
      name: testCase.name,
      success: validation.isValid && response.status === 200,
      duration,
      response: response.data,
      validation,
      debugData: {
        request: testCase.request,
        responseStatus: response.status,
        responseHeaders: response.headers,
        contentLength: JSON.stringify(response.data).length
      }
    };
  }

  /**
   * 执行流式测试
   */
  async executeStreamingTest(testCase) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const chunks = [];
      let hasError = false;
      let errorMessage = '';

      this.httpClient.post('/v1/messages', testCase.request, {
        responseType: 'stream'
      }).then(response => {
        response.data.on('data', (chunk) => {
          const chunkStr = chunk.toString();
          chunks.push(chunkStr);
        });

        response.data.on('end', () => {
          const duration = Date.now() - startTime;
          const fullResponse = chunks.join('');
          
          // 验证SSE格式
          const sseValidation = this.validateSSEResponse(fullResponse);
          
          resolve({
            name: testCase.name,
            success: !hasError && sseValidation.isValid,
            duration,
            streamData: {
              chunks: chunks.length,
              totalLength: fullResponse.length,
              sampleChunks: chunks.slice(0, 3) // 保存前3个chunk作为样本
            },
            validation: sseValidation,
            debugData: {
              request: testCase.request,
              chunkCount: chunks.length,
              fullResponse: fullResponse.substring(0, 500) // 保存前500字符
            }
          });
        });

        response.data.on('error', (error) => {
          hasError = true;
          errorMessage = error.message;
        });
      }).catch(error => {
        resolve({
          name: testCase.name,
          success: false,
          error: error.message,
          duration: Date.now() - startTime
        });
      });
    });
  }

  /**
   * 验证Anthropic响应格式
   */
  validateAnthropicResponse(response) {
    const validation = {
      isValid: true,
      errors: []
    };

    // 检查必需字段
    const requiredFields = ['id', 'type', 'role', 'content', 'model'];
    for (const field of requiredFields) {
      if (!response[field]) {
        validation.isValid = false;
        validation.errors.push(`Missing required field: ${field}`);
      }
    }

    // 检查content格式
    if (response.content && Array.isArray(response.content)) {
      const hasTextContent = response.content.some(c => c.type === 'text' && c.text);
      if (!hasTextContent) {
        validation.isValid = false;
        validation.errors.push('No valid text content found');
      }
    } else {
      validation.isValid = false;
      validation.errors.push('Content is not an array');
    }

    // 检查usage信息
    if (!response.usage || typeof response.usage.input_tokens !== 'number') {
      validation.isValid = false;
      validation.errors.push('Invalid usage information');
    }

    return validation;
  }

  /**
   * 验证SSE响应格式
   */
  validateSSEResponse(sseData) {
    const validation = {
      isValid: true,
      errors: [],
      events: []
    };

    const lines = sseData.split('\n');
    let currentEvent = null;

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.substring(6).trim();
        validation.events.push(currentEvent);
      } else if (line.startsWith('data:')) {
        if (!currentEvent) {
          validation.isValid = false;
          validation.errors.push('Data without event');
        }
      }
    }

    // 检查必需的事件
    const requiredEvents = ['message_start', 'content_block_start', 'message_stop'];
    for (const event of requiredEvents) {
      if (!validation.events.includes(event)) {
        validation.isValid = false;
        validation.errors.push(`Missing required event: ${event}`);
      }
    }

    return validation;
  }

  /**
   * 生成测试报告
   */
  generateTestReport() {
    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.length - passed;
    const total = this.testResults.length;
    const successRate = Math.round((passed / total) * 100);

    return {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed,
        failed,
        successRate
      },
      testResults: this.testResults,
      debugData: this.debugData,
      configuration: TEST_CONFIG,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };
  }

  /**
   * 保存测试报告
   */
  saveTestReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `codewhisperer-test-report-${timestamp}.json`;
    const filepath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`📄 测试报告已保存: ${filepath}`);
  }
}

// 主函数
async function main() {
  const tester = new CodeWhispererTester();
  
  try {
    const success = await tester.runFullTestSuite();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 测试套件执行失败:', error.message);
    process.exit(1);
  }
}

// 辅助函数：展开用户路径
path.expanduser = function(filePath) {
  if (filePath.startsWith('~/')) {
    return path.join(require('os').homedir(), filePath.slice(2));
  }
  return filePath;
};

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { CodeWhispererTester, TEST_CONFIG, TEST_CASES };