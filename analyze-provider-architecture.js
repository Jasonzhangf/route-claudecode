#!/usr/bin/env node
/**
 * Provider架构差异分析
 * 深入对比shuaihong和CodeWhisperer的架构设计
 * 
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

// 架构分析配置
const ARCHITECTURE_ANALYSIS_CONFIG = {
  providersToAnalyze: [
    {
      name: 'shuaihong-openai',
      type: 'openai',
      clientPath: 'src/providers/openai/enhanced-client.ts',
      description: 'OpenAI格式兼容的第三方提供商'
    },
    {
      name: 'codewhisperer-primary',
      type: 'codewhisperer',
      clientPath: 'src/providers/codewhisperer/client.ts',
      description: 'AWS CodeWhisperer官方提供商'
    }
  ],
  
  analysisAspects: [
    'authentication',
    'request_format',
    'response_format',
    'streaming_support',
    'error_handling',
    'data_transformation',
    'performance_characteristics',
    'configuration_requirements'
  ]
};

class ProviderArchitectureAnalyzer {
  constructor() {
    this.analysisResults = {};
    this.comparisonResults = {};
  }

  /**
   * 运行完整架构分析
   */
  async runArchitectureAnalysis() {
    console.log('🏗️  Provider架构差异分析');
    console.log('===============================');
    console.log('');

    // Step 1: 分析各个provider的架构
    console.log('📋 Step 1: 分析各provider架构特征');
    for (const provider of ARCHITECTURE_ANALYSIS_CONFIG.providersToAnalyze) {
      console.log(`\n🔍 分析 ${provider.name} (${provider.type})`);
      this.analysisResults[provider.name] = await this.analyzeProviderArchitecture(provider);
    }

    // Step 2: 对比架构差异
    console.log('\n📋 Step 2: 对比架构差异');
    this.comparisonResults = this.compareProviderArchitectures();

    // Step 3: 生成架构分析报告
    console.log('\n📋 Step 3: 生成架构分析报告');
    const report = this.generateArchitectureReport();
    this.saveArchitectureReport(report);

    console.log('\n📊 架构分析完成!');
    this.displayArchitectureSummary(report);

    return true;
  }

  /**
   * 分析单个provider的架构
   */
  async analyzeProviderArchitecture(provider) {
    const analysis = {
      name: provider.name,
      type: provider.type,
      description: provider.description,
      architecture: {},
      codeAnalysis: {},
      timestamp: new Date().toISOString()
    };

    try {
      // 读取和分析代码
      const clientCode = this.readProviderCode(provider.clientPath);
      analysis.codeAnalysis = this.analyzeProviderCode(clientCode, provider.type);
      
      // 基于代码分析得出架构特征
      analysis.architecture = this.extractArchitectureFeatures(analysis.codeAnalysis, provider.type);
      
      console.log(`✅ ${provider.name} 分析完成`);
      
    } catch (error) {
      console.log(`❌ ${provider.name} 分析失败: ${error.message}`);
      analysis.error = error.message;
    }

    return analysis;
  }

  /**
   * 读取provider代码
   */
  readProviderCode(clientPath) {
    const fullPath = path.join(process.cwd(), clientPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Provider代码文件不存在: ${fullPath}`);
    }
    
    return fs.readFileSync(fullPath, 'utf8');
  }

  /**
   * 分析provider代码
   */
  analyzeProviderCode(code, providerType) {
    const analysis = {
      linesOfCode: code.split('\n').length,
      classesFound: [],
      methodsFound: [],
      importsFound: [],
      errorHandlingPatterns: [],
      streamingSupport: {},
      authenticationMethods: [],
      configurationOptions: []
    };

    // 分析类定义
    const classMatches = code.match(/class\s+(\w+)/g);
    if (classMatches) {
      analysis.classesFound = classMatches.map(match => match.replace('class ', ''));
    }

    // 分析方法定义
    const methodMatches = code.match(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g);
    if (methodMatches) {
      analysis.methodsFound = methodMatches.map(match => 
        match.replace(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/, '$1')
      );
    }

    // 分析导入
    const importMatches = code.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      analysis.importsFound = importMatches.map(match => 
        match.replace(/import\s+.*?from\s+['"]([^'"]+)['"]/, '$1')
      );
    }

    // 分析错误处理
    if (code.includes('try') && code.includes('catch')) {
      analysis.errorHandlingPatterns.push('try-catch');
    }
    if (code.includes('ProviderError')) {
      analysis.errorHandlingPatterns.push('custom-provider-error');
    }
    if (code.includes('throw new')) {
      analysis.errorHandlingPatterns.push('explicit-error-throwing');
    }

    // 分析流式支持
    analysis.streamingSupport = {
      hasStreamMethod: code.includes('sendStreamRequest') || code.includes('stream'),
      hasSSEHandling: code.includes('event:') || code.includes('data:'),
      hasAsyncIterable: code.includes('AsyncIterable') || code.includes('yield'),
      streamingComplexity: this.calculateStreamingComplexity(code)
    };

    // 分析认证方法
    if (code.includes('Bearer')) {
      analysis.authenticationMethods.push('bearer-token');
    }
    if (code.includes('Authorization')) {
      analysis.authenticationMethods.push('authorization-header');
    }
    if (code.includes('apiKey') || code.includes('api_key')) {
      analysis.authenticationMethods.push('api-key');
    }
    if (code.includes('profileArn')) {
      analysis.authenticationMethods.push('aws-profile-arn');
    }

    // 分析配置选项
    const configMatches = code.match(/this\.config\.\w+/g);
    if (configMatches) {
      analysis.configurationOptions = [...new Set(configMatches)];
    }

    return analysis;
  }

  /**
   * 计算流式处理复杂度
   */
  calculateStreamingComplexity(code) {
    let complexity = 0;
    
    if (code.includes('ReadableStream')) complexity += 2;
    if (code.includes('TextEncoder') || code.includes('TextDecoder')) complexity += 1;
    if (code.includes('SSE') || code.includes('event:')) complexity += 2;
    if (code.includes('transformStream') || code.includes('transform')) complexity += 3;
    if (code.includes('yield')) complexity += 2;
    if (code.includes('async') && code.includes('for')) complexity += 1;
    
    return complexity;
  }

  /**
   * 提取架构特征
   */
  extractArchitectureFeatures(codeAnalysis, providerType) {
    const features = {};

    // 认证架构
    features.authentication = {
      type: providerType === 'codewhisperer' ? 'aws-sso' : 'api-key',
      methods: codeAnalysis.authenticationMethods,
      complexity: codeAnalysis.authenticationMethods.length > 2 ? 'high' : 'low'
    };

    // 请求格式
    features.requestFormat = {
      nativeFormat: providerType === 'codewhisperer' ? 'anthropic' : 'openai',
      requiresTransformation: true,
      transformationComplexity: this.assessTransformationComplexity(codeAnalysis, providerType)
    };

    // 响应格式
    features.responseFormat = {
      nativeFormat: providerType === 'codewhisperer' ? 'binary-stream' : 'json',
      requiresParsing: providerType === 'codewhisperer',
      outputFormat: 'anthropic'
    };

    // 流式支持
    features.streamingSupport = {
      supported: codeAnalysis.streamingSupport.hasStreamMethod,
      complexity: codeAnalysis.streamingSupport.streamingComplexity,
      sseHandling: codeAnalysis.streamingSupport.hasSSEHandling,
      asyncIterable: codeAnalysis.streamingSupport.hasAsyncIterable
    };

    // 错误处理
    features.errorHandling = {
      patterns: codeAnalysis.errorHandlingPatterns,
      robustness: codeAnalysis.errorHandlingPatterns.length > 2 ? 'high' : 'medium',
      customErrors: codeAnalysis.errorHandlingPatterns.includes('custom-provider-error')
    };

    // 性能特征
    features.performanceCharacteristics = {
      codeSize: codeAnalysis.linesOfCode,
      complexity: this.assessOverallComplexity(codeAnalysis),
      dependencies: codeAnalysis.importsFound.length,
      estimatedLatency: providerType === 'codewhisperer' ? 'high' : 'medium'
    };

    // 配置要求
    features.configurationRequirements = {
      optionsCount: codeAnalysis.configurationOptions.length,
      complexity: this.assessConfigurationComplexity(providerType),
      setupDifficulty: providerType === 'codewhisperer' ? 'high' : 'medium'
    };

    return features;
  }

  /**
   * 评估转换复杂度
   */
  assessTransformationComplexity(codeAnalysis, providerType) {
    if (providerType === 'codewhisperer') {
      // CodeWhisperer需要复杂的二进制流解析
      return 'high';
    } else {
      // OpenAI格式相对简单
      return 'medium';
    }
  }

  /**
   * 评估整体复杂度
   */
  assessOverallComplexity(codeAnalysis) {
    const factors = [
      codeAnalysis.linesOfCode > 300 ? 2 : 1,
      codeAnalysis.methodsFound.length > 10 ? 2 : 1,
      codeAnalysis.streamingSupport.streamingComplexity,
      codeAnalysis.errorHandlingPatterns.length
    ];
    
    const totalComplexity = factors.reduce((sum, factor) => sum + factor, 0);
    
    if (totalComplexity > 8) return 'high';
    if (totalComplexity > 5) return 'medium';
    return 'low';
  }

  /**
   * 评估配置复杂度
   */
  assessConfigurationComplexity(providerType) {
    if (providerType === 'codewhisperer') {
      // CodeWhisperer需要AWS SSO、profile ARN等复杂配置
      return 'high';
    } else {
      // OpenAI只需要API key和endpoint
      return 'low';
    }
  }

  /**
   * 对比provider架构
   */
  compareProviderArchitectures() {
    const providers = Object.keys(this.analysisResults);
    const comparison = {
      timestamp: new Date().toISOString(),
      providers: providers,
      differences: {},
      similarities: {},
      recommendations: []
    };

    if (providers.length < 2) {
      comparison.error = 'Need at least 2 providers for comparison';
      return comparison;
    }

    const [provider1, provider2] = providers;
    const arch1 = this.analysisResults[provider1].architecture;
    const arch2 = this.analysisResults[provider2].architecture;

    // 对比认证
    comparison.differences.authentication = {
      [provider1]: arch1.authentication,
      [provider2]: arch2.authentication,
      significant: arch1.authentication.type !== arch2.authentication.type
    };

    // 对比请求格式
    comparison.differences.requestFormat = {
      [provider1]: arch1.requestFormat,
      [provider2]: arch2.requestFormat,
      significant: arch1.requestFormat.nativeFormat !== arch2.requestFormat.nativeFormat
    };

    // 对比流式支持
    comparison.differences.streamingSupport = {
      [provider1]: arch1.streamingSupport,
      [provider2]: arch2.streamingSupport,
      significant: Math.abs(arch1.streamingSupport.complexity - arch2.streamingSupport.complexity) > 2
    };

    // 对比性能特征
    comparison.differences.performanceCharacteristics = {
      [provider1]: arch1.performanceCharacteristics,
      [provider2]: arch2.performanceCharacteristics,
      significant: arch1.performanceCharacteristics.complexity !== arch2.performanceCharacteristics.complexity
    };

    // 相似性分析
    comparison.similarities.outputFormat = arch1.responseFormat.outputFormat === arch2.responseFormat.outputFormat;
    comparison.similarities.errorHandling = arch1.errorHandling.customErrors === arch2.errorHandling.customErrors;

    // 生成建议
    comparison.recommendations = this.generateArchitectureRecommendations(comparison);

    return comparison;
  }

  /**
   * 生成架构建议
   */
  generateArchitectureRecommendations(comparison) {
    const recommendations = [];

    // 认证差异建议
    if (comparison.differences.authentication.significant) {
      recommendations.push({
        category: 'authentication',
        priority: 'high',
        description: '两个provider使用不同的认证机制',
        suggestion: '考虑统一认证接口，简化配置管理',
        impact: 'reduces configuration complexity'
      });
    }

    // 性能差异建议
    if (comparison.differences.performanceCharacteristics.significant) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        description: '两个provider性能特征差异较大',
        suggestion: '实施负载均衡策略，根据任务类型选择合适的provider',
        impact: 'improves overall system performance'
      });
    }

    // 流式处理建议
    if (comparison.differences.streamingSupport.significant) {
      recommendations.push({
        category: 'streaming',
        priority: 'medium',
        description: '流式处理复杂度差异显著',
        suggestion: '优化流式处理管道，统一SSE格式输出',
        impact: 'improves streaming consistency'
      });
    }

    return recommendations;
  }

  /**
   * 生成架构分析报告
   */
  generateArchitectureReport() {
    return {
      timestamp: new Date().toISOString(),
      reportType: 'Provider架构差异分析',
      summary: this.generateArchitectureSummary(),
      providerAnalysis: this.analysisResults,
      architectureComparison: this.comparisonResults,
      overallRecommendations: this.generateOverallRecommendations(),
      metadata: {
        analyzedProviders: Object.keys(this.analysisResults).length,
        analysisAspects: ARCHITECTURE_ANALYSIS_CONFIG.analysisAspects.length,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 生成架构摘要
   */
  generateArchitectureSummary() {
    const providers = Object.keys(this.analysisResults);
    const summary = {
      totalProviders: providers.length,
      architecturalDiversity: 'high', // 默认值
      complexityDistribution: {},
      authenticationMethods: [],
      streamingSupportLevel: 'mixed'
    };

    // 计算复杂度分布
    for (const provider of providers) {
      const arch = this.analysisResults[provider].architecture;
      if (arch && arch.performanceCharacteristics) {
        const complexity = arch.performanceCharacteristics.complexity;
        summary.complexityDistribution[complexity] = (summary.complexityDistribution[complexity] || 0) + 1;
      }
    }

    // 收集认证方法
    for (const provider of providers) {
      const arch = this.analysisResults[provider].architecture;
      if (arch && arch.authentication) {
        summary.authenticationMethods.push(arch.authentication.type);
      }
    }
    summary.authenticationMethods = [...new Set(summary.authenticationMethods)];

    return summary;
  }

  /**
   * 生成总体建议
   */
  generateOverallRecommendations() {
    const recommendations = [];

    // 基于分析结果生成建议
    const providers = Object.keys(this.analysisResults);
    
    if (providers.length > 1) {
      recommendations.push({
        category: 'architecture-unification',
        priority: 'high',
        description: '统一provider接口设计',
        details: [
          '标准化认证流程',
          '统一错误处理机制',
          '一致的配置格式',
          '标准化的响应转换'
        ],
        expectedBenefit: '降低维护成本，提高系统一致性'
      });

      recommendations.push({
        category: 'performance-optimization',
        priority: 'medium',
        description: '优化性能瓶颈',
        details: [
          '实施连接池管理',
          '优化流式处理管道',
          '改进错误恢复机制',
          '添加性能监控'
        ],
        expectedBenefit: '提高响应速度，降低资源消耗'
      });
    }

    return recommendations;
  }

  /**
   * 显示架构摘要
   */
  displayArchitectureSummary(report) {
    console.log('📊 架构分析摘要:');
    console.log(`🏗️  分析provider数量: ${report.summary.totalProviders}`);
    console.log(`🔐 认证方法: ${report.summary.authenticationMethods.join(', ')}`);
    console.log(`⚡ 复杂度分布: ${JSON.stringify(report.summary.complexityDistribution)}`);
    console.log(`📡 流式支持: ${report.summary.streamingSupportLevel}`);
    
    if (report.overallRecommendations.length > 0) {
      console.log(`\n💡 主要建议:`);
      report.overallRecommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.description} (${rec.priority})`);
      });
    }
  }

  /**
   * 保存架构分析报告
   */
  saveArchitectureReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `provider-architecture-analysis-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`📄 架构分析报告已保存: ${filename}`);
  }
}

// 主函数
async function main() {
  const analyzer = new ProviderArchitectureAnalyzer();
  
  try {
    const success = await analyzer.runArchitectureAnalysis();
    console.log('\n🏗️  架构分析完成!');
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 架构分析失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { ProviderArchitectureAnalyzer, ARCHITECTURE_ANALYSIS_CONFIG };