/**
 * 回放系统实现
 * 
 * 提供调试数据回放、验证和报告功能
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  IReplaySystem,
  ReplayConfig,
  ReplayResult,
  ReplayDifference,
  RequestTrace,
  DebugRecord,
  RecordType
} from '../interfaces/core/debug-interface';

/**
 * 回放状态
 */
interface ReplayState {
  isRunning: boolean;
  config: ReplayConfig;
  startTime: Date;
  processedRequests: number;
  totalRequests: number;
  errors: Error[];
  currentRequestId?: string;
}

/**
 * 回放系统实现类
 */
export class ReplaySystem extends EventEmitter implements IReplaySystem {
  private state: ReplayState | null = null;
  private originalTraces: Map<string, RequestTrace> = new Map();
  private replayTraces: Map<string, RequestTrace> = new Map();

  constructor() {
    super();
  }

  /**
   * 开始回放
   */
  async startReplay(config: ReplayConfig): Promise<ReplayResult> {
    if (this.state?.isRunning) {
      throw new Error('Replay is already running');
    }

    this.state = {
      isRunning: true,
      config,
      startTime: new Date(),
      processedRequests: 0,
      totalRequests: 0,
      errors: [],
      currentRequestId: undefined
    };

    this.emit('replay-started', config);

    try {
      // 加载原始追踪数据
      await this.loadOriginalTraces();

      // 执行回放
      const result = await this.executeReplay();

      this.state.isRunning = false;
      this.emit('replay-completed', result);

      return result;
    } catch (error) {
      this.state.isRunning = false;
      const result: ReplayResult = {
        success: false,
        totalRequests: this.state.totalRequests,
        successfulRequests: this.state.processedRequests,
        failedRequests: this.state.totalRequests - this.state.processedRequests,
        executionTime: Date.now() - this.state.startTime.getTime(),
        differences: [],
        error: error as Error
      };

      this.emit('replay-completed', result);
      throw error;
    }
  }

  /**
   * 停止回放
   */
  async stopReplay(): Promise<void> {
    if (!this.state?.isRunning) {
      throw new Error('No replay is currently running');
    }

    this.state.isRunning = false;
    this.emit('replay-stopped');
  }

  /**
   * 获取回放状态
   */
  getReplayStatus(): any | null {
    if (!this.state) {
      return null;
    }

    return {
      isRunning: this.state.isRunning,
      sessionId: this.state.config.sessionId,
      startTime: this.state.startTime,
      processedRequests: this.state.processedRequests,
      totalRequests: this.state.totalRequests,
      currentRequestId: this.state.currentRequestId,
      progress: this.state.totalRequests > 0 ? this.state.processedRequests / this.state.totalRequests : 0,
      errors: this.state.errors.length
    };
  }

  /**
   * 验证回放结果
   */
  validateReplayResult(originalTrace: RequestTrace, replayTrace: RequestTrace): ReplayDifference[] {
    const differences: ReplayDifference[] = [];

    // 比较响应内容
    if (originalTrace.response && replayTrace.response) {
      const originalResponse = originalTrace.response;
      const replayResponse = replayTrace.response;

      // 比较状态码
      if (originalResponse.statusCode !== replayResponse.statusCode) {
        differences.push({
          requestId: originalTrace.requestId,
          field: 'response.statusCode',
          originalValue: originalResponse.statusCode,
          replayValue: replayResponse.statusCode,
          type: 'value'
        });
      }

      // 比较响应体（简化比较）
      const originalBody = JSON.stringify(originalResponse.body);
      const replayBody = JSON.stringify(replayResponse.body);
      
      if (originalBody !== replayBody) {
        differences.push({
          requestId: originalTrace.requestId,
          field: 'response.body',
          originalValue: originalResponse.body,
          replayValue: replayResponse.body,
          type: 'value'
        });
      }
    }

    // 比较错误状态
    const originalHasError = !!originalTrace.error;
    const replayHasError = !!replayTrace.error;

    if (originalHasError !== replayHasError) {
      differences.push({
        requestId: originalTrace.requestId,
        field: 'error',
        originalValue: originalTrace.error?.message || null,
        replayValue: replayTrace.error?.message || null,
        type: 'error'
      });
    }

    // 比较执行步骤数量
    if (originalTrace.steps.length !== replayTrace.steps.length) {
      differences.push({
        requestId: originalTrace.requestId,
        field: 'steps.length',
        originalValue: originalTrace.steps.length,
        replayValue: replayTrace.steps.length,
        type: 'value'
      });
    }

    // 比较性能指标（允许一定的时间差异）
    const timingTolerance = 0.2; // 20%的时间差异容忍度
    const originalTime = originalTrace.performance.totalTime;
    const replayTime = replayTrace.performance.totalTime;
    
    if (Math.abs(originalTime - replayTime) > originalTime * timingTolerance) {
      differences.push({
        requestId: originalTrace.requestId,
        field: 'performance.totalTime',
        originalValue: originalTime,
        replayValue: replayTime,
        type: 'timing'
      });
    }

    return differences;
  }

