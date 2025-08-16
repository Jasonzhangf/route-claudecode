/**
 * 依赖注入容器
 * 
 * 解决pipeline模块间的依赖关系，防止循环依赖
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';

/**
 * 服务生命周期
 */
export enum ServiceLifetime {
  SINGLETON = 'singleton',
  TRANSIENT = 'transient',
  SCOPED = 'scoped'
}

/**
 * 服务描述符
 */
export interface ServiceDescriptor<T = any> {
  id: string;
  name: string;
  factory: ServiceFactory<T>;
  lifetime: ServiceLifetime;
  dependencies: string[];
  metadata?: Record<string, any>;
}

/**
 * 服务工厂函数
 */
export type ServiceFactory<T = any> = (container: DIContainer, ...dependencies: any[]) => T | Promise<T>;

/**
 * 服务实例信息
 */
interface ServiceInstance {
  id: string;
  instance: any;
  lifetime: ServiceLifetime;
  createdAt: Date;
  accessCount: number;
}

/**
 * 循环依赖检测结果
 */
interface CircularDependencyResult {
  hasCircularDependency: boolean;
  cycles: string[][];
  affectedServices: string[];
}

/**
 * 依赖注入容器实现
 */
export class DIContainer extends EventEmitter {
  private services = new Map<string, ServiceDescriptor>();
  private instances = new Map<string, ServiceInstance>();
  private scopes = new Map<string, Map<string, any>>();
  private isInitializing = new Set<string>();

  constructor() {
    super();
  }

  /**
   * 注册服务
   */
  register<T>(descriptor: ServiceDescriptor<T>): void {
    // 验证服务描述符
    this.validateServiceDescriptor(descriptor);

    // 检查循环依赖
    const circularCheck = this.detectCircularDependencies([...this.services.values(), descriptor]);
    if (circularCheck.hasCircularDependency) {
      throw new Error(
        `Circular dependency detected: ${circularCheck.cycles.map(cycle => cycle.join(' -> ')).join(', ')}`
      );
    }

    this.services.set(descriptor.id, descriptor);
    this.emit('service-registered', descriptor);

    console.log(`✅ Service registered: ${descriptor.name} (${descriptor.id})`);
  }

  /**
   * 注册单例服务
   */
  registerSingleton<T>(
    id: string,
    name: string,
    factory: ServiceFactory<T>,
    dependencies: string[] = []
  ): void {
    this.register({
      id,
      name,
      factory,
      lifetime: ServiceLifetime.SINGLETON,
      dependencies
    });
  }

  /**
   * 注册瞬时服务
   */
  registerTransient<T>(
    id: string,
    name: string,
    factory: ServiceFactory<T>,
    dependencies: string[] = []
  ): void {
    this.register({
      id,
      name,
      factory,
      lifetime: ServiceLifetime.TRANSIENT,
      dependencies
    });
  }

  /**
   * 注册作用域服务
   */
  registerScoped<T>(
    id: string,
    name: string,
    factory: ServiceFactory<T>,
    dependencies: string[] = [],
    scopeId?: string
  ): void {
    this.register({
      id,
      name,
      factory,
      lifetime: ServiceLifetime.SCOPED,
      dependencies,
      metadata: { scopeId }
    });
  }

  /**
   * 解析服务
   */
  async resolve<T>(serviceId: string, scopeId?: string): Promise<T> {
    const descriptor = this.services.get(serviceId);
    if (!descriptor) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    // 检测循环初始化
    if (this.isInitializing.has(serviceId)) {
      throw new Error(`Circular initialization detected for service: ${serviceId}`);
    }

    switch (descriptor.lifetime) {
      case ServiceLifetime.SINGLETON:
        return this.resolveSingleton<T>(descriptor);
      case ServiceLifetime.TRANSIENT:
        return this.resolveTransient<T>(descriptor);
      case ServiceLifetime.SCOPED:
        return this.resolveScoped<T>(descriptor, scopeId || 'default');
      default:
        throw new Error(`Unknown service lifetime: ${descriptor.lifetime}`);
    }
  }

