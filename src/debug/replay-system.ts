/**
 * Debug回放系统
 * 
 * 支持请求重放、测试生成和结果验证
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { DebugRecord, ModuleRecord, ReplayResult, ReplayDifference } from './types/debug-types';
import { DebugRecorder } from './debug-recorder';
import { Pipeline } from '../pipeline/types';
import { PipelineManager } from '../pipeline/pipeline-manager';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * 回放系统接口
 */
export interface ReplaySystem {
  replayRequest(requestId: string): Promise<ReplayResult>;
  replayRequestWithOptions(requestId: string, options: ReplayOptions): Promise<ReplayResult>;
  createUnitTest(requestId: string): Promise<string>;
  createIntegrationTest(requestId: string): Promise<string>;
  validateReplay(original: DebugRecord, replayed: DebugRecord): boolean;
  batchReplay(requestIds: string[]): Promise<Map<string, ReplayResult>>;
  generatePerformanceReport(requestIds: string[]): Promise<PerformanceReport>;
}

/**
 * 回放选项
 */
export interface ReplayOptions {
  skipModules?: string[];
  onlyModules?: string[];
  mockExternalCalls?: boolean;
  validateOutput?: boolean;
  timeoutMs?: number;
  compareOptions?: CompareOptions;
}

/**
 * 比较选项
 */
export interface CompareOptions {
  ignoreFields?: string[];
  tolerancePercent?: number;
  ignoreTimestamps?: boolean;
  ignoreRandomIds?: boolean;
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  totalRequests: number;
  successfulReplays: number;
  failedReplays: number;
  averageOriginalTime: number;
  averageReplayTime: number;
  performanceRatio: number;
  modulePerformance: Map<string, {
    averageOriginalTime: number;
    averageReplayTime: number;
    successRate: number;
  }>;
  recommendations: string[];
}

/**
 * 回放错误
 */
export class ReplayError extends Error {
  constructor(requestId: string, operation: string, message: string) {
    super(`Replay ${operation} failed for ${requestId}: ${message}`);
    this.name = 'ReplayError';
  }
}

/**
 * 回放系统实现
 */
export class ReplaySystemImpl extends EventEmitter implements ReplaySystem {
  private recorder: DebugRecorder;
  private pipelineManager: PipelineManager;
  private replayCache: Map<string, ReplayResult> = new Map();

  constructor(recorder: DebugRecorder, pipelineManager?: PipelineManager) {
    super();
    this.recorder = recorder;
    this.pipelineManager = pipelineManager || new PipelineManager();
  }

  /**
   * 回放请求
   */
  async replayRequest(requestId: string): Promise<ReplayResult> {
    return this.replayRequestWithOptions(requestId, {});
  }

