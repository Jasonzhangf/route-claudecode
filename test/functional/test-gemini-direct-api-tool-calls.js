#!/usr/bin/env node

/**
 * 直接Gemini API工具调用测试
 * 验证转换后的工具格式是否与Gemini API兼容
 * 项目所有者：Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// 配置
const CONFIG_PATH = path.join(process.env.HOME, '.route-claude-code', 'config.json');
const DEBUG_OUTPUT_DIR = `/tmp/gemini-direct-api-test-${Date.now()}`;

// 创建调试输出目录
if (!fs.existsSync(DEBUG_OUTPUT_DIR)) {
  fs.mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });
}

const LOG_FILE = path.join(DEBUG_OUTPUT_DIR, 'debug.log');

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}${data ? '\nData: ' + JSON.stringify(data, null, 2) : ''}`;
  console.log(logEntry);
  fs.appendFileSync(LOG_FILE, logEntry + '\n');
}

function saveData(filename, data) {
  const filePath = path.join(DEBUG_OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  log(`💾 Data saved: ${filePath}`);
  return filePath;
}

/**
 * Clean JSON Schema object for Gemini API compatibility
 */
function cleanJsonSchemaForGemini(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const cleaned = {};
  
  // Gemini API supported fields for schema
  const supportedFields = ['type', 'properties', 'required', 'items', 'description', 'enum'];
  
  for (const [key, value] of Object.entries(schema)) {
    if (supportedFields.includes(key)) {
      if (key === 'properties' && typeof value === 'object') {
        // Recursively clean properties
        cleaned[key] = {};
        for (const [propKey, propValue] of Object.entries(value)) {
          cleaned[key][propKey] = cleanJsonSchemaForGemini(propValue);
        }
      } else if (key === 'items' && typeof value === 'object') {
        // Recursively clean array items schema
        cleaned[key] = cleanJsonSchemaForGemini(value);
      } else {
        cleaned[key] = value;
      }
    }
    // Skip unsupported fields like: additionalProperties, $schema, minItems, maxItems, etc.
  }
  
  return cleaned;
}

/**
 * Convert Anthropic tools to Gemini format
 */
function convertAnthropicToolsToGemini(anthropicTools) {
  const functionDeclarations = anthropicTools.map(tool => {
    const rawParameters = tool.input_schema || {};
    const parameters = cleanJsonSchemaForGemini(rawParameters);
    
    return {
      name: tool.name,
      description: tool.description || '',
      parameters: parameters
    };
  });
  
  return [{
    functionDeclarations: functionDeclarations
  }];
}

/**
 * 测试1: 验证工具格式转换
 */
async function test1_validateToolConversion() {
  log('🧪 Test 1: 验证工具格式转换');
  
  const anthropicTools = [
    {
      name: 'TodoWrite',
      description: 'Create and manage todo items',
      input_schema: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string', minLength: 1 },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                id: { type: 'string' }
              },
              required: ['content', 'status', 'priority', 'id'],
              additionalProperties: false
            }
          }
        },
        required: ['todos'],
        $schema: 'http://json-schema.org/draft-07/schema#',
        additionalProperties: false
      }
    }
  ];
  
  const geminiTools = convertAnthropicToolsToGemini(anthropicTools);
  
  log('✅ 工具转换完成', {
    originalToolCount: anthropicTools.length,
    geminiToolFormat: Array.isArray(geminiTools) ? 'array' : 'object',
    hasFunctionDeclarations: !!(geminiTools[0]?.functionDeclarations),
    functionCount: geminiTools[0]?.functionDeclarations?.length || 0
  });
  
  const conversionResult = {
    original: anthropicTools,
    converted: geminiTools,
    validation: {
      isArray: Array.isArray(geminiTools),
      hasDeclarations: !!(geminiTools[0]?.functionDeclarations),
      parameterFields: geminiTools[0]?.functionDeclarations?.[0]?.parameters ? 
        Object.keys(geminiTools[0].functionDeclarations[0].parameters) : [],
      removedUnsupportedFields: ['$schema', 'additionalProperties', 'minLength']
    }
  };
  
  saveData('tool-conversion-result.json', conversionResult);
  return conversionResult;
}

