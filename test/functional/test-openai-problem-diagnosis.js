#!/usr/bin/env node
/**
 * OpenAI问题定位诊断系统
 * 智能化识别OpenAI特有问题并提供自动化诊断建议
 * Project: Claude Code Router Enhanced
 * Author: Jason Zhang
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * OpenAI问题诊断系统
 * 基于已知问题模式和流水线数据进行智能诊断
 */
class OpenAIProblemDiagnosisSystem {
  constructor() {
    this.captureDir = '/tmp/openai-pipeline-captures';
    this.diagnosisPatterns = this.initializeDiagnosisPatterns();
    this.commonIssues = this.initializeCommonIssues();
    this.fixSuggestions = this.initializeFixSuggestions();
  }

  /**
   * 初始化诊断模式
   */
  initializeDiagnosisPatterns() {
    return {
      // 格式转换问题
      formatConversion: {
        anthropicToOpenAI: {
          systemPromptIssue: {
            pattern: (data) => {
              const step3 = data['step3-transformation'];
              return step3?.anthropicRequest?.system && !step3?.openaiRequest?.messages?.some(m => m.role === 'system');
            },
            severity: 'high',
            category: 'transformation'
          },
          toolFormatMismatch: {
            pattern: (data) => {
              const step3 = data['step3-transformation'];
              return step3?.anthropicRequest?.tools?.length > 0 && 
                     (!step3?.openaiRequest?.tools || step3.openaiRequest.tools.length === 0);
            },
            severity: 'high',
            category: 'tools'
          },
          messageStructureError: {
            pattern: (data) => {
              const step3 = data['step3-transformation'];
              return step3?.transformationChanges?.messageFormatChanged && 
                     !step3?.openaiRequest?.messages?.every(m => m.role && m.content);
            },
            severity: 'medium',
            category: 'transformation'
          }
        },
        openaiToAnthropic: {
          emptyContentBlocks: {
            pattern: (data) => {
              const step6 = data['step6-transformer-output'];
              return step6?.outputAnalysis?.contentBlocks === 0 || 
                     (step6?.anthropicResponse?.content?.length === 0);
            },
            severity: 'high',
            category: 'content'
          },
          toolCallLossIssue: {
            pattern: (data) => {
              const step4 = data['step4-raw-response'];
              const step6 = data['step6-transformer-output'];
              return step4?.responseAnalysis?.toolCallCount > 0 && 
                     step6?.outputAnalysis?.hasToolUseBlocks === 0;
            },
            severity: 'critical',
            category: 'tools'
          },
          usageInfoMissing: {
            pattern: (data) => {
              const step4 = data['step4-raw-response'];
              const step6 = data['step6-transformer-output'];
              return step4?.responseData?.usage && !step6?.anthropicResponse?.usage;
            },
            severity: 'low',
            category: 'metadata'
          }
        }
      },

      // 路由问题
      routing: {
        modelMappingError: {
          pattern: (data) => {
            const step1 = data['step1-input-processing'];
            const step2 = data['step2-routing'];
            const step6 = data['step6-transformer-output'];
            return step1?.originalRequest?.model !== step6?.anthropicResponse?.model;
          },
          severity: 'medium',
          category: 'routing'
        },
        providerSelectionIssue: {
          pattern: (data) => {
            const step2 = data['step2-routing'];
            const step4 = data['step4-raw-response'];
            return step2?.selectedProvider && (!step4 || step4.responseAnalysis?.hasContent === false);
          },
          severity: 'high',
          category: 'provider'
        },
        categoryMisclassification: {
          pattern: (data) => {
            const step1 = data['step1-input-processing'];
            const step2 = data['step2-routing'];
            // 检查是否有工具但未分类为search
            return step1?.toolCount > 0 && step2?.category !== 'search';
          },
          severity: 'medium',
          category: 'routing'
        }
      },

      // API响应问题
      apiResponse: {
        emptyResponse: {
          pattern: (data) => {
            const step4 = data['step4-raw-response'];
            return step4 && (!step4.responseAnalysis?.hasContent || step4.responseAnalysis?.contentLength === 0);
          },
          severity: 'critical',
          category: 'api'
        },
        malformedResponse: {
          pattern: (data) => {
            const step5 = data['step5-transformer-input'];
            return step5 && !step5.inputAnalysis?.isValidOpenAI;
          },
          severity: 'high',
          category: 'api'
        },
        incompleteResponse: {
          pattern: (data) => {
            const step4 = data['step4-raw-response'];
            return step4?.responseAnalysis?.finishReason === null || 
                   step4?.responseAnalysis?.finishReason === 'length';
          },
          severity: 'medium',
          category: 'api'
        }
      },

      // 流式处理问题
      streaming: {
        eventParsingError: {
          pattern: (data) => {
            // 检查是否是流式请求但响应处理有问题
            const step1 = data['step1-input-processing'];
            const step6 = data['step6-transformer-output'];
            return step1?.originalRequest?.stream && 
                   step6?.outputAnalysis?.contentBlocks === 0;
          },
          severity: 'high',
          category: 'streaming'
        },
        bufferingIssue: {
          pattern: (data) => {
            const step4 = data['step4-raw-response'];
            return step4?.isStreaming && step4?.responseAnalysis?.hasContent === false;
          },
          severity: 'medium',
          category: 'streaming'
        }
      }
    };
  }

