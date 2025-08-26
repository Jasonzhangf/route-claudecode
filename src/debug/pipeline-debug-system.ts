/**
 * Pipeline调试系统核心实现
 * 
 * 负责：
 * 1. 记录所有"活着"的流水线
 * 2. 初始化检查 - 验证配置vs实际创建的流水线
 * 3. 运行时诊断 - 分层测试和问题定位
 * 4. 架构验证 - 确保每条流水线的4层结构完整
 * 
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { PipelineManager } from '../pipeline/pipeline-manager';
import { RoutingTable, PipelineRoute } from '../router/pipeline-router';
import { secureLogger } from '../utils/secure-logger';

/**
 * 流水线调试信息
 */
export interface PipelineDebugInfo {
  pipelineId: string;
  status: 'initializing' | 'runtime' | 'error' | 'stopped';
  routeInfo: {
    virtualModel: string;
    provider: string;
    targetModel: string;
    apiKeyIndex: number;
  };
  layerStatus: {
    transformer: 'connected' | 'error';
    protocol: 'connected' | 'error';
    serverCompatibility: 'connected' | 'error';
    server: 'connected' | 'error';
  };
  lastExecutionTime?: Date;
  errorCount: number;
  successCount: number;
}

/**
 * 期望的流水线配置
 */
export interface ExpectedPipeline {
  pipelineId: string;
  provider: string;
  targetModel: string;
  apiKeyIndex: number;
  shouldExist: boolean;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalExpected: number;
  totalFound: number;
  missingPipelines: string[];
  unexpectedPipelines: string[];
}

/**
 * 路由测试结果
 */
export interface RoutingTestResult {
  virtualModel: string;
  availablePipelines: string[];
  selectedPipelineId: string;
  isRoutingValid: boolean;
}

/**
 * 执行测试结果
 */
export interface ExecutionTestResult {
  pipelineId: string;
  hasResponse: boolean;
  response: any | null;
  executionTime: number;
  error: string | null;
}

/**
 * Pipeline调试系统
 */
export class PipelineDebugSystem extends EventEmitter {
  private pipelineManager: PipelineManager;
  private livePipelines: Map<string, PipelineDebugInfo> = new Map();
  private lastCheckTime?: Date;

  constructor(pipelineManager: PipelineManager) {
    super();
    this.pipelineManager = pipelineManager;
  }

  /**
   * 执行完整的初始化检查
   */
  async performInitializationCheck(routingTable: RoutingTable): Promise<ValidationResult> {
    secureLogger.info('🔍 === Pipeline Initialization Check ===');
    
    try {
      // Step 1: 记录所有"活着"的流水线
      const livePipelines = this.recordLivePipelines();
      
      // Step 2: 根据配置文件计算期望的流水线
      const expectedPipelines = this.calculateExpectedPipelines(routingTable);
      
      // Step 3: 对比验证
      const validationResult = this.validatePipelinesAgainstConfig(expectedPipelines, livePipelines);
      
      // Step 4: 检查每条流水线的内部架构
      if (validationResult.isValid) {
        await this.validatePipelineArchitecture(livePipelines);
      }
      
      // Step 5: 记录检查时间
      this.lastCheckTime = new Date();
      this.emit('initializationCheckCompleted', { validationResult, timestamp: this.lastCheckTime });
      
      if (validationResult.isValid) {
        secureLogger.info('✅ Initialization check passed: All pipelines correctly configured', {
          totalExpected: validationResult.totalExpected,
          totalFound: validationResult.totalFound
        });
      } else {
        secureLogger.error('❌ Initialization check failed', {
          errors: validationResult.errors,
          missingPipelines: validationResult.missingPipelines,
          unexpectedPipelines: validationResult.unexpectedPipelines
        });
      }
      
      return validationResult;
      
    } catch (error) {
      const errorResult: ValidationResult = {
        isValid: false,
        errors: [`Initialization check failed: ${error.message}`],
        warnings: [],
        totalExpected: 0,
        totalFound: 0,
        missingPipelines: [],
        unexpectedPipelines: []
      };
      
      secureLogger.error('❌ Initialization check threw error', { error: error.message });
      this.emit('initializationCheckFailed', { error: error.message, timestamp: new Date() });
      
      return errorResult;
    }
  }

