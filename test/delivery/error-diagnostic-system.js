#!/usr/bin/env node

/**
 * Delivery Test: Error Classification & Diagnosis System
 * 错误分类诊断系统 - 标准化错误处理和诊断
 */

const fs = require('fs');
const path = require('path');

// 错误分类体系
const ERROR_CATEGORIES = {
  LOCAL_SERVER_ERROR: 'local_server_error',
  REMOTE_PROVIDER_ERROR: 'remote_provider_error',
  NETWORK_ERROR: 'network_error',
  AUTHENTICATION_ERROR: 'authentication_error',
  RATE_LIMIT_ERROR: 'rate_limit_error',
  TIMEOUT_ERROR: 'timeout_error',
  CONFIGURATION_ERROR: 'configuration_error'
};

// 错误代码映射
const ERROR_CODE_MAPPING = {
  // 本地服务器错误 (5xx)
  500: { category: ERROR_CATEGORIES.LOCAL_SERVER_ERROR, severity: 'critical', action: 'fix_local_code' },
  501: { category: ERROR_CATEGORIES.LOCAL_SERVER_ERROR, severity: 'high', action: 'implement_feature' },
  502: { category: ERROR_CATEGORIES.LOCAL_SERVER_ERROR, severity: 'high', action: 'check_proxy_config' },
  503: { category: ERROR_CATEGORIES.LOCAL_SERVER_ERROR, severity: 'high', action: 'restart_service' },
  504: { category: ERROR_CATEGORIES.LOCAL_SERVER_ERROR, severity: 'medium', action: 'check_upstream_timeout' },
  
  // 远端Provider错误 (4xx)
  400: { category: ERROR_CATEGORIES.REMOTE_PROVIDER_ERROR, severity: 'medium', action: 'fix_request_format' },
  401: { category: ERROR_CATEGORIES.AUTHENTICATION_ERROR, severity: 'high', action: 'refresh_credentials' },
  403: { category: ERROR_CATEGORIES.AUTHENTICATION_ERROR, severity: 'high', action: 'check_permissions' },
  404: { category: ERROR_CATEGORIES.REMOTE_PROVIDER_ERROR, severity: 'medium', action: 'check_endpoint' },
  429: { category: ERROR_CATEGORIES.RATE_LIMIT_ERROR, severity: 'medium', action: 'implement_backoff' },
  
  // 网络错误
  'ECONNREFUSED': { category: ERROR_CATEGORIES.NETWORK_ERROR, severity: 'high', action: 'check_network_connectivity' },
  'ENOTFOUND': { category: ERROR_CATEGORIES.NETWORK_ERROR, severity: 'high', action: 'check_dns_resolution' },
  'ETIMEDOUT': { category: ERROR_CATEGORIES.TIMEOUT_ERROR, severity: 'medium', action: 'increase_timeout' },
  'ECONNRESET': { category: ERROR_CATEGORIES.NETWORK_ERROR, severity: 'medium', action: 'retry_connection' }
};

// 处理阶段定义
const PROCESSING_STAGES = {
  REQUEST_VALIDATION: 'request_validation',
  ROUTING: 'routing',
  PROVIDER_SELECTION: 'provider_selection',
  FORMAT_TRANSFORMATION: 'format_transformation',
  API_CALL: 'api_call',
  RESPONSE_PROCESSING: 'response_processing',
  OUTPUT_TRANSFORMATION: 'output_transformation'
};

