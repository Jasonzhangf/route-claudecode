#!/usr/bin/env node

/**
 * Gemini工具调用流水线调试系统
 * 深度分析Anthropic → Gemini转换流程中的问题
 * 项目所有者：Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// 配置路径
const CONFIG_PATH = path.join(process.env.HOME, '.route-claude-code', 'config-router.json');
const DEBUG_OUTPUT_DIR = `/tmp/gemini-tool-debug-${Date.now()}`;

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

function saveStageData(stage, data, filename = null) {
  const stageName = filename || `stage-${stage}-${Date.now()}.json`;
  const filePath = path.join(DEBUG_OUTPUT_DIR, stageName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  log(`📄 Stage ${stage} data saved: ${filePath}`);
  return filePath;
}

/**
 * 阶段1: 分析Anthropic工具定义
 */
async function stage1_analyzeAnthropicTools() {
  log('🔍 Stage 1: 分析Anthropic工具定义格式');
  
  // 标准Anthropic工具定义
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
  
  log('✅ Anthropic工具定义结构分析完成', {
    toolCount: anthropicTools.length,
    hasComplexSchema: anthropicTools[0].input_schema.properties.todos.items.properties,
    unsupportedFields: ['$schema', 'additionalProperties', 'minLength']
  });
  
  return saveStageData(1, anthropicTools, 'anthropic-tools.json');
}

/**
 * 阶段2: 测试当前的Gemini转换逻辑（独立实现）
 */
async function stage2_testCurrentGeminiConversion() {
  log('🔧 Stage 2: 测试Gemini转换逻辑（独立实现）');
  
  try {
    // 读取阶段1的数据
    const anthropicToolsPath = path.join(DEBUG_OUTPUT_DIR, 'anthropic-tools.json');
    const anthropicTools = JSON.parse(fs.readFileSync(anthropicToolsPath, 'utf8'));
    
    // 构建测试请求
    const testRequest = {
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'Please create a todo item for testing'
        }
      ],
      tools: anthropicTools,
      max_tokens: 1000
    };
    
    // 独立实现转换逻辑来测试当前行为
    const geminiRequest = convertToGeminiFormatTest(testRequest);
    
    log('✅ Gemini格式转换完成', {
      hasTools: !!geminiRequest.tools,
      toolsFormat: Array.isArray(geminiRequest.tools) ? 'array' : 'object',
      toolsLength: geminiRequest.tools?.length || 0,
      contentsLength: geminiRequest.contents?.length || 0
    });
    
    // 详细分析转换结果
    const analysisResult = {
      original: testRequest,
      converted: geminiRequest,
      analysis: {
        toolsCorrectFormat: Array.isArray(geminiRequest.tools),
        hasFunctionDeclarations: !!(geminiRequest.tools?.[0]?.functionDeclarations),
        functionCount: geminiRequest.tools?.[0]?.functionDeclarations?.length || 0,
        schemaFields: geminiRequest.tools?.[0]?.functionDeclarations?.[0]?.parameters ? 
          Object.keys(geminiRequest.tools[0].functionDeclarations[0].parameters) : [],
        removedFields: ['$schema', 'additionalProperties', 'minLength'] // 应该被清理的字段
      }
    };
    
    return saveStageData(2, analysisResult, 'gemini-conversion-analysis.json');
    
  } catch (error) {
    log('❌ Gemini转换测试失败', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * 独立实现的Gemini转换逻辑（基于源码重现）
 */
function convertToGeminiFormatTest(request) {
  const geminiRequest = {
    contents: convertMessagesTest(request.messages),
    generationConfig: {
      maxOutputTokens: request.max_tokens || 4096
    }
  };

  // Add temperature if specified
  if (request.temperature !== undefined) {
    geminiRequest.generationConfig.temperature = request.temperature;
  }

  // Handle tools if present
  const tools = request.tools || request.metadata?.tools;
  if (tools && Array.isArray(tools) && tools.length > 0) {
    // 🔧 修复: Gemini API正确的工具格式是tools数组，不是单个对象
    geminiRequest.tools = [convertToolsTest(tools)];
    log('🔧 Tools converted for Gemini request (fixed format)', {
      toolCount: tools.length,
      toolNames: tools.map((t) => t.name),
      geminiToolsFormat: 'array with functionDeclarations object'
    });
  }

  return geminiRequest;
}

function convertMessagesTest(messages) {
  const contents = [];
  
  for (const message of messages) {
    // 处理不同类型的content格式
    let textContent;
    
    if (typeof message.content === 'string') {
      textContent = message.content;
    } else if (Array.isArray(message.content)) {
      // Anthropic格式：content是一个数组，提取text类型的内容
      textContent = message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    } else if (message.content && typeof message.content === 'object') {
      // 其他对象格式
      textContent = message.content.text || JSON.stringify(message.content);
    } else {
      textContent = String(message.content || '');
    }
    
    if (message.role === 'system') {
      // System messages are treated as user messages in Gemini
      contents.push({
        role: 'user',
        parts: [{ text: textContent }]
      });
    } else if (message.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: textContent }]
      });
    } else if (message.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: textContent }]
      });
    }
  }

  return contents;
}

