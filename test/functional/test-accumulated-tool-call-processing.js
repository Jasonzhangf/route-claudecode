/**
 * Test accumulated tool call processing - 测试工具调用累积处理
 * 验证新的累积式处理方式是否能正确处理分段的工具调用文本
 * 
 * @author Jason Zhang
 */

const axios = require('axios');

async function testAccumulatedToolCallProcessing() {
  console.log('[2025-07-27T07:50:00.000Z] 🔍 开始测试累积式工具调用处理');
  
  const startTime = Date.now();
  const logFile = `/tmp/test-accumulated-tool-call-processing-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.log`;
  
  try {
    // 测试请求 - 请求使用 LS 工具
    const testRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: 'Check the files in the current directory using LS tool.'
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
    };
    
    console.log('[' + new Date().toISOString() + '] 📤 发送累积式工具调用测试请求');
    
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': 'any-string-is-ok'
      },
      timeout: 30000
    });
    
    console.log('[' + new Date().toISOString() + '] ✅ 累积式工具调用测试 完成');
    
    // 分析响应
    const analysisResult = analyzeResponse(response.data);
    
    // 输出结果
    console.log(JSON.stringify({
      statusCode: response.status,
      analysis: analysisResult
    }, null, 2));
    
    // 生成测试报告
    const testReport = generateTestReport(analysisResult, startTime);
    console.log('\\n📋 累积式处理测试报告:');
    console.log(`[${new Date().toISOString()}] 状态: ${testReport.status}`);
    console.log(`[${new Date().toISOString()}] 工具调用处理方式: ${testReport.processingMethod}`);
    console.log(`[${new Date().toISOString()}] 检测到的问题: ${testReport.issueCount}`);
    console.log(`[${new Date().toISOString()}] 执行时长: ${testReport.duration}ms`);
    
    if (testReport.issues.length > 0) {
      console.log('\\n⚠️  发现的问题:');
      testReport.issues.forEach((issue, index) => {
        console.log(`[${new Date().toISOString()}] ${index + 1}. ${issue}`);
      });
    }
    
    console.log(`\\n📄 详细日志保存在: ${logFile}`);
    
    return testReport;
    
  } catch (error) {
    console.error('[' + new Date().toISOString() + '] ❌ 累积式工具调用测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
    
    return {
      status: 'FAILED',
      processingMethod: 'accumulated',
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

function analyzeResponse(responseData) {
  console.log('[' + new Date().toISOString() + '] 📡 开始分析累积式处理响应');
  
  const analysis = {
    totalEvents: 0,
    hasToolCall: false,
    hasTextContent: false,
    toolEvents: [],
    textEvents: [],
    suspiciousContent: [],
    issues: [],
    processingMethod: 'accumulated',
    toolCallsDetected: 0,
    fragmentedToolCalls: []
  };
  
  // 如果响应包含content数组，分析每个content块
  if (responseData && responseData.content && Array.isArray(responseData.content)) {
    responseData.content.forEach((contentBlock, index) => {
      console.log(`[${new Date().toISOString()}] 📋 Content Block ${index + 1}: ${contentBlock.type}`);
      
      if (contentBlock.type === 'tool_use') {
        analysis.hasToolCall = true;
        analysis.toolCallsDetected++;
        analysis.toolEvents.push({
          name: contentBlock.name,
          id: contentBlock.id,
          input: contentBlock.input
        });
        
        console.log(`[${new Date().toISOString()}] 🔧 检测到工具调用: ${contentBlock.name}`);
        
        // 检查工具调用是否是从累积的文本中正确解析的
        if (contentBlock.id && contentBlock.id.includes('accumulated_tool_')) {
          console.log(`[${new Date().toISOString()}] ✅ 工具调用通过累积处理正确识别`);
        }
        
      } else if (contentBlock.type === 'text') {
        analysis.hasTextContent = true;
        analysis.textEvents.push({
          text: contentBlock.text,
          length: contentBlock.text.length
        });
        
        // 检查文本中是否包含未处理的工具调用
        if (contentBlock.text.includes('Tool call:')) {
          analysis.suspiciousContent.push({
            type: 'text_contains_tool_call',
            content: contentBlock.text.substring(0, 200),
            blockIndex: index
          });
          analysis.issues.push(`文本内容中发现未处理的工具调用: Block ${index + 1}`);
          console.log(`[${new Date().toISOString()}] ⚠️ 在文本块中发现未处理的工具调用`);
        }
      }
    });
  }
  
  // 分析总结
  analysis.totalEvents = analysis.toolEvents.length + analysis.textEvents.length;
  
  console.log('[' + new Date().toISOString() + '] 🔍 累积式处理分析结果:');
  console.log(`[${new Date().toISOString()}] 📊 总内容块数: ${analysis.totalEvents}`);
  console.log(`[${new Date().toISOString()}] 🔧 是否有工具调用: ${analysis.hasToolCall}`);
  console.log(`[${new Date().toISOString()}] ❌ 工具调用被转为文本: ${analysis.suspiciousContent.length > 0}`);
  console.log(`[${new Date().toISOString()}] 📝 工具调用事件数: ${analysis.toolEvents.length}`);
  console.log(`[${new Date().toISOString()}] 💬 文本事件数: ${analysis.textEvents.length}`);
  
  return analysis;
}

function generateTestReport(analysis, startTime) {
  const duration = Date.now() - startTime;
  
  const report = {
    status: analysis.issues.length === 0 ? 'PASSED' : 'FAILED',
    processingMethod: 'accumulated',
    issueCount: analysis.issues.length,
    issues: analysis.issues,
    duration: duration,
    summary: {
      toolCallsDetected: analysis.toolCallsDetected,
      properlyProcessed: analysis.toolEvents.length,
      textBlocks: analysis.textEvents.length,
      suspiciousContent: analysis.suspiciousContent.length
    }
  };
  
  // 验证累积式处理是否有效
  if (analysis.hasToolCall && analysis.suspiciousContent.length === 0) {
    report.processingEffectiveness = 'EXCELLENT';
    report.message = '累积式处理成功避免了工具调用被错误识别为文本';
  } else if (analysis.hasToolCall && analysis.suspiciousContent.length > 0) {
    report.processingEffectiveness = 'NEEDS_IMPROVEMENT';
    report.message = '累积式处理部分有效，但仍有工具调用被识别为文本';
  } else if (!analysis.hasToolCall) {
    report.processingEffectiveness = 'NO_TOOL_CALLS';
    report.message = '响应中没有检测到工具调用';
  }
  
  return report;
}

// 如果直接运行此脚本
if (require.main === module) {
  testAccumulatedToolCallProcessing()
    .then(result => {
      console.log('\\n🏁 累积式工具调用处理测试完成');
      process.exit(result.status === 'PASSED' ? 0 : 1);
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testAccumulatedToolCallProcessing };