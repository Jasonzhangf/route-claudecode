#!/usr/bin/env node

/**
 * Delivery Test: Large Input Scenario Coverage
 * 测试所有Provider处理大容量输入的能力
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 大输入测试场景
const LARGE_INPUT_SCENARIOS = [
  {
    name: 'medium-input-30k-tokens',
    description: '中等规模输入测试 (~30K tokens)',
    generateContent: () => generateCodeAnalysisRequest(30000)
  },
  {
    name: 'large-input-60k-tokens', 
    description: '大规模输入测试 (~60K tokens)',
    generateContent: () => generateDocumentationRequest(60000)
  },
  {
    name: 'very-large-input-100k-tokens',
    description: '超大规模输入测试 (~100K tokens)',
    generateContent: () => generateCodebaseAnalysisRequest(100000)
  }
];

// Provider配置
const PROVIDERS = [
  { name: 'codewhisperer', port: 3458, config: 'config-codewhisperer-only.json' },
  { name: 'openai', port: 3459, config: 'config-openai-only.json' },
  { name: 'gemini', port: 3460, config: 'config-gemini-only.json' },
  { name: 'anthropic', port: 3461, config: 'config-anthropic-only.json' }
];

// 生成不同类型的大输入内容
function generateCodeAnalysisRequest(targetTokens) {
  const baseCode = `
function RouteEngine() {
  this.providers = new Map();
  this.routingRules = new Map();
  this.healthChecks = new Map();
  
  this.route = async function(request) {
    const category = this.determineCategory(request);
    const provider = this.selectProvider(category);
    const result = await this.executeRequest(provider, request);
    return this.transformResponse(result);
  };
  
  this.determineCategory = function(request) {
    if (request.model.includes('haiku')) return 'background';
    if (request.thinking === true) return 'thinking';
    if (this.calculateTokens(request) > 60000) return 'longcontext';
    if (request.tools && request.tools.length > 0) return 'search';
    return 'default';
  };
  
  this.selectProvider = function(category) {
    const rule = this.routingRules.get(category);
    if (!rule) throw new Error('No routing rule for category: ' + category);
    
    const providers = rule.providers.filter(p => this.isHealthy(p));
    if (!providers.length) throw new Error('No healthy providers for category: ' + category);
    
    return this.loadBalance(providers);
  };
}`;

  // 重复代码直到达到目标token数
  let content = 'Please analyze the following large codebase and provide detailed insights:\\n\\n';
  const iterations = Math.ceil(targetTokens / (baseCode.length / 4)); // 粗略的token估算
  
  for (let i = 0; i < iterations; i++) {
    content += `// Module ${i + 1}\\n${baseCode}\\n\\n`;
    content += `/* Analysis needed for module ${i + 1}:
    - Code structure and patterns
    - Performance implications  
    - Error handling coverage
    - Maintainability assessment
    - Security considerations
    */\\n\\n`;
  }
  
  content += `
Please provide a comprehensive analysis covering:
1. Overall architecture assessment
2. Code quality evaluation
3. Performance bottlenecks identification
4. Security vulnerability analysis
5. Maintainability recommendations
6. Refactoring suggestions
7. Testing strategy recommendations
8. Documentation gaps
9. Best practices compliance
10. Scalability considerations`;

  return {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: content
      }
    ]
  };
}

function generateDocumentationRequest(targetTokens) {
  const baseDoc = `
# Claude Code Router Architecture Documentation

## Overview
The Claude Code Router is a sophisticated multi-provider routing system designed to intelligently route AI requests to the most appropriate provider based on request characteristics, model capabilities, and system health.

## Core Components

### 1. Input Processing Layer
The input processing layer handles incoming requests in various formats:
- Anthropic format processing
- OpenAI format processing  
- Gemini format processing
- Request validation and normalization

### 2. Routing Engine
The routing engine implements intelligent request routing:
- Category-based routing decisions
- Provider health monitoring
- Load balancing strategies
- Failover mechanisms

### 3. Provider Management
Provider management handles multiple AI service providers:
- CodeWhisperer integration
- OpenAI-compatible providers
- Gemini API integration
- Anthropic direct API