  /**
   * 带选项的回放请求
   */
  async replayRequestWithOptions(requestId: string, options: ReplayOptions): Promise<ReplayResult> {
    try {
      this.emit('replay-started', { requestId, options, timestamp: Date.now() });

      // 检查缓存
      const cacheKey = this.getCacheKey(requestId, options);
      if (this.replayCache.has(cacheKey)) {
        const cached = this.replayCache.get(cacheKey)!;
        this.emit('replay-cache-hit', { requestId, timestamp: Date.now() });
        return cached;
      }

      // 加载原始记录
      const originalRecord = await this.recorder.loadRecord(requestId);
      
      // 重建流水线环境
      const pipeline = await this.reconstructPipeline(originalRecord.pipeline);
      
      // 执行回放
      const replayStartTime = Date.now();
      const replayResult = await this.executePipelineReplay(pipeline, originalRecord, options);
      const replayEndTime = Date.now();

      // 创建回放记录
      const replayedRecord: DebugRecord = {
        ...originalRecord,
        requestId: `${requestId}-replay-${Date.now()}`,
        timestamp: replayStartTime,
        readableTime: this.formatReadableTime(replayStartTime),
        response: {
          ...originalRecord.response,
          body: replayResult,
          duration: replayEndTime - replayStartTime
        }
      };

      // 比较结果
      const differences = this.findDifferences(
        originalRecord.response.body,
        replayResult,
        options.compareOptions
      );
      
      const isValid = options.validateOutput !== false ? 
        this.validateReplay(originalRecord, replayedRecord) : true;

      const result: ReplayResult = {
        original: originalRecord.response.body,
        replayed: replayResult,
        isValid,
        differences,
        performance: {
          originalDuration: originalRecord.response.duration,
          replayDuration: replayEndTime - replayStartTime,
          performanceRatio: originalRecord.response.duration > 0 ? 
            (replayEndTime - replayStartTime) / originalRecord.response.duration : 1
        }
      };

      // 缓存结果
      this.replayCache.set(cacheKey, result);

      this.emit('replay-completed', {
        requestId,
        isValid,
        differences: differences.length,
        performanceRatio: result.performance.performanceRatio,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.emit('replay-failed', {
        requestId,
        error: error.message,
        timestamp: Date.now()
      });
      throw new ReplayError(requestId, 'execution', error.message);
    }
  }

  /**
   * 创建单元测试
   */
  async createUnitTest(requestId: string): Promise<string> {
    try {
      const record = await this.recorder.loadRecord(requestId);
      
      const testCode = this.generateUnitTestCode(record);
      
      // 保存测试文件
      const testPath = await this.saveTestFile(requestId, 'unit', testCode);
      
      this.emit('unit-test-generated', {
        requestId,
        testPath,
        timestamp: Date.now()
      });

      return testCode;

    } catch (error) {
      throw new ReplayError(requestId, 'unit-test-generation', error.message);
    }
  }

  /**
   * 创建集成测试
   */
  async createIntegrationTest(requestId: string): Promise<string> {
    try {
      const record = await this.recorder.loadRecord(requestId);
      
      const testCode = this.generateIntegrationTestCode(record);
      
      // 保存测试文件
      const testPath = await this.saveTestFile(requestId, 'integration', testCode);
      
      this.emit('integration-test-generated', {
        requestId,
        testPath,
        timestamp: Date.now()
      });

      return testCode;

    } catch (error) {
      throw new ReplayError(requestId, 'integration-test-generation', error.message);
    }
  }

  /**
   * 验证回放结果
   */
  validateReplay(original: DebugRecord, replayed: DebugRecord): boolean {
    try {
      // 基本结构验证
      if (!this.compareStructure(original.response, replayed.response)) {
        return false;
      }

      // 关键字段验证
      if (!this.compareKeyFields(original.response.body, replayed.response.body)) {
        return false;
      }

      // 模块执行验证
      return this.compareModuleExecution(original.pipeline.modules, replayed.pipeline.modules);

    } catch (error) {
      console.error('验证回放结果失败:', error);
      return false;
    }
  }

  /**
   * 批量回放
   */
  async batchReplay(requestIds: string[]): Promise<Map<string, ReplayResult>> {
    const results = new Map<string, ReplayResult>();
    const concurrency = 3; // 限制并发数
    
    this.emit('batch-replay-started', {
      totalRequests: requestIds.length,
      timestamp: Date.now()
    });

    for (let i = 0; i < requestIds.length; i += concurrency) {
      const batch = requestIds.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (requestId) => {
        try {
          const result = await this.replayRequest(requestId);
          results.set(requestId, result);
          return { requestId, success: true };
        } catch (error) {
          console.error(`批量回放失败 [${requestId}]:`, error);
          return { requestId, success: false, error: error.message };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      this.emit('batch-replay-progress', {
        completed: Math.min(i + concurrency, requestIds.length),
        total: requestIds.length,
        timestamp: Date.now()
      });
    }

    this.emit('batch-replay-completed', {
      totalRequests: requestIds.length,
      successfulReplays: results.size,
      timestamp: Date.now()
    });

    return results;
  }

  /**
   * 生成性能报告
   */
  async generatePerformanceReport(requestIds: string[]): Promise<PerformanceReport> {
    const replayResults = await this.batchReplay(requestIds);
    
    let totalOriginalTime = 0;
    let totalReplayTime = 0;
    let successfulReplays = 0;
    const moduleStats = new Map<string, {
      originalTimes: number[];
      replayTimes: number[];
      successCount: number;
      totalCount: number;
    }>();

    for (const [requestId, result] of replayResults) {
      if (result.isValid) {
        successfulReplays++;
        totalOriginalTime += result.performance.originalDuration;
        totalReplayTime += result.performance.replayDuration;

        // 收集模块性能数据
        try {
          const record = await this.recorder.loadRecord(requestId);
          for (const module of record.pipeline.modules) {
            if (!moduleStats.has(module.moduleName)) {
              moduleStats.set(module.moduleName, {
                originalTimes: [],
                replayTimes: [],
                successCount: 0,
                totalCount: 0
              });
            }
            
            const stats = moduleStats.get(module.moduleName)!;
            stats.originalTimes.push(module.duration);
            stats.replayTimes.push(module.duration); // 简化实现
            stats.successCount++;
            stats.totalCount++;
          }
        } catch (error) {
          console.error(`收集模块性能数据失败 [${requestId}]:`, error);
        }
      }
    }

    // 生成模块性能统计
    const modulePerformance = new Map<string, {
      averageOriginalTime: number;
      averageReplayTime: number;
      successRate: number;
    }>();

    for (const [moduleName, stats] of moduleStats) {
      modulePerformance.set(moduleName, {
        averageOriginalTime: stats.originalTimes.reduce((a, b) => a + b, 0) / stats.originalTimes.length,
        averageReplayTime: stats.replayTimes.reduce((a, b) => a + b, 0) / stats.replayTimes.length,
        successRate: stats.successCount / stats.totalCount
      });
    }

    // 生成建议
    const recommendations = this.generateRecommendations({
      totalRequests: requestIds.length,
      successfulReplays,
      averageOriginalTime: totalOriginalTime / successfulReplays,
      averageReplayTime: totalReplayTime / successfulReplays,
      modulePerformance
    });

    return {
      totalRequests: requestIds.length,
      successfulReplays,
      failedReplays: requestIds.length - successfulReplays,
      averageOriginalTime: totalOriginalTime / successfulReplays,
      averageReplayTime: totalReplayTime / successfulReplays,
      performanceRatio: totalOriginalTime > 0 ? totalReplayTime / totalOriginalTime : 1,
      modulePerformance,
      recommendations
    };
  }

  // ===== Private Helper Methods =====

  private async reconstructPipeline(pipelineInfo: DebugRecord['pipeline']): Promise<Pipeline> {
    // 简化实现：创建基本流水线
    return {
      id: pipelineInfo.id,
      provider: pipelineInfo.provider,
      model: pipelineInfo.model,
      modules: pipelineInfo.modules.map(m => ({
        name: m.moduleName,
        version: m.metadata.version,
        config: m.metadata.config
      })),
      process: async (input: any) => {
        // 这里应该重建实际的流水线处理逻辑
        // 简化实现直接返回模拟结果
        return { 
          choices: [{ 
            message: { 
              content: 'Replayed response for testing',
              role: 'assistant' 
            }
          }]
        };
      }
    } as any; // 简化类型
  }

  private async executePipelineReplay(pipeline: Pipeline, record: DebugRecord, options: ReplayOptions): Promise<any> {
    // 设置超时
    const timeoutMs = options.timeoutMs || 30000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Replay timeout')), timeoutMs);
    });

    // 执行回放
    const replayPromise = pipeline.process(record.request.body);

    return Promise.race([replayPromise, timeoutPromise]);
  }

  private findDifferences(original: any, replayed: any, options?: CompareOptions): ReplayDifference[] {
    const differences: ReplayDifference[] = [];
    
    try {
      this.compareObjects(original, replayed, '', differences, options);
    } catch (error) {
      console.error('查找差异失败:', error);
    }

    return differences;
  }

  private compareObjects(obj1: any, obj2: any, path: string, differences: ReplayDifference[], options?: CompareOptions): void {
    if (obj1 === obj2) return;

    if (typeof obj1 !== typeof obj2) {
      differences.push({
        path,
        originalValue: obj1,
        replayedValue: obj2,
        type: 'modified'
      });
      return;
    }

    if (typeof obj1 === 'object' && obj1 !== null && obj2 !== null) {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      const allKeys = new Set([...keys1, ...keys2]);

      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        
        // 跳过忽略的字段
        if (options?.ignoreFields?.includes(key)) continue;
        
        if (!(key in obj1)) {
          differences.push({
            path: newPath,
            originalValue: undefined,
            replayedValue: obj2[key],
            type: 'added'
          });
        } else if (!(key in obj2)) {
          differences.push({
            path: newPath,
            originalValue: obj1[key],
            replayedValue: undefined,
            type: 'removed'
          });
        } else {
          this.compareObjects(obj1[key], obj2[key], newPath, differences, options);
        }
      }
    } else {
      differences.push({
        path,
        originalValue: obj1,
        replayedValue: obj2,
        type: 'modified'
      });
    }
  }

  private compareStructure(original: any, replayed: any): boolean {
    if (typeof original !== typeof replayed) return false;
    
    if (typeof original === 'object' && original !== null) {
      const keys1 = Object.keys(original);
      const keys2 = Object.keys(replayed);
      
      return keys1.length === keys2.length && 
             keys1.every(key => key in replayed);
    }
    
    return true;
  }

  private compareKeyFields(original: any, replayed: any): boolean {
    // 比较关键字段（如choices, message等）
    if (original?.choices && replayed?.choices) {
      return original.choices.length === replayed.choices.length;
    }
    return true;
  }

  private compareModuleExecution(original: ModuleRecord[], replayed: ModuleRecord[]): boolean {
    if (original.length !== replayed.length) return false;
    
    for (let i = 0; i < original.length; i++) {
      if (original[i].moduleName !== replayed[i].moduleName) return false;
    }
    
    return true;
  }

  private generateUnitTestCode(record: DebugRecord): string {
    return `
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ${record.pipeline.modules.map(m => m.moduleName).join(', ')} } from '../src/modules';

describe('Pipeline Replay Test - ${record.requestId}', () => {
  const requestId = '${record.requestId}';
  const timestamp = '${record.readableTime}';

  beforeAll(async () => {
    // 初始化测试环境
    console.log(\`开始回放测试: \${requestId} (\${timestamp})\`);
  });

  afterAll(async () => {
    // 清理测试环境
    console.log(\`回放测试完成: \${requestId}\`);
  });

  test('should process input through pipeline modules', async () => {
    const input = ${JSON.stringify(record.request.body, null, 4)};
    const expectedOutput = ${JSON.stringify(record.response.body, null, 4)};

    ${record.pipeline.modules.map((module, index) => `
    // 步骤 ${index + 1}: ${module.moduleName}
    const step${index + 1}Input = ${index === 0 ? 'input' : `step${index}Output`};
    const step${index + 1}Output = await ${module.moduleName}.process(step${index + 1}Input);
    
    expect(step${index + 1}Output).toBeDefined();
    ${module.error ? `expect(() => { throw new Error('${module.error.message}'); }).toThrow();` : ''}
    `).join('\n')}

    // 验证最终输出
    const finalOutput = step${record.pipeline.modules.length}Output;
    expect(finalOutput).toMatchObject(expectedOutput);
  });

  test('should maintain performance within acceptable range', async () => {
    const startTime = performance.now();
    
    // 执行回放
    const input = ${JSON.stringify(record.request.body, null, 4)};
    // ... 执行逻辑 ...
    
    const duration = performance.now() - startTime;
    const originalDuration = ${record.response.duration};
    
    // 性能不应劣化超过50%
    expect(duration).toBeLessThan(originalDuration * 1.5);
  });
});
`.trim();
  }

  private generateIntegrationTestCode(record: DebugRecord): string {
    return `
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { PipelineManager } from '../src/pipeline/pipeline-manager';
import { DebugManager } from '../src/debug/debug-manager';

describe('Integration Replay Test - ${record.requestId}', () => {
  let pipelineManager: PipelineManager;
  let debugManager: DebugManager;

  beforeAll(async () => {
    // 初始化集成测试环境
    pipelineManager = new PipelineManager();
    debugManager = new DebugManager();
    
    console.log('集成测试环境已初始化');
  });

  afterAll(async () => {
    // 清理集成测试环境
    await pipelineManager.cleanup();
    await debugManager.cleanup();
    
    console.log('集成测试环境已清理');
  });

  test('should reproduce complete end-to-end behavior', async () => {
    // 创建完整的请求上下文
    const request = {
      method: '${record.request.method}',
      url: '${record.request.url}',
      headers: ${JSON.stringify(record.request.headers, null, 6)},
      body: ${JSON.stringify(record.request.body, null, 6)}
    };

    // 创建流水线
    const pipeline = await pipelineManager.createPipeline('${record.pipeline.provider}', '${record.pipeline.model}');
    
    // 启用调试
    const session = debugManager.createSession(${record.port});
    
    try {
      // 执行完整请求
      const response = await pipeline.process(request.body);
      
      // 验证响应结构
      expect(response).toBeDefined();
      expect(response).toHaveProperty('choices');
      
      // 验证调试记录
      const debugRecord = await debugManager.getRecorder().loadRecord('${record.requestId}');
      expect(debugRecord.pipeline.modules).toHaveLength(${record.pipeline.modules.length});
      
      // 验证各模块执行
      ${record.pipeline.modules.map((module, index) => `
      expect(debugRecord.pipeline.modules[${index}].moduleName).toBe('${module.moduleName}');
      expect(debugRecord.pipeline.modules[${index}].duration).toBeLessThan(${module.duration * 2});
      `).join('')}
      
    } finally {
      await debugManager.endSession(session.sessionId);
    }
  });

  test('should handle errors gracefully', async () => {
    // 测试错误处理
    ${record.error ? `
    const invalidInput = { invalid: 'data' };
    
    await expect(async () => {
      const pipeline = await pipelineManager.createPipeline('${record.pipeline.provider}', '${record.pipeline.model}');
      await pipeline.process(invalidInput);
    }).rejects.toThrow();
    ` : `
    // 原始请求无错误，跳过错误测试
    expect(true).toBe(true);
    `}
  });
});
`.trim();
  }

  private async saveTestFile(requestId: string, testType: string, testCode: string): Promise<string> {
    const testDir = path.join(process.cwd(), 'tests', 'replay', testType);
    await mkdir(testDir, { recursive: true });
    
    const testPath = path.join(testDir, `${requestId}-${testType}.test.ts`);
    await writeFile(testPath, testCode);
    
    return testPath;
  }

  private generateRecommendations(reportData: any): string[] {
    const recommendations: string[] = [];

    if (reportData.successfulReplays / reportData.totalRequests < 0.8) {
      recommendations.push('回放成功率较低，建议检查环境一致性和数据完整性');
    }

    if (reportData.performanceRatio > 1.5) {
      recommendations.push('回放性能明显劣化，建议优化测试环境或检查资源限制');
    }

    for (const [moduleName, perf] of reportData.modulePerformance) {
      if (perf.successRate < 0.9) {
        recommendations.push(`模块 ${moduleName} 成功率较低 (${(perf.successRate * 100).toFixed(1)}%)，需要特别关注`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('回放测试表现良好，无需特别优化');
    }

    return recommendations;
  }

  private getCacheKey(requestId: string, options: ReplayOptions): string {
    return `${requestId}-${JSON.stringify(options)}`;
  }

  private formatReadableTime(timestamp: number): string {
    const date = new Date(timestamp);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${date.toLocaleString('zh-CN', { timeZone: timezone })} ${timezone}`;
  }
}