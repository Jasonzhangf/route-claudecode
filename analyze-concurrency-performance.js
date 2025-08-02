#!/usr/bin/env node

/**
 * Claude Code Router 并发性能分析工具
 * 分析API调用是否存在排队问题，检测并发性能瓶颈
 */

const fs = require('fs');
const path = require('path');

class ConcurrencyAnalyzer {
  constructor() {
    this.logBasePath = path.join(process.env.HOME, '.route-claude-code', 'logs');
    this.ports = [5508, 5509, 5506]; // 主要分析的端口
  }

  /**
   * 分析指定端口的并发性能
   */
  async analyzePort(port) {
    console.log(`\n📊 分析端口 ${port} 的并发性能`);
    console.log('=' .repeat(50));

    const portLogDir = path.join(this.logBasePath, `port-${port}`);
    
    if (!fs.existsSync(portLogDir)) {
      console.log(`❌ 端口 ${port} 日志目录不存在`);
      return null;
    }

    // 获取最新的rotation目录
    const rotationDirs = fs.readdirSync(portLogDir)
      .filter(dir => dir.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/))
      .sort()
      .slice(-3); // 取最近3个目录

    console.log(`🔍 分析目录: ${rotationDirs.join(', ')}`);

    let allRequests = [];

    for (const rotationDir of rotationDirs) {
      const fullPath = path.join(portLogDir, rotationDir);
      const requests = this.analyzeRotationDir(fullPath);
      allRequests = allRequests.concat(requests);
    }

    if (allRequests.length === 0) {
      console.log(`⚠️  端口 ${port} 没有找到请求数据`);
      return null;
    }

    // 按时间排序
    allRequests.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    const analysis = this.analyzeConcurrency(allRequests, port);
    this.printAnalysis(analysis, port);

