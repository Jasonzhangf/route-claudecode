/**
 * RCC v4.0 Configuration Loader (Legacy Compatibility)
 *
 * 提供向后兼容的配置加载接口
 * 新代码请使用模块化的 ConfigManager
 *
 * @author Jason Zhang
 * @deprecated 请使用 ConfigManager 替代
 */

import { secureLogger } from '../utils/secure-logger';
import { ConfigManager, getConfigManager } from './config-manager';

// 重新导出所有类型，保持向后兼容
export * from './config-types';

/**
 * RCC v4.0配置加载器 (兼容类)
 * @deprecated 请使用 ConfigManager 替代
 */
export class RCCv4ConfigLoader {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = getConfigManager();
    secureLogger.warn('⚠️ RCCv4ConfigLoader 已弃用，请使用 ConfigManager');
  }

  /**
   * 初始化配置加载器
   */
  async initialize(): Promise<void> {
    await this.configManager.initialize();
    secureLogger.info('🔧 RCC v4.0配置加载器已初始化 (兼容模式)');
  }

  /**
   * 加载完整的v4配置
   */
  async loadConfig(configDir: string = 'config/v4') {
    return this.configManager.loadConfig(configDir);
  }

  /**
   * 获取Provider配置
   */
  getProviderConfig(config: any, providerId: string) {
    // 设置当前配置到管理器 (如果需要)
    if (this.configManager.getCurrentConfig() !== config) {
      // 这是一个兼容性hack，实际使用中应该避免
      secureLogger.warn('⚠️ 使用兼容模式获取Provider配置');
    }
    return this.configManager.getProviderConfig(providerId);
  }

  /**
   * 获取启用的Provider列表
   */
  getEnabledProviders(config: any) {
    // 设置当前配置到管理器 (如果需要)
    if (this.configManager.getCurrentConfig() !== config) {
      secureLogger.warn('⚠️ 使用兼容模式获取启用的Provider');
    }
    return this.configManager.getEnabledProviders();
  }

  /**
   * 获取路由配置
   */
  getRouteConfig(config: any, routeId: string) {
    // 设置当前配置到管理器 (如果需要)
    if (this.configManager.getCurrentConfig() !== config) {
      secureLogger.warn('⚠️ 使用兼容模式获取路由配置');
    }
    return this.configManager.getRouteConfig(routeId);
  }

  /**
   * 获取当前配置 (用于API)
   */
  async getCurrentConfig(): Promise<any> {
    return this.configManager.getCurrentConfig();
  }

  /**
   * 验证配置 (用于API)
   */
  async validateConfig(config: any): Promise<{ valid: boolean; errors: string[] }> {
    return this.configManager.validateConfig(config);
  }

  /**
   * 更新配置 (用于API)
   */
  async updateConfig(config: any): Promise<void> {
    return this.configManager.updateConfig('current', config);
  }

  /**
   * 导出配置 (用于API)
   */
  async exportConfig(): Promise<any> {
    return this.configManager.exportConfig();
  }

  /**
   * 列出配置 (用于CLI)
   */
  async listConfigurations(): Promise<Array<{ name: string; path: string; active: boolean }>> {
    const configPaths = await this.configManager.listConfigurations();
    return configPaths.map(path => ({
      name: path.split('/').pop() || 'unknown',
      path,
      active: false,
    }));
  }

  /**
   * 验证配置文件 (用于CLI)
   */
  async validateConfiguration(config: any): Promise<{ valid: boolean; errors: string[] }> {
    return this.validateConfig(config);
  }

  /**
   * 重置为默认配置 (用于CLI)
   */
  async resetToDefaults(): Promise<void> {
    return this.configManager.resetToDefaults();
  }

  /**
   * 获取当前配置 (用于CLI)
   */
  async getCurrentConfiguration(): Promise<any> {
    return this.getCurrentConfig();
  }

  /**
   * 更新配置 (用于CLI)
   */
  async updateConfiguration(config: any): Promise<void> {
    return this.updateConfig(config);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 不清理全局管理器，只记录警告
    secureLogger.info('🧹 配置加载器已清理 (兼容模式)');
  }
}
