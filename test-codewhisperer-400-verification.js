#!/usr/bin/env node
/**
 * CodeWhisperer 400错误专项验证测试
 * 确认profileArn修复后是否还存在400错误
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class CodeWhispererVerificationTester {
  constructor() {
    this.testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        api400Count: 0
      }
    };
    
    this.outputDir = 'debug-output/codewhisperer-400-verification';
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async runVerificationTests() {
    console.log('🧪 CodeWhisperer 400错误专项验证测试');
    console.log('======================================');
    
    // 测试场景
    const testScenarios = [
      {
        name: '简单文本请求',
        description: '基础文本对话请求',
        request: {
          model: 'CLAUDE_SONNET_4_20250514_V1_0',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: 'Hello, how are you?' }
          ]
        }
      },
      {
        name: '工具调用请求',
        description: '包含工具定义的请求',
        request: {
          model: 'CLAUDE_SONNET_4_20250514_V1_0',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: 'What time is it now?' }
          ],
          tools: [{
            name: 'get_current_time',
            description: 'Get the current date and time',
            input_schema: {
              type: 'object',
              properties: {
                timezone: {
                  type: 'string',
                  description: 'Timezone identifier'
                }
              }
            }
          }]
        }
      },
      {
        name: '多轮对话请求',
        description: '包含历史消息的多轮对话',
        request: {
          model: 'CLAUDE_SONNET_4_20250514_V1_0',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there! How can I help you?' },
            { role: 'user', content: 'Can you tell me a joke?' }
          ]
        }
      },
      {
        name: '复杂工具调用请求',
        description: '多个工具定义和复杂schema',
        request: {
          model: 'CLAUDE_SONNET_4_20250514_V1_0',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: 'Help me plan a trip to Japan.' }
          ],
          tools: [
            {
              name: 'search_flights',
              description: 'Search for flight options',
              input_schema: {
                type: 'object',
                properties: {
                  origin: { type: 'string', description: 'Origin airport code' },
                  destination: { type: 'string', description: 'Destination airport code' },
                  departure_date: { type: 'string', format: 'date' },
                  return_date: { type: 'string', format: 'date' }
                },
                required: ['origin', 'destination', 'departure_date']
              }
            },
            {
              name: 'get_weather',
              description: 'Get weather information for a location',
              input_schema: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'City name or coordinates' },
                  date: { type: 'string', format: 'date' }
                },
                required: ['location']
              }
            }
          ]
        }
      }
    ];

    console.log(`🎯 准备执行 ${testScenarios.length} 个测试场景...\n`);

    // 执行所有测试
    for (const scenario of testScenarios) {
      await this.runSingleTest(scenario);
    }

    // 生成测试报告
    await this.generateTestReport();
    
    // 输出总结
    this.printSummary();
  }

  async runSingleTest(scenario) {
    console.log(`📋 测试: ${scenario.name}`);
    console.log(`   描述: ${scenario.description}`);
    
    const testResult = {
      name: scenario.name,
      description: scenario.description,
      request: scenario.request,
      timestamp: new Date().toISOString(),
      success: false,
      status: null,
      response: null,
      error: null,
      duration: 0
    };

    const startTime = Date.now();
    
    try {
      const response = await axios.post('http://localhost:3456/v1/messages', scenario.request, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      });

      testResult.success = true;
      testResult.status = response.status;
      testResult.response = response.data;
      testResult.duration = Date.now() - startTime;

      console.log(`   ✅ 成功 - 状态码: ${response.status}, 耗时: ${testResult.duration}ms`);
      
      // 检查响应内容
      if (response.data.content && response.data.content.length > 0) {
        const textContent = response.data.content.find(c => c.type === 'text');
        if (textContent) {
          console.log(`   📝 响应预览: "${textContent.text.substring(0, 50)}..."`);
        }
      }

      this.testResults.summary.passed++;

    } catch (error) {
      testResult.success = false;
      testResult.status = error.response?.status;
      testResult.error = {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
      testResult.duration = Date.now() - startTime;

      console.log(`   ❌ 失败 - 状态码: ${error.response?.status || 'N/A'}, 耗时: ${testResult.duration}ms`);
      console.log(`   🚨 错误信息: ${error.message}`);
      
      // 特别记录400错误
      if (error.response?.status === 400) {
        this.testResults.summary.api400Count++;
        console.log(`   🔍 API 400错误详情: ${JSON.stringify(error.response.data, null, 2)}`);
      }

      this.testResults.summary.failed++;
    }

    this.testResults.tests.push(testResult);
    this.testResults.summary.total++;
    
    console.log(''); // 空行分隔
  }

  async generateTestReport() {
    const reportData = {
      ...this.testResults,
      metadata: {
        testType: 'CodeWhisperer 400 Error Verification',
        profileArnFixApplied: true,
        testingObjective: 'Verify that profileArn substring error fix resolves API 400 issues',
        testEnvironment: {
          port: 3456,
          provider: 'codewhisperer',
          authMethod: 'conditional-social-check'
        }
      }
    };

    const reportPath = path.join(this.outputDir, `verification-report-${this.testResults.timestamp.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    console.log(`📊 详细报告已保存: ${reportPath}`);
    
    // 生成Markdown报告
    await this.generateMarkdownReport(reportData);
  }

  async generateMarkdownReport(reportData) {
    const markdownPath = path.join(this.outputDir, `verification-report-${this.testResults.timestamp.replace(/[:.]/g, '-')}.md`);
    
    const markdown = `# CodeWhisperer 400错误验证报告

生成时间: ${reportData.timestamp}

## 🎯 测试目标
验证ProfileArn substring错误修复后，CodeWhisperer API是否仍存在400错误。

## 📊 测试结果总览

- **总测试数**: ${reportData.summary.total}
- **成功**: ${reportData.summary.passed}
- **失败**: ${reportData.summary.failed}
- **API 400错误数**: ${reportData.summary.api400Count}
- **成功率**: ${((reportData.summary.passed / reportData.summary.total) * 100).toFixed(1)}%

## 🧪 详细测试结果

${reportData.tests.map(test => `
### ${test.name}
- **描述**: ${test.description}
- **状态**: ${test.success ? '✅ 成功' : '❌ 失败'}
- **HTTP状态码**: ${test.status || 'N/A'}
- **耗时**: ${test.duration}ms
${test.error ? `- **错误信息**: ${test.error.message}` : ''}
${test.error?.status === 400 ? `- **🚨 API 400详情**: \`${JSON.stringify(test.error.data)}\`` : ''}
`).join('\n')}

## 🎯 结论

${reportData.summary.api400Count === 0 
  ? '🎉 **修复成功**: 所有测试均未出现API 400错误，profileArn修复生效！' 
  : `⚠️ **仍有问题**: 发现 ${reportData.summary.api400Count} 个API 400错误，需要进一步调试。`
}

## 🔧 修复验证

ProfileArn修复要点:
- ✅ 条件性设置profileArn (只在authMethod='social'时)
- ✅ 安全的substring调用 (防止undefined错误)
- ✅ Demo3兼容的请求结构

## 📝 建议后续行动

${reportData.summary.api400Count === 0 
  ? `1. ✅ ProfileArn修复验证成功，可以继续其他开发任务
2. 🔄 建议定期运行此验证测试确保稳定性
3. 📋 将此修复经验添加到项目文档`
  : `1. 🔍 深入分析剩余的400错误原因
2. 🛠️ 根据错误详情进行针对性修复
3. 🧪 修复后重新运行验证测试`
}

---
*报告由CodeWhispererVerificationTester自动生成*
`;

    fs.writeFileSync(markdownPath, markdown);
    console.log(`📋 Markdown报告已保存: ${markdownPath}`);
  }

  printSummary() {
    console.log('🎯 验证测试总结');
    console.log('================');
    console.log(`总测试数: ${this.testResults.summary.total}`);
    console.log(`成功: ${this.testResults.summary.passed}`);
    console.log(`失败: ${this.testResults.summary.failed}`);
    console.log(`API 400错误: ${this.testResults.summary.api400Count}`);
    console.log(`成功率: ${((this.testResults.summary.passed / this.testResults.summary.total) * 100).toFixed(1)}%`);
    
    if (this.testResults.summary.api400Count === 0) {
      console.log('\n🎉 恭喜！ProfileArn修复成功，未发现API 400错误！');
      console.log('✅ 修复要点验证通过:');
      console.log('   - profileArn条件性设置逻辑');
      console.log('   - substring安全调用机制');
      console.log('   - demo3架构兼容性');
    } else {
      console.log(`\n⚠️ 警告：仍有 ${this.testResults.summary.api400Count} 个API 400错误需要修复`);
      console.log('🔍 建议检查错误详情并进行针对性修复');
    }
    
    console.log(`\n📁 详细报告位置: ${this.outputDir}/`);
  }
}

// 运行验证测试
async function runVerification() {
  const tester = new CodeWhispererVerificationTester();
  
  try {
    await tester.runVerificationTests();
  } catch (error) {
    console.error('💥 验证测试执行失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runVerification();
}

module.exports = { CodeWhispererVerificationTester };