  /**
   * 初始化常见问题库
   */
  initializeCommonIssues() {
    return {
      'tool-calls-as-text': {
        description: 'Tool calls are being converted to text instead of tool_use blocks',
        symptoms: [
          'Tool calls appear in text content',
          'No tool_use blocks in final response',
          'OpenAI response has tool_calls but Anthropic response only has text'
        ],
        causes: [
          'Streaming parser not recognizing tool call format',
          'Buffer processing not handling tool calls correctly',
          'Unknown event type containing tool calls'
        ],
        impact: 'Critical - Tools cannot be executed properly'
      },

      'empty-response': {
        description: 'API returns empty or no content',
        symptoms: [
          'Content length is 0',
          'No content blocks in final response',
          'Valid request but empty result'
        ],
        causes: [
          'API rate limiting',
          'Invalid request format',
          'Model configuration issues',
          'Content filtering'
        ],
        impact: 'Critical - No usable response for user'
      },

      'model-mapping-inconsistency': {
        description: 'Model names inconsistent across the pipeline',
        symptoms: [
          'Input model differs from output model',
          'Model mapping not applied correctly',
          'Provider model not matching expected model'
        ],
        causes: [
          'Routing engine not applying model mapping',
          'Response transformer not preserving original model',
          'Provider returning unexpected model name'
        ],
        impact: 'Medium - Confuses users about which model was used'
      },

      'format-conversion-failure': {
        description: 'Conversion between Anthropic and OpenAI formats fails',
        symptoms: [
          'System prompt missing in OpenAI request',
          'Tools not converted properly',
          'Message structure incorrect'
        ],
        causes: [
          'Transformer logic bugs',
          'Unsupported message types',
          'Schema validation errors'
        ],
        impact: 'High - Request may fail or behave unexpectedly'
      },

      'streaming-buffer-incomplete': {
        description: 'Streaming response buffering incomplete or incorrect',
        symptoms: [
          'Partial content in final response',
          'Event parsing errors',
          'Streaming timeout issues'
        ],
        causes: [
          'Buffer size limits',
          'Network interruptions',
          'Event parsing logic errors'
        ],
        impact: 'Medium - User gets incomplete response'
      }
    };
  }

