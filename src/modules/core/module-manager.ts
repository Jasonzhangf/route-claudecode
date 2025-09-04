/**
 * !W¡h
 * 
 * #!W„èŒÑ°}h¡
 * 
 * @author Jason Zhang
 */

import { ModuleInterface } from '../../interfaces/module/base-module';
import { secureLogger } from '../../utils/secure-logger';

/**
 * !W¡h{
 */
export class ModuleManager {
  private modules: Map<string, ModuleInterface> = new Map();
  private dependencies: Map<string, string[]> = new Map();

  /**
   * èŒ!W
   */
  async registerModule(module: ModuleInterface): Promise<void> {
    this.modules.set(module.getId(), module);
  }

  /**
   * ·Ö!W
   */
  getModule(moduleId: string): ModuleInterface | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * ·Ö@	!W
   */
  getAllModules(): ModuleInterface[] {
    return Array.from(this.modules.values());
  }

  /**
   * ûd!W
   */
  async unregisterModule(moduleId: string): Promise<void> {
    const module = this.modules.get(moduleId);
    if (module) {
      await module.cleanup();
      this.modules.delete(moduleId);
    }
  }

  /**
   * /¨@	!W
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
   * \b@	!W
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