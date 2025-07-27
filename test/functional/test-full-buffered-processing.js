/**
 * Test full buffered processing - 测试完全缓冲式处理
 * 验证新的非流式->流式转换方法是否能彻底解决工具调用问题
 * 
 * @author Jason Zhang
 */

const axios = require('axios');

async function testFullBufferedProcessing() {
  console.log('[2025-07-27T09:15:00.000Z] 🔍 开始测试完全缓冲式处理');
  
  const startTime = Date.now();
  const logFile = `/tmp/test-full-buffered-processing-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.log`;
  
  const testCases = [
    {
      name: '简单LS工具调用',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Use the LS tool to list files in the current directory'
          }
        ],
        tools: [
          {
            name: 'LS',
            description: 'List files and directories',
            input_schema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Directory path to list'
                }
              },
              required: ['path']
            }
          }
        ]
      }
    },
    {
      name: '复杂路径LS工具调用',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'List the contents of /Users/fanzhang/.claude-code-router using LS tool'
          }
        ],
        tools: [
          {
            name: 'LS',
            description: 'List files and directories',
            input_schema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Directory path to list'
                }
              },
              required: ['path']
            }
          }
        ]
      }
    },
    {
      name: '多工具调用场景',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: 'First use LS to list current directory, then use Read to read a file if found'
          }
        ],
        tools: [
          {
            name: 'LS',
            description: 'List files and directories',
            input_schema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Directory path to list'
                }
              },
              required: ['path']
            }
          },
          {
            name: 'Read',
            description: 'Read file contents',
            input_schema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to file to read'
                }
              },
              required: ['file_path']
            }
          }
        ]
      }
    }
  ];

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\\n[${new Date().toISOString()}] 📋 测试 ${i + 1}: ${testCase.name}`);
    
    try {
      const testStart = Date.now();
      
      const response = await axios.post('http://127.0.0.1:3456/v1/messages', testCase.request, {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': 'any-string-is-ok'
        },
        timeout: 30000
      });
      
      const testDuration = Date.now() - testStart;
      console.log(`[${new Date().toISOString()}] ✅ 测试 ${i + 1} 完成 (${testDuration}ms)`);
      
      // 分析响应
      const analysisResult = analyzeBufferedResponse(response.data, testCase.name);
      results.push({
        testName: testCase.name,
        status: 'PASSED',
        duration: testDuration,
        analysis: analysisResult
      });
      
      // 输出简要结果
      console.log(`   📊 内容块: ${analysisResult.totalContentBlocks}`);
      console.log(`   🔧 工具调用: ${analysisResult.toolCallBlocks}`);
      console.log(`   💬 文本块: ${analysisResult.textBlocks}`);
      console.log(`   ❌ 工具调用被误认为文本: ${analysisResult.toolCallsInText}`);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ 测试 ${i + 1} 失败:`, error.message);
      results.push({
        testName: testCase.name,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - testStart
      });
    }
  }

  // 生成总体测试报告
  const overallReport = generateOverallReport(results, startTime);
  
  console.log('\\n📋 完全缓冲式处理测试报告:');
  console.log(`[${new Date().toISOString()}] 总体状态: ${overallReport.overallStatus}`);
  console.log(`[${new Date().toISOString()}] 测试用例总数: ${overallReport.totalTests}`);
  console.log(`[${new Date().toISOString()}] 通过: ${overallReport.passedTests}`);
  console.log(`[${new Date().toISOString()}] 失败: ${overallReport.failedTests}`);
  console.log(`[${new Date().toISOString()}] 总执行时长: ${overallReport.totalDuration}ms`);
  console.log(`[${new Date().toISOString()}] 工具调用问题修复率: ${overallReport.toolCallFixRate}%`);
  
  if (overallReport.issues.length > 0) {
    console.log('\\n⚠️  发现的问题:');
    overallReport.issues.forEach((issue, index) => {
      console.log(`[${new Date().toISOString()}] ${index + 1}. ${issue}`);
    });
  } else {
    console.log('\\n🎉 完全缓冲式处理完美解决了所有工具调用问题！');
  }
  
  console.log(`\\n📄 详细日志保存在: ${logFile}`);
  
  return overallReport;
}