  /**
   * 初始化修复建议
   */
  initializeFixSuggestions() {
    return {
      'tool-calls-as-text': [
        {
          action: 'Enable full buffering',
          description: 'Use complete buffering approach instead of streaming parsing',
          code: `// Switch to buffered processing
const anthropicEvents = processBufferedResponse(responseBuffer, requestId, request.model);`,
          priority: 'high'
        },
        {
          action: 'Add tool call text detection',
          description: 'Add pattern matching for tool calls in unknown events',
          code: `// Add tool call detection
if (text.includes('Tool call:') && text.includes('({')) {
  return convertToolCallTextToEvent(text);
}`,
          priority: 'medium'
        }
      ],

      'empty-response': [
        {
          action: 'Add response validation',
          description: 'Validate API response before processing',
          code: `// Validate response
if (!response.choices || response.choices.length === 0) {
  throw new Error('Empty API response');
}`,
          priority: 'high'
        },
        {
          action: 'Implement retry logic',
          description: 'Retry requests for empty responses',
          code: `// Retry on empty response
if (isEmpty(response)) {
  return await retryRequest(request, attempt + 1);
}`,
          priority: 'medium'
        }
      ],

      'model-mapping-inconsistency': [
        {
          action: 'Fix model mapping timing',
          description: 'Apply model mapping at routing stage, not response stage',
          code: `// Apply mapping at routing
request.model = targetModel;
request.metadata.originalModel = originalModel;`,
          priority: 'high'
        },
        {
          action: 'Preserve original model in response',
          description: 'Ensure response uses original model name',
          code: `// Preserve original model
response.model = request.metadata.originalModel || request.model;`,
          priority: 'medium'
        }
      ],

      'format-conversion-failure': [
        {
          action: 'Improve transformer logic',
          description: 'Add comprehensive format validation and conversion',
          code: `// Validate and convert
const converted = validateAndTransform(input, targetFormat);
if (!converted.valid) throw new Error(converted.errors);`,
          priority: 'high'
        },
        {
          action: 'Add fallback handling',
          description: 'Provide graceful degradation for unsupported formats',
          code: `// Fallback handling
if (!canConvert(input)) {
  return createFallbackResponse(input);
}`,
          priority: 'low'
        }
      ],

      'streaming-buffer-incomplete': [
        {
          action: 'Increase buffer limits',
          description: 'Increase streaming buffer size and timeout',
          code: `// Increase limits
const bufferSize = 1024 * 1024; // 1MB
const timeout = 300000; // 5 minutes`,
          priority: 'medium'
        },
        {
          action: 'Add buffer completion check',
          description: 'Verify buffer completeness before processing',
          code: `// Check completion
if (!isBufferComplete(buffer)) {
  await waitForCompletion(buffer, timeout);
}`,
          priority: 'high'
        }
      ]
    };
  }

  /**
   * 诊断会话数据
   */
  async diagnoseSession(sessionId) {
    console.log(`🔍 Diagnosing session: ${sessionId}`);
    
    // 加载会话数据
    const sessionData = await this.loadSessionData(sessionId);
    if (!sessionData) {
      return { error: 'Session data not found' };
    }

    // 执行所有诊断检查
    const diagnosisResults = {
      sessionId,
      timestamp: new Date().toISOString(),
      issues: [],
      warnings: [],
      recommendations: [],
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };

    // 运行模式匹配诊断
    await this.runPatternDiagnosis(sessionData, diagnosisResults);
    
    // 运行数据完整性检查
    await this.runDataIntegrityCheck(sessionData, diagnosisResults);
    
    // 运行性能分析
    await this.runPerformanceAnalysis(sessionData, diagnosisResults);
    
    // 生成修复建议
    await this.generateFixRecommendations(diagnosisResults);
    
    // 保存诊断报告
    await this.saveDiagnosisReport(sessionId, diagnosisResults);
    
    console.log(`📊 Diagnosis completed: ${diagnosisResults.issues.length} issues found`);
    return diagnosisResults;
  }

  /**
   * 加载会话数据
   */
  async loadSessionData(sessionId) {
    const sessionData = {};
    const steps = ['step1-input-processing', 'step2-routing', 'step3-transformation',
                   'step4-raw-response', 'step5-transformer-input', 'step6-transformer-output'];
    
    for (const step of steps) {
      const filename = `${sessionId}-${step}.json`;
      const filepath = path.join(this.captureDir, filename);
      
      try {
        const data = await fs.readFile(filepath, 'utf8');
        sessionData[step] = JSON.parse(data);
      } catch (error) {
        console.log(`⚠️ Missing ${step} data`);
      }
    }
    
    return Object.keys(sessionData).length > 0 ? sessionData : null;
  }

  /**
   * 运行模式匹配诊断
   */
  async runPatternDiagnosis(sessionData, results) {
    console.log('🔬 Running pattern diagnosis...');
    
    for (const [categoryName, category] of Object.entries(this.diagnosisPatterns)) {
      for (const [subName, subCategory] of Object.entries(category)) {
        if (typeof subCategory === 'object' && subCategory.pattern) {
          // 直接模式匹配
          await this.checkPattern(sessionData, results, `${categoryName}.${subName}`, subCategory);
        } else {
          // 嵌套模式匹配
          for (const [patternName, pattern] of Object.entries(subCategory)) {
            await this.checkPattern(sessionData, results, `${categoryName}.${subName}.${patternName}`, pattern);
          }
        }
      }
    }
  }

