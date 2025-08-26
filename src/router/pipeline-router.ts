/**
 * 流水线路由器 - 根据routing table选择流水线
 * 
 * 设计原则：
 * 1. 路由选择的是流水线，不是provider
 * 2. 初始化时已经创建所有流水线，此处只是选择
 * 3. 负载均衡由专门的负载均衡器处理
 * 4. 零fallback策略，选择失败立即抛出错误
 * 
 * @author RCC v4.0 Architecture
 */

import { secureLogger } from '../utils/secure-logger';
import { VirtualModelMapper } from './virtual-model-mapping';
import { PipelineTableLoader } from './pipeline-table-loader';
import { ZeroFallbackErrorFactory } from '../interfaces/core/zero-fallback-errors';

export interface PipelineRoute {
  routeId: string;
  routeName: string;
  virtualModel: string;
  provider: string;
  apiKeyIndex: number;
  pipelineId: string;
  isActive: boolean;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface RoutingTable {
  routes: Record<string, PipelineRoute[]>; // virtualModel -> PipelineRoute[]
  defaultRoute: string;
}

export interface PipelineRoutingDecision {
  originalModel: string;
  virtualModel: string;
  availablePipelines: string[];
  globalPipelinePool: string[]; // 全局流水线池，必需字段，用于跨类别容错切换
  selectedPipeline?: string; // 由负载均衡器决定
  reasoning: string;
}

/**
 * 流水线路由器 - 纯粹选择流水线的路由器
 */
export class PipelineRouter {
  private routingTable: RoutingTable;

  constructor(routingTable: RoutingTable) {
    this.routingTable = routingTable;
    secureLogger.info('PipelineRouter initialized', {
      routeCount: Object.keys(routingTable.routes).length,
      defaultRoute: routingTable.defaultRoute,
    });
  }

  /**
   * 从配置名称创建Router (从generated目录加载流水线表)
   * @param configName 配置名称 (如 lmstudio-v4-5506)
   * @returns PipelineRouter实例
   */
  static fromConfigName(configName: string): PipelineRouter {
    try {
      const routingTable = PipelineTableLoader.loadPipelineTable(configName);
      return new PipelineRouter(routingTable);
    } catch (error) {
      secureLogger.error('❌ Failed to create router from config:', {
        configName,
        error: error.message
      });
      throw new Error(`Failed to create router from config ${configName}: ${error.message}`);
    }
  }

  /**
   * 从运行时RoutingTable直接创建Router (用于配置驱动的路由)
   * @param routingTable 运行时生成的路由表
   * @returns PipelineRouter实例
   */
  static fromRoutingTable(routingTable: RoutingTable): PipelineRouter {
    try {
      secureLogger.info('✅ Creating router from runtime routing table', {
        routeCount: Object.keys(routingTable.routes).length,
        defaultRoute: routingTable.defaultRoute
      });
      return new PipelineRouter(routingTable);
    } catch (error) {
      secureLogger.error('❌ Failed to create router from routing table:', {
        error: error.message
      });
      throw new Error(`Failed to create router from routing table: ${error.message}`);
    }
  }

  /**
   * 检查并重新加载流水线表 (如果已过期)
   * @param configName 配置名称
   * @param maxAge 最大年龄（毫秒），默认5分钟
   */
  refreshIfStale(configName: string, maxAge?: number): boolean {
    try {
      if (PipelineTableLoader.isPipelineTableStale(configName, maxAge)) {
        secureLogger.info('🔄 Pipeline table is stale, reloading...', { configName });
        
        const newRoutingTable = PipelineTableLoader.loadPipelineTable(configName);
        this.updateRoutingTable(newRoutingTable);
        
        secureLogger.info('✅ Pipeline table refreshed', { configName });
        return true;
      }
      return false;
    } catch (error) {
      secureLogger.error('❌ Failed to refresh pipeline table:', {
        configName,
        error: error.message
      });
      return false;
    }
  }

  /**
   * 路由决策 - 选择可用的流水线列表
   * 注意：这里不选择具体的流水线，而是返回可用流水线列表
   * 具体选择哪个流水线由负载均衡器决定
   */
  route(inputModel: string): PipelineRoutingDecision {
    const virtualModel = this.mapToVirtualModel(inputModel);
    
    // 获取该虚拟模型对应的所有流水线
    const availableRoutes = this.routingTable.routes[virtualModel];
    
    if (!availableRoutes || availableRoutes.length === 0) {
      // 尝试默认路由
      const defaultRoutes = this.routingTable.routes[this.routingTable.defaultRoute];
      if (!defaultRoutes || defaultRoutes.length === 0) {
        throw new Error(`No pipelines available for model ${inputModel} (virtual: ${virtualModel})`);
      }
      
      return {
        originalModel: inputModel,
        virtualModel: this.routingTable.defaultRoute,
        availablePipelines: defaultRoutes
          .filter(route => route.isActive && route.health !== 'unhealthy')
          .map(route => route.pipelineId),
        globalPipelinePool: this.getAllHealthyPipelines(),
        reasoning: `Using default route ${this.routingTable.defaultRoute} for ${inputModel}`,
      };
    }

    // 过滤出健康的活跃流水线
    const healthyPipelines = availableRoutes
      .filter(route => route.isActive && route.health !== 'unhealthy')
      .map(route => route.pipelineId);

    if (healthyPipelines.length === 0) {
      throw new Error(`No healthy pipelines available for model ${inputModel} (virtual: ${virtualModel})`);
    }

    secureLogger.debug('Pipeline routing decision', {
      originalModel: inputModel,
      virtualModel,
      availablePipelinesCount: healthyPipelines.length,
      healthyPipelines,
    });

    return {
      originalModel: inputModel,
      virtualModel,
      availablePipelines: healthyPipelines,
      globalPipelinePool: this.getAllHealthyPipelines(),
      reasoning: `Found ${healthyPipelines.length} healthy pipelines for ${virtualModel}`,
    };
  }

