#!/usr/bin/env node

/**
 * Tool Parsing Fix Verification Test
 * 验证修复后的工具解析逻辑是否正确处理assistantResponseEvent中的工具调用
 * 
 * 测试目标：
 * 1. 验证文本内容解析正常
 * 2. 验证工具调用检测和解析正常
 * 3. 验证混合内容（文本+工具调用）处理正常
 * 4. 验证跨事件工具调用检测正常
 */

const axios = require('axios');
const fs = require('fs');

const TEST_CONFIG = {
  routerEndpoint: 'http://localhost:3456/v1/messages',
  timeout: 60000,
  logFile: '/tmp/tool-parsing-fix-verification.log',
  testCases: [
    {
      name: 'text-only',
      description: '纯文本响应测试',
      messages: [{ role: 'user', content: 'Please explain what is machine learning in 50 words' }],
      max_tokens: 100,
      expectedTypes: ['text']
    },
    {
      name: 'tool-call-request',
      description: '工具调用请求测试',
      messages: [{ role: 'user', content: 'Use the WebSearch tool to find information about "artificial intelligence"' }],
      max_tokens: 500,
      tools: [
        {
          name: 'WebSearch',
          description: 'Search for information on the web',
          input_schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query'
              }
            },
            required: ['query']
          }
        }
      ],
      expectedTypes: ['text', 'tool_use']
    },
    {
      name: 'mixed-content',
      description: '混合内容测试',
      messages: [{ role: 'user', content: 'First explain what AI is, then search for latest news about it' }],
      max_tokens: 800,
      tools: [
        {
          name: 'WebSearch',
          description: 'Search for information on the web',
          input_schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query'
              }
            },
            required: ['query']
          }
        }
      ],
      expectedTypes: ['text', 'tool_use']
    }
  ]
};