/**
 * 测试2: 直接调用Gemini API测试工具调用
 */
async function test2_directGeminiAPICall() {
  log('🌐 Test 2: 直接调用Gemini API测试工具调用');
  
  try {
    // 读取配置获取API密钥
    let config;
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
      log('❌ 无法读取配置文件', { error: error.message, path: CONFIG_PATH });
      return { error: 'config_not_found', message: 'Cannot read configuration file' };
    }
    
    // 查找Gemini provider
    let geminiApiKey = null;
    for (const [providerId, provider] of Object.entries(config.providers || {})) {
      if (provider.endpoint?.includes('googleapis.com') || providerId.includes('gemini')) {
        const credentials = provider.authentication?.credentials;
        if (credentials?.api_key) {
          geminiApiKey = Array.isArray(credentials.api_key) ? 
            credentials.api_key[0] : credentials.api_key;
          log('✅ 找到Gemini API密钥', { providerId });
          break;
        }
      }
    }
    
    if (!geminiApiKey) {
      log('❌ 未找到Gemini API密钥');
      return { error: 'api_key_not_found', message: 'Gemini API key not found in configuration' };
    }
    
    // 读取转换后的工具
    const toolConversionPath = path.join(DEBUG_OUTPUT_DIR, 'tool-conversion-result.json');
    const toolConversion = JSON.parse(fs.readFileSync(toolConversionPath, 'utf8'));
    
    // 构建Gemini API请求
    const geminiRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ 
            text: 'Please create a todo item with content "Test Gemini API direct call", status "in_progress", priority "high", and id "direct-test-1"' 
          }]
        }
      ],
      tools: toolConversion.converted,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.1
      }
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    log('🚀 发送直接API请求到Gemini', {
      url: url.replace(geminiApiKey, '***' + geminiApiKey.slice(-4)),
      hasTools: !!geminiRequest.tools,
      toolCount: geminiRequest.tools[0]?.functionDeclarations?.length || 0,
      requestSize: JSON.stringify(geminiRequest).length
    });
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(geminiRequest)
    });
    const responseTime = Date.now() - startTime;
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      log('❌ API响应不是有效JSON', { 
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.slice(0, 1000) + (responseText.length > 1000 ? '...' : '')
      });
      
      const errorResult = {
        error: 'invalid_json_response',
        status: response.status,
        statusText: response.statusText,
        responseText,
        responseTime
      };
      
      saveData('direct-api-error.json', errorResult);
      return errorResult;
    }
    
    const apiResult = {
      request: geminiRequest,
      response: {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      },
      timing: {
        responseTime,
        timestamp: new Date().toISOString()
      },
      analysis: {
        success: response.ok,
        hasContent: !!(responseData.candidates?.[0]?.content?.parts?.length),
        hasToolCalls: !!(responseData.candidates?.[0]?.content?.parts?.some(p => p.functionCall)),
        hasTextContent: !!(responseData.candidates?.[0]?.content?.parts?.some(p => p.text)),
        isEmpty: !responseData.candidates?.[0]?.content?.parts?.some(p => p.text || p.functionCall),
        finishReason: responseData.candidates?.[0]?.finishReason,
        usageMetadata: responseData.usageMetadata
      }
    };
    
    if (response.ok) {
      log('✅ Gemini API调用成功', {
        responseTime: `${responseTime}ms`,
        hasContent: apiResult.analysis.hasContent,
        hasToolCalls: apiResult.analysis.hasToolCalls,
        isEmpty: apiResult.analysis.isEmpty
      });
    } else {
      log('❌ Gemini API调用失败', {
        status: response.status,
        statusText: response.statusText,
        error: responseData.error || responseData
      });
    }
    
    saveData('direct-api-result.json', apiResult);
    return apiResult;
    
  } catch (error) {
    log('❌ 直接API调用异常', {
      error: error.message,
      stack: error.stack
    });
    
    const errorResult = {
      error: 'api_call_exception',
      message: error.message,
      stack: error.stack
    };
    
    saveData('direct-api-exception.json', errorResult);
    return errorResult;
  }
}