  /**
   * 将输入模型映射到目标模型类型
   * 使用基于算法的5个有意义的模型分类
   */
  mapToVirtualModel(inputModel: string, request?: any): string {
    try {
      const targetModel = VirtualModelMapper.mapToVirtual(inputModel, request || {});
      return targetModel;
    } catch (error) {
      secureLogger.error('Model mapping failed - Zero Fallback Policy', {
        inputModel,
        error: error.message,
        zeroFallbackPolicy: true
      });
      
      // 零Fallback策略: 模型映射失败时立即抛出错误
      throw ZeroFallbackErrorFactory.createRoutingRuleNotFound(
        inputModel,
        'virtual-model-mapping',
        error.message,
        { originalModel: inputModel }
      );
    }
  }

  /**
   * 更新路由表 - 用于运行时更新流水线状态
   */
  updateRoutingTable(newRoutingTable: RoutingTable): void {
    this.routingTable = newRoutingTable;
    secureLogger.info('Routing table updated', {
      routeCount: Object.keys(newRoutingTable.routes).length,
      defaultRoute: newRoutingTable.defaultRoute,
    });
  }

  /**
   * 获取当前路由表状态
   */
  getRoutingTableStatus(): {
    totalRoutes: number;
    healthyPipelines: number;
    unhealthyPipelines: number;
    routeDetails: Record<string, { total: number; healthy: number; }>;
  } {
    let totalPipelines = 0;
    let healthyPipelines = 0;
    let unhealthyPipelines = 0;
    const routeDetails: Record<string, { total: number; healthy: number; }> = {};

    for (const [virtualModel, routes] of Object.entries(this.routingTable.routes)) {
      const totalForRoute = routes.length;
      const healthyForRoute = routes.filter(r => r.isActive && r.health !== 'unhealthy').length;
      
      routeDetails[virtualModel] = {
        total: totalForRoute,
        healthy: healthyForRoute,
      };

      totalPipelines += totalForRoute;
      healthyPipelines += healthyForRoute;
      unhealthyPipelines += (totalForRoute - healthyForRoute);
    }

    return {
      totalRoutes: Object.keys(this.routingTable.routes).length,
      healthyPipelines,
      unhealthyPipelines,
      routeDetails,
    };
  }

  /**
   * 标记流水线为不健康
   */
  markPipelineUnhealthy(pipelineId: string, reason: string): void {
    for (const routes of Object.values(this.routingTable.routes)) {
      const route = routes.find(r => r.pipelineId === pipelineId);
      if (route) {
        route.health = 'unhealthy';
        secureLogger.warn('Pipeline marked as unhealthy', {
          pipelineId,
          reason,
          route: route.routeId,
        });
        return;
      }
    }
    secureLogger.warn('Pipeline not found for health update', { pipelineId });
  }

  /**
   * 标记流水线为健康
   */
  markPipelineHealthy(pipelineId: string): void {
    for (const routes of Object.values(this.routingTable.routes)) {
      const route = routes.find(r => r.pipelineId === pipelineId);
      if (route) {
        route.health = 'healthy';
        secureLogger.info('Pipeline marked as healthy', {
          pipelineId,
          route: route.routeId,
        });
        return;
      }
    }
    secureLogger.warn('Pipeline not found for health update', { pipelineId });
  }

  /**
   * 获取路由器统计信息
   */
  getStatistics(): {
    totalProviders: number;
    totalBlacklisted: number;
    totalRoutes: number;
    healthyPipelines: number;
    unhealthyPipelines: number;
    routeDetails: Record<string, { total: number; healthy: number; }>;
  } {
    const status = this.getRoutingTableStatus();
    
    // 计算Provider数量（去重）
    const uniqueProviders = new Set<string>();
    for (const routes of Object.values(this.routingTable.routes)) {
      for (const route of routes) {
        uniqueProviders.add(route.provider);
      }
    }

    return {
      totalProviders: uniqueProviders.size,
      totalBlacklisted: 0, // 暂时返回0，后续可扩展blacklist功能
      totalRoutes: status.totalRoutes,
      healthyPipelines: status.healthyPipelines,
      unhealthyPipelines: status.unhealthyPipelines,
      routeDetails: status.routeDetails,
    };
  }

  /**
   * 清理过期的黑名单条目
   * 注意：当前实现中没有blacklist功能，这是一个空操作
   */
  cleanupExpiredBlacklists(): void {
    // 当前PipelineRouter没有blacklist功能
    // 这是为了保持向后兼容性的空实现
    secureLogger.debug('Cleanup expired blacklists called (no-op in PipelineRouter)');
  }

  /**
   * 将API密钥加入黑名单
   * 注意：当前实现中没有blacklist功能，这是一个空操作
   */
  blacklistKey(apiKey: string, reason: string, duration?: number): void {
    // 当前PipelineRouter没有blacklist功能
    // 这是为了保持向后兼容性的空实现
    secureLogger.warn('Blacklist key called (no-op in PipelineRouter)', {
      reason,
      duration: duration || 'permanent'
    });
  }

  /**
   * 获取所有健康流水线的全局池
   */
  private getAllHealthyPipelines(): string[] {
    const allHealthyPipelines: string[] = [];
    
    for (const routes of Object.values(this.routingTable.routes)) {
      for (const route of routes) {
        if (route.isActive && route.health !== 'unhealthy') {
          allHealthyPipelines.push(route.pipelineId);
        }
      }
    }
    
    return allHealthyPipelines;
  }
}