    return analysis;
  }

  /**
   * 分析单个rotation目录
   */
  analyzeRotationDir(dirPath) {
    const files = fs.readdirSync(dirPath);
    const requests = new Map();

    // 收集所有请求的起始和结束时间
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const match = file.match(/^node-(start|provider-response|output-processed)-(.+)\.json$/);
      if (!match) continue;

      const [, stage, requestId] = match;
      const filePath = path.join(dirPath, file);

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (!requests.has(requestId)) {
          requests.set(requestId, { requestId, stages: {} });
        }

        requests.get(requestId).stages[stage] = {
          timestamp: data.timestamp,
          data: data.data
        };
      } catch (error) {
        // 忽略解析错误的文件
      }
    }

    // 转换为分析数据格式
    const requestList = [];
    for (const [requestId, request] of requests) {
      if (request.stages.start && request.stages['provider-response']) {
        const startTime = new Date(request.stages.start.timestamp);
        const providerTime = new Date(request.stages['provider-response'].timestamp);
        const endTime = request.stages['output-processed'] 
          ? new Date(request.stages['output-processed'].timestamp)
          : providerTime;

        requestList.push({
          requestId,
          startTime: startTime.toISOString(),
          providerTime: providerTime.toISOString(),
          endTime: endTime.toISOString(),
          totalDuration: endTime - startTime,
          providerDuration: providerTime - startTime,
          processingDuration: endTime - providerTime
        });
      }
    }

    return requestList;
  }

  /**
   * 分析并发性能
   */
  analyzeConcurrency(requests, port) {
    if (requests.length < 2) {
      return { 
        port, 
        totalRequests: requests.length, 
        concurrencyLevel: 0,
        queueing: false,
        analysis: '请求数量过少，无法分析并发性能'
      };
    }

    // 分析重叠的请求
    let maxConcurrent = 0;
    let totalOverlap = 0;
    let queueingDetected = false;
    let sequentialRequests = 0;

    const intervals = requests.map(req => ({
      start: new Date(req.startTime),
      end: new Date(req.endTime),
      requestId: req.requestId,
      duration: req.totalDuration
    }));

    // 检测并发级别
    for (let i = 0; i < intervals.length; i++) {
      let concurrent = 1; // 包括当前请求
      const current = intervals[i];

      for (let j = 0; j < intervals.length; j++) {
        if (i === j) continue;
        const other = intervals[j];

        // 检查时间重叠
        if (current.start < other.end && current.end > other.start) {
          concurrent++;
          totalOverlap++;
        }
      }

      maxConcurrent = Math.max(maxConcurrent, concurrent - 1); // 减去自己
    }

    // 检测排队模式 - 连续请求的开始时间间隔
    const gaps = [];
    for (let i = 1; i < requests.length; i++) {
      const prevEnd = new Date(requests[i-1].endTime);
      const currentStart = new Date(requests[i].startTime);
      const gap = currentStart - prevEnd;
      gaps.push(gap);

      // 如果当前请求在前一个请求结束后很快开始，可能是排队
      if (gap < 100 && gap >= 0) { // 100ms内开始
        sequentialRequests++;
      }
    }

    // 分析排队迹象
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const sequentialRatio = sequentialRequests / (requests.length - 1);

    queueingDetected = sequentialRatio > 0.7 || (maxConcurrent === 0 && requests.length > 5);

    // 计算性能指标
    const durations = requests.map(r => r.totalDuration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    return {
      port,
      totalRequests: requests.length,
      maxConcurrent,
      concurrencyLevel: maxConcurrent,
      queueing: queueingDetected,
      sequentialRatio,
      performance: {
        avgDuration: Math.round(avgDuration),
        maxDuration: Math.round(maxDuration),
        minDuration: Math.round(minDuration),
        avgGap: Math.round(avgGap)
      },
      timespan: {
        start: requests[0].startTime,
        end: requests[requests.length - 1].endTime,
        duration: new Date(requests[requests.length - 1].endTime) - new Date(requests[0].startTime)
      }
    };
  }

  /**
   * 打印分析结果
   */
  printAnalysis(analysis, port) {
    console.log(`\n📈 端口 ${port} 并发性能分析结果:`);
    console.log(`📊 总请求数: ${analysis.totalRequests}`);
    console.log(`🔄 最大并发数: ${analysis.maxConcurrent}`);
    console.log(`⏱️  平均响应时间: ${analysis.performance.avgDuration}ms`);
    console.log(`📏 请求间隔: ${analysis.performance.avgGap}ms`);
    console.log(`🔗 连续请求比例: ${(analysis.sequentialRatio * 100).toFixed(1)}%`);

    // 并发性能判断
    if (analysis.queueing) {
      console.log(`🚨 **检测到排队问题**: ${analysis.sequentialRatio > 0.8 ? '严重' : '轻微'}`);
      console.log(`   - 连续请求比例过高 (${(analysis.sequentialRatio * 100).toFixed(1)}%)`);
      console.log(`   - 最大并发数偏低 (${analysis.maxConcurrent})`);
    } else if (analysis.maxConcurrent > 2) {
      console.log(`✅ **良好的并发性能**: 最大并发 ${analysis.maxConcurrent} 个请求`);
    } else if (analysis.maxConcurrent === 0) {
      console.log(`⚠️  **可能存在串行处理**: 没有检测到并发请求`);
    } else {
      console.log(`📊 **中等并发性能**: 并发级别 ${analysis.maxConcurrent}`);
    }

    // 性能建议
    this.printOptimizationSuggestions(analysis);
  }

  /**
   * 打印优化建议
   */
  printOptimizationSuggestions(analysis) {
    console.log(`\n💡 性能优化建议:`);

    if (analysis.queueing) {
      console.log(`🔧 **排队问题解决方案**:`);
      console.log(`   1. 增加连接池大小 (httpClient maxConnections)`);
      console.log(`   2. 启用请求并发处理 (移除await阻塞)`);
      console.log(`   3. 实现异步队列管理`);
      console.log(`   4. 检查Provider端点并发限制`);
    }

    if (analysis.performance.avgDuration > 3000) {
      console.log(`⚡ **响应时间优化**:`);
      console.log(`   1. 启用连接复用 (keep-alive)`);
      console.log(`   2. 增加超时设置优化`);
      console.log(`   3. 考虑请求缓存机制`);
    }

    if (analysis.maxConcurrent < 3 && analysis.totalRequests > 10) {
      console.log(`🚀 **并发性能提升**:`);
      console.log(`   1. 检查Fastify配置 (connectionTimeout, keepAliveTimeout)`);
      console.log(`   2. 优化Provider client配置`);
      console.log(`   3. 实现请求流水线处理`);
    }
  }

  /**
   * 运行完整分析
   */
  async run() {
    console.log('🔍 Claude Code Router 并发性能分析');
    console.log('=====================================');

    const results = [];

    for (const port of this.ports) {
      try {
        const result = await this.analyzePort(port);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.log(`❌ 分析端口 ${port} 时出错:`, error.message);
      }
    }

    // 总结分析
    this.printSummary(results);
  }

  /**
   * 打印总结
   */
  printSummary(results) {
    if (results.length === 0) {
      console.log('\n❌ 没有可分析的数据');
      return;
    }

    console.log('\n📋 总体并发性能评估');
    console.log('========================');

    const queueingPorts = results.filter(r => r.queueing);
    const highConcurrencyPorts = results.filter(r => r.maxConcurrent > 2);

    if (queueingPorts.length > 0) {
      console.log(`🚨 发现排队问题的端口: ${queueingPorts.map(r => r.port).join(', ')}`);
      console.log(`   这些端口需要优先优化并发处理能力`);
    }

    if (highConcurrencyPorts.length > 0) {
      console.log(`✅ 并发性能良好的端口: ${highConcurrencyPorts.map(r => r.port).join(', ')}`);
    }

    const avgConcurrency = results.reduce((sum, r) => sum + r.maxConcurrent, 0) / results.length;
    console.log(`📊 平均并发级别: ${avgConcurrency.toFixed(1)}`);

    if (avgConcurrency < 1.5) {
      console.log(`\n🎯 **关键建议**: 系统整体并发性能偏低，建议:`);
      console.log(`   1. 检查HTTP客户端配置 (axios, node-fetch等)`);
      console.log(`   2. 优化异步请求处理流程`);
      console.log(`   3. 考虑实现请求池或队列管理`);
      console.log(`   4. 检查Provider端点的并发限制`);
    }
  }
}

// 运行分析
const analyzer = new ConcurrencyAnalyzer();
analyzer.run().catch(console.error);