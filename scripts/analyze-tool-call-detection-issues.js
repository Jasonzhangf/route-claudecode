#!/usr/bin/env node

/**
 * 工具调用检测问题分析脚本
 * 分析3456端口OpenAI日志中的工具调用检测问题
 * 避免tool call漏检和误检，确保finish_reason正确映射
 */

const fs = require('fs');
const path = require('path');

class ToolCallDetectionAnalyzer {
  constructor() {
    this.logDir = path.join(process.env.HOME, '.route-claude-code/logs/port-3456');
    this.analysisResults = {
      totalRequests: 0,
      toolCallRequests: 0,
      finishReasonIssues: 0,
      detectionIssues: 0,
      patterns: new Map(),
      recommendations: []
    };
  }

  /**
   * 分析最近的日志文件
   */
  async analyzeRecentLogs() {
    console.log('🔍 开始分析工具调用检测问题...');
    console.log(`📁 日志目录: ${this.logDir}`);

    if (!fs.existsSync(this.logDir)) {
      console.error('❌ 日志目录不存在，请确保服务器已运行');
      return;
    }

    // 获取最近的日志文件
    const logFiles = this.getRecentLogFiles();
    console.log(`📄 找到 ${logFiles.length} 个日志文件`);

    for (const logFile of logFiles) {
      await this.analyzeLogFile(logFile);
    }

    this.generateReport();
  }

  /**
   * 获取最近的日志文件
   */
  getRecentLogFiles() {
    const files = [];
    
    try {
      const entries = fs.readdirSync(this.logDir);
      
      for (const entry of entries) {
        const fullPath = path.join(this.logDir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile() && entry.endsWith('.log')) {
          files.push({
            path: fullPath,
            name: entry,
            mtime: stat.mtime
          });
        }
      }
      
      // 按修改时间排序，最新的在前
      return files.sort((a, b) => b.mtime - a.mtime).slice(0, 5);
      
    } catch (error) {
      console.error('❌ 读取日志目录失败:', error.message);
      return [];
    }
  }