/**
 * 测试3: 分析响应格式并生成修复建议
 */
async function test3_analyzeResponseAndGenerateFixes() {
  log('🔍 Test 3: 分析响应格式并生成修复建议');
  
  try {
    // 读取API调用结果
    const apiResultPath = path.join(DEBUG_OUTPUT_DIR, 'direct-api-result.json');
    const apiResult = JSON.parse(fs.readFileSync(apiResultPath, 'utf8'));
    
    const analysis = {
      apiCallStatus: apiResult.response?.status || 'unknown',
      success: apiResult.analysis?.success || false,
      hasContent: apiResult.analysis?.hasContent || false,
      hasToolCalls: apiResult.analysis?.hasToolCalls || false,
      isEmpty: apiResult.analysis?.isEmpty || false,
      finishReason: apiResult.analysis?.finishReason,
      issues: [],
      recommendations: []
    };
    
    // 分析问题
    if (!analysis.success) {
      analysis.issues.push({
        type: 'api_error',
        severity: 'critical',
        description: `API call failed with status ${analysis.apiCallStatus}`,
        details: apiResult.response?.data?.error || apiResult.response?.statusText
      });
      
      if (analysis.apiCallStatus === 400) {
        analysis.recommendations.push({
          priority: 'high',
          category: 'format_fix',
          action: 'Check tool schema format - likely contains unsupported JSON Schema fields',
          details: 'Review cleanJsonSchemaForGemini function and ensure all unsupported fields are removed'
        });
      }
    }
    
    if (analysis.success && analysis.isEmpty) {
      analysis.issues.push({
        type: 'empty_response',
        severity: 'high',
        description: 'API call succeeded but returned empty content',
        details: 'Gemini API returned a successful response but no actual content'
      });
      
      analysis.recommendations.push({
        priority: 'high',
        category: 'content_handling',
        action: 'Implement better empty response handling in convertFromGeminiFormat',
        details: 'Add fallback content when Gemini returns empty response'
      });
    }
    
    if (analysis.success && !analysis.hasToolCalls && !analysis.hasTextContent) {
      analysis.issues.push({
        type: 'no_useful_content',
        severity: 'medium',
        description: 'Response has no tool calls or text content',
        details: 'API response structure may be unexpected'
      });
    }
    
    // 生成针对性建议
    if (analysis.success && analysis.hasToolCalls) {
      analysis.recommendations.push({
        priority: 'low',
        category: 'optimization',
        action: 'Tool call format is working correctly',
        details: 'Current implementation successfully generates tool calls'
      });
    }
    
    log('✅ 响应分析完成', {
      issuesFound: analysis.issues.length,
      recommendationsGenerated: analysis.recommendations.length,
      overallStatus: analysis.success ? 'success' : 'failed'
    });
    
    saveData('response-analysis.json', analysis);
    return analysis;
    
  } catch (error) {
    log('❌ 响应分析失败', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      error: 'analysis_failed',
      message: error.message
    };
  }
}

/**
 * 生成综合测试报告
 */