### 4. Response Processing
Response processing ensures consistent output format:
- Format transformation
- Stream processing
- Error handling
- Response validation

## Configuration Management
The system uses sophisticated configuration management:
- Provider-specific settings
- Routing rules configuration
- Health check parameters
- Authentication management

## Architecture Patterns
The system implements several key patterns:
- Strategy pattern for routing decisions
- Factory pattern for provider creation
- Observer pattern for health monitoring
- Chain of responsibility for request processing`;

  let content = 'Please create a comprehensive technical documentation for the following system based on this partial documentation:\\n\\n';
  const iterations = Math.ceil(targetTokens / (baseDoc.length / 4));
  
  for (let i = 0; i < iterations; i++) {
    content += `${baseDoc}\\n\\n`;
    content += `## Additional Section ${i + 1}
This section covers additional aspects of the system architecture and implementation details that need thorough documentation.
Please expand on the technical specifications, API documentation, deployment procedures, and operational guidelines.\\n\\n`;
  }
  
  content += `
Please generate comprehensive documentation that includes:
1. Complete API reference with examples
2. Deployment and configuration guide
3. Troubleshooting and debugging guide
4. Performance tuning recommendations
5. Security configuration guidelines
6. Monitoring and alerting setup
7. Backup and recovery procedures
8. Scaling and capacity planning
9. Development workflow documentation
10. Testing and validation procedures`;

  return {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: content
      }
    ]
  };
}

function generateCodebaseAnalysisRequest(targetTokens) {
  const baseFiles = [
    'src/routing/engine.ts',
    'src/providers/codewhisperer/client.ts',
    'src/providers/openai/client.ts',
    'src/providers/gemini/client.ts',
    'src/transformers/anthropic.ts',
    'src/server.ts',
    'src/types/index.ts'
  ];
  
  const fileTemplate = `
// FILE: {{filename}}
import { BaseRequest, BaseResponse, RoutingCategory } from '../types';
import { logger } from '../utils/logger';

export class {{className}} {
  private config: Config;
  private healthStatus: HealthStatus;
  
  constructor(config: Config) {
    this.config = config;
    this.healthStatus = 'healthy';
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    try {
      await this.validateConfiguration();
      await this.establishConnections();
      await this.performHealthCheck();
      logger.info('{{className}} initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize {{className}}:', error);
      throw error;
    }
  }
  
  public async processRequest(request: BaseRequest): Promise<BaseResponse> {
    const startTime = Date.now();
    
    try {
      this.validateRequest(request);
      const processedRequest = await this.preprocessRequest(request);
      const response = await this.executeRequest(processedRequest);
      const transformedResponse = this.transformResponse(response);
      
      logger.info('Request processed successfully', {
        duration: Date.now() - startTime,
        requestId: request.id
      });
      
      return transformedResponse;
    } catch (error) {
      logger.error('Request processing failed:', error);
      throw error;
    }
  }
  
  private validateRequest(request: BaseRequest): void {
    if (!request || !request.messages || !Array.isArray(request.messages)) {
      throw new Error('Invalid request format');
    }
    
    if (request.messages.length === 0) {
      throw new Error('Request must contain at least one message');
    }
    
    for (const message of request.messages) {
      if (!message.role || !message.content) {
        throw new Error('Invalid message format');
      }
    }
  }
  
