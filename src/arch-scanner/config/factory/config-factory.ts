/**
 * Configuration Module Factory
 * 
 * 创建配置管理相关组件的工厂
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ConfigManagerInterface } from '../../core/interfaces/scanner-interface';
import { ConfigManagerImpl } from '../internal/config-manager-impl';

/**
 * 配置模块工厂
 */
export class ConfigModuleFactory {
  /**
   * 创建配置管理器
   */
  static createConfigManager(): ConfigManagerInterface {
    return new ConfigManagerImpl();
  }
}