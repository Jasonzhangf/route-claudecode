/**
 * PipelineManager相关类型定义
 * 
 * 从pipeline-manager.ts提取的类型定义，提高代码可读性和模块化
 * 
 * @author RCC v4.0
 */

import { ModuleInterface } from '../interfaces/module/base-module';

/**
 * 完整流水线定义 (RCC v4.0)
 */
export interface CompletePipeline {
  readonly pipelineId: string;
  readonly virtualModel: string;
  readonly provider: string;
  readonly targetModel: string;
  readonly apiKey: string;
  
  // 4层架构组件（初始化时已创建并连接）
  readonly transformer: ModuleInterface;
  readonly protocol: ModuleInterface;
  readonly serverCompatibility: ModuleInterface;
  readonly server: ModuleInterface;
  
  status: 'initializing' | 'runtime' | 'error' | 'stopped';
  lastHandshakeTime: Date;
  
  execute(request: any): Promise<any>;
  handshake(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getStatus(): any;
  stop(): Promise<void>;
}

/**
 * 流水线创建配置 (RCC v4.0)
 */
export interface CompletePipelineConfig {
  pipelineId: string;
  virtualModel: string;
  provider: string;
  targetModel: string;
  apiKey: string;
  endpoint: string;
  transformer: string;
  protocol: string;
  serverCompatibility: string;
}

/**
 * 流水线表数据结构 (用于保存到generated目录)
 */
export interface PipelineTableData {
  configName: string;
  configFile: string;
  generatedAt: string;
  totalPipelines: number;
  pipelinesGroupedByVirtualModel: Record<string, PipelineTableEntry[]>;
  allPipelines: PipelineTableEntry[];
}

/**
 * 流水线表条目 (包含4层架构详细信息)
 */
export interface PipelineTableEntry {
  pipelineId: string;
  virtualModel: string;
  provider: string;
  targetModel: string;
  apiKeyIndex: number;
  endpoint: string;
  status: 'initializing' | 'runtime' | 'error' | 'stopped';
  createdAt: string;
  handshakeTime?: number; // 毫秒
  
  // 4层架构详细信息 (transformer → protocol → server compatibility → server)
  architecture: {
    transformer: {
      id: string;
      name: string;
      type: string;
      status: string;
    };
    protocol: {
      id: string;
      name: string;
      type: string;
      status: string;
    };
    serverCompatibility: {
      id: string;
      name: string;
      type: string;
      status: string;
    };
    server: {
      id: string;
      name: string;
      type: string;
      status: string;
      endpoint: string;
    };
  };
}

/**
 * Debug版本的流水线表数据
 */
export interface DebugPipelineTableData extends PipelineTableData {
  debugInfo: {
    port: number;
    initializationStartTime: string;
    initializationEndTime: string;
    initializationDuration: number;
    systemConfig: any;
    totalHandshakeTime: number;
  };
}

/**
 * 健康检查结果
 */
export interface PipelineHealthCheckResult {
  healthy: boolean;
  pipelines: number;
  activeExecutions: number;
  issues: string[];
}

/**
 * 系统配置接口
 */
export interface PipelineSystemConfig {
  providerTypes: Record<string, {
    endpoint: string;
    protocol: string;
    transformer: string;
    serverCompatibility: string;
    timeout?: number;
    maxRetries?: number;
  }>;
  transformers?: Record<string, any>;
  serverCompatibilityModules?: Record<string, any>;
}