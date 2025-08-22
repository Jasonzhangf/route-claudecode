/**
 * 流水线表加载器
 * 
 * 负责从generated目录加载流水线表，并转换为Router可用的RoutingTable格式
 * 
 * @author RCC v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { PipelineTableData, PipelineTableEntry } from '../pipeline/pipeline-manager';
import { RoutingTable, PipelineRoute } from './pipeline-router';
import { ROUTING_TABLE_DEFAULTS } from '../constants/router-defaults';
import { ERROR_MESSAGES } from '../constants/error-messages';

/**
 * 流水线表加载器
 */
export class PipelineTableLoader {
  /**
   * 从generated目录加载流水线表
   * @param configName 配置名称 (如 lmstudio-v4-5506)
   * @returns RoutingTable对象
   */
  static loadPipelineTable(configName: string): RoutingTable {
    const generatedDir = path.join(os.homedir(), '.route-claudecode', 'config', 'generated');
    const fileName = `${configName}-pipeline-table.json`;
    const filePath = path.join(generatedDir, fileName);

    secureLogger.info('📋 Loading pipeline table', {
      configName,
      filePath
    });

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`Pipeline table file not found: ${filePath}`);
      }

      // 读取文件内容
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const pipelineTableData: PipelineTableData = JQJsonHandler.parseJsonString<PipelineTableData>(fileContent);

      // 验证数据格式
      this.validatePipelineTableData(pipelineTableData);

      // 转换为RoutingTable格式
      const routingTable = this.convertToRoutingTable(pipelineTableData);

      secureLogger.info('✅ Pipeline table loaded successfully', {
        configName: pipelineTableData.configName,
        totalPipelines: pipelineTableData.totalPipelines,
        modelTypes: Object.keys(routingTable.routes).length
      });

      return routingTable;

    } catch (error) {
      secureLogger.error('❌ Failed to load pipeline table:', {
        configName,
        filePath,
        error: error.message
      });
      throw new Error(`Failed to load pipeline table for ${configName}: ${error.message}`);
    }
  }

  /**
   * 列出所有可用的流水线表文件
   * @returns 配置名称列表
   */
  static listAvailablePipelineTables(): string[] {
    const generatedDir = path.join(os.homedir(), '.route-claudecode', 'config', 'generated');
    
    try {
      if (!fs.existsSync(generatedDir)) {
        return [];
      }

      const files = fs.readdirSync(generatedDir);
      const pipelineTableFiles = files
        .filter(file => file.endsWith('-pipeline-table.json'))
        .map(file => file.replace('-pipeline-table.json', ''));

      secureLogger.info('📋 Available pipeline tables', {
        count: pipelineTableFiles.length,
        tables: pipelineTableFiles
      });

      return pipelineTableFiles;

    } catch (error) {
      secureLogger.error('❌ Failed to list pipeline tables:', { error: error.message });
      return [];
    }
  }

  /**
   * 验证流水线表数据格式
   */
  private static validatePipelineTableData(data: PipelineTableData): void {
    if (!data.configName) {
      throw new Error(ERROR_MESSAGES.CONFIG_INVALID);
    }

    if (!data.allPipelines || !Array.isArray(data.allPipelines)) {
      throw new Error(ERROR_MESSAGES.INVALID_CONFIG_FORMAT);
    }

    if (!data.pipelinesGroupedByVirtualModel || typeof data.pipelinesGroupedByVirtualModel !== 'object') {
      throw new Error(ERROR_MESSAGES.INVALID_CONFIG_FORMAT);
    }

    // 验证每个流水线条目
    for (const pipeline of data.allPipelines) {
      if (!pipeline.pipelineId || !pipeline.provider || !pipeline.targetModel) {
        throw new Error(`Invalid pipeline entry: missing required fields in ${pipeline.pipelineId}`);
      }
    }
  }

  /**
   * 将PipelineTableData转换为RoutingTable格式
   */
  private static convertToRoutingTable(data: PipelineTableData): RoutingTable {
    const routes: Record<string, PipelineRoute[]> = {};

    // 按目标模型类型分组转换
    for (const [targetModel, pipelines] of Object.entries(data.pipelinesGroupedByVirtualModel)) {
      routes[targetModel] = pipelines
        .filter(pipeline => pipeline.status === 'runtime') // 只包含运行中的流水线
        .map(pipeline => this.convertToPipelineRoute(pipeline));
    }

    // 确定默认路由 - 选择包含最多流水线的模型类型
    let defaultRoute = 'default';
    let maxPipelines = 0;
    
    for (const [modelType, pipelineRoutes] of Object.entries(routes)) {
      if (pipelineRoutes.length > maxPipelines) {
        maxPipelines = pipelineRoutes.length;
        defaultRoute = modelType;
      }
    }

    // 如果没有找到default类型，且存在其他类型，使用第一个
    if (!routes.default && Object.keys(routes).length > 0) {
      const firstModelType = Object.keys(routes)[0];
      if (firstModelType !== 'default') {
        defaultRoute = firstModelType;
      }
    }

    return {
      routes,
      defaultRoute
    };
  }

  /**
   * 将PipelineTableEntry转换为PipelineRoute
   */
  private static convertToPipelineRoute(entry: PipelineTableEntry): PipelineRoute {
    return {
      routeId: `route-${entry.pipelineId}`,
      routeName: `${entry.provider}-${entry.targetModel}-key${entry.apiKeyIndex}`,
      virtualModel: entry.virtualModel,
      provider: entry.provider,
      apiKeyIndex: entry.apiKeyIndex,
      pipelineId: entry.pipelineId,
      isActive: entry.status === 'runtime',
      health: this.determineHealthStatus(entry)
    };
  }

  /**
   * 根据流水线状态确定健康状态
   */
  private static determineHealthStatus(entry: PipelineTableEntry): 'healthy' | 'degraded' | 'unhealthy' {
    switch (entry.status) {
      case 'runtime':
        // 如果握手时间过长，标记为degraded
        return (entry.handshakeTime && entry.handshakeTime > 5000) ? 'degraded' : 'healthy';
      case 'error':
        return 'unhealthy';
      case 'initializing':
        return 'degraded';
      case 'stopped':
        return 'unhealthy';
      default:
        return 'unhealthy';
    }
  }

  /**
   * 检查流水线表是否需要刷新
   * @param configName 配置名称
   * @param maxAge 最大年龄（毫秒）
   * @returns 是否需要刷新
   */
  static isPipelineTableStale(configName: string, maxAge: number = ROUTING_TABLE_DEFAULTS.CACHE_TTL): boolean {
    const generatedDir = path.join(os.homedir(), '.route-claudecode', 'config', 'generated');
    const fileName = `${configName}-pipeline-table.json`;
    const filePath = path.join(generatedDir, fileName);

    try {
      if (!fs.existsSync(filePath)) {
        return true; // 文件不存在，需要生成
      }

      const stats = fs.statSync(filePath);
      const age = Date.now() - stats.mtime.getTime();
      const isStale = age > maxAge;

      secureLogger.debug('Pipeline table age check', {
        configName,
        ageMs: age,
        maxAgeMs: maxAge,
        isStale
      });

      return isStale;

    } catch (error) {
      secureLogger.error('❌ Failed to check pipeline table age:', {
        configName,
        error: error.message
      });
      return true; // 出错时认为需要刷新
    }
  }
}