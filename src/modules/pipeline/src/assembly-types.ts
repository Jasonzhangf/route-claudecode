/**
 * Pipeline Assembly Types
 * 
 * Pipeline组装器相关的类型定义
 * 
 * @author Claude Code Router v4.0
 */

import { ModuleInterface, ModuleType } from './module-interface';
import { PipelineConfig } from '../../router/src/router-preprocessor';

/**
 * 组装后的流水线
 */
export interface AssembledPipeline {
  pipelineId: string;
  routeId: string;
  routeName: string;
  provider: string;
  model: string;
  endpoint: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
  maxTokens?: number;
  
  // 组装后的模块链
  modules: AssembledModule[];
  
  // 组装状态
  assemblyStatus: 'pending' | 'assembling' | 'assembled' | 'failed';
  assemblyTime: number;
  assemblyErrors: string[];
  
  // 运行时状态
  isActive: boolean;
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastUsed?: Date;
}

/**
 * 组装后的模块
 */
export interface AssembledModule {
  name: string;
  type: ModuleType;
  order: number;
  config: Record<string, any>;
  
  // 模块实例
  instance: ModuleInterface;
  
  // 连接信息
  nextModule?: AssembledModule;
  previousModule?: AssembledModule;
  
  // 状态信息
  isInitialized: boolean;
  initializationTime: number;
  lastProcessingTime?: number;
}

/**
 * 模块选择策略
 */
export interface ModuleSelectionStrategy {
  selectModule(type: ModuleType, config: Record<string, any>): Promise<ModuleInterface | null>;
  getAvailableModules(type: ModuleType): ModuleInterface[];
  validateModuleCompatibility(modules: ModuleInterface[]): Promise<boolean>;
}

/**
 * 组装结果统计
 */
export interface AssemblyStats {
  totalPipelines: number;
  successfulAssemblies: number;
  failedAssemblies: number;
  totalModulesRegistered: number;
  modulesByType: Record<string, number>;
  assemblyTimeMs: number;
  averageAssemblyTime: number;
  memoryUsageMB: number;
}

/**
 * 按路由模型分组的流水线结果
 */
export interface PipelinesByRouteModel {
  [routeModel: string]: AssembledPipeline[];
}

/**
 * Pipeline组装器结果
 */
export interface PipelineAssemblyResult {
  success: boolean;
  pipelinesByRouteModel: PipelinesByRouteModel;
  allPipelines: AssembledPipeline[];
  stats: AssemblyStats;
  errors: string[];
  warnings: string[];
}

/**
 * 模块连接验证结果
 */
export interface ModuleConnectionValidation {
  isValid: boolean;
  connectionMap: Map<string, string[]>;
  circularDependencies: string[];
  unreachableModules: string[];
  validationErrors: string[];
}

/**
 * 模块健康检查结果
 */
export interface ModuleHealthCheck {
  moduleId: string;
  moduleName: string;
  moduleType: ModuleType;
  isHealthy: boolean;
  responseTime: number;
  details: any;
  lastChecked: Date;
}

/**
 * 组装过程中的事件
 */
export interface AssemblyEvent {
  type: 'started' | 'module-registered' | 'pipeline-assembled' | 'completed' | 'error';
  timestamp: Date;
  pipelineId?: string;
  moduleId?: string;
  message: string;
  data?: any;
}