  /**
   * 检查单个模式
   */
  async checkPattern(sessionData, results, patternId, pattern) {
    try {
      const isMatch = pattern.pattern(sessionData);
      
      if (isMatch) {
        const issue = {
          id: patternId,
          severity: pattern.severity,
          category: pattern.category,
          description: this.getPatternDescription(patternId),
          detected: true,
          affectedSteps: this.getAffectedSteps(patternId, sessionData)
        };
        
        results.issues.push(issue);
        results.summary[pattern.severity]++;
        
        console.log(`❌ Issue detected: ${patternId} (${pattern.severity})`);
      }
    } catch (error) {
      console.log(`⚠️ Pattern check error for ${patternId}:`, error.message);
    }
  }

  /**
   * 获取模式描述
   */
  getPatternDescription(patternId) {
    const descriptions = {
      'formatConversion.anthropicToOpenAI.systemPromptIssue': 'System prompt not properly converted to OpenAI format',
      'formatConversion.anthropicToOpenAI.toolFormatMismatch': 'Tools not converted from Anthropic to OpenAI format',
      'formatConversion.anthropicToOpenAI.messageStructureError': 'Message structure invalid after conversion',
      'formatConversion.openaiToAnthropic.emptyContentBlocks': 'OpenAI response not converted to Anthropic content blocks',
      'formatConversion.openaiToAnthropic.toolCallLossIssue': 'Tool calls lost during OpenAI to Anthropic conversion',
      'formatConversion.openaiToAnthropic.usageInfoMissing': 'Usage information missing in Anthropic response',
      'routing.modelMappingError': 'Model mapping not preserved from input to output',
      'routing.providerSelectionIssue': 'Selected provider not returning valid response',
      'routing.categoryMisclassification': 'Request category incorrectly classified',
      'apiResponse.emptyResponse': 'API returned empty response',
      'apiResponse.malformedResponse': 'API response format is invalid',
      'apiResponse.incompleteResponse': 'API response appears to be incomplete',
      'streaming.eventParsingError': 'Streaming events not parsed correctly',
      'streaming.bufferingIssue': 'Streaming buffer processing failed'
    };
    
    return descriptions[patternId] || `Unknown issue: ${patternId}`;
  }

  /**
   * 获取受影响的步骤
   */
  getAffectedSteps(patternId, sessionData) {
    const stepMapping = {
      'formatConversion.anthropicToOpenAI': ['step3-transformation'],
      'formatConversion.openaiToAnthropic': ['step6-transformer-output'],
      'routing': ['step2-routing'],
      'apiResponse': ['step4-raw-response', 'step5-transformer-input'],
      'streaming': ['step4-raw-response', 'step6-transformer-output']
    };
    
    for (const [prefix, steps] of Object.entries(stepMapping)) {
      if (patternId.startsWith(prefix)) {
        return steps.filter(step => sessionData[step]);
      }
    }
    
    return [];
  }

  /**
   * 运行数据完整性检查
   */
  async runDataIntegrityCheck(sessionData, results) {
    console.log('🔬 Running data integrity check...');
    
    // 检查流水线完整性
    const expectedSteps = ['step1-input-processing', 'step2-routing', 'step3-transformation',
                          'step4-raw-response', 'step5-transformer-input', 'step6-transformer-output'];
    const missingSteps = expectedSteps.filter(step => !sessionData[step]);
    
    if (missingSteps.length > 0) {
      results.issues.push({
        id: 'pipeline.incomplete',
        severity: 'high',
        category: 'pipeline',
        description: `Pipeline incomplete: missing ${missingSteps.join(', ')}`,
        detected: true,
        affectedSteps: missingSteps
      });
      results.summary.high++;
    }

    // 检查数据一致性
    await this.checkDataConsistency(sessionData, results);
  }

  /**
   * 检查数据一致性
   */
  async checkDataConsistency(sessionData, results) {
    const step1 = sessionData['step1-input-processing'];
    const step2 = sessionData['step2-routing'];
    const step6 = sessionData['step6-transformer-output'];
    
    if (step1 && step6) {
      // 检查模型一致性
      const inputModel = step1.originalRequest?.model;
      const outputModel = step6.anthropicResponse?.model;
      
      if (inputModel !== outputModel) {
        results.warnings.push({
          id: 'consistency.model_mismatch',
          description: `Model inconsistency: input=${inputModel}, output=${outputModel}`,
          severity: 'medium'
        });
      }
      
      // 检查内容完整性
      const hasInputContent = step1.originalRequest?.messages?.some(m => m.content);
      const hasOutputContent = step6.outputAnalysis?.hasTextBlocks > 0;
      
      if (hasInputContent && !hasOutputContent) {
        results.issues.push({
          id: 'consistency.content_loss',
          severity: 'critical',
          category: 'content',
          description: 'Content lost during processing - input has content but output is empty',
          detected: true,
          affectedSteps: ['step6-transformer-output']
        });
        results.summary.critical++;
      }
    }
  }