  /**
   * 检查服务是否已注册
   */
  isRegistered(serviceId: string): boolean {
    return this.services.has(serviceId);
  }

  /**
   * 获取服务信息
   */
  getServiceInfo(serviceId: string): ServiceDescriptor | undefined {
    return this.services.get(serviceId);
  }

  /**
   * 获取所有注册的服务
   */
  getAllServices(): ServiceDescriptor[] {
    return Array.from(this.services.values());
  }

  /**
   * 获取依赖图
   */
  getDependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    
    for (const [serviceId, descriptor] of this.services) {
      graph[serviceId] = descriptor.dependencies.slice();
    }

    return graph;
  }

  /**
   * 创建作用域
   */
  createScope(scopeId: string): void {
    if (!this.scopes.has(scopeId)) {
      this.scopes.set(scopeId, new Map());
      this.emit('scope-created', scopeId);
    }
  }

  /**
   * 销毁作用域
   */
  async disposeScope(scopeId: string): Promise<void> {
    const scope = this.scopes.get(scopeId);
    if (!scope) return;

    // 销毁作用域中的所有实例
    for (const [serviceId, instance] of scope) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          await instance.dispose();
        } catch (error) {
          console.error(`Error disposing service ${serviceId}:`, error);
        }
      }
    }

    this.scopes.delete(scopeId);
    this.emit('scope-disposed', scopeId);
  }

  /**
   * 验证依赖图的完整性
   */
  validateDependencyGraph(): {
    isValid: boolean;
    missingDependencies: string[];
    circularDependencies: string[][];
  } {
    const missingDependencies: string[] = [];
    const serviceIds = new Set(this.services.keys());

    // 检查缺失的依赖
    for (const [serviceId, descriptor] of this.services) {
      for (const depId of descriptor.dependencies) {
        if (!serviceIds.has(depId)) {
          missingDependencies.push(`${serviceId} -> ${depId}`);
        }
      }
    }

    // 检查循环依赖
    const circularCheck = this.detectCircularDependencies(Array.from(this.services.values()));

    return {
      isValid: missingDependencies.length === 0 && !circularCheck.hasCircularDependency,
      missingDependencies,
      circularDependencies: circularCheck.cycles
    };
  }

  /**
   * 获取容器统计信息
   */
  getContainerStats(): {
    totalServices: number;
    singletonInstances: number;
    scopedInstances: number;
    activeScopes: number;
    servicesByLifetime: Record<ServiceLifetime, number>;
  } {
    const servicesByLifetime = {
      [ServiceLifetime.SINGLETON]: 0,
      [ServiceLifetime.TRANSIENT]: 0,
      [ServiceLifetime.SCOPED]: 0
    };

    for (const descriptor of this.services.values()) {
      servicesByLifetime[descriptor.lifetime]++;
    }

    return {
      totalServices: this.services.size,
      singletonInstances: this.instances.size,
      scopedInstances: Array.from(this.scopes.values()).reduce((sum, scope) => sum + scope.size, 0),
      activeScopes: this.scopes.size,
      servicesByLifetime
    };
  }

  /**
   * 清理容器
   */
  async dispose(): Promise<void> {
    // 销毁所有作用域
    const scopes = Array.from(this.scopes.keys());
    for (const scopeId of scopes) {
      await this.disposeScope(scopeId);
    }

    // 销毁所有单例实例
    for (const [serviceId, instanceInfo] of this.instances) {
      if (instanceInfo.instance && typeof instanceInfo.instance.dispose === 'function') {
        try {
          await instanceInfo.instance.dispose();
        } catch (error) {
          console.error(`Error disposing singleton ${serviceId}:`, error);
        }
      }
    }

    this.instances.clear();
    this.services.clear();
    this.isInitializing.clear();

    this.emit('container-disposed');
  }

  // ============ 私有方法 ============

  /**
   * 解析单例服务
   */
  private async resolveSingleton<T>(descriptor: ServiceDescriptor<T>): Promise<T> {
    let instanceInfo = this.instances.get(descriptor.id);
    
    if (!instanceInfo) {
      const instance = await this.createInstance(descriptor);
      
      instanceInfo = {
        id: descriptor.id,
        instance,
        lifetime: ServiceLifetime.SINGLETON,
        createdAt: new Date(),
        accessCount: 0
      };
      
      this.instances.set(descriptor.id, instanceInfo);
    }

    instanceInfo.accessCount++;
    return instanceInfo.instance;
  }

  /**
   * 解析瞬时服务
   */
  private async resolveTransient<T>(descriptor: ServiceDescriptor<T>): Promise<T> {
    return this.createInstance(descriptor);
  }

  /**
   * 解析作用域服务
   */
  private async resolveScoped<T>(descriptor: ServiceDescriptor<T>, scopeId: string): Promise<T> {
    let scope = this.scopes.get(scopeId);
    if (!scope) {
      scope = new Map();
      this.scopes.set(scopeId, scope);
    }

    let instance = scope.get(descriptor.id);
    if (!instance) {
      instance = await this.createInstance(descriptor);
      scope.set(descriptor.id, instance);
    }

    return instance;
  }

  /**
   * 创建服务实例
   */
  private async createInstance<T>(descriptor: ServiceDescriptor<T>): Promise<T> {
    this.isInitializing.add(descriptor.id);

    try {
      // 解析依赖
      const dependencies = await this.resolveDependencies(descriptor.dependencies);
      
      // 调用工厂函数
      const instance = await descriptor.factory(this, ...dependencies);
      
      this.emit('service-created', descriptor, instance);
      return instance;
    } finally {
      this.isInitializing.delete(descriptor.id);
    }
  }

  /**
   * 解析依赖数组
   */
  private async resolveDependencies(dependencies: string[]): Promise<any[]> {
    const resolved: any[] = [];
    
    for (const depId of dependencies) {
      const dependency = await this.resolve(depId);
      resolved.push(dependency);
    }

    return resolved;
  }

  /**
   * 验证服务描述符
   */
  private validateServiceDescriptor(descriptor: ServiceDescriptor): void {
    if (!descriptor.id || typeof descriptor.id !== 'string') {
      throw new Error('Service descriptor must have a valid id');
    }

    if (!descriptor.name || typeof descriptor.name !== 'string') {
      throw new Error('Service descriptor must have a valid name');
    }

    if (typeof descriptor.factory !== 'function') {
      throw new Error('Service descriptor must have a valid factory function');
    }

    if (!Object.values(ServiceLifetime).includes(descriptor.lifetime)) {
      throw new Error('Service descriptor must have a valid lifetime');
    }

    if (!Array.isArray(descriptor.dependencies)) {
      throw new Error('Service descriptor dependencies must be an array');
    }

    if (this.services.has(descriptor.id)) {
      throw new Error(`Service with id '${descriptor.id}' is already registered`);
    }
  }

  /**
   * 检测循环依赖
   */
  private detectCircularDependencies(services: ServiceDescriptor[]): CircularDependencyResult {
    const graph = new Map<string, string[]>();
    
    // 构建依赖图
    for (const service of services) {
      graph.set(service.id, service.dependencies.slice());
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const dfs = (serviceId: string, path: string[]): void => {
      if (visiting.has(serviceId)) {
        // 发现循环
        const cycleStart = path.indexOf(serviceId);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart).concat(serviceId));
        }
        return;
      }

      if (visited.has(serviceId)) {
        return;
      }

      visiting.add(serviceId);
      const dependencies = graph.get(serviceId) || [];
      
      for (const depId of dependencies) {
        dfs(depId, path.concat(serviceId));
      }

      visiting.delete(serviceId);
      visited.add(serviceId);
    };

    // 检查每个服务
    for (const serviceId of graph.keys()) {
      if (!visited.has(serviceId)) {
        dfs(serviceId, []);
      }
    }

    const affectedServices = new Set<string>();
    for (const cycle of cycles) {
      cycle.forEach(id => affectedServices.add(id));
    }

    return {
      hasCircularDependency: cycles.length > 0,
      cycles,
      affectedServices: Array.from(affectedServices)
    };
  }
}

/**
 * 全局依赖注入容器实例
 */
export const globalContainer = new DIContainer();