async function generateComprehensiveReport() {
  log('📋 生成综合测试报告');
  
  const report = {
    timestamp: new Date().toISOString(),
    testSuite: 'Gemini Direct API Tool Calls Test',
    debugOutputDir: DEBUG_OUTPUT_DIR,
    tests: {},
    summary: {
      totalTests: 3,
      passed: 0,
      failed: 0,
      issues: [],
      recommendations: []
    }
  };
  
  // 收集所有测试结果
  const testFiles = [
    { test: 'tool_conversion', file: 'tool-conversion-result.json' },
    { test: 'direct_api_call', file: 'direct-api-result.json' },
    { test: 'response_analysis', file: 'response-analysis.json' }
  ];
  
  for (const { test, file } of testFiles) {
    const filePath = path.join(DEBUG_OUTPUT_DIR, file);
    if (fs.existsSync(filePath)) {
      try {
        report.tests[test] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // 判断测试是否通过
        if (test === 'tool_conversion') {
          const passed = report.tests[test].validation?.isArray && 
                        report.tests[test].validation?.hasDeclarations;
          if (passed) report.summary.passed++;
          else report.summary.failed++;
        } else if (test === 'direct_api_call') {
          const passed = report.tests[test].analysis?.success || false;
          if (passed) report.summary.passed++;
          else report.summary.failed++;
        } else if (test === 'response_analysis') {
          report.summary.passed++; // 分析本身总是成功的
          
          // 收集问题和建议
          if (report.tests[test].issues) {
            report.summary.issues.push(...report.tests[test].issues);
          }
          if (report.tests[test].recommendations) {
            report.summary.recommendations.push(...report.tests[test].recommendations);
          }
        }
      } catch (error) {
        log(`⚠️ 无法读取测试结果: ${file}`, { error: error.message });
        report.tests[test] = { error: error.message };
        report.summary.failed++;
      }
    } else {
      log(`⚠️ 测试结果文件不存在: ${file}`);
      report.summary.failed++;
    }
  }
  
  // 生成总结
  report.summary.successRate = (report.summary.passed / report.summary.totalTests * 100).toFixed(1);
  report.summary.criticalIssues = report.summary.issues.filter(i => i.severity === 'critical').length;
  report.summary.highPriorityRecommendations = report.summary.recommendations.filter(r => r.priority === 'high').length;
  
  log('✅ 综合测试报告生成完成', {
    successRate: report.summary.successRate + '%',
    criticalIssues: report.summary.criticalIssues,
    highPriorityRecommendations: report.summary.highPriorityRecommendations
  });
  
  saveData('comprehensive-test-report.json', report);
  return report;
}

/**
 * 主执行函数
 */
async function main() {
  log('🚀 开始Gemini直接API工具调用测试');
  log('📁 调试输出目录:', DEBUG_OUTPUT_DIR);
  
  try {
    // 执行所有测试
    await test1_validateToolConversion();
    await test2_directGeminiAPICall();
    await test3_analyzeResponseAndGenerateFixes();
    const report = await generateComprehensiveReport();
    
    log('🎉 测试套件执行完成');
    log('📊 测试结果总结:', {
      successRate: report.summary.successRate + '%',
      passedTests: report.summary.passed,
      failedTests: report.summary.failed,
      criticalIssues: report.summary.criticalIssues
    });
    
    // 显示关键发现
    if (report.summary.criticalIssues > 0) {
      log('🚨 发现关键问题:');
      report.summary.issues
        .filter(i => i.severity === 'critical')
        .forEach(issue => {
          log(`   - ${issue.description}`, { details: issue.details });
        });
    }
    
    if (report.summary.highPriorityRecommendations > 0) {
      log('💡 关键修复建议:');
      report.summary.recommendations
        .filter(r => r.priority === 'high')
        .forEach(rec => {
          log(`   - ${rec.action}`, { category: rec.category, details: rec.details });
        });
    }
    
    log('📁 完整测试数据:', DEBUG_OUTPUT_DIR);
    
  } catch (error) {
    log('❌ 测试套件执行失败', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  test1_validateToolConversion,
  test2_directGeminiAPICall,
  test3_analyzeResponseAndGenerateFixes,
  generateComprehensiveReport,
  cleanJsonSchemaForGemini,
  convertAnthropicToolsToGemini
};