function convertToolsTest(tools) {
  // Convert Anthropic/OpenAI tools to Gemini function declarations
  const functionDeclarations = tools.map(tool => {
    // Handle both Anthropic format (tool.input_schema) and OpenAI format (tool.function.parameters)
    const rawParameters = tool.input_schema || tool.function?.parameters || {};
    
    // 🔧 Critical Fix: Clean JSON Schema for Gemini API compatibility
    const parameters = cleanJsonSchemaForGeminiTest(rawParameters);
    
    return {
      name: tool.name,
      description: tool.description || tool.function?.description || '',
      parameters: parameters
    };
  });
  
  return {
    functionDeclarations: functionDeclarations
  };
}

/**
 * Clean JSON Schema object for Gemini API compatibility
 * 基于源码的独立实现
 */
function cleanJsonSchemaForGeminiTest(schema) {
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
          cleaned[key][propKey] = cleanJsonSchemaForGeminiTest(propValue);
        }
      } else if (key === 'items' && typeof value === 'object') {
        // Recursively clean array items schema
        cleaned[key] = cleanJsonSchemaForGeminiTest(value);
      } else {
        cleaned[key] = value;
      }
    }
    // Skip unsupported fields like: additionalProperties, $schema, minItems, maxItems, etc.
  }
  
  return cleaned;
}

/**
 * 阶段3: 对比官方Gemini工具格式
 */
