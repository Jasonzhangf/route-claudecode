#!/usr/bin/env node
/**
 * CodeWhisperer认证和API连接测试
 * 验证token、认证流程和API可达性
 * 
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 认证测试配置
const AUTH_TEST_CONFIG = {
  tokenPath: path.join(require('os').homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json'),
  codewhispererEndpoint: 'https://codewhisperer.us-east-1.amazonaws.com',
  profileArn: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/test-profile',
  localServerEndpoint: 'http://127.0.0.1:3456',
  
  // 测试请求模板
  testRequest: {
    model: 'CLAUDE_SONNET_4_20250514_V1_0',
    messages: [
      { role: 'user', content: 'Hello, this is a CodeWhisperer authentication test' }
    ],
    max_tokens: 131072
  }
};

class CodeWhispererAuthTester {
  constructor() {
    this.testResults = [];
    this.authData = {};
  }

  /**
   * 运行完整认证测试
   */
  async runAuthTests() {
    console.log('🔐 CodeWhisperer认证测试套件');
    console.log('=====================================');
    console.log('');

    // Step 1: 检查token文件
    console.log('📋 Step 1: 检查token文件');
    const tokenCheck = await this.checkTokenFile();
    this.logTestResult('token-file-check', tokenCheck);
    console.log('');

    // Step 2: 验证token内容
    console.log('📋 Step 2: 验证token内容');
    const tokenValidation = await this.validateTokenContent();
    this.logTestResult('token-content-validation', tokenValidation);
    console.log('');

    // Step 3: 测试本地服务器认证
    console.log('📋 Step 3: 测试本地服务器认证集成');
    const serverAuthTest = await this.testServerAuth();
    this.logTestResult('server-auth-integration', serverAuthTest);
    console.log('');

    // Step 4: 测试CodeWhisperer直接连接（如果可能）
    console.log('📋 Step 4: 测试CodeWhisperer直接连接');
    const directConnectionTest = await this.testDirectConnection();
    this.logTestResult('direct-connection-test', directConnectionTest);
    console.log('');

    // Step 5: 生成认证测试报告
    console.log('📋 Step 5: 生成认证测试报告');
    const report = this.generateAuthReport();
    this.saveAuthReport(report);

    console.log(`\n📊 认证测试摘要:`);
    console.log(`✅ 通过: ${report.summary.passed}/${report.summary.total}`);
    console.log(`❌ 失败: ${report.summary.failed}/${report.summary.total}`);
    console.log(`📈 成功率: ${report.summary.successRate}%`);

    return report.summary.successRate >= 75;
  }

  /**
   * 检查token文件是否存在
   */
  async checkTokenFile() {
    try {
      console.log(`🔍 检查token文件: ${AUTH_TEST_CONFIG.tokenPath}`);
      
      const exists = fs.existsSync(AUTH_TEST_CONFIG.tokenPath);
      if (!exists) {
        return {
          success: false,
          message: 'Token文件不存在',
          details: { path: AUTH_TEST_CONFIG.tokenPath }
        };
      }

      const stats = fs.statSync(AUTH_TEST_CONFIG.tokenPath);
      const isRecent = (Date.now() - stats.mtime.getTime()) < (24 * 60 * 60 * 1000); // 24小时内

      console.log(`📄 文件存在: ✅`);
      console.log(`📅 修改时间: ${stats.mtime.toISOString()}`);
      console.log(`⏰ 是否最近更新: ${isRecent ? '✅' : '❌'}`);

      return {
        success: true,
        message: 'Token文件检查通过',
        details: {
          path: AUTH_TEST_CONFIG.tokenPath,
          exists: true,
          mtime: stats.mtime.toISOString(),
          isRecent,
          size: stats.size
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Token文件检查失败: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * 验证token内容
   */
  async validateTokenContent() {
    try {
      if (!fs.existsSync(AUTH_TEST_CONFIG.tokenPath)) {
        return {
          success: false,
          message: 'Token文件不存在，无法验证内容'
        };
      }

      const tokenContent = JSON.parse(fs.readFileSync(AUTH_TEST_CONFIG.tokenPath, 'utf8'));
      this.authData = tokenContent; // 保存用于后续测试

      const hasAccessToken = !!(tokenContent.accessToken && tokenContent.accessToken.length > 0);
      const hasRefreshToken = !!(tokenContent.refreshToken && tokenContent.refreshToken.length > 0);
      const hasValidStructure = hasAccessToken && hasRefreshToken;

      console.log(`🔑 访问令牌: ${hasAccessToken ? '✅' : '❌'}`);
      console.log(`🔄 刷新令牌: ${hasRefreshToken ? '✅' : '❌'}`);
      console.log(`📝 令牌长度: access=${tokenContent.accessToken?.length || 0}, refresh=${tokenContent.refreshToken?.length || 0}`);

      // 简单验证token格式
      const accessTokenValid = tokenContent.accessToken && 
                              tokenContent.accessToken.startsWith('aoa') && 
                              tokenContent.accessToken.includes(':');
      const refreshTokenValid = tokenContent.refreshToken && 
                               tokenContent.refreshToken.startsWith('aor') && 
                               tokenContent.refreshToken.includes(':');

      console.log(`🔍 访问令牌格式: ${accessTokenValid ? '✅' : '❌'}`);
      console.log(`🔍 刷新令牌格式: ${refreshTokenValid ? '✅' : '❌'}`);

      return {
        success: hasValidStructure && accessTokenValid && refreshTokenValid,
        message: 'Token内容验证完成',
        details: {
          hasAccessToken,
          hasRefreshToken,
          accessTokenLength: tokenContent.accessToken?.length || 0,
          refreshTokenLength: tokenContent.refreshToken?.length || 0,
          accessTokenValid,
          refreshTokenValid
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Token内容验证失败: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * 测试本地服务器认证集成
   */
  async testServerAuth() {
    try {
      console.log('🌐 测试本地服务器认证集成');
      
      const client = axios.create({
        baseURL: AUTH_TEST_CONFIG.localServerEndpoint,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key'
        }
      });

      // 测试简单请求看是否能通过认证
      const response = await client.post('/v1/messages', {
        ...AUTH_TEST_CONFIG.testRequest,
        stream: false
      });

      const isSuccess = response.status === 200 && response.data.content;
      console.log(`📡 请求状态: ${response.status}`);
      console.log(`📝 响应内容: ${isSuccess ? '✅ 有效' : '❌ 无效'}`);
      console.log(`🎯 模型: ${response.data.model || 'N/A'}`);

      return {
        success: isSuccess,
        message: '本地服务器认证测试完成',
        details: {
          status: response.status,
          model: response.data.model,
          hasContent: !!(response.data.content && response.data.content.length > 0),
          responseId: response.data.id,
          usage: response.data.usage
        }
      };
    } catch (error) {
      console.log(`❌ 本地服务器认证失败: ${error.message}`);
      
      return {
        success: false,
        message: `本地服务器认证失败: ${error.message}`,
        details: {
          errorType: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data
        }
      };
    }
  }

  /**
   * 测试CodeWhisperer直接连接
   */
  async testDirectConnection() {
    try {
      console.log('🔗 测试CodeWhisperer直接连接');
      
      if (!this.authData.accessToken) {
        return {
          success: false,
          message: 'No access token available for direct connection test'
        };
      }

      // 注意：直接连接CodeWhisperer需要正确的请求格式和认证
      // 这里只做连接性测试，不一定能成功调用
      const client = axios.create({
        baseURL: AUTH_TEST_CONFIG.codewhispererEndpoint,
        timeout: 15000,
        headers: {
          'Authorization': `Bearer ${this.authData.accessToken}`,
          'Content-Type': 'application/json',
          'x-amzn-codewhisperer-profile-arn': AUTH_TEST_CONFIG.profileArn
        }
      });

      try {
        // 尝试健康检查或简单的API调用
        const response = await client.get('/health');
        
        console.log(`🏥 健康检查状态: ${response.status}`);
        
        return {
          success: response.status === 200,
          message: 'CodeWhisperer直接连接测试完成',
          details: {
            status: response.status,
            endpoint: AUTH_TEST_CONFIG.codewhispererEndpoint,
            healthCheck: 'success'
          }
        };
      } catch (healthError) {
        // 如果健康检查失败，尝试实际API调用
        console.log('⚠️  健康检查不可用，尝试API调用测试');
        
        // 构建CodeWhisperer格式的请求
        const cwRequest = {
          conversationState: {
            currentMessage: {
              userInputMessage: {
                content: AUTH_TEST_CONFIG.testRequest.messages[0].content,
                userInputMessageContext: {
                  codeBlockLanguage: null,
                  editorState: {
                    cursorState: [{
                      range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 0 }
                      }
                    }],
                    filename: "test.txt"
                  }
                }
              }
            }
          }
        };

        const apiResponse = await client.post('/generateAssistantResponse', cwRequest);
        
        console.log(`🔧 API调用状态: ${apiResponse.status}`);
        
        return {
          success: apiResponse.status === 200,
          message: 'CodeWhisperer API调用测试完成',
          details: {
            status: apiResponse.status,
            endpoint: AUTH_TEST_CONFIG.codewhispererEndpoint,
            apiCall: 'success',
            responseSize: JSON.stringify(apiResponse.data).length
          }
        };
      }
    } catch (error) {
      console.log(`❌ CodeWhisperer直接连接失败: ${error.message}`);
      
      // 区分不同类型的错误
      let errorType = 'unknown';
      if (error.code === 'ENOTFOUND') {
        errorType = 'network';
      } else if (error.response?.status === 401) {
        errorType = 'authentication';
      } else if (error.response?.status === 403) {
        errorType = 'authorization';
      } else if (error.response?.status >= 500) {
        errorType = 'server';
      }

      return {
        success: false,
        message: `CodeWhisperer直接连接失败: ${error.message}`,
        details: {
          errorType,
          status: error.response?.status,
          statusText: error.response?.statusText,
          endpoint: AUTH_TEST_CONFIG.codewhispererEndpoint,
          hasToken: !!this.authData.accessToken,
          tokenLength: this.authData.accessToken?.length || 0
        }
      };
    }
  }

  /**
   * 记录测试结果
   */
  logTestResult(testName, result) {
    this.testResults.push({
      name: testName,
      timestamp: new Date().toISOString(),
      ...result
    });

    console.log(`📊 ${testName}: ${result.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`📝 ${result.message}`);
    
    if (result.details) {
      console.log('🔍 详细信息:', JSON.stringify(result.details, null, 2));
    }
    
    if (result.error) {
      console.log(`❗ 错误: ${result.error}`);
    }
  }

  /**
   * 生成认证测试报告
   */
  generateAuthReport() {
    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.length - passed;
    const total = this.testResults.length;
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    return {
      timestamp: new Date().toISOString(),
      testType: 'CodeWhisperer认证测试',
      summary: {
        total,
        passed,
        failed,
        successRate
      },
      authResults: this.testResults,
      configuration: AUTH_TEST_CONFIG,
      recommendations: this.generateAuthRecommendations(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        tokenPath: AUTH_TEST_CONFIG.tokenPath,
        hasTokenFile: fs.existsSync(AUTH_TEST_CONFIG.tokenPath)
      }
    };
  }

  /**
   * 生成认证改进建议
   */
  generateAuthRecommendations() {
    const recommendations = [];
    
    const tokenFileTest = this.testResults.find(r => r.name === 'token-file-check');
    if (tokenFileTest && !tokenFileTest.success) {
      recommendations.push({
        type: 'token-file',
        description: 'Token文件不存在或不可访问',
        suggestion: '请确保AWS SSO登录成功，token文件应该位于 ~/.aws/sso/cache/',
        priority: 'high'
      });
    }

    const tokenContentTest = this.testResults.find(r => r.name === 'token-content-validation');
    if (tokenContentTest && !tokenContentTest.success) {
      recommendations.push({
        type: 'token-content',
        description: 'Token内容无效或格式错误',
        suggestion: '重新执行AWS SSO登录: aws sso login --profile your-profile',
        priority: 'high'
      });
    }

    const serverAuthTest = this.testResults.find(r => r.name === 'server-auth-integration');
    if (serverAuthTest && !serverAuthTest.success) {
      recommendations.push({
        type: 'server-integration',
        description: '本地服务器认证集成失败',
        suggestion: '检查路由器配置和CodeWhisperer provider设置',
        priority: 'medium'
      });
    }

    const directConnectionTest = this.testResults.find(r => r.name === 'direct-connection-test');
    if (directConnectionTest && !directConnectionTest.success) {
      recommendations.push({
        type: 'direct-connection',
        description: 'CodeWhisperer直接连接失败',
        suggestion: '检查网络连接、profile ARN配置和token有效性',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * 保存认证测试报告
   */
  saveAuthReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `codewhisperer-auth-report-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`📄 认证测试报告已保存: ${filename}`);
  }
}

// 主函数
async function main() {
  const tester = new CodeWhispererAuthTester();
  
  try {
    const success = await tester.runAuthTests();
    console.log('\n🔐 认证测试完成!');
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 认证测试失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { CodeWhispererAuthTester, AUTH_TEST_CONFIG };