  /**
   * 分析单个日志文件
   */
  async analyzeLogFile(logFile) {
    console.log(`\n📖 分析日志文件: ${logFile.name}`);
    
    try {
      const content = fs.readFileSync(logFile.path, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      let currentRequest = null;
      
      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          
          // 检测新请求开始
          if (this.isRequestStart(logEntry)) {
            if (currentRequest) {
              this.analyzeRequest(currentRequest);
            }
            currentRequest = this.initializeRequest(logEntry);
          }
          
          // 收集请求相关的日志
          if (currentRequest && this.isRelatedToRequest(logEntry, currentRequest.requestId)) {
            this.addLogToRequest(currentRequest, logEntry);
          }
          
        } catch (parseError) {
          // 跳过无法解析的行
          continue;
        }
      }
      
      // 分析最后一个请求
      if (currentRequest) {
        this.analyzeRequest(currentRequest);
      }
      
    } catch (error) {
      console.error(`❌ 分析日志文件失败 ${logFile.name}:`, error.message);
    }
  }

  /**
   * 检测是否是请求开始
   */
  isRequestStart(logEntry) {
    return logEntry.message && (
      logEntry.message.includes('Sending request to') ||
      logEntry.message.includes('Starting') ||
      logEntry.message.includes('Processing request')
    );
  }

  /**
   * 初始化请求对象
   */
  initializeRequest(logEntry) {
    return {
      requestId: logEntry.requestId || 'unknown',
      timestamp: logEntry.timestamp,
      logs: [logEntry],
      hasTools: false,
      toolCallsDetected: 0,
      finishReason: null,
      stopReason: null,
      provider: 'openai',
      model: logEntry.model || 'unknown'
    };
  }

  /**
   * 检测日志是否与请求相关
   */
  isRelatedToRequest(logEntry, requestId) {
    return logEntry.requestId === requestId;
  }

  /**
   * 添加日志到请求
   */
  addLogToRequest(request, logEntry) {
    request.logs.push(logEntry);
    
    // 检测工具相关信息
    if (logEntry.message) {
      if (logEntry.message.includes('tool') || logEntry.message.includes('function')) {
        request.hasTools = true;
      }
      
      if (logEntry.message.includes('finish_reason')) {
        request.finishReason = this.extractFinishReason(logEntry);
      }
      
      if (logEntry.message.includes('stop_reason')) {
        request.stopReason = this.extractStopReason(logEntry);
      }
    }
    
    // 检测工具调用数量
    if (logEntry.data && logEntry.data.toolCallsExtracted) {
      request.toolCallsDetected += logEntry.data.toolCallsExtracted;
    }
  }

  /**
   * 提取finish_reason
   */
  extractFinishReason(logEntry) {
    if (logEntry.data && logEntry.data.finishReason) {
      return logEntry.data.finishReason;
    }
    
    const match = logEntry.message.match(/finish_reason[:\s]+([a-zA-Z_]+)/);
    return match ? match[1] : null;
  }

  /**
   * 提取stop_reason
   */
  extractStopReason(logEntry) {
    if (logEntry.data && logEntry.data.stopReason) {
      return logEntry.data.stopReason;
    }
    
    const match = logEntry.message.match(/stop_reason[:\s]+([a-zA-Z_]+)/);
    return match ? match[1] : null;
  }

  /**
   * 分析单个请求
   */
  analyzeRequest(request) {
    this.analysisResults.totalRequests++;
    
    // 检测工具调用请求
    if (request.hasTools || request.toolCallsDetected > 0) {
      this.analysisResults.toolCallRequests++;
      
      // 检测finish_reason问题
      if (this.hasFinishReasonIssue(request)) {
        this.analysisResults.finishReasonIssues++;
        this.recordFinishReasonIssue(request);
      }
      
      // 检测工具调用检测问题
      if (this.hasDetectionIssue(request)) {
        this.analysisResults.detectionIssues++;
        this.recordDetectionIssue(request);
      }
    }
    
    // 记录模式
    this.recordPatterns(request);
  }

  /**
   * 检测finish_reason问题
   */
  hasFinishReasonIssue(request) {
    // 如果有工具调用但finish_reason不是tool_calls，则有问题
    if (request.toolCallsDetected > 0) {
      return request.finishReason !== 'tool_calls' && 
             request.stopReason !== 'tool_use';
    }
    
    // 如果请求包含工具定义但没有正确的finish_reason
    if (request.hasTools && request.finishReason === 'end_turn') {
      return true;
    }
    
    return false;
  }

  /**
   * 检测工具调用检测问题
   */
  hasDetectionIssue(request) {
    // 检查是否有工具调用但没有被检测到
    const hasToolCallInLogs = request.logs.some(log => 
      log.message && (
        log.message.includes('Tool call:') ||
        log.message.includes('function_call') ||
        log.message.includes('tool_use')
      )
    );
    
    return hasToolCallInLogs && request.toolCallsDetected === 0;
  }

  /**
   * 记录finish_reason问题
   */
  recordFinishReasonIssue(request) {
    const issue = {
      type: 'finish_reason_mapping',
      requestId: request.requestId,
      expected: 'tool_calls',
      actual: request.finishReason,
      stopReason: request.stopReason,
      toolCallsDetected: request.toolCallsDetected,
      model: request.model
    };
    
    console.log(`⚠️  Finish Reason Issue: ${request.requestId}`);
    console.log(`   Expected: tool_calls, Got: ${request.finishReason}`);
    console.log(`   Tool calls detected: ${request.toolCallsDetected}`);
    console.log(`   Model: ${request.model}`);
  }

  /**
   * 记录检测问题
   */
  recordDetectionIssue(request) {
    const issue = {
      type: 'tool_call_detection',
      requestId: request.requestId,
      hasToolsInRequest: request.hasTools,
      toolCallsDetected: request.toolCallsDetected,
      model: request.model
    };
    
    console.log(`🔍 Detection Issue: ${request.requestId}`);
    console.log(`   Has tools in request: ${request.hasTools}`);
    console.log(`   Tool calls detected: ${request.toolCallsDetected}`);
    console.log(`   Model: ${request.model}`);
  }

  /**
   * 记录模式
   */
  recordPatterns(request) {
    // 记录finish_reason模式
    const finishReasonKey = `finish_reason_${request.finishReason || 'null'}`;
    this.analysisResults.patterns.set(
      finishReasonKey,
      (this.analysisResults.patterns.get(finishReasonKey) || 0) + 1
    );
    
    // 记录工具调用模式
    if (request.toolCallsDetected > 0) {
      const toolCallKey = `tool_calls_${request.toolCallsDetected}`;
      this.analysisResults.patterns.set(
        toolCallKey,
        (this.analysisResults.patterns.get(toolCallKey) || 0) + 1
      );
    }
  }

  /**
   * 生成分析报告
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 工具调用检测问题分析报告');
    console.log('='.repeat(60));
    
    console.log(`\n📈 统计信息:`);
    console.log(`   总请求数: ${this.analysisResults.totalRequests}`);
    console.log(`   工具调用请求: ${this.analysisResults.toolCallRequests}`);
    console.log(`   Finish Reason问题: ${this.analysisResults.finishReasonIssues}`);
    console.log(`   检测问题: ${this.analysisResults.detectionIssues}`);
    
    console.log(`\n🔍 模式分析:`);
    for (const [pattern, count] of this.analysisResults.patterns.entries()) {
      console.log(`   ${pattern}: ${count}`);
    }
    
    this.generateRecommendations();
    
    console.log(`\n💡 建议措施:`);
    for (const recommendation of this.analysisResults.recommendations) {
      console.log(`   • ${recommendation}`);
    }
    
    // 保存详细报告
    this.saveDetailedReport();
  }

  /**
   * 生成建议
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.analysisResults.finishReasonIssues > 0) {
      recommendations.push('修复finish_reason映射逻辑，确保工具调用返回正确的finish_reason');
      recommendations.push('在OpenAI响应转换中添加工具调用检测和finish_reason修正');
    }
    
    if (this.analysisResults.detectionIssues > 0) {
      recommendations.push('优化工具调用检测算法，减少漏检');
      recommendations.push('添加更多工具调用模式匹配规则');
    }
    
    const toolCallRate = this.analysisResults.toolCallRequests / this.analysisResults.totalRequests;
    if (toolCallRate > 0.5) {
      recommendations.push('工具调用使用率较高，建议优化工具调用处理性能');
    }
    
    if (this.analysisResults.patterns.has('finish_reason_end_turn')) {
      const endTurnCount = this.analysisResults.patterns.get('finish_reason_end_turn');
      if (endTurnCount > this.analysisResults.toolCallRequests * 0.3) {
        recommendations.push('大量工具调用被错误标记为end_turn，需要紧急修复映射逻辑');
      }
    }
    
    this.analysisResults.recommendations = recommendations;
  }

  /**
   * 保存详细报告
   */
  saveDetailedReport() {
    const reportPath = `/tmp/tool-call-detection-analysis-${Date.now()}.json`;
    
    const report = {
      timestamp: new Date().toISOString(),
      analysis: this.analysisResults,
      patterns: Object.fromEntries(this.analysisResults.patterns),
      summary: {
        issueRate: this.analysisResults.finishReasonIssues / Math.max(this.analysisResults.toolCallRequests, 1),
        detectionRate: (this.analysisResults.toolCallRequests - this.analysisResults.detectionIssues) / Math.max(this.analysisResults.toolCallRequests, 1),
        toolCallUsage: this.analysisResults.toolCallRequests / Math.max(this.analysisResults.totalRequests, 1)
      }
    };
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 详细报告已保存: ${reportPath}`);
    } catch (error) {
      console.error(`❌ 保存报告失败: ${error.message}`);
    }
  }
}

// 主函数
async function main() {
  const analyzer = new ToolCallDetectionAnalyzer();
  await analyzer.analyzeRecentLogs();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ToolCallDetectionAnalyzer };