async function stage3_compareWithOfficialFormat() {
  log('📚 Stage 3: 对比官方Gemini工具格式');
  
  // 基于官方文档的正确格式
  const officialGeminiFormat = {
    tools: [
      {
        functionDeclarations: [
          {
            name: 'TodoWrite',
            description: 'Create and manage todo items',
            parameters: {
              type: 'object',
              properties: {
                todos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      content: { type: 'string', description: 'Todo content' },
                      status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      id: { type: 'string', description: 'Unique identifier' }
                    },
                    required: ['content', 'status', 'priority', 'id']
                    // 注意：没有additionalProperties
                  }
                }
              },
              required: ['todos']
              // 注意：没有$schema, additionalProperties等字段
            }
          }
        ]
      }
    ]
  };
  
  // 读取阶段2的转换结果
  const stage2Path = path.join(DEBUG_OUTPUT_DIR, 'gemini-conversion-analysis.json');
  const stage2Data = JSON.parse(fs.readFileSync(stage2Path, 'utf8'));
  
  const currentConversion = stage2Data.converted;
  
  // 详细对比
  const comparison = {
    official: officialGeminiFormat,
    current: currentConversion,
    differences: {
      toolsStructure: {
        official: 'tools[0].functionDeclarations[]',
        current: currentConversion.tools ? 
          `tools[${currentConversion.tools.length}].functionDeclarations[${currentConversion.tools[0]?.functionDeclarations?.length || 0}]` : 'missing'
      },
      schemaFields: {
        official: ['type', 'properties', 'required', 'items', 'description', 'enum'],
        current: currentConversion.tools?.[0]?.functionDeclarations?.[0]?.parameters ? 
          Object.keys(currentConversion.tools[0].functionDeclarations[0].parameters) : []
      },
      potentialIssues: []
    }
  };
  
  // 检查潜在问题
  if (!Array.isArray(currentConversion.tools)) {
    comparison.differences.potentialIssues.push('tools field is not an array');
  }
  
  if (!currentConversion.tools?.[0]?.functionDeclarations) {
    comparison.differences.potentialIssues.push('missing functionDeclarations in tools[0]');
  }
  
  // 检查是否有不支持的字段
  const currentParams = currentConversion.tools?.[0]?.functionDeclarations?.[0]?.parameters;
  if (currentParams) {
    const unsupportedFields = Object.keys(currentParams).filter(key => 
      !['type', 'properties', 'required', 'items', 'description', 'enum'].includes(key)
    );
    if (unsupportedFields.length > 0) {
      comparison.differences.potentialIssues.push(`unsupported schema fields: ${unsupportedFields.join(', ')}`);
    }
  }
  
  log('✅ 格式对比完成', {
    issuesFound: comparison.differences.potentialIssues.length,
    issues: comparison.differences.potentialIssues
  });
  
  return saveStageData(3, comparison, 'format-comparison.json');
}

/**
 * 阶段4: 测试直接Gemini API调用
 */
async function stage4_testDirectGeminiAPI() {
  log('🌐 Stage 4: 测试直接Gemini API调用');
  
  // 读取配置获取真实API密钥
  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (error) {
    log('⚠️ 无法读取配置文件，跳过直接API测试', { error: error.message });
    return null;
  }
  
  // 查找Gemini provider配置
  const geminiProvider = Object.values(config.providers || {}).find(p => 
    p.endpoint?.includes('googleapis.com') || p.type === 'gemini'
  );
  
  if (!geminiProvider?.authentication?.credentials?.api_key) {
    log('⚠️ 未找到Gemini API密钥，跳过直接API测试');
    return null;
  }
  
  // 读取阶段3的官方格式
  const stage3Path = path.join(DEBUG_OUTPUT_DIR, 'format-comparison.json');
  const stage3Data = JSON.parse(fs.readFileSync(stage3Path, 'utf8'));
  
  const testPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Please create a todo item for testing tools' }]
      }
    ],
    tools: stage3Data.official.tools,
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.1
    }
  };
  
  try {
    const apiKey = Array.isArray(geminiProvider.authentication.credentials.api_key) ? 
      geminiProvider.authentication.credentials.api_key[0] : 
      geminiProvider.authentication.credentials.api_key;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    log('🚀 发送直接API请求到Gemini', {
      url: url.replace(apiKey, '***' + apiKey.slice(-4)),
      hasTools: !!testPayload.tools,
      toolCount: testPayload.tools[0]?.functionDeclarations?.length || 0
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      log('❌ API响应不是有效JSON', { responseText });
      return saveStageData(4, { 
        error: 'invalid_json_response',
        responseText,
        status: response.status 
      }, 'direct-api-error.json');
    }
    
    const apiResult = {
      request: testPayload,
      response: {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      },
      analysis: {
        success: response.ok,
        hasContent: !!(responseData.candidates?.[0]?.content?.parts?.length),
        hasToolCalls: !!(responseData.candidates?.[0]?.content?.parts?.some(p => p.functionCall)),
        isEmpty: !responseData.candidates?.[0]?.content?.parts?.[0]?.text,
        finishReason: responseData.candidates?.[0]?.finishReason
      }
    };
    
    log(response.ok ? '✅ Gemini API调用成功' : '❌ Gemini API调用失败', apiResult.analysis);
    
    return saveStageData(4, apiResult, 'direct-api-result.json');
    
  } catch (error) {
    log('❌ 直接API调用失败', {
      error: error.message,
      stack: error.stack
    });
    
    return saveStageData(4, {
      error: 'api_call_failed',
      message: error.message,
      stack: error.stack
    }, 'direct-api-error.json');
  }
}

