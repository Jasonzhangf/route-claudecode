/**
 * Pipeline表管理器
 * 
 * 负责生成和保存Pipeline表数据到不同目录
 * 支持基础版本和Debug版本的表数据
 * 
 * @author RCC v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { secureLogger } from '../utils/secure-logger';
import {
  CompletePipeline,
  PipelineTableData,
  PipelineTableEntry,
  DebugPipelineTableData,
  PipelineSystemConfig
} from './pipeline-manager-types';
import { ModuleInterface } from '../interfaces/module/base-module';

export class PipelineTableManager {
  private configName: string = '';
  private configFile: string = '';
  private port: number = 0;
  private systemConfig?: PipelineSystemConfig;

  constructor(systemConfig?: PipelineSystemConfig) {
    this.systemConfig = systemConfig;
  }

  /**
   * 设置配置信息
   */
  setConfigInfo(configName: string, configFile: string, port: number): void {
    this.configName = configName;
    this.configFile = configFile;
    this.port = port;
  }

  /**
   * 生成流水线表数据
   */
  generatePipelineTableData(pipelines: Map<string, CompletePipeline>): PipelineTableData {
    const allPipelines: PipelineTableEntry[] = [];
    const pipelinesGroupedByModel: Record<string, PipelineTableEntry[]> = {};
    
    for (const [pipelineId, pipeline] of pipelines) {
      const entry: PipelineTableEntry = {
        pipelineId,
        virtualModel: pipeline.virtualModel,
        provider: pipeline.provider,
        targetModel: pipeline.targetModel,
        apiKeyIndex: this.extractApiKeyIndex(pipelineId),
        endpoint: this.extractEndpoint(pipeline),
        status: pipeline.status,
        createdAt: pipeline.lastHandshakeTime.toISOString(),
        handshakeTime: pipeline.lastHandshakeTime ? Date.now() - pipeline.lastHandshakeTime.getTime() : undefined,
        
        // 添加4层架构详细信息
        architecture: this.extractArchitectureDetails(pipeline)
      };
      
      allPipelines.push(entry);
      
      // 按模型分组
      if (!pipelinesGroupedByModel[pipeline.virtualModel]) {
        pipelinesGroupedByModel[pipeline.virtualModel] = [];
      }
      pipelinesGroupedByModel[pipeline.virtualModel].push(entry);
    }
    
    return {
      configName: this.configName,
      configFile: this.configFile,
      generatedAt: new Date().toISOString(),
      totalPipelines: allPipelines.length,
      pipelinesGroupedByVirtualModel: pipelinesGroupedByModel,
      allPipelines
    };
  }

  /**
   * 生成debug版本的流水线表数据 (包含更多调试信息)
   */
  generateDebugPipelineTableData(pipelines: Map<string, CompletePipeline>): DebugPipelineTableData {
    const basicData = this.generatePipelineTableData(pipelines);
    
    // 计算总握手时间
    const totalHandshakeTime = Array.from(pipelines.values())
      .reduce((total, pipeline) => {
        const handshakeTime = pipeline.lastHandshakeTime ? Date.now() - pipeline.lastHandshakeTime.getTime() : 0;
        return total + handshakeTime;
      }, 0);

    return {
      ...basicData,
      debugInfo: {
        port: this.port,
        initializationStartTime: new Date().toISOString(),
        initializationEndTime: new Date().toISOString(),
        initializationDuration: 0, // 将在实际使用时计算
        systemConfig: {
          providerTypes: Object.keys(this.systemConfig?.providerTypes || {}),
          transformersCount: Object.keys(this.systemConfig?.transformers || {}).length,
          serverCompatibilityModulesCount: Object.keys(this.systemConfig?.serverCompatibilityModules || {}).length
        },
        totalHandshakeTime
      }
    };
  }

  /**
   * 保存流水线表到generated目录
   */
  async savePipelineTableToGenerated(pipelines: Map<string, CompletePipeline>): Promise<void> {
    const generatedDir = path.join(os.homedir(), '.route-claudecode', 'config', 'generated');
    
    // 确保generated目录存在
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    
    // 生成流水线表数据
    const pipelineTableData = this.generatePipelineTableData(pipelines);
    
    // 保存文件路径：configName-pipeline-table.json
    const fileName = this.configName 
      ? `${this.configName}-pipeline-table.json`
      : `default-pipeline-table.json`;
    const filePath = path.join(generatedDir, fileName);
    
    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(pipelineTableData, null, 2), 'utf8');
    
    secureLogger.info('📋 Pipeline table saved', {
      file: filePath,
      totalPipelines: pipelineTableData.totalPipelines,
      configName: this.configName
    });
  }

  /**
   * 保存流水线表到debug-logs目录 (按端口分组)
   */
  async savePipelineTableToDebugLogs(pipelines: Map<string, CompletePipeline>): Promise<void> {
    if (!this.port) {
      secureLogger.warn('⚠️  No port specified, skipping debug-logs save');
      return;
    }

    const debugLogsDir = path.join(os.homedir(), '.route-claudecode', 'debug-logs', `port-${this.port}`);
    
    // 确保debug-logs目录存在
    if (!fs.existsSync(debugLogsDir)) {
      fs.mkdirSync(debugLogsDir, { recursive: true });
    }
    
    // 生成debug版本的流水线表数据 (包含更多调试信息)
    const debugPipelineTableData = this.generateDebugPipelineTableData(pipelines);
    
    // 保存文件路径：时间+配置名称格式
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
    const fileName = this.configName 
      ? `${timestamp}_${this.configName}-pipeline-table.json`
      : `${timestamp}_default-pipeline-table.json`;
    const filePath = path.join(debugLogsDir, fileName);
    
    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(debugPipelineTableData, null, 2), 'utf8');
    
    secureLogger.info('🐛 Debug pipeline table saved', {
      file: filePath,
      port: this.port,
      totalPipelines: debugPipelineTableData.totalPipelines,
      configName: this.configName
    });
  }

  /**
   * 从流水线ID提取API Key索引
   */
  private extractApiKeyIndex(pipelineId: string): number {
    const match = pipelineId.match(/-key(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * 从流水线提取endpoint信息
   */
  private extractEndpoint(pipeline: CompletePipeline): string {
    // 从系统配置中获取endpoint信息
    const providerType = this.systemConfig?.providerTypes?.[pipeline.provider];
    return providerType?.endpoint || 'unknown';
  }

  /**
   * 提取4层架构详细信息
   */
  private extractArchitectureDetails(pipeline: CompletePipeline): PipelineTableEntry['architecture'] {
    // 从系统配置获取Provider类型配置
    const providerType = this.systemConfig?.providerTypes?.[pipeline.provider];
    
    // 辅助函数：将模块状态转换为字符串
    const getModuleStatusString = (module: ModuleInterface | undefined): string => {
      if (!module || !module.getStatus) {
        return 'runtime';
      }
      
      try {
        const status = module.getStatus();
        // 如果status是对象，提取status字段；如果是字符串/枚举，直接使用
        if (typeof status === 'object' && status.status) {
          return String(status.status);
        } else {
          return String(status);
        }
      } catch (error) {
        return 'runtime';
      }
    };
    
    return {
      transformer: {
        id: pipeline.transformer?.getId?.() || `${pipeline.provider}-transformer`,
        name: providerType?.transformer || 'anthropic-to-openai-transformer',
        type: 'transformer',
        status: getModuleStatusString(pipeline.transformer)
      },
      protocol: {
        id: pipeline.protocol?.getId?.() || `${pipeline.provider}-protocol`,
        name: providerType?.protocol || 'openai-protocol-handler',
        type: 'protocol',
        status: getModuleStatusString(pipeline.protocol)
      },
      serverCompatibility: {
        id: pipeline.serverCompatibility?.getId?.() || `${pipeline.provider}-compatibility`,
        name: providerType?.serverCompatibility || `${pipeline.provider}-compatibility-handler`,
        type: 'serverCompatibility',
        status: getModuleStatusString(pipeline.serverCompatibility)
      },
      server: {
        id: pipeline.server?.getId?.() || `${pipeline.provider}-server`,
        name: `${pipeline.provider}-server`,
        type: 'server',
        status: getModuleStatusString(pipeline.server),
        endpoint: this.extractEndpoint(pipeline)
      }
    };
  }
}