  private async preprocessRequest(request: BaseRequest): Promise<ProcessedRequest> {
    // Complex preprocessing logic
    const processed = {
      ...request,
      metadata: {
        timestamp: new Date().toISOString(),
        preprocessorVersion: '2.6.0',
        category: this.determineCategory(request)
      }
    };
    
    return processed;
  }
}`;

  let content = 'Please perform a comprehensive analysis of the following large codebase:\\n\\n';
  const filesPerIteration = Math.ceil(targetTokens / (fileTemplate.length * baseFiles.length / 4));
  
  for (let i = 0; i < filesPerIteration; i++) {
    for (const filename of baseFiles) {
      const className = filename.split('/').pop()?.replace('.ts', '')?.replace(/[-_]/g, '') || 'Component';
      const fileContent = fileTemplate
        .replace(/{{filename}}/g, filename)
        .replace(/{{className}}/g, className.charAt(0).toUpperCase() + className.slice(1));
      
      content += `${fileContent}\\n\\n`;
    }
    
    content += `// Additional implementation files and test cases for iteration ${i + 1}\\n\\n`;
  }
  
  content += `
Please provide a detailed codebase analysis including:
1. Architecture review and recommendations
2. Code quality assessment
3. Security vulnerability analysis
4. Performance optimization opportunities
5. Testing coverage evaluation
6. Documentation gaps identification
7. Dependency analysis
8. Refactoring recommendations
9. Design pattern usage evaluation
10. Maintainability assessment
11. Scalability considerations
12. Error handling evaluation
13. Logging and monitoring assessment
14. Configuration management review
15. Deployment and operations analysis`;

  return {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: content
      }
    ]
  };
}

class LargeInputDeliveryTester {
  constructor() {
    this.results = [];
    this.outputDir = path.join(process.env.HOME, '.route-claude-code/database/delivery-testing/scenarios/large-input');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // 粗略估算token数量
  estimateTokens(text) {
    return Math.ceil(text.length / 4); // 1 token ≈ 4 characters
  }

  async testLargeInputScenario(provider, scenario) {
    const startTime = Date.now();
    console.log(`\\n📊 Testing ${provider.name} - ${scenario.name}`);
    
    try {
      const request = scenario.generateContent();
      const estimatedInputTokens = this.estimateTokens(JSON.stringify(request.messages));
      
      console.log(`   📏 Estimated input tokens: ${estimatedInputTokens.toLocaleString()}`);
      console.log(`   ⏱️  Starting large input processing...`);

      const response = await axios.post(`http://localhost:${provider.port}/v1/messages`, request, {
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Session': `delivery-large-input-${Date.now()}`
        },
        timeout: 120000, // 2分钟超时，大输入需要更长时间
        maxContentLength: 50 * 1024 * 1024, // 50MB响应大小限制
        maxBodyLength: 50 * 1024 * 1024
      });

      const duration = Date.now() - startTime;
      const result = this.analyzeLargeInputResponse(response.data, scenario, provider, duration, estimatedInputTokens);
      
      // 保存原始数据（压缩存储）
      this.saveLargeInputData(provider.name, scenario.name, {
        request: {
          ...request,
          messages: request.messages.map(m => ({
            ...m,
            content: m.content.substring(0, 1000) + '...[truncated]...' + m.content.substring(m.content.length - 1000)
          })) // 截断保存，避免文件过大
        },
        response: response.data,
        result: result,
        estimatedInputTokens: estimatedInputTokens
      });

      console.log(`   ✅ ${result.status} - ${result.summary}`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const result = {
        provider: provider.name,
        scenario: scenario.name,
        status: 'FAILED',
        duration: duration,
        error: {
          message: error.message,
          code: error.response?.status || error.code || 'NETWORK_ERROR',
          details: error.response?.data || error.toString()
        },
        summary: `Large input processing failed: ${error.message}`,
        inputTokensProcessed: 0,
        outputTokensGenerated: 0,
        memoryEfficient: false,
        responseComplete: false,
        tokensPerSecond: 0
      };

      console.log(`   ❌ FAILED - ${error.message}`);
      return result;
    }
  }

  analyzeLargeInputResponse(response, scenario, provider, duration, estimatedInputTokens) {
    const result = {
      provider: provider.name,
      scenario: scenario.name,
      status: 'UNKNOWN',
      duration: duration,
      estimatedInputTokens: estimatedInputTokens,
      inputTokensProcessed: 0,
      outputTokensGenerated: 0,
      memoryEfficient: true,
      responseComplete: false,
      tokensPerSecond: 0
    };

    // 分析响应数据
    if (response.usage) {
      result.inputTokensProcessed = response.usage.input_tokens || 0;
      result.outputTokensGenerated = response.usage.output_tokens || 0;
      
      // 计算处理速度 (tokens per second)
      const totalTokens = result.inputTokensProcessed + result.outputTokensGenerated;
      result.tokensPerSecond = Math.round(totalTokens / (duration / 1000));
    }

    // 检查响应完整性
    if (response.content && Array.isArray(response.content)) {
      const textBlocks = response.content.filter(block => block.type === 'text');
      result.responseComplete = textBlocks.length > 0 && response.stop_reason;
      
      if (result.responseComplete) {
        const totalResponseLength = textBlocks.reduce((sum, block) => sum + (block.text?.length || 0), 0);
        
        // 评估处理质量
        const inputAccuracy = result.inputTokensProcessed > 0 ? 
          Math.min(result.inputTokensProcessed / estimatedInputTokens, 1) : 0;
        
        const responseQuality = totalResponseLength > 1000 ? 1 : totalResponseLength / 1000;
        
        // 性能评估
        const processingSpeed = result.tokensPerSecond;
        const timeoutThreshold = 120000; // 2分钟
        const performanceScore = Math.min(1, (timeoutThreshold - duration) / timeoutThreshold);
        
        // 综合评估
        if (inputAccuracy > 0.8 && responseQuality > 0.7 && performanceScore > 0.3) {
          result.status = 'PASSED';
          result.summary = `Successfully processed ${result.inputTokensProcessed.toLocaleString()} tokens in ${(duration/1000).toFixed(1)}s (${result.tokensPerSecond} tok/s)`;
        } else if (inputAccuracy > 0.5 && responseQuality > 0.5) {
          result.status = 'PARTIAL';
          result.summary = `Partial success: input ${(inputAccuracy*100).toFixed(1)}%, quality ${(responseQuality*100).toFixed(1)}%, performance ${(performanceScore*100).toFixed(1)}%`;
        } else {
          result.status = 'FAILED';
          result.summary = `Poor processing quality: input accuracy ${(inputAccuracy*100).toFixed(1)}%`;
        }
      } else {
        result.status = 'FAILED';
        result.summary = 'Incomplete response received';
      }
    } else {
      result.status = 'FAILED';
      result.summary = 'Invalid response format';
    }

    // 内存效率评估 (基于处理时间和输入大小)
    const expectedMinTime = estimatedInputTokens / 10000; // 预期最少处理时间
    result.memoryEfficient = (duration / 1000) < (expectedMinTime * 5); // 不超过预期的5倍

    return result;
  }

  saveLargeInputData(provider, scenario, data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${provider}-${scenario}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`   💾 Large input data saved: ${filename}`);
  }

