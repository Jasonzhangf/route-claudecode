/**
 * 流水线模块管理
 *
 * @author Jason Zhang
 */

import { ModuleInterface } from '../interfaces/module/base-module';

export interface PipelineModule {
  id: string;
  module: ModuleInterface;
  config: any;
}

export class PipelineModuleManager {
  private modules: Map<string, PipelineModule> = new Map();

  addModule(id: string, module: ModuleInterface, config: any = {}): void {
    this.modules.set(id, { id, module, config });
  }

  removeModule(id: string): boolean {
    return this.modules.delete(id);
  }

  getModule(id: string): PipelineModule | undefined {
    return this.modules.get(id);
  }

  getAllModules(): PipelineModule[] {
    return Array.from(this.modules.values());
  }
}