  /**
   * 记录所有活着的流水线
   */
  recordLivePipelines(): PipelineDebugInfo[] {
    secureLogger.info('📋 Recording live pipelines:');
    
    const allPipelines = this.pipelineManager.getAllPipelines();
    const debugInfoList: PipelineDebugInfo[] = [];
    
    // 清空之前的记录
    this.livePipelines.clear();
    
    for (const [pipelineId, pipeline] of allPipelines) {
      const debugInfo: PipelineDebugInfo = {
        pipelineId,
        status: this.getPipelineStatus(pipeline),
        routeInfo: {
          virtualModel: this.extractVirtualModel(pipeline),
          provider: this.extractProvider(pipeline),
          targetModel: this.extractTargetModel(pipeline),
          apiKeyIndex: this.extractApiKeyIndex(pipelineId)
        },
        layerStatus: {
          transformer: this.checkLayerStatus(pipeline, 'transformer'),
          protocol: this.checkLayerStatus(pipeline, 'protocol'),
          serverCompatibility: this.checkLayerStatus(pipeline, 'serverCompatibility'),
          server: this.checkLayerStatus(pipeline, 'server')
        },
        lastExecutionTime: undefined,
        errorCount: 0,
        successCount: 0
      };
      
      debugInfoList.push(debugInfo);
      this.livePipelines.set(pipelineId, debugInfo);
      
      secureLogger.info(`  ✅ ${pipelineId}`, {
        virtualModel: debugInfo.routeInfo.virtualModel,
        providerModel: `${debugInfo.routeInfo.provider}.${debugInfo.routeInfo.targetModel}`,
        apiKeyIndex: debugInfo.routeInfo.apiKeyIndex,
        status: debugInfo.status,
        layers: debugInfo.layerStatus
      });
    }
    
    secureLogger.info(`📊 Total live pipelines recorded: ${debugInfoList.length}`);
    return debugInfoList;
  }

  /**
   * 根据路由表计算期望的流水线
   */
  calculateExpectedPipelines(routingTable: RoutingTable): ExpectedPipeline[] {
    secureLogger.info('🧮 Calculating expected pipelines from config:');
    
    const expected: ExpectedPipeline[] = [];
    const seenProviderModels = new Set<string>();
    
    for (const [virtualModel, routes] of Object.entries(routingTable.routes)) {
      for (const route of routes) {
        // 从pipelineId中解析出targetModel信息
        // pipelineId格式: provider-targetModel-keyN
        const pipelineIdParts = route.pipelineId.split('-');
        const targetModel = pipelineIdParts.length >= 2 ? pipelineIdParts.slice(1, -1).join('-') : 'unknown';
        const providerModel = `${route.provider}-${targetModel}`;
        
        // 避免重复计算相同的Provider.Model
        if (!seenProviderModels.has(providerModel)) {
          seenProviderModels.add(providerModel);
          
          // 从pipelineId推断单个流水线（新架构中每个流水线对应一个apiKey）
          const expectedPipeline: ExpectedPipeline = {
            pipelineId: route.pipelineId,
            provider: route.provider,
            targetModel: targetModel,
            apiKeyIndex: route.apiKeyIndex,
            shouldExist: true
          };
          
          expected.push(expectedPipeline);
          secureLogger.info(`  📋 Expected: ${expectedPipeline.pipelineId}`);
        }
      }
    }
    
    secureLogger.info(`📊 Total expected pipelines: ${expected.length}`);
    return expected;
  }

  /**
   * 验证实际流水线vs配置
   */
  validatePipelinesAgainstConfig(
    expectedPipelines: ExpectedPipeline[], 
    livePipelines: PipelineDebugInfo[]
  ): ValidationResult {
    secureLogger.info('🔍 Validating pipelines against configuration:');
    
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      totalExpected: expectedPipelines.length,
      totalFound: livePipelines.length,
      missingPipelines: [],
      unexpectedPipelines: []
    };
    
    const expectedPipelineIds = new Set(expectedPipelines.map(p => p.pipelineId));
    const livePipelineIds = new Set(livePipelines.map(p => p.pipelineId));
    
    // 检查缺失的流水线
    for (const expected of expectedPipelines) {
      if (!livePipelineIds.has(expected.pipelineId)) {
        result.missingPipelines.push(expected.pipelineId);
        result.errors.push(`Missing pipeline: ${expected.pipelineId}`);
        secureLogger.error(`  ❌ Missing: ${expected.pipelineId}`);
      } else {
        secureLogger.info(`  ✅ Found: ${expected.pipelineId}`);
      }
    }
    
    // 检查意外的流水线
    for (const live of livePipelines) {
      if (!expectedPipelineIds.has(live.pipelineId)) {
        result.unexpectedPipelines.push(live.pipelineId);
        result.warnings.push(`Unexpected pipeline: ${live.pipelineId}`);
        secureLogger.warn(`  ⚠️  Unexpected: ${live.pipelineId}`);
      }
    }
    
    // 判断整体有效性
    result.isValid = result.errors.length === 0;
    
    if (result.isValid) {
      secureLogger.info('✅ Pipeline validation passed');
    } else {
      secureLogger.error('❌ Pipeline validation failed', {
        errorCount: result.errors.length,
        missingCount: result.missingPipelines.length
      });
    }
    