  async runAllTests() {
    console.log('🚀 Starting Large Input Delivery Testing');
    console.log(`Testing ${PROVIDERS.length} providers with ${LARGE_INPUT_SCENARIOS.length} large input scenarios`);

    for (const provider of PROVIDERS) {
      console.log(`\\n📊 Testing Provider: ${provider.name} (Port: ${provider.port})`);
      
      for (const scenario of LARGE_INPUT_SCENARIOS) {
        const result = await this.testLargeInputScenario(provider, scenario);
        this.results.push(result);
        
        // 场景间延迟，让系统恢复
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return this.generateReport();
  }

  generateReport() {
    const report = {
      testSuite: 'Large Input Delivery Testing',
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.length,
        passed: this.results.filter(r => r.status === 'PASSED').length,
        failed: this.results.filter(r => r.status === 'FAILED').length,
        partial: this.results.filter(r => r.status === 'PARTIAL').length
      },
      providerSummary: {},
      scenarioSummary: {},
      performanceMetrics: {
        avgProcessingSpeed: 0,
        maxInputTokens: 0,
        avgDuration: 0
      },
      detailedResults: this.results
    };

    // Provider汇总
    for (const provider of PROVIDERS) {
      const providerResults = this.results.filter(r => r.provider === provider.name);
      report.providerSummary[provider.name] = {
        total: providerResults.length,
        passed: providerResults.filter(r => r.status === 'PASSED').length,
        failed: providerResults.filter(r => r.status === 'FAILED').length,
        partial: providerResults.filter(r => r.status === 'PARTIAL').length,
        avgDuration: Math.round(providerResults.reduce((sum, r) => sum + r.duration, 0) / providerResults.length),
        avgTokensPerSecond: Math.round(providerResults.reduce((sum, r) => sum + (r.tokensPerSecond || 0), 0) / providerResults.length),
        maxInputTokens: Math.max(...providerResults.map(r => r.inputTokensProcessed || 0)),
        totalTokensProcessed: providerResults.reduce((sum, r) => sum + (r.inputTokensProcessed || 0), 0),
        memoryEfficiencyRate: providerResults.filter(r => r.memoryEfficient).length / providerResults.length
      };
    }

    // Scenario汇总
    for (const scenario of LARGE_INPUT_SCENARIOS) {
      const scenarioResults = this.results.filter(r => r.scenario === scenario.name);
      report.scenarioSummary[scenario.name] = {
        total: scenarioResults.length,
        passed: scenarioResults.filter(r => r.status === 'PASSED').length,
        failed: scenarioResults.filter(r => r.status === 'FAILED').length,
        partial: scenarioResults.filter(r => r.status === 'PARTIAL').length,
        avgDuration: Math.round(scenarioResults.reduce((sum, r) => sum + r.duration, 0) / scenarioResults.length),
        avgInputTokens: Math.round(scenarioResults.reduce((sum, r) => sum + (r.estimatedInputTokens || 0), 0) / scenarioResults.length)
      };
    }

    // 性能指标
    const validResults = this.results.filter(r => r.tokensPerSecond > 0);
    if (validResults.length > 0) {
      report.performanceMetrics.avgProcessingSpeed = Math.round(
        validResults.reduce((sum, r) => sum + r.tokensPerSecond, 0) / validResults.length
      );
      report.performanceMetrics.maxInputTokens = Math.max(...this.results.map(r => r.inputTokensProcessed || 0));
      report.performanceMetrics.avgDuration = Math.round(
        this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length
      );
    }

    // 保存报告
    const reportPath = path.join(this.outputDir, `large-input-delivery-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  printReport(report) {
    console.log('\\n📋 Large Input Delivery Test Report');
    console.log('=' * 50);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Partial: ${report.summary.partial}`);
    console.log(`Success Rate: ${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%`);

    console.log('\\n🚀 Performance Metrics:');
    console.log(`  Average Processing Speed: ${report.performanceMetrics.avgProcessingSpeed.toLocaleString()} tokens/sec`);
    console.log(`  Maximum Input Processed: ${report.performanceMetrics.maxInputTokens.toLocaleString()} tokens`);
    console.log(`  Average Duration: ${(report.performanceMetrics.avgDuration / 1000).toFixed(1)} seconds`);

    console.log('\\n📊 Provider Performance:');
    for (const [provider, stats] of Object.entries(report.providerSummary)) {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      const memoryRate = (stats.memoryEfficiencyRate * 100).toFixed(1);
      console.log(`  ${provider}: ${stats.passed}/${stats.total} (${successRate}%) - ${stats.avgTokensPerSecond} tok/s - ${(stats.avgDuration/1000).toFixed(1)}s avg - Memory: ${memoryRate}%`);
    }

    console.log('\\n🎭 Scenario Results:');
    for (const [scenario, stats] of Object.entries(report.scenarioSummary)) {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`  ${scenario}: ${stats.passed}/${stats.total} (${successRate}%) - ${stats.avgInputTokens.toLocaleString()} avg tokens - ${(stats.avgDuration/1000).toFixed(1)}s`);
    }

    if (report.summary.failed > 0 || report.summary.partial > 0) {
      console.log('\\n⚠️  Issues Found:');
      for (const result of report.detailedResults) {
        if (result.status !== 'PASSED') {
          console.log(`  ${result.provider} - ${result.scenario}: ${result.summary}`);
        }
      }
    }
  }
}

// 执行测试
async function main() {
  const tester = new LargeInputDeliveryTester();
  
  try {
    const report = await tester.runAllTests();
    tester.printReport(report);
    
    // 退出码根据测试结果决定
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Large Input Testing Failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LargeInputDeliveryTester;