  /**
   * 运行性能分析
   */
  async runPerformanceAnalysis(sessionData, results) {
    console.log('🔬 Running performance analysis...');
    
    // 检查响应时间（如果有时间戳）
    const timestamps = [];
    Object.values(sessionData).forEach(step => {
      if (step.timestamp) {
        timestamps.push(new Date(step.timestamp));
      }
    });
    
    if (timestamps.length >= 2) {
      const duration = timestamps[timestamps.length - 1] - timestamps[0];
      
      if (duration > 30000) { // 超过30秒
        results.warnings.push({
          id: 'performance.slow_processing',
          description: `Slow processing detected: ${duration}ms total duration`,
          severity: 'medium'
        });
      }
    }
    
    // 检查内容长度效率
    const step4 = sessionData['step4-raw-response'];
    const step6 = sessionData['step6-transformer-output'];
    
    if (step4 && step6) {
      const rawLength = step4.responseAnalysis?.contentLength || 0;
      const finalLength = step6.anthropicResponse?.content?.[0]?.text?.length || 0;
      
      if (rawLength > finalLength * 2) {
        results.warnings.push({
          id: 'performance.content_compression',
          description: `Significant content reduction: ${rawLength} → ${finalLength} characters`,
          severity: 'low'
        });
      }
    }
  }

  /**
   * 生成修复建议
   */
  async generateFixRecommendations(results) {
    console.log('💡 Generating fix recommendations...');
    
    for (const issue of results.issues) {
      const recommendations = this.getFixRecommendations(issue.id, issue.category);
      
      if (recommendations.length > 0) {
        results.recommendations.push({
          issueId: issue.id,
          severity: issue.severity,
          fixes: recommendations
        });
      }
    }
  }

  /**
   * 获取修复建议
   */
  getFixRecommendations(issueId, category) {
    // 基于问题ID和类别匹配修复建议
    const issuePatterns = {
      'toolCallLossIssue': 'tool-calls-as-text',
      'emptyResponse': 'empty-response',
      'modelMappingError': 'model-mapping-inconsistency',
      'systemPromptIssue': 'format-conversion-failure',
      'toolFormatMismatch': 'format-conversion-failure',
      'bufferingIssue': 'streaming-buffer-incomplete'
    };
    
    for (const [pattern, suggestionKey] of Object.entries(issuePatterns)) {
      if (issueId.includes(pattern)) {
        return this.fixSuggestions[suggestionKey] || [];
      }
    }
    
    // 基于类别的通用建议
    const categoryRecommendations = {
      'tools': this.fixSuggestions['tool-calls-as-text'],
      'api': this.fixSuggestions['empty-response'],
      'routing': this.fixSuggestions['model-mapping-inconsistency'],
      'transformation': this.fixSuggestions['format-conversion-failure'],
      'streaming': this.fixSuggestions['streaming-buffer-incomplete']
    };
    
    return categoryRecommendations[category] || [];
  }

