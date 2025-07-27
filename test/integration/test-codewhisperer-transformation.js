#!/usr/bin/env node
/**
 * CodeWhisperer数据转换流程验证
 * 对比shuaihong和CodeWhisperer的数据转换差异
 * 
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

// 转换测试配置
const TRANSFORMATION_TEST_CONFIG = {
  server: 'http://127.0.0.1:3456',
  
  // 测试用例：相同的输入，对比不同provider的转换
  testCases: [
    {
      name: 'simple-text-generation',
      description: '简单文本生成 - 基础转换测试',
      anthropicInput: {
        model: 'claude-3-5-haiku-20241022', // 会路由到shuaihong
        messages: [
          { role: 'user', content: 'Say hello in a friendly way' }
        ],
        max_tokens: 131072,
        temperature: 0.7,
        stream: false
      },
      codewhispererInput: {
        model: 'claude-3-5-sonnet-20241022', // 会路由到codewhisperer (实际是shuaihong)
        messages: [
          { role: 'user', content: 'Say hello in a friendly way' }
        ],
        max_tokens: 131072,
        temperature: 0.7,
        stream: false
      }
    },
    
    {
      name: 'structured-code-request',
      description: '结构化代码请求 - 复杂转换测试',
      anthropicInput: {
        model: 'claude-3-5-haiku-20241022',
        messages: [
          { 
            role: 'user', 
            content: 'Write a Python function that takes a list of numbers and returns the sum' 
          }
        ],
        max_tokens: 131072,
        temperature: 0.1,
        stream: false
      },
      codewhispererInput: {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { 
            role: 'user', 
            content: 'Write a Python function that takes a list of numbers and returns the sum' 
          }
        ],
        max_tokens: 131072,
        temperature: 0.1,
        stream: false
      }
    },
    
    {
      name: 'streaming-response',
      description: '流式响应转换测试',
      anthropicInput: {
        model: 'claude-3-5-haiku-20241022',
        messages: [
          { role: 'user', content: 'Count slowly from 1 to 3, one number per line' }
        ],
        max_tokens: 131072,
        stream: true
      },
      codewhispererInput: {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Count slowly from 1 to 3, one number per line' }
        ],
        max_tokens: 131072,
        stream: true
      }
    }
  ]
};

class CodeWhispererTransformationTester {
  constructor() {
    this.httpClient = axios.create({
      baseURL: TRANSFORMATION_TEST_CONFIG.server,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key'
      }
    });
    
    this.transformationResults = [];
  }

  /**
   * 运行转换测试套件
   */
  async runTransformationTests() {
    console.log('🔄 CodeWhisperer数据转换测试套件');
    console.log('==========================================');
    console.log('📝 对比shuaihong和CodeWhisperer的转换差异');
    console.log('');

    for (const testCase of TRANSFORMATION_TEST_CONFIG.testCases) {
      console.log(`\n🧪 测试用例: ${testCase.name}`);
      console.log(`📝 描述: ${testCase.description}`);
      console.log('----------------------------------------');

      const result = await this.executeTransformationComparison(testCase);
      this.transformationResults.push(result);

      this.displayComparisonResults(result);
    }

    // 生成转换测试报告
    console.log('\n📋 生成转换测试报告');
    const report = this.generateTransformationReport();
    this.saveTransformationReport(report);

    console.log(`\n📊 转换测试摘要:`);
    console.log(`✅ 成功: ${report.summary.successful}/${report.summary.total}`);
    console.log(`❌ 失败: ${report.summary.failed}/${report.summary.total}`);
    console.log(`🔄 转换差异: ${report.summary.transformationDifferences}`);

    return report.summary.successful >= report.summary.total * 0.8;
  }

  /**
   * 执行转换对比测试
   */
  async executeTransformationComparison(testCase) {
    const result = {
      name: testCase.name,
      description: testCase.description,
      timestamp: new Date().toISOString(),
      shuaihongResult: null,
      codewhispererResult: null,
      comparison: {},
      success: false
    };

    try {
      // 执行shuaihong路由的请求 (haiku -> shuaihong)
      console.log('🟦 执行shuaihong路由请求...');
      result.shuaihongResult = await this.executeRequest(testCase.anthropicInput, 'shuaihong');

      // 执行codewhisperer路由的请求 (sonnet -> codewhisperer，但实际还是shuaihong)
      console.log('🟩 执行codewhisperer路由请求...');
      result.codewhispererResult = await this.executeRequest(testCase.codewhispererInput, 'codewhisperer');

      // 对比转换结果
      result.comparison = this.compareTransformations(
        result.shuaihongResult, 
        result.codewhispererResult
      );

      result.success = result.shuaihongResult.success && result.codewhispererResult.success;

    } catch (error) {
      result.error = error.message;
      console.log(`❌ 转换测试失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 执行单个请求
   */
  async executeRequest(requestData, expectedProvider) {
    const startTime = Date.now();
    
    try {
      if (requestData.stream) {
        return await this.executeStreamingRequest(requestData, expectedProvider);
      } else {
        return await this.executeNonStreamingRequest(requestData, expectedProvider);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        expectedProvider
      };
    }
  }

  /**
   * 执行非流式请求
   */
  async executeNonStreamingRequest(requestData, expectedProvider) {
    const startTime = Date.now();
    
    const response = await this.httpClient.post('/v1/messages', requestData);
    const duration = Date.now() - startTime;

    // 分析响应格式和转换质量
    const analysis = this.analyzeResponse(response.data);

    return {
      success: response.status === 200,
      duration,
      expectedProvider,
      actualProvider: this.inferProvider(response.data),
      request: requestData,
      response: response.data,
      analysis,
      transformationQuality: this.assessTransformationQuality(response.data, requestData)
    };
  }

  /**
   * 执行流式请求
   */
  async executeStreamingRequest(requestData, expectedProvider) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const streamData = {
        chunks: [],
        events: [],
        totalData: ''
      };

      this.httpClient.post('/v1/messages', requestData, {
        responseType: 'stream'
      }).then(response => {
        response.data.on('data', (chunk) => {
          const chunkStr = chunk.toString();
          streamData.chunks.push(chunkStr);
          streamData.totalData += chunkStr;

          // 解析SSE事件
          const lines = chunkStr.split('\n');
          for (const line of lines) {
            if (line.startsWith('event:')) {
              streamData.events.push(line.substring(6).trim());
            }
          }
        });

        response.data.on('end', () => {
          const duration = Date.now() - startTime;
          const analysis = this.analyzeStreamResponse(streamData);

          resolve({
            success: true,
            duration,
            expectedProvider,
            actualProvider: this.inferProviderFromStream(streamData),
            request: requestData,
            streamData,
            analysis,
            transformationQuality: this.assessStreamTransformationQuality(streamData, requestData)
          });
        });

        response.data.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
            duration: Date.now() - startTime,
            expectedProvider
          });
        });
      }).catch(error => {
        resolve({
          success: false,
          error: error.message,
          duration: Date.now() - startTime,
          expectedProvider
        });
      });
    });
  }

  /**
   * 分析响应格式
   */
  analyzeResponse(responseData) {
    return {
      hasId: !!responseData.id,
      hasType: !!responseData.type,
      hasRole: !!responseData.role,
      hasModel: !!responseData.model,
      hasContent: !!(responseData.content && responseData.content.length > 0),
      hasUsage: !!responseData.usage,
      contentTypes: responseData.content ? responseData.content.map(c => c.type) : [],
      modelUsed: responseData.model,
      idFormat: responseData.id ? this.getIdFormat(responseData.id) : null,
      totalTokens: responseData.usage ? responseData.usage.input_tokens + responseData.usage.output_tokens : 0
    };
  }

  /**
   * 分析流式响应
   */
  analyzeStreamResponse(streamData) {
    return {
      totalChunks: streamData.chunks.length,
      totalDataLength: streamData.totalData.length,
      uniqueEvents: [...new Set(streamData.events)],
      hasMessageStart: streamData.events.includes('message_start'),
      hasContentBlockStart: streamData.events.includes('content_block_start'),
      hasContentBlockDelta: streamData.events.includes('content_block_delta'),
      hasMessageStop: streamData.events.includes('message_stop'),
      eventSequence: streamData.events
    };
  }

  /**
   * 推断provider
   */
  inferProvider(responseData) {
    if (responseData.model) {
      if (responseData.model.includes('gemini-') || responseData.model.includes('gpt-')) {
        return 'shuaihong-openai';
      }
      if (responseData.model.includes('CLAUDE_') || responseData.model.includes('V1_0')) {
        return 'codewhisperer-primary';
      }
    }
    
    if (responseData.id) {
      if (responseData.id.startsWith('chatcmpl-')) {
        return 'shuaihong-openai';
      }
      if (responseData.id.startsWith('msg_')) {
        return 'codewhisperer-primary';
      }
    }
    
    return 'unknown';
  }

  /**
   * 从流式数据推断provider
   */
  inferProviderFromStream(streamData) {
    // 从流式数据的格式特征推断
    if (streamData.totalData.includes('gemini-') || streamData.totalData.includes('chatcmpl-')) {
      return 'shuaihong-openai';
    }
    if (streamData.totalData.includes('CLAUDE_') || streamData.totalData.includes('msg_')) {
      return 'codewhisperer-primary';
    }
    return 'unknown';
  }

  /**
   * 获取ID格式
   */
  getIdFormat(id) {
    if (id.startsWith('chatcmpl-')) return 'openai-style';
    if (id.startsWith('msg_')) return 'anthropic-style';
    return 'unknown';
  }

  /**
   * 评估转换质量
   */
  assessTransformationQuality(responseData, requestData) {
    const quality = {
      score: 0,
      aspects: {}
    };

    // 检查必需字段
    if (responseData.id) quality.score += 20;
    if (responseData.type === 'message') quality.score += 20;
    if (responseData.role === 'assistant') quality.score += 20;
    if (responseData.content && responseData.content.length > 0) quality.score += 20;
    if (responseData.usage) quality.score += 20;

    quality.aspects.structureCompliance = quality.score >= 80;
    quality.aspects.hasValidContent = !!(responseData.content && responseData.content[0]?.text);
    quality.aspects.preservesModel = !!responseData.model;
    quality.aspects.correctUsage = !!(responseData.usage && 
                                     typeof responseData.usage.input_tokens === 'number' &&
                                     typeof responseData.usage.output_tokens === 'number');

    return quality;
  }

  /**
   * 评估流式转换质量
   */
  assessStreamTransformationQuality(streamData, requestData) {
    const quality = {
      score: 0,
      aspects: {}
    };

    const analysis = streamData.analysis || this.analyzeStreamResponse(streamData);

    if (analysis.hasMessageStart) quality.score += 20;
    if (analysis.hasContentBlockStart) quality.score += 20;
    if (analysis.hasContentBlockDelta) quality.score += 20;
    if (analysis.hasMessageStop) quality.score += 20;
    if (analysis.totalChunks > 0) quality.score += 20;

    quality.aspects.completeEventSequence = quality.score >= 80;
    quality.aspects.hasContent = analysis.hasContentBlockDelta;
    quality.aspects.properSSEFormat = streamData.totalData.includes('event:') && streamData.totalData.includes('data:');

    return quality;
  }

  /**
   * 对比转换结果
   */
  compareTransformations(shuaihongResult, codewhispererResult) {
    const comparison = {
      bothSuccessful: shuaihongResult.success && codewhispererResult.success,
      providerMatch: shuaihongResult.actualProvider === codewhispererResult.actualProvider,
      differences: {},
      similarities: {}
    };

    if (comparison.bothSuccessful) {
      // 对比响应结构
      const shuaihongAnalysis = shuaihongResult.analysis;
      const codewhispererAnalysis = codewhispererResult.analysis;

      comparison.differences.responseFormat = {
        shuaihong: shuaihongAnalysis,
        codewhisperer: codewhispererAnalysis
      };

      comparison.differences.modelUsed = {
        shuaihong: shuaihongResult.response?.model,
        codewhisperer: codewhispererResult.response?.model
      };

      comparison.differences.idFormat = {
        shuaihong: shuaihongAnalysis?.idFormat,
        codewhisperer: codewhispererAnalysis?.idFormat
      };

      // 对比转换质量
      comparison.differences.transformationQuality = {
        shuaihong: shuaihongResult.transformationQuality?.score,
        codewhisperer: codewhispererResult.transformationQuality?.score
      };

      // 相似性分析
      comparison.similarities.bothHaveContent = shuaihongAnalysis?.hasContent && codewhispererAnalysis?.hasContent;
      comparison.similarities.bothHaveUsage = shuaihongAnalysis?.hasUsage && codewhispererAnalysis?.hasUsage;
      comparison.similarities.sameStructure = JSON.stringify(shuaihongAnalysis) === JSON.stringify(codewhispererAnalysis);
    }

    return comparison;
  }

  /**
   * 显示对比结果
   */
  displayComparisonResults(result) {
    console.log(`📊 测试结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (result.shuaihongResult) {
      console.log(`🟦 Shuaihong: ${result.shuaihongResult.success ? '✅' : '❌'} (${result.shuaihongResult.duration}ms)`);
      console.log(`   Provider: ${result.shuaihongResult.actualProvider}`);
      console.log(`   Model: ${result.shuaihongResult.response?.model || result.shuaihongResult.streamData?.model || 'N/A'}`);
    }
    
    if (result.codewhispererResult) {
      console.log(`🟩 CodeWhisperer: ${result.codewhispererResult.success ? '✅' : '❌'} (${result.codewhispererResult.duration}ms)`);
      console.log(`   Provider: ${result.codewhispererResult.actualProvider}`);
      console.log(`   Model: ${result.codewhispererResult.response?.model || result.codewhispererResult.streamData?.model || 'N/A'}`);
    }

    if (result.comparison) {
      console.log(`🔄 Provider匹配: ${result.comparison.providerMatch ? '✅' : '❌'}`);
      console.log(`📋 结构相似: ${result.comparison.similarities?.sameStructure ? '✅' : '❌'}`);
    }

    if (result.error) {
      console.log(`❌ 错误: ${result.error}`);
    }
  }

  /**
   * 生成转换测试报告
   */
  generateTransformationReport() {
    const successful = this.transformationResults.filter(r => r.success).length;
    const failed = this.transformationResults.length - successful;
    const total = this.transformationResults.length;

    // 计算转换差异
    const transformationDifferences = this.transformationResults.reduce((count, result) => {
      if (result.comparison && !result.comparison.providerMatch) {
        return count + 1;
      }
      return count;
    }, 0);

    return {
      timestamp: new Date().toISOString(),
      testType: 'CodeWhisperer数据转换测试',
      summary: {
        total,
        successful,
        failed,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
        transformationDifferences
      },
      transformationResults: this.transformationResults,
      configuration: TRANSFORMATION_TEST_CONFIG,
      analysis: this.generateTransformationAnalysis(),
      recommendations: this.generateTransformationRecommendations()
    };
  }

  /**
   * 生成转换分析
   */
  generateTransformationAnalysis() {
    const analysis = {
      providerRouting: {},
      responseFormats: {},
      transformationQuality: {}
    };

    // 分析provider路由
    for (const result of this.transformationResults) {
      if (result.shuaihongResult && result.codewhispererResult) {
        const key = `${result.shuaihongResult.actualProvider}_vs_${result.codewhispererResult.actualProvider}`;
        analysis.providerRouting[key] = (analysis.providerRouting[key] || 0) + 1;
      }
    }

    // 分析响应格式
    for (const result of this.transformationResults) {
      if (result.comparison && result.comparison.differences) {
        const shuaihongFormat = result.comparison.differences.idFormat?.shuaihong;
        const codewhispererFormat = result.comparison.differences.idFormat?.codewhisperer;
        
        if (shuaihongFormat) {
          analysis.responseFormats[shuaihongFormat] = (analysis.responseFormats[shuaihongFormat] || 0) + 1;
        }
        if (codewhispererFormat) {
          analysis.responseFormats[codewhispererFormat] = (analysis.responseFormats[codewhispererFormat] || 0) + 1;
        }
      }
    }

    return analysis;
  }

  /**
   * 生成转换建议
   */
  generateTransformationRecommendations() {
    const recommendations = [];

    // 检查provider路由不一致
    const routingInconsistencies = this.transformationResults.filter(r => 
      r.comparison && !r.comparison.providerMatch
    );
    
    if (routingInconsistencies.length > 0) {
      recommendations.push({
        type: 'routing-inconsistency',
        description: '发现provider路由不一致',
        count: routingInconsistencies.length,
        suggestion: '检查路由规则配置，确保不同模型正确路由到对应的provider',
        priority: 'high'
      });
    }

    // 检查转换质量
    const lowQualityTransformations = this.transformationResults.filter(r => 
      (r.shuaihongResult?.transformationQuality?.score || 0) < 80 ||
      (r.codewhispererResult?.transformationQuality?.score || 0) < 80
    );

    if (lowQualityTransformations.length > 0) {
      recommendations.push({
        type: 'transformation-quality',
        description: '发现转换质量较低的情况',
        count: lowQualityTransformations.length,
        suggestion: '优化transformer实现，确保响应格式完整性',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * 保存转换测试报告
   */
  saveTransformationReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `codewhisperer-transformation-report-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`📄 转换测试报告已保存: ${filename}`);
  }
}

// 主函数
async function main() {
  const tester = new CodeWhispererTransformationTester();
  
  try {
    const success = await tester.runTransformationTests();
    console.log('\n🔄 转换测试完成!');
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 转换测试失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { CodeWhispererTransformationTester, TRANSFORMATION_TEST_CONFIG };