/**
 * 阶段5: 测试通过Claude Code Router的完整流程
 */
async function stage5_testFullPipeline() {
  log('🔄 Stage 5: 测试完整Claude Code Router流程');
  
  const testRequest = {
    model: 'claude-sonnet-4-20250514', // 会被路由到gemini
    messages: [
      {
        role: 'user',
        content: 'Please create a todo item with content "Debug Gemini tools", status "in_progress", priority "high", and id "debug-1"'
      }
    ],
    tools: [
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
    ],
    max_tokens: 1000,
    stream: false
  };
  
  try {
    log('🚀 发送请求到Claude Code Router', {
      model: testRequest.model,
      hasTools: !!testRequest.tools,
      toolCount: testRequest.tools.length
    });
    
    const response = await fetch('http://localhost:3456/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key'
      },
      body: JSON.stringify(testRequest)
    });
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      log('❌ Router响应不是有效JSON', { responseText });
      return saveStageData(5, {
        error: 'invalid_json_response',
        responseText,
        status: response.status
      }, 'router-error.json');
    }
    
    const pipelineResult = {
      request: testRequest,
      response: {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      },
      analysis: {
        success: response.ok,
        hasContent: !!(responseData.content?.length),
        hasTextContent: !!(responseData.content?.some(c => c.type === 'text' && c.text)),
        hasToolUse: !!(responseData.content?.some(c => c.type === 'tool_use')),
        isEmpty: !!(responseData.content?.some(c => c.type === 'text' && (!c.text || c.text.trim() === ''))),
        contentBlocks: responseData.content?.length || 0,
        model: responseData.model
      }
    };
    
    log(response.ok ? '✅ 完整流程测试完成' : '❌ 完整流程测试失败', pipelineResult.analysis);
    
    // 如果发现空响应问题，进行更深入分析
    if (pipelineResult.analysis.isEmpty) {
      log('🔍 检测到空响应问题，进行深入分析');
      pipelineResult.diagnosis = {
        issue: 'empty_text_response',
        possibleCauses: [
          'Gemini API返回空内容',
          'JSON Schema兼容性问题',
          'Content Safety过滤',
          'API密钥配额限制',
          '工具格式错误导致API拒绝'
        ],
        nextSteps: [
          '检查直接Gemini API调用结果（Stage 4）',
          '对比工具格式转换差异（Stage 3）',
          '验证API密钥状态',
          '测试简化的工具定义'
        ]
      };
    }
    
    return saveStageData(5, pipelineResult, 'full-pipeline-result.json');
    
  } catch (error) {
    log('❌ 完整流程测试失败', {
      error: error.message,
      stack: error.stack
    });
    
    return saveStageData(5, {
      error: 'pipeline_test_failed',
      message: error.message,
      stack: error.stack
    }, 'pipeline-error.json');
  }
}

/**
 * 阶段6: 生成综合诊断报告和修复建议
 */