  /**
   * 保存诊断报告
   */
  async saveDiagnosisReport(sessionId, results) {
    const reportPath = path.join(this.captureDir, `${sessionId}-diagnosis-report.json`);
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`📋 Diagnosis report saved: ${reportPath}`);
  }

  /**
   * 批量诊断多个会话
   */
  async batchDiagnosis() {
    console.log('🔄 Running batch diagnosis on all sessions...');
    
    try {
      const files = await fs.readdir(this.captureDir);
      const sessions = new Set();
      
      // 提取所有会话ID
      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('diagnosis-report')) {
          const sessionId = file.split('-')[0] + '-' + file.split('-')[1];
          sessions.add(sessionId);
        }
      }
      
      const results = [];
      
      for (const sessionId of sessions) {
        console.log(`\n🔍 Diagnosing session: ${sessionId}`);
        const diagnosis = await this.diagnoseSession(sessionId);
        results.push(diagnosis);
      }
      
      // 生成批量报告
      const batchReport = {
        timestamp: new Date().toISOString(),
        sessionsAnalyzed: results.length,
        overallSummary: {
          critical: results.reduce((sum, r) => sum + r.summary.critical, 0),
          high: results.reduce((sum, r) => sum + r.summary.high, 0),
          medium: results.reduce((sum, r) => sum + r.summary.medium, 0),
          low: results.reduce((sum, r) => sum + r.summary.low, 0)
        },
        commonIssues: this.identifyCommonIssues(results),
        sessions: results
      };
      
      const batchReportPath = path.join(this.captureDir, `batch-diagnosis-${Date.now()}.json`);
      await fs.writeFile(batchReportPath, JSON.stringify(batchReport, null, 2));
      
      console.log(`\n📊 Batch diagnosis completed:`);
      console.log(`   Sessions analyzed: ${results.length}`);
      console.log(`   Critical issues: ${batchReport.overallSummary.critical}`);
      console.log(`   High priority issues: ${batchReport.overallSummary.high}`);
      console.log(`   Report saved: ${batchReportPath}`);
      
      return batchReport;
      
    } catch (error) {
      console.error('❌ Batch diagnosis failed:', error);
      throw error;
    }
  }

  /**
   * 识别常见问题
   */
  identifyCommonIssues(results) {
    const issueFrequency = {};
    
    results.forEach(result => {
      result.issues.forEach(issue => {
        if (!issueFrequency[issue.id]) {
          issueFrequency[issue.id] = {
            count: 0,
            severity: issue.severity,
            category: issue.category,
            description: issue.description
          };
        }
        issueFrequency[issue.id].count++;
      });
    });
    
    // 返回出现频率最高的前5个问题
    return Object.entries(issueFrequency)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5)
      .map(([id, data]) => ({
        issueId: id,
        frequency: data.count,
        percentage: Math.round((data.count / results.length) * 100),
        severity: data.severity,
        category: data.category,
        description: data.description
      }));
  }

  /**
   * 生成诊断摘要
   */
  generateDiagnosisSummary(results) {
    console.log('\n📋 Diagnosis Summary:');
    console.log(`   Session: ${results.sessionId}`);
    console.log(`   Total issues: ${results.issues.length}`);
    console.log(`   Critical: ${results.summary.critical}`);
    console.log(`   High: ${results.summary.high}`);
    console.log(`   Medium: ${results.summary.medium}`);
    console.log(`   Low: ${results.summary.low}`);
    
    if (results.issues.length > 0) {
      console.log('\n🔴 Issues found:');
      results.issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🚨' : 
                    issue.severity === 'high' ? '❌' : 
                    issue.severity === 'medium' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} [${issue.severity.toUpperCase()}] ${issue.description}`);
      });
    }
    
    if (results.recommendations.length > 0) {
      console.log('\n💡 Fix recommendations:');
      results.recommendations.forEach(rec => {
        console.log(`   🔧 ${rec.issueId}:`);
        rec.fixes.forEach(fix => {
          console.log(`      • ${fix.action} (${fix.priority} priority)`);
        });
      });
    }
  }
}

/**
 * 运行诊断演示
 */
async function runDiagnosisDemo() {
  console.log('🩺 OpenAI Problem Diagnosis System Demo\n');
  
  const diagnosisSystem = new OpenAIProblemDiagnosisSystem();
  
  try {
    // 运行批量诊断
    const batchResults = await diagnosisSystem.batchDiagnosis();
    
    if (batchResults.sessions.length > 0) {
      console.log('\n🎯 Most recent session diagnosis:');
      const latestSession = batchResults.sessions[batchResults.sessions.length - 1];
      diagnosisSystem.generateDiagnosisSummary(latestSession);
      
      console.log('\n📊 Common issues across all sessions:');
      batchResults.commonIssues.forEach(issue => {
        console.log(`   🔸 ${issue.description} (${issue.percentage}% of sessions)`);
      });
    } else {
      console.log('\n⚠️ No sessions found to diagnose. Run data capture first.');
    }
    
  } catch (error) {
    console.error('❌ Diagnosis demo failed:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runDiagnosisDemo()
    .then(() => {
      console.log('\n✅ Diagnosis system demo completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Diagnosis system demo failed:', error);
      process.exit(1);
    });
}

module.exports = { OpenAIProblemDiagnosisSystem, runDiagnosisDemo };