/**
 * 自检模块工厂
 *
 * 负责创建和管理自检模块实例
 *
 * @author Jason Zhang
 * @version 4.0.0
 */

import { ISelfCheckModule } from './self-check.interface';
import { SelfCheckService } from './self-check.service';
import { SelfCheckConfig } from './self-check-types';
import { RCCError } from '../types/src';

/**
 * 自检模块工厂类
 */
export class SelfCheckModuleFactory {
  private static instance: SelfCheckModuleFactory;
  private modules: Map<string, ISelfCheckModule> = new Map();

  private constructor() {}

  /**
   * 获取工厂单例实例
   * @returns SelfCheckModuleFactory 工厂实例
   */
  public static getInstance(): SelfCheckModuleFactory {
    if (!SelfCheckModuleFactory.instance) {
      SelfCheckModuleFactory.instance = new SelfCheckModuleFactory();
    }
    return SelfCheckModuleFactory.instance;
  }

  /**
   * 创建自检模块实例
   * @param moduleId 模块ID
   * @param config 自检配置
   * @returns ISelfCheckModule 自检模块实例
   */
  public createSelfCheckModule(moduleId: string, config?: SelfCheckConfig): ISelfCheckModule {
    // 检查是否已存在相同ID的模块
    if (this.modules.has(moduleId)) {
      throw new RCCError(`自检模块 ${moduleId} 已存在`, 'SELF_CHECK_FACTORY_001', 'SelfCheckModuleFactory');
    }

    // 创建新的自检模块实例
    const selfCheckModule = new SelfCheckService();
    
    // 如果提供了配置，配置模块
    if (config) {
      selfCheckModule.configureSelfCheck(config).catch(error => {
        // 记录配置错误但不中断创建过程
        // 在实际实现中，这里应该使用适当的日志记录机制
      });
    }

    // 存储模块实例
    this.modules.set(moduleId, selfCheckModule);
    
    return selfCheckModule;
  }

  /**
   * 获取自检模块实例
   * @param moduleId 模块ID
   * @returns ISelfCheckModule 自检模块实例
   */
  public getSelfCheckModule(moduleId: string): ISelfCheckModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * 获取所有自检模块实例
   * @returns Map<string, ISelfCheckModule> 所有自检模块实例
   */
  public getAllSelfCheckModules(): Map<string, ISelfCheckModule> {
    return new Map(this.modules);
  }

  /**
   * 销毁自检模块实例
   * @param moduleId 模块ID
   * @returns boolean 是否成功销毁
   */
  public destroySelfCheckModule(moduleId: string): boolean {
    const module = this.modules.get(moduleId);
    if (module) {
      // 清理模块资源
      module.cleanup().catch(error => {
        // 记录清理错误但不中断销毁过程
        // 在实际实现中，这里应该使用适当的日志记录机制
      });
      
      // 从映射中移除
      this.modules.delete(moduleId);
      return true;
    }
    return false;
  }

  /**
   * 销毁所有自检模块实例
   */
  public destroyAllSelfCheckModules(): void {
    for (const [moduleId] of this.modules) {
      this.destroySelfCheckModule(moduleId);
    }
  }
}