async function stage6_generateDiagnosisReport() {
  log('📋 Stage 6: 生成综合诊断报告');
  
  const reportData = {
    timestamp: new Date().toISOString(),
    debugOutputDir: DEBUG_OUTPUT_DIR,
    stages: {},
    overallAnalysis: {},
    recommendations: []
  };
  
  // 收集所有阶段的数据
  const stageFiles = [
    { stage: 1, file: 'anthropic-tools.json' },
    { stage: 2, file: 'gemini-conversion-analysis.json' },
    { stage: 3, file: 'format-comparison.json' },
    { stage: 4, file: 'direct-api-result.json' },
    { stage: 5, file: 'full-pipeline-result.json' }
  ];
  
  for (const { stage, file } of stageFiles) {
    const filePath = path.join(DEBUG_OUTPUT_DIR, file);
    if (fs.existsSync(filePath)) {
      try {
        reportData.stages[`stage${stage}`] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        log(`⚠️ 无法读取Stage ${stage}数据: ${error.message}`);
        reportData.stages[`stage${stage}`] = { error: error.message };
      }
    }
  }
  
  // 综合分析
  const stage3Data = reportData.stages.stage3;
  const stage4Data = reportData.stages.stage4;
  const stage5Data = reportData.stages.stage5;
  
  if (stage3Data?.differences?.potentialIssues?.length > 0) {
    reportData.overallAnalysis.formatIssues = stage3Data.differences.potentialIssues;
    reportData.recommendations.push({
      priority: 'high',
      category: 'format_conversion',
      issue: 'JSON Schema compatibility issues',
      action: 'Update cleanJsonSchemaForGemini() to remove all unsupported fields',
      details: stage3Data.differences.potentialIssues
    });
  }
  
  if (stage4Data?.analysis?.success === false) {
    reportData.overallAnalysis.apiCallFailed = true;
    reportData.recommendations.push({
      priority: 'high',
      category: 'api_integration',
      issue: 'Direct Gemini API call failed',
      action: 'Check API key validity and tool format compatibility',
      details: stage4Data.response?.data || stage4Data.error
    });
  }
  
  if (stage5Data?.analysis?.isEmpty) {
    reportData.overallAnalysis.emptyResponse = true;
    reportData.recommendations.push({
      priority: 'high',
      category: 'response_handling',
      issue: 'Empty text response from Gemini',
      action: 'Improve empty response handling and add fallback content',
      details: stage5Data.diagnosis
    });
  }
  
  // 如果直接API成功但Router失败，说明是转换问题
  if (stage4Data?.analysis?.success && stage5Data?.analysis?.isEmpty) {
    reportData.recommendations.push({
      priority: 'critical',
      category: 'conversion_logic',
      issue: 'Direct API works but Router produces empty response',
      action: 'Fix Anthropic-to-Gemini conversion and response parsing logic',
      details: 'The issue is in the conversion pipeline, not the Gemini API itself'
    });
  }
  
  log('✅ 诊断报告生成完成', {
    stagesAnalyzed: Object.keys(reportData.stages).length,
    issuesFound: reportData.recommendations.length,
    criticalIssues: reportData.recommendations.filter(r => r.priority === 'critical').length
  });
  
  return saveStageData(6, reportData, 'comprehensive-diagnosis.json');
}

/**
 * 主执行函数
 */
async function main() {
  log('🚀 Gemini工具调用流水线调试开始');
  log('📁 调试输出目录:', DEBUG_OUTPUT_DIR);
  
  try {
    // 按顺序执行所有阶段
    await stage1_analyzeAnthropicTools();
    await stage2_testCurrentGeminiConversion();
    await stage3_compareWithOfficialFormat();
    await stage4_testDirectGeminiAPI();
    await stage5_testFullPipeline();
    const reportPath = await stage6_generateDiagnosisReport();
    
    log('🎉 调试流水线执行完成');
    log('📋 综合诊断报告:', reportPath);
    log('📁 所有调试数据:', DEBUG_OUTPUT_DIR);
    
    // 读取并显示关键发现
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (report.recommendations.length > 0) {
      log('🔧 关键修复建议:');
      report.recommendations.forEach((rec, index) => {
        log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.issue}`);
        log(`   Action: ${rec.action}`);
      });
    }
    
  } catch (error) {
    log('❌ 调试流水线执行失败', {
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
  stage1_analyzeAnthropicTools,
  stage2_testCurrentGeminiConversion,
  stage3_compareWithOfficialFormat,
  stage4_testDirectGeminiAPI,
  stage5_testFullPipeline,
  stage6_generateDiagnosisReport
};