class ErrorDiagnosticSystem {
  constructor() {
    this.outputDir = path.join(process.env.HOME, '.route-claude-code/database/delivery-testing/error-diagnostics');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 分析和分类错误
   */
  analyzeError(error, context = {}) {
    const analysis = {
      timestamp: new Date().toISOString(),
      category: ERROR_CATEGORIES.LOCAL_SERVER_ERROR, // 默认分类
      code: this.extractErrorCode(error),
      provider: context.provider || 'unknown',
      model: context.model || 'unknown',
      stage: context.stage || PROCESSING_STAGES.API_CALL,
      message: error.message || 'Unknown error',
      severity: 'medium',
      suggestedAction: 'investigate_manually',
      details: {
        requestId: context.requestId || 'unknown',
        sessionId: context.sessionId || 'unknown',
        stackTrace: error.stack || 'No stack trace available',
        originalError: this.sanitizeError(error),
        context: context
      }
    };

    // 根据错误代码进行分类
    const errorMapping = ERROR_CODE_MAPPING[analysis.code];
    if (errorMapping) {
      analysis.category = errorMapping.category;
      analysis.severity = errorMapping.severity;
      analysis.suggestedAction = errorMapping.action;
    } else {
      // 基于错误消息进行启发式分类
      analysis.category = this.classifyByMessage(error.message);
    }

    // 生成诊断建议
    analysis.diagnosis = this.generateDiagnosis(analysis);
    
    // 生成修复建议
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  /**
   * 提取错误代码
   */
  extractErrorCode(error) {
    // HTTP状态码
    if (error.response && error.response.status) {
      return error.response.status;
    }
    
    // 网络错误代码
    if (error.code) {
      return error.code;
    }
    
    // Axios错误代码
    if (error.errno) {
      return error.errno;
    }
    
    // 自定义错误代码
    if (error.errorCode) {
      return error.errorCode;
    }
    
    return 'UNKNOWN';
  }

  /**
   * 基于错误消息进行启发式分类
   */
  classifyByMessage(message) {
    if (!message) return ERROR_CATEGORIES.LOCAL_SERVER_ERROR;
    
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return ERROR_CATEGORIES.TIMEOUT_ERROR;
    }
    
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
      return ERROR_CATEGORIES.AUTHENTICATION_ERROR;
    }
    
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
      return ERROR_CATEGORIES.RATE_LIMIT_ERROR;
    }
    
    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      return ERROR_CATEGORIES.NETWORK_ERROR;
    }
    
    if (lowerMessage.includes('config') || lowerMessage.includes('configuration')) {
      return ERROR_CATEGORIES.CONFIGURATION_ERROR;
    }
    
    if (lowerMessage.includes('provider') || lowerMessage.includes('api')) {
      return ERROR_CATEGORIES.REMOTE_PROVIDER_ERROR;
    }
    
    return ERROR_CATEGORIES.LOCAL_SERVER_ERROR;
  }

  /**
   * 清理敏感信息
   */
  sanitizeError(error) {
    const sanitized = {
      name: error.name,
      message: error.message,
      code: error.code
    };
    
    // 移除敏感信息
    if (error.config) {
      sanitized.config = {
        method: error.config.method,
        url: this.sanitizeUrl(error.config.url),
        timeout: error.config.timeout
      };
    }
    
    if (error.response) {
      sanitized.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: this.sanitizeHeaders(error.response.headers)
      };
    }
    
    return sanitized;
  }

  /**
   * 清理URL中的敏感信息
   */
  sanitizeUrl(url) {
    if (!url) return url;
    
    // 移除API密钥参数
    return url.replace(/([?&])(api_key|key|token)=[^&]*/gi, '$1$2=***');
  }

  /**
   * 清理响应头中的敏感信息
   */
  sanitizeHeaders(headers) {
    if (!headers) return headers;
    
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '***';
      }
    }
    
    return sanitized;
  }

  /**
   * 生成诊断信息
   */
  generateDiagnosis(analysis) {
    const diagnosis = {
      category: analysis.category,
      severity: analysis.severity,
      isLocalIssue: this.isLocalIssue(analysis.category),
      isProviderIssue: this.isProviderIssue(analysis.category),
      requiresImmediateAction: analysis.severity === 'critical',
      canRetry: this.canRetry(analysis.category, analysis.code)
    };

    // 根据不同类别生成具体诊断
    switch (analysis.category) {
      case ERROR_CATEGORIES.LOCAL_SERVER_ERROR:
        diagnosis.description = `本地服务器错误 (${analysis.code}): 需要检查代码逻辑或服务器配置`;
        diagnosis.impact = '影响所有请求处理';
        diagnosis.urgency = 'high';
        break;
        
      case ERROR_CATEGORIES.REMOTE_PROVIDER_ERROR:
        diagnosis.description = `远端Provider错误 (${analysis.code}): ${analysis.provider}服务异常`;
        diagnosis.impact = `影响${analysis.provider}的所有请求`;
        diagnosis.urgency = 'medium';
        break;
        
      case ERROR_CATEGORIES.AUTHENTICATION_ERROR:
        diagnosis.description = `认证错误 (${analysis.code}): ${analysis.provider}凭据无效或过期`;
        diagnosis.impact = `${analysis.provider}无法使用`;
        diagnosis.urgency = 'high';
        break;
        
      case ERROR_CATEGORIES.RATE_LIMIT_ERROR:
        diagnosis.description = `速率限制错误 (${analysis.code}): ${analysis.provider}请求频率过高`;
        diagnosis.impact = '暂时无法使用该Provider';
        diagnosis.urgency = 'low';
        break;
        
      case ERROR_CATEGORIES.TIMEOUT_ERROR:
        diagnosis.description = `超时错误: 请求处理时间超过${analysis.details.context.timeout || '默认'}限制`;
        diagnosis.impact = '影响用户体验';
        diagnosis.urgency = 'medium';
        break;
        
      default:
        diagnosis.description = `未分类错误: ${analysis.message}`;
        diagnosis.impact = '未知影响范围';
        diagnosis.urgency = 'medium';
    }

    return diagnosis;
  }

  /**
   * 生成修复建议
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    switch (analysis.category) {
      case ERROR_CATEGORIES.LOCAL_SERVER_ERROR:
        recommendations.push({
          priority: 'immediate',
          action: '检查服务器日志和错误堆栈',
          command: `tail -f ~/.route-claude-code/logs/ccr-*.log | grep ERROR`
        });
        recommendations.push({
          priority: 'immediate',
          action: '重启服务并监控状态',
          command: './rcc restart && ./rcc status'
        });
        if (analysis.code === 500) {
          recommendations.push({
            priority: 'high',
            action: '检查代码逻辑错误',
            command: 'grep -r "throw\\|Error" src/ --include="*.ts"'
          });
        }
        break;
        
      case ERROR_CATEGORIES.REMOTE_PROVIDER_ERROR:
        recommendations.push({
          priority: 'high',
          action: `检查${analysis.provider}服务状态`,
          command: `curl -I ${this.getProviderHealthEndpoint(analysis.provider)}`
        });
        recommendations.push({
          priority: 'medium',
          action: '切换到备用Provider',
          command: `./rcc config --disable-provider ${analysis.provider}`
        });
        break;
        
      case ERROR_CATEGORIES.AUTHENTICATION_ERROR:
        recommendations.push({
          priority: 'immediate',
          action: `刷新${analysis.provider}认证凭据`,
          command: this.getCredentialRefreshCommand(analysis.provider)
        });
        recommendations.push({
          priority: 'high',
          action: '验证API密钥有效性',
          command: `./test-provider-auth.sh --provider ${analysis.provider}`
        });
        break;
        
      case ERROR_CATEGORIES.RATE_LIMIT_ERROR:
        recommendations.push({
          priority: 'medium',
          action: '实施指数退避重试策略',
          command: `./rcc config --set backoff.${analysis.provider}.enabled=true`
        });
        recommendations.push({
          priority: 'low',
          action: '考虑升级Provider套餐或增加账户',
          command: '联系Provider客服或购买更高配额'
        });
        break;
        
      case ERROR_CATEGORIES.TIMEOUT_ERROR:
        recommendations.push({
          priority: 'medium',
          action: '增加超时时间配置',
          command: `./rcc config --set timeout.${analysis.provider}=60000`
        });
        recommendations.push({
          priority: 'low',
          action: '优化请求大小和复杂度',
          command: '减少单次请求的token数量或复杂度'
        });
        break;
    }

    // 通用建议
    recommendations.push({
      priority: 'low',
      action: '运行完整诊断测试',
      command: './test-runner.sh --category delivery --provider ' + analysis.provider
    });

    return recommendations.sort((a, b) => {
      const priorities = { immediate: 4, high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
  }

  /**
   * 判断是否为本地问题
   */
  isLocalIssue(category) {
    return [
      ERROR_CATEGORIES.LOCAL_SERVER_ERROR,
      ERROR_CATEGORIES.CONFIGURATION_ERROR
    ].includes(category);
  }

  /**
   * 判断是否为Provider问题
   */  
  isProviderIssue(category) {
    return [
      ERROR_CATEGORIES.REMOTE_PROVIDER_ERROR,
      ERROR_CATEGORIES.AUTHENTICATION_ERROR,
      ERROR_CATEGORIES.RATE_LIMIT_ERROR
    ].includes(category);
  }

  /**
   * 判断是否可以重试
   */
  canRetry(category, code) {
    // 不可重试的错误
    const noRetryCategories = [ERROR_CATEGORIES.AUTHENTICATION_ERROR];
    const noRetryCodes = [400, 401, 403, 404];
    
    if (noRetryCategories.includes(category) || noRetryCodes.includes(code)) {
      return false;
    }
    
    // 可重试的错误
    const retryCategories = [
      ERROR_CATEGORIES.RATE_LIMIT_ERROR,
      ERROR_CATEGORIES.TIMEOUT_ERROR,
      ERROR_CATEGORIES.NETWORK_ERROR
    ];
    
    return retryCategories.includes(category) || [429, 500, 502, 503, 504].includes(code);
  }

  /**
   * 获取Provider健康检查端点
   */
  getProviderHealthEndpoint(provider) {
    const endpoints = {
      'codewhisperer': 'https://codewhisperer.us-east-1.amazonaws.com/health',
      'openai': 'https://api.openai.com/v1/models',
      'gemini': 'https://generativelanguage.googleapis.com/v1beta/models',
      'anthropic': 'https://api.anthropic.com/v1/messages'
    };
    
    return endpoints[provider] || 'unknown';
  }

  /**
   * 获取凭据刷新命令
   */
  getCredentialRefreshCommand(provider) {
    const commands = {
      'codewhisperer': 'aws sso login --profile kiro-auth && aws sso get-role-credentials --profile kiro-auth',
      'openai': 'echo "Check OPENAI_API_KEY environment variable"',
      'gemini': 'echo "Check GEMINI_API_KEY environment variable"',
      'anthropic': 'echo "Check ANTHROPIC_API_KEY environment variable"'
    };
    
    return commands[provider] || 'echo "Check provider credentials"';
  }

  /**
   * 保存错误分析结果
   */
  saveErrorAnalysis(analysis) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `error-analysis-${analysis.provider}-${analysis.code}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(analysis, null, 2));
    return filepath;
  }

  /**
   * 生成错误报告
   */
  generateErrorReport(errors) {
    const report = {
      timestamp: new Date().toISOString(),
      totalErrors: errors.length,
      categorySummary: {},
      providerSummary: {},
      severitySummary: {},
      recommendations: [],
      errors: errors
    };

    // 按类别统计
    for (const error of errors) {
      const category = error.category;
      if (!report.categorySummary[category]) {
        report.categorySummary[category] = 0;
      }
      report.categorySummary[category]++;
    }

    // 按Provider统计
    for (const error of errors) {
      const provider = error.provider;
      if (!report.providerSummary[provider]) {
        report.providerSummary[provider] = 0;
      }
      report.providerSummary[provider]++;
    }

    // 按严重程度统计
    for (const error of errors) {
      const severity = error.severity;
      if (!report.severitySummary[severity]) {
        report.severitySummary[severity] = 0;
      }
      report.severitySummary[severity]++;
    }

    // 生成综合建议
    report.recommendations = this.generateOverallRecommendations(report);

    return report;
  }

  /**
   * 生成综合建议
   */
  generateOverallRecommendations(report) {
    const recommendations = [];

    // 检查是否有大量本地错误
    const localErrors = report.categorySummary[ERROR_CATEGORIES.LOCAL_SERVER_ERROR] || 0;
    if (localErrors > report.totalErrors * 0.5) {
      recommendations.push({
        priority: 'critical',
        issue: '本地服务器错误过多',
        action: '立即检查服务器代码和配置',
        impact: 'high'
      });
    }

    // 检查Provider可用性问题
    for (const [provider, count] of Object.entries(report.providerSummary)) {
      if (count > 3) { // 某个Provider错误超过3个
        recommendations.push({
          priority: 'high',
          issue: `${provider} Provider错误频发`,
          action: `检查${provider}的配置和连接状态`,
          impact: 'medium'
        });
      }
    }

    // 检查认证问题
    const authErrors = Object.values(report.errors).filter(e => 
      e.category === ERROR_CATEGORIES.AUTHENTICATION_ERROR
    ).length;
    
    if (authErrors > 0) {
      recommendations.push({
        priority: 'high',
        issue: '存在认证错误',
        action: '刷新所有Provider的认证凭据',
        impact: 'high'
      });
    }

    return recommendations.sort((a, b) => {
      const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
  }

  /**
   * 打印错误分析结果
   */
  printErrorAnalysis(analysis) {
    console.log('\\n🚨 Error Analysis Report');
    console.log('=' * 50);
    console.log(`Category: ${analysis.category}`);
    console.log(`Code: ${analysis.code}`);
    console.log(`Provider: ${analysis.provider}`);
    console.log(`Model: ${analysis.model}`);
    console.log(`Stage: ${analysis.stage}`);
    console.log(`Severity: ${analysis.severity}`);
    console.log(`Message: ${analysis.message}`);
    
    console.log('\\n🔍 Diagnosis:');
    console.log(`  ${analysis.diagnosis.description}`);
    console.log(`  Impact: ${analysis.diagnosis.impact}`);
    console.log(`  Urgency: ${analysis.diagnosis.urgency}`);
    console.log(`  Can Retry: ${analysis.diagnosis.canRetry ? 'Yes' : 'No'}`);
    
    console.log('\\n💡 Recommendations:');
    for (const rec of analysis.recommendations) {
      console.log(`  [${rec.priority.toUpperCase()}] ${rec.action}`);
      if (rec.command) {
        console.log(`    Command: ${rec.command}`);
      }
    }
  }
}

// 命令行接口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const diagnostic = new ErrorDiagnosticSystem();
  
  switch (command) {
    case '--analyze':
      const logFile = args[1];
      if (!logFile || !fs.existsSync(logFile)) {
        console.error('❌ Please provide a valid log file path');
        process.exit(1);
      }
      // 这里需要实现日志解析逻辑
      console.log('🔍 Analyzing log file:', logFile);
      break;
      
    case '--categorize':
      const provider = args.find(arg => arg.startsWith('--provider='))?.split('=')[1];
      if (!provider) {
        console.error('❌ Please specify a provider with --provider=<name>');
        process.exit(1);
      }
      console.log('📊 Categorizing errors for provider:', provider);
      break;
      
    case '--recommend-fix':
      const errorCode = args.find(arg => arg.startsWith('--error-code='))?.split('=')[1];
      if (!errorCode) {
        console.error('❌ Please specify an error code with --error-code=<code>');
        process.exit(1);
      }
      
      // 模拟错误分析
      const mockError = new Error('Sample error for demonstration');
      mockError.response = { status: parseInt(errorCode) };
      
      const analysis = diagnostic.analyzeError(mockError, {
        provider: 'sample-provider',
        model: 'sample-model',
        stage: 'api_call'
      });
      
      diagnostic.printErrorAnalysis(analysis);
      break;
      
    default:
      console.log('📖 Error Diagnostic System Usage:');
      console.log('');
      console.log('  --analyze <log-file>          Analyze errors in log file');
      console.log('  --categorize --provider=<name> Categorize errors by provider');
      console.log('  --recommend-fix --error-code=<code> Get fix recommendations');
      console.log('');
      console.log('Examples:');
      console.log('  ./error-diagnostic-system.js --analyze logs/error-20250801.log');
      console.log('  ./error-diagnostic-system.js --categorize --provider=codewhisperer');
      console.log('  ./error-diagnostic-system.js --recommend-fix --error-code=500');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  ErrorDiagnosticSystem,
  ERROR_CATEGORIES,
  ERROR_CODE_MAPPING,
  PROCESSING_STAGES
};