  /**
   * 导出回放报告
   */
  async exportReplayReport(result: ReplayResult, format: 'json' | 'html' | 'csv'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `replay-report-${timestamp}`;

    switch (format) {
      case 'json':
        return this.exportJsonReport(result, baseFileName);
      case 'html':
        return this.exportHtmlReport(result, baseFileName);
      case 'csv':
        return this.exportCsvReport(result, baseFileName);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 加载原始追踪数据
   */
  private async loadOriginalTraces(): Promise<void> {
    if (!this.state) {
      throw new Error('Replay state not initialized');
    }

    // 简化实现：从内存中加载（实际项目中应该从存储中加载）
    const mockTraces = this.generateMockTraces();
    
    for (const trace of mockTraces) {
      this.originalTraces.set(trace.requestId, trace);
    }

    this.state.totalRequests = this.originalTraces.size;
  }

  /**
   * 执行回放
   */
  private async executeReplay(): Promise<ReplayResult> {
    if (!this.state) {
      throw new Error('Replay state not initialized');
    }

    const startTime = Date.now();
    let successfulRequests = 0;
    let failedRequests = 0;
    const allDifferences: ReplayDifference[] = [];

    for (const [requestId, originalTrace] of Array.from(this.originalTraces.entries())) {
      if (!this.state.isRunning) {
        break;
      }

      this.state.currentRequestId = requestId;

      try {
        // 模拟回放执行
        const replayTrace = await this.simulateRequestReplay(originalTrace);
        this.replayTraces.set(requestId, replayTrace);

        // 验证结果
        if (this.state.config.validateOutputs) {
          const differences = this.validateReplayResult(originalTrace, replayTrace);
          allDifferences.push(...differences);
        }

        successfulRequests++;
        this.state.processedRequests++;

        // 应用速度倍数
        if (this.state.config.speedMultiplier > 0) {
          const delay = (1000 / this.state.config.speedMultiplier);
          await this.sleep(delay);
        }

        this.emit('request-replayed', {
          requestId,
          originalTrace,
          replayTrace,
          differences: this.state.config.validateOutputs ? 
            this.validateReplayResult(originalTrace, replayTrace) : []
        });

      } catch (error) {
        failedRequests++;
        this.state.errors.push(error as Error);

        if (!this.state.config.skipErrors) {
          throw error;
        }

        this.emit('request-replay-failed', {
          requestId,
          originalTrace,
          error: error as Error
        });
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      success: failedRequests === 0,
      totalRequests: this.state.totalRequests,
      successfulRequests,
      failedRequests,
      executionTime,
      differences: allDifferences
    };
  }

  /**
   * 模拟请求回放
   */
  private async simulateRequestReplay(originalTrace: RequestTrace): Promise<RequestTrace> {
    // 模拟回放执行，实际项目中这里会调用真实的请求处理流水线
    
    const startTime = new Date();
    
    // 模拟一些处理时间
    await this.sleep(Math.random() * 100);

    const replayTrace: RequestTrace = {
      requestId: originalTrace.requestId,
      sessionId: `replay_${originalTrace.sessionId}`,
      startTime,
      endTime: new Date(),
      request: originalTrace.request,
      response: originalTrace.response, // 模拟：使用相同的响应
      steps: originalTrace.steps, // 模拟：复制相同的步骤
      performance: {
        ...originalTrace.performance,
        totalTime: Math.random() * 200 + 50 // 模拟：随机的执行时间
      }
    };

    return replayTrace;
  }

  /**
   * 生成模拟追踪数据
   */
  private generateMockTraces(): RequestTrace[] {
    // 生成一些模拟的追踪数据用于测试
    const traces: RequestTrace[] = [];

    for (let i = 0; i < 5; i++) {
      const requestId = `req_${Date.now()}_${i}`;
      const trace: RequestTrace = {
        requestId,
        sessionId: this.state!.config.sessionId,
        startTime: new Date(Date.now() - i * 1000),
        endTime: new Date(Date.now() - i * 1000 + 500),
        request: {
          id: requestId,
          timestamp: new Date(Date.now() - i * 1000),
          method: 'POST',
          path: '/v1/messages',
          headers: { 'Content-Type': 'application/json' },
          body: {
            model: 'test-model',
            messages: [{ role: 'user', content: `Test message ${i}` }]
          },
          metadata: {
            originalFormat: 'openai',
            targetFormat: 'anthropic',
            provider: 'test-provider',
            category: 'test'
          }
        },
        response: {
          requestId,
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            id: `resp_${requestId}`,
            content: [{ type: 'text', text: `Test response ${i}` }],
            model: 'test-model'
          },
          processingTime: 500
        },
        steps: [
          {
            id: `step_${i}_1`,
            name: 'routing',
            moduleId: 'router',
            startTime: new Date(Date.now() - i * 1000),
            endTime: new Date(Date.now() - i * 1000 + 100),
            input: { model: 'test-model' },
            output: { provider: 'test-provider' }
          },
          {
            id: `step_${i}_2`,
            name: 'transform',
            moduleId: 'transformer',
            startTime: new Date(Date.now() - i * 1000 + 100),
            endTime: new Date(Date.now() - i * 1000 + 300),
            input: { format: 'openai' },
            output: { format: 'anthropic' }
          }
        ],
        performance: {
          totalTime: 500,
          routingTime: 100,
          pipelineTime: 300,
          networkTime: 80,
          transformTime: 20,
          memoryUsage: {
            heapUsed: 50 * 1024 * 1024,
            heapTotal: 60 * 1024 * 1024,
            external: 5 * 1024 * 1024
          },
          cpuUsage: {
            user: 1000,
            system: 500
          }
        }
      };

      traces.push(trace);
    }

    return traces;
  }

  /**
   * 导出JSON报告
   */
  private async exportJsonReport(result: ReplayResult, baseFileName: string): Promise<string> {
    const fileName = `${baseFileName}.json`;
    const content = JSON.stringify(result, null, 2);
    
    await fs.writeFile(fileName, content);
    return fileName;
  }

  /**
   * 导出HTML报告
   */
  private async exportHtmlReport(result: ReplayResult, baseFileName: string): Promise<string> {
    const fileName = `${baseFileName}.html`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Replay Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .differences { margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Replay Report</h1>
        <p><strong>Status:</strong> <span class="${result.success ? 'success' : 'error'}">${result.success ? 'SUCCESS' : 'FAILED'}</span></p>
        <p><strong>Execution Time:</strong> ${result.executionTime}ms</p>
        <p><strong>Total Requests:</strong> ${result.totalRequests}</p>
        <p><strong>Successful:</strong> <span class="success">${result.successfulRequests}</span></p>
        <p><strong>Failed:</strong> <span class="error">${result.failedRequests}</span></p>
    </div>

    <div class="differences">
        <h2>Differences (${result.differences.length})</h2>
        <table>
            <tr>
                <th>Request ID</th>
                <th>Field</th>
                <th>Original Value</th>
                <th>Replay Value</th>
                <th>Type</th>
            </tr>
            ${result.differences.map(diff => `
            <tr>
                <td>${diff.requestId}</td>
                <td>${diff.field}</td>
                <td>${JSON.stringify(diff.originalValue)}</td>
                <td>${JSON.stringify(diff.replayValue)}</td>
                <td>${diff.type}</td>
            </tr>
            `).join('')}
        </table>
    </div>

    ${result.error ? `
    <div class="error">
        <h2>Error Details</h2>
        <pre>${result.error.message}</pre>
        ${result.error.stack ? `<pre>${result.error.stack}</pre>` : ''}
    </div>
    ` : ''}
</body>
</html>
    `;

    await fs.writeFile(fileName, html);
    return fileName;
  }

  /**
   * 导出CSV报告
   */
  private async exportCsvReport(result: ReplayResult, baseFileName: string): Promise<string> {
    const fileName = `${baseFileName}.csv`;
    
    const csvContent = [
      'Request ID,Field,Original Value,Replay Value,Type',
      ...result.differences.map(diff => 
        `"${diff.requestId}","${diff.field}","${JSON.stringify(diff.originalValue)}","${JSON.stringify(diff.replayValue)}","${diff.type}"`
      )
    ].join('\n');

    await fs.writeFile(fileName, csvContent);
    return fileName;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}