class ToolParsingTester {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message,
      data,
      elapsedTime: Date.now() - this.startTime
    };
    
    console.log(`[${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    fs.appendFileSync(TEST_CONFIG.logFile, JSON.stringify(logEntry) + '\n');
  }

  async testToolParsing(testCase) {
    const testStartTime = Date.now();
    this.log(`开始测试: ${testCase.name} - ${testCase.description}`);

    try {
      const requestPayload = {
        model: 'claude-sonnet-4-20250514',
        messages: testCase.messages,
        max_tokens: testCase.max_tokens,
        stream: false,
        ...(testCase.tools && { tools: testCase.tools })
      };

      this.log('发送测试请求', {
        testCase: testCase.name,
        hasTools: !!testCase.tools,
        toolCount: testCase.tools ? testCase.tools.length : 0
      });

      const response = await axios.post(TEST_CONFIG.routerEndpoint, requestPayload, {
        timeout: TEST_CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Case': testCase.name
        }
      });

      const responseTime = Date.now() - testStartTime;
      this.log('收到响应', {
        status: response.status,
        responseTime: `${responseTime}ms`
      });

      // 分析响应内容
      const analysis = this.analyzeResponse(response.data, testCase);
      
      this.log('响应分析完成', analysis);

      return {
        testCase: testCase.name,
        success: true,
        responseTime,
        analysis,
        response: response.data
      };

    } catch (error) {
      const responseTime = Date.now() - testStartTime;
      this.log('测试失败', {
        testCase: testCase.name,
        error: error.message,
        responseTime: `${responseTime}ms`
      });

      return {
        testCase: testCase.name,
        success: false,
        responseTime,
        error: error.message
      };
    }
  }

  analyzeResponse(responseData, testCase) {
    const analysis = {
      hasResponse: !!responseData,
      hasContent: !!responseData?.content,
      contentBlocks: responseData?.content?.length || 0,
      blockTypes: [],
      textBlocks: 0,
      toolBlocks: 0,
      hasValidText: false,
      hasValidTools: false,
      toolDetails: [],
      meetsExpectations: false
    };

    if (responseData?.content && Array.isArray(responseData.content)) {
      responseData.content.forEach((block, index) => {
        analysis.blockTypes.push(block.type);
        
        if (block.type === 'text') {
          analysis.textBlocks++;
          if (block.text && block.text.trim().length > 0) {
            analysis.hasValidText = true;
          }
          this.log(`文本块 ${index}`, {
            textLength: block.text ? block.text.length : 0,
            textPreview: block.text ? block.text.substring(0, 100) + '...' : 'empty'
          });
        } else if (block.type === 'tool_use') {
          analysis.toolBlocks++;
          analysis.hasValidTools = true;
          analysis.toolDetails.push({
            id: block.id,
            name: block.name,
            input: block.input
          });
          this.log(`工具块 ${index}`, {
            toolId: block.id,
            toolName: block.name,
            inputKeys: block.input ? Object.keys(block.input) : []
          });
        }
      });
    }

    // 检查是否符合预期
    if (testCase.expectedTypes) {
      const hasExpectedText = testCase.expectedTypes.includes('text') ? analysis.hasValidText : true;
      const hasExpectedTools = testCase.expectedTypes.includes('tool_use') ? analysis.hasValidTools : true;
      analysis.meetsExpectations = hasExpectedText && hasExpectedTools;
    }

    // 计算用量信息
    if (responseData?.usage) {
      analysis.usage = responseData.usage;
      analysis.hasValidUsage = responseData.usage.output_tokens > 0;
    }

    return analysis;
  }

  generateReport() {
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    
    const textParsingSuccess = this.results.filter(r => 
      r.success && r.analysis && r.analysis.hasValidText
    ).length;
    
    const toolParsingSuccess = this.results.filter(r => 
      r.success && r.analysis && r.analysis.hasValidTools && 
      r.testCase.includes('tool')
    ).length;
    
    const toolTestsTotal = this.results.filter(r => r.testCase.includes('tool')).length;

    const report = {
      summary: {
        totalTests,
        successfulTests,
        failedTests,
        successRate: `${Math.round((successfulTests / totalTests) * 100)}%`,
        textParsingRate: `${textParsingSuccess}/${totalTests} tests had valid text`,
        toolParsingRate: `${toolParsingSuccess}/${toolTestsTotal} tool tests had valid tools`
      },
      detailedResults: this.results,
      conclusions: []
    };

    // 生成结论
    if (successfulTests === totalTests) {
      report.conclusions.push('✅ 所有测试都成功完成');
    } else {
      report.conclusions.push(`❌ ${failedTests} 个测试失败`);
    }

    if (textParsingSuccess === totalTests) {
      report.conclusions.push('✅ 文本解析完全正常');
    } else {
      report.conclusions.push(`⚠️ 文本解析存在问题 (${totalTests - textParsingSuccess} 个测试无效文本)`);
    }

    if (toolTestsTotal > 0 && toolParsingSuccess === toolTestsTotal) {
      report.conclusions.push('✅ 工具调用解析完全正常');
    } else if (toolTestsTotal > 0) {
      report.conclusions.push(`⚠️ 工具调用解析存在问题 (${toolTestsTotal - toolParsingSuccess}/${toolTestsTotal} 个工具测试失败)`);
    }

    return report;
  }
}

async function main() {
  console.log('=== Tool Parsing Fix Verification Test ===');
  console.log(`开始时间: ${new Date().toISOString()}`);
  console.log(`日志文件: ${TEST_CONFIG.logFile}`);
  
  // 清理之前的日志
  if (fs.existsSync(TEST_CONFIG.logFile)) {
    fs.unlinkSync(TEST_CONFIG.logFile);
  }
  
  const tester = new ToolParsingTester();
  
  for (const testCase of TEST_CONFIG.testCases) {
    console.log(`\n--- 执行测试: ${testCase.name} ---`);
    const result = await tester.testToolParsing(testCase);
    tester.results.push(result);
    
    console.log(`--- 测试完成: ${testCase.name} (${result.success ? '成功' : '失败'}) ---`);
    
    // 测试间等待3秒
    if (TEST_CONFIG.testCases.indexOf(testCase) < TEST_CONFIG.testCases.length - 1) {
      console.log('等待3秒后继续下一个测试...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // 生成最终报告
  const report = tester.generateReport();
  
  const reportFile = `/tmp/tool-parsing-fix-report-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log('\n=== 工具解析修复验证报告 ===');
  console.log(`测试总数: ${report.summary.totalTests}`);
  console.log(`成功率: ${report.summary.successRate}`);
  console.log(`文本解析: ${report.summary.textParsingRate}`);
  console.log(`工具解析: ${report.summary.toolParsingRate}`);
  console.log('\n结论:');
  report.conclusions.forEach(conclusion => console.log(`  ${conclusion}`));
  console.log(`\n详细报告: ${reportFile}`);
  
  // 如果有失败的测试，退出码为1
  process.exit(report.summary.failedTests > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { ToolParsingTester, TEST_CONFIG };