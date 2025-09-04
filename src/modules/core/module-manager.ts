/**
 * Module Manager
 * 
 * 负责模块的注册、管理和生命周期控制
 * 
 * @author Jason Zhang
 */

import { ModuleInterface } from '../../interfaces/module/base-module';
import { secureLogger } from '../../utils/secure-logger';

/**
 * 模块管理器
 */
export class ModuleManager {
  private modules: Map<string, ModuleInterface> = new Map();
  private dependencies: Map<string, string[]> = new Map();

  /**
   * 注册模块
   */
  async registerModule(module: ModuleInterface): Promise<void> {
    this.modules.set(module.getId(), module);
  }

  /**
   * 获取模块
   */
  getModule(moduleId: string): ModuleInterface | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * 获取所有模块
   */
  getAllModules(): ModuleInterface[] {
    return Array.from(this.modules.values());
  }

  /**
   * 注销模块
   */
  async unregisterModule(moduleId: string): Promise<void> {
    const module = this.modules.get(moduleId);
    if (module) {
      await module.cleanup();
      this.modules.delete(moduleId);
    }
  }

  /**
   * 启动所有模块
   */
  async startAllModules(): Promise<void> {
    for (const module of this.modules.values()) {
      try {
        await module.start();
      } catch (error) {
        secureLogger.error('Failed to start module', {
          moduleId: module.getId(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * 停止所有模块
   */
  async stopAllModules(): Promise<void> {
    for (const module of this.modules.values()) {
      try {
        await module.stop();
      } catch (error) {
        secureLogger.error('Failed to stop module', {
          moduleId: module.getId(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}