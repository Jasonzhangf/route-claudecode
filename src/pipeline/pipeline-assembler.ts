/**
 * 流水线组装器
 * 
 * 负责根据路由器输出的配置文件进行一次性流水线组装
 * 均匀分布。。  
 * 
 * @author RCC v4.0 Architecture Team
 */
import { RoutingTable, PipelineRoute } from '../router/pipeline-router';
import { PipelineTableData, PipelineTableEntry } from './pipeline-manager-types';
import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ConfigInfo {
  name: string;
  file: string;
  port?: number;
}

export class PipelineAssembler {
  private _pipelineTable: PipelineTableData | null = null;
  private _isInitialized: boolean = false;
  private _configInfo: ConfigInfo | null = null;
  private _systemConfig: any = null;
  
  get pipelineTable(): PipelineTableData {
    return JSON.parse(JSON.stringify(this._pipelineTable));
  }
  
  async initialize(
    routingTable: RoutingTable, 
    configInfo: ConfigInfo,
    systemConfig?: any
  ): Promise<void> {
    this._configInfo = configInfo;
    this._systemConfig = systemConfig;
    
    await this._assemblePipelines(routingTable);
    await this._savePipelineTable();
    this._isInitialized = true;
    
    secureLogger.info('✅ 流水线组装器初始化完成', {
      totalPipelines: this._pipelineTable?.totalPipelines,
      configName: configInfo.name
    });
  }
  
  isInitialized(): boolean {
    return this._isInitialized;
  }
  
  private async _assemblePipelines(routingTable: RoutingTable): Promise<void> {
    const allPipelines: PipelineTableEntry[] = [];
    const pipelinesGroupedByType: Record<string, PipelineTableEntry[]> = {};
    
    for (const [modelType, routes] of Object.entries(routingTable.routes)) {
      for (const route of routes) {
        const entry = this._createPipelineEntry(route);
        allPipelines.push(entry);
        
        if (!pipelinesGroupedByType[modelType]) {
          pipelinesGroupedByType[modelType] = [];
        }
        pipelinesGroupedByType[modelType].push(entry);
      }
    }
    
    this._pipelineTable = {
      configName: this._configInfo!.name,
      configFile: this._configInfo!.file,
      generatedAt: new Date().toISOString(),
      totalPipelines: allPipelines.length,
      pipelinesGroupedByVirtualModel: pipelinesGroupedByType,
      allPipelines
    };
  }
  
  private _createPipelineEntry(route: PipelineRoute): PipelineTableEntry {
    const pipelineId = route.pipelineId;
    const apiKeyIndex = this._extractApiKeyIndex(route.pipelineId);
    const providerConfig = this._systemConfig?.providerTypes?.[route.provider] || {};
    const selectedModules = this._selectModules(route.provider, providerConfig);
    
    const entry: PipelineTableEntry = {
      pipelineId,
      virtualModel: route.virtualModel,
      provider: route.provider,
      targetModel: this._extractTargetModel(route.pipelineId),
      apiKeyIndex,
      endpoint: providerConfig.endpoint || '',
      status: 'runtime',
      createdAt: new Date().toISOString(),
      
      architecture: {
        transformer: {
          id: `${route.provider}-transformer-${pipelineId}`,
          name: selectedModules.transformer,
          type: 'transformer',
          status: 'running'
        },
        protocol: {
          id: `${route.provider}-protocol-${pipelineId}`,
          name: selectedModules.protocol,
          type: 'protocol',
          status: 'running'
        },
        serverCompatibility: {
          id: `${route.provider}-compatibility-${pipelineId}`,
          name: selectedModules.serverCompatibility,
          type: 'serverCompatibility',
          status: 'running'
        },
        server: {
          id: `${route.provider}-server-${pipelineId}`,
          name: `${route.provider}-server`,
          type: 'server',
          status: 'running',
          endpoint: providerConfig.endpoint || ''
        }
      }
    };
    
    return entry;
  }
  
  private async _savePipelineTable(): Promise<void> {
    await this._saveToGeneratedDir();
    await this._saveToDebugLogsDir();
  }
  
  private async _saveToGeneratedDir(): Promise<void> {
    const generatedDir = path.join(process.cwd(), 'generated');
    
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    
    const fileName = this._configInfo!.name 
      ? `${this._configInfo!.name}-pipeline-table.json`
      : `default-pipeline-table.json`;
    const filePath = path.join(generatedDir, fileName);
    
    fs.writeFileSync(filePath, JQJsonHandler.stringifyJson(this._pipelineTable!, false), 'utf8');
    
    secureLogger.info('📋 流水线表已保存到generated目录', { file: filePath });
  }
  
  private async _saveToDebugLogsDir(): Promise<void> {
    if (!this._configInfo || !this._configInfo.port) {
      secureLogger.warn('⚠️  未指定端口，跳过保存到debug-logs目录');
      return;
    }
    
    const debugLogsDir = path.join(os.homedir(), '.route-claudecode', 'debug-logs', `port-${this._configInfo.port}`);
    
    if (!fs.existsSync(debugLogsDir)) {
      fs.mkdirSync(debugLogsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
    const fileName = this._configInfo.name 
      ? `${timestamp}_${this._configInfo.name}-pipeline-table.json`
      : `${timestamp}_default-pipeline-table.json`;
    const filePath = path.join(debugLogsDir, fileName);
    
    fs.writeFileSync(filePath, JQJsonHandler.stringifyJson(this._pipelineTable!, false), 'utf8');
    
    secureLogger.info('🐛 流水线表已保存到debug-logs目录', { file: filePath });
  }
  
  private _extractApiKeyIndex(pipelineId: string): number {
    const match = pipelineId.match(/-key(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }
  
  private _extractTargetModel(pipelineId: string): string {
    const parts = pipelineId.split('-');
    if (parts.length >= 2) {
      return parts.slice(1, -1).join('-');
    }
    return 'unknown';
  }
  
  private _selectModules(provider: string, providerConfig: any): { 
    transformer: string; 
    protocol: string; 
    serverCompatibility: string; 
  } {
    const transformer = providerConfig.transformer || 'AnthropicOpenAITransformer';
    const protocol = providerConfig.protocol || 'OpenAIProtocolEnhancer';
    let serverCompatibility = providerConfig.serverCompatibility || 'PassthroughServerCompatibility';
    
    if (provider.includes('lmstudio')) {
      serverCompatibility = 'LMStudioServerCompatibility';
    } else if (provider.includes('iflow')) {
      serverCompatibility = 'IFlowCompatibilityModule';
    } else if (provider.includes('qwen')) {
      serverCompatibility = 'QwenServerCompatibility';
    } else if (provider.includes('ollama')) {
      serverCompatibility = 'OllamaServerCompatibility';
    }
    
    return {
      transformer,
      protocol,
      serverCompatibility
    };
  }
}