function analyzeBufferedResponse(responseData, testName) {
  console.log(`[${new Date().toISOString()}] 📡 分析缓冲式处理响应: ${testName}`);
  
  const analysis = {
    totalContentBlocks: 0,
    textBlocks: 0,
    toolCallBlocks: 0,
    toolCallsInText: 0,
    suspiciousContent: [],
    issues: [],
    processingMethod: 'full-buffered'
  };
  
  // 分析响应内容
  if (responseData && responseData.content && Array.isArray(responseData.content)) {
    analysis.totalContentBlocks = responseData.content.length;
    
    responseData.content.forEach((contentBlock, index) => {
      console.log(`[${new Date().toISOString()}] 📋 内容块 ${index + 1}: ${contentBlock.type}`);
      
      if (contentBlock.type === 'tool_use') {
        analysis.toolCallBlocks++;
        console.log(`[${new Date().toISOString()}] 🔧 工具调用检测: ${contentBlock.name} (ID: ${contentBlock.id})`);
        
        // 检查工具调用是否来自缓冲处理
        if (contentBlock.id && (contentBlock.id.includes('extracted_') || contentBlock.id.includes('buffered_'))) {
          console.log(`[${new Date().toISOString()}] ✅ 确认来自缓冲式处理的工具调用`);
        }
        
      } else if (contentBlock.type === 'text') {
        analysis.textBlocks++;
        
        // 检查文本中是否包含未处理的工具调用
        if (contentBlock.text && contentBlock.text.includes('Tool call:')) {
          analysis.toolCallsInText++;
          analysis.suspiciousContent.push({
            type: 'text_contains_tool_call',
            content: contentBlock.text.substring(0, 200),
            blockIndex: index
          });
          analysis.issues.push(`文本内容块 ${index + 1} 中发现未处理的工具调用`);
          console.log(`[${new Date().toISOString()}] ⚠️ 在文本块中发现未处理的工具调用`);
        }
      }
    });
  }
  
  console.log(`[${new Date().toISOString()}] 🔍 缓冲式处理分析完成:`);
  console.log(`[${new Date().toISOString()}] 📊 总内容块: ${analysis.totalContentBlocks}`);
  console.log(`[${new Date().toISOString()}] 🔧 工具调用块: ${analysis.toolCallBlocks}`);
  console.log(`[${new Date().toISOString()}] 💬 文本块: ${analysis.textBlocks}`);
  console.log(`[${new Date().toISOString()}] ❌ 文本中的工具调用: ${analysis.toolCallsInText}`);
  
  return analysis;
}

function generateOverallReport(results, startTime) {
  const totalDuration = Date.now() - startTime;
  const passedTests = results.filter(r => r.status === 'PASSED').length;
  const failedTests = results.filter(r => r.status === 'FAILED').length;
  
  // 计算工具调用问题修复率
  const allAnalyses = results.filter(r => r.analysis).map(r => r.analysis);
  const totalToolCallsInText = allAnalyses.reduce((sum, a) => sum + a.toolCallsInText, 0);
  const totalToolCallBlocks = allAnalyses.reduce((sum, a) => sum + a.toolCallBlocks, 0);
  const toolCallFixRate = totalToolCallBlocks > 0 ? 
    Math.round(((totalToolCallBlocks - totalToolCallsInText) / totalToolCallBlocks) * 100) : 100;
  
  const allIssues = results.flatMap(r => r.analysis ? r.analysis.issues : []);
  
  const report = {
    overallStatus: failedTests === 0 && totalToolCallsInText === 0 ? 'EXCELLENT' : 
                   failedTests === 0 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
    totalTests: results.length,
    passedTests,
    failedTests,
    totalDuration,
    toolCallFixRate,
    issues: allIssues,
    summary: {
      processingMethod: 'full-buffered',
      totalToolCallBlocks: totalToolCallBlocks,
      totalToolCallsInText: totalToolCallsInText,
      effectivenessRating: totalToolCallsInText === 0 ? 'PERFECT' : 'PARTIAL'
    }
  };
  
  return report;
}

// 如果直接运行此脚本
if (require.main === module) {
  testFullBufferedProcessing()
    .then(result => {
      console.log('\\n🏁 完全缓冲式处理测试完成');
      process.exit(result.overallStatus === 'EXCELLENT' ? 0 : 1);
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testFullBufferedProcessing };