    return result;
  }

  /**
   * 验证流水线架构
   */
  async validatePipelineArchitecture(livePipelines: PipelineDebugInfo[]): Promise<void> {
    secureLogger.info('🏗️  Validating pipeline architecture:');
    
    for (const pipelineInfo of livePipelines) {
      const pipeline = this.pipelineManager.getPipeline(pipelineInfo.pipelineId);
      if (!pipeline) {
        secureLogger.error(`  ❌ Pipeline not found in manager: ${pipelineInfo.pipelineId}`);
        continue;
      }
      
      secureLogger.info(`  🔍 Checking ${pipelineInfo.pipelineId}:`);
      
      // 验证4层架构是否完整
      const architectureCheck = {
        hasTransformer: pipelineInfo.layerStatus.transformer === 'connected',
        hasProtocol: pipelineInfo.layerStatus.protocol === 'connected',
        hasServerCompatibility: pipelineInfo.layerStatus.serverCompatibility === 'connected',
        hasServer: pipelineInfo.layerStatus.server === 'connected'
      };
      
      const isComplete = Object.values(architectureCheck).every(Boolean);
      
      if (isComplete) {
        secureLogger.info(`    ✅ Architecture complete: Transformer → Protocol → ServerCompatibility → Server`);
        
        // 执行健康检查
        try {
          const healthCheckResult = await this.performPipelineHealthCheck(pipeline);
          secureLogger.info(`    ${healthCheckResult ? '✅' : '❌'} Health check: ${healthCheckResult ? 'PASS' : 'FAIL'}`);
          
          if (!healthCheckResult) {
            throw new Error(`Health check failed for pipeline ${pipelineInfo.pipelineId}`);
          }
          
        } catch (error) {
          secureLogger.error(`    ❌ Health check error: ${error.message}`);
          throw error;
        }
        
      } else {
        const missingLayers = Object.entries(architectureCheck)
          .filter(([, connected]) => !connected)
          .map(([layer]) => layer);
          
        secureLogger.error(`    ❌ Architecture incomplete - Missing layers: ${missingLayers.join(', ')}`);
        throw new Error(`Pipeline ${pipelineInfo.pipelineId} has incomplete architecture: missing ${missingLayers.join(', ')}`);
      }
    }
    
    secureLogger.info('🎉 All pipeline architectures validated successfully');
  }

  /**
   * 获取调试信息摘要
   */
  getDebugSummary(): {
    totalPipelines: number;
    pipelinesByStatus: Record<string, number>;
    pipelinesByProvider: Record<string, number>;
    lastCheckTime?: Date;
  } {
    const summary = {
      totalPipelines: this.livePipelines.size,
      pipelinesByStatus: {} as Record<string, number>,
      pipelinesByProvider: {} as Record<string, number>,
      lastCheckTime: this.lastCheckTime
    };
    
    for (const debugInfo of this.livePipelines.values()) {
      // 按状态统计
      const status = debugInfo.status;
      summary.pipelinesByStatus[status] = (summary.pipelinesByStatus[status] || 0) + 1;
      
      // 按Provider统计
      const provider = debugInfo.routeInfo.provider;
      summary.pipelinesByProvider[provider] = (summary.pipelinesByProvider[provider] || 0) + 1;
    }
    
    return summary;
  }

  /**
   * 获取所有流水线的调试信息
   */
  getAllPipelineDebugInfo(): PipelineDebugInfo[] {
    return Array.from(this.livePipelines.values());
  }

  /**
   * 获取特定流水线的调试信息
   */
  getPipelineDebugInfo(pipelineId: string): PipelineDebugInfo | null {
    return this.livePipelines.get(pipelineId) || null;
  }

  // === 私有辅助方法 ===

  private getPipelineStatus(pipeline: any): 'initializing' | 'runtime' | 'error' | 'stopped' {
    if (pipeline.status) {
      return pipeline.status;
    }
    
    // 如果没有status属性，尝试推断
    try {
      const status = pipeline.getStatus?.();
      if (status?.status === 'running') return 'runtime';
      if (status?.status === 'error') return 'error';
      if (status?.status === 'stopped') return 'stopped';
    } catch {
      // 忽略错误
    }
    
    return 'runtime'; // 默认假设是运行中
  }

  private extractVirtualModel(pipeline: any): string {
    return pipeline.virtualModel || pipeline.config?.virtualModel || 'unknown';
  }

  private extractProvider(pipeline: any): string {
    return pipeline.provider || pipeline.config?.provider || 'unknown';
  }

  private extractTargetModel(pipeline: any): string {
    return pipeline.targetModel || pipeline.model || pipeline.config?.model || 'unknown';
  }

  private extractApiKeyIndex(pipelineId: string): number {
    // 从pipelineId中提取APIKey索引: "provider-model-keyN" -> N
    const match = pipelineId.match(/-key(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private checkLayerStatus(pipeline: any, layerName: string): 'connected' | 'error' {
    try {
      const layer = pipeline[layerName];
      return layer ? 'connected' : 'error';
    } catch {
      return 'error';
    }
  }

  private async performPipelineHealthCheck(pipeline: any): Promise<boolean> {
    try {
      if (pipeline.healthCheck && typeof pipeline.healthCheck === 'function') {
        return await pipeline.healthCheck();
      }
      
      // 如果没有healthCheck方法，检查基本状态
      return pipeline.status === 'runtime' || pipeline.getStatus?.()?.status === 'running';
      
    } catch (error) {
      secureLogger.error(`Health check failed for pipeline: ${error.message}`);
      return false;
    }
  }
}