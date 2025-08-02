/**
 * CodeWhisperer 实时流式配置管理
 * 支持动态切换缓冲式和实时流式实现
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface CodeWhispererStreamingConfig {
  // 实现选择
  implementation: 'buffered' | 'realtime';
  
  // 实时流式选项
  realtimeOptions: {
    enableZeroDelay: boolean;               // 是否启用零延迟
    maxConcurrentStreams: number;           // 最大并发流数
    binaryFrameSize: number;                // 二进制帧大小限制
    toolCallStrategy: 'immediate' | 'buffered'; // 工具调用处理策略
    enableCompression: boolean;             // 启用压缩
  };
  
  // 性能监控
  performanceMetrics: {
    enableProfiling: boolean;               // 启用性能分析
    collectLatencyData: boolean;            // 收集延迟数据
    memoryUsageTracking: boolean;           // 内存使用跟踪
    metricsIntervalMs: number;              // 指标收集间隔
  };
  
  // 故障转移
  fallback: {
    enableFallback: boolean;                // 启用故障转移
    fallbackToBuffered: boolean;            // 失败时回退到缓冲式
    maxFailuresBeforeFallback: number;      // 最大失败次数
  };
}

export const defaultStreamingConfig: CodeWhispererStreamingConfig = {
  implementation: 'buffered',              // 默认使用现有实现
  realtimeOptions: {
    enableZeroDelay: true,
    maxConcurrentStreams: 100,
    binaryFrameSize: 1024 * 1024,           // 1MB
    toolCallStrategy: 'immediate',
    enableCompression: false,
  },
  performanceMetrics: {
    enableProfiling: false,
    collectLatencyData: false,
    memoryUsageTracking: false,
    metricsIntervalMs: 5000,
  },
  fallback: {
    enableFallback: true,
    fallbackToBuffered: true,
    maxFailuresBeforeFallback: 3,
  },
};

export class CodeWhispererStreamingConfigManager {
  private static instance: CodeWhispererStreamingConfigManager;
  private config: CodeWhispererStreamingConfig;
  private configPath: string;
  private listeners: Array<(config: CodeWhispererStreamingConfig) => void> = [];

  private constructor() {
    this.configPath = this.getConfigPathInternal();
    this.config = this.loadConfig();
  }

  static getInstance(): CodeWhispererStreamingConfigManager {
    if (!CodeWhispererStreamingConfigManager.instance) {
      CodeWhispererStreamingConfigManager.instance = 
        new CodeWhispererStreamingConfigManager();
    }
    return CodeWhispererStreamingConfigManager.instance;
  }

  /**
   * 获取配置文件路径
   */
  /**
   * 获取配置文件路径
   */
  private getConfigPathInternal(): string {
    // 优先使用环境变量指定的路径
    const envPath = process.env.CODEWHISPERER_STREAMING_CONFIG;
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }

    // 其次使用用户目录下的配置
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const userConfigPath = path.join(
      homeDir, 
      '.route-claude-code', 
      'config', 
      'codewhisperer-streaming.json'
    );
    
    if (fs.existsSync(userConfigPath)) {
      return userConfigPath;
    }

    // 最后使用项目目录下的配置
    const projectConfigPath = path.join(
      process.cwd(), 
      'config', 
      'codewhisperer-streaming.json'
    );
    
    return projectConfigPath;
  }

  /**
   * 加载配置
   */
  private loadConfig(): CodeWhispererStreamingConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        const mergedConfig = { ...defaultStreamingConfig, ...configData };
        
        logger.info('成功加载CodeWhisperer流式配置', {
          path: this.configPath,
          implementation: mergedConfig.implementation,
          realtimeOptions: mergedConfig.realtimeOptions,
        });
        
        return mergedConfig;
      }
    } catch (error) {
      logger.warn('无法加载CodeWhisperer流式配置，使用默认配置', {
        path: this.configPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info('使用默认CodeWhisperer流式配置');
    return { ...defaultStreamingConfig };
  }

  /**
   * 保存配置到文件
   */
  private saveConfig(): void {
    try {
      // 确保目录存在
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      logger.info('CodeWhisperer流式配置已保存', { path: this.configPath });
    } catch (error) {
      logger.error('保存CodeWhisperer流式配置失败', {
        path: this.configPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): CodeWhispererStreamingConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CodeWhispererStreamingConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    logger.info('CodeWhisperer流式配置已更新', {
      changes: this.getConfigChanges(oldConfig, this.config),
      newConfig: this.config,
    });
    
    // 保存配置
    this.saveConfig();
    
    // 通知监听器
    this.notifyListeners(this.config);
  }

  /**
   * 切换实现类型
   */
  switchImplementation(implementation: 'buffered' | 'realtime'): void {
    const oldImplementation = this.config.implementation;
    this.config.implementation = implementation;
    
    logger.info(`CodeWhisperer实现已切换`, {
      from: oldImplementation,
      to: implementation,
      configPath: this.configPath,
    });
    
    // 保存配置
    this.saveConfig();
    
    // 通知监听器
    this.notifyListeners(this.config);
  }

  /**
   * 添加配置变更监听器
   */
  addConfigChangeListener(
    listener: (config: CodeWhispererStreamingConfig) => void
  ): void {
    this.listeners.push(listener);
  }

  /**
   * 移除配置变更监听器
   */
  removeConfigChangeListener(
    listener: (config: CodeWhispererStreamingConfig) => void
  ): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(config: CodeWhispererStreamingConfig): void {
    this.listeners.forEach(listener => {
      try {
        listener(config);
      } catch (error) {
        logger.error('配置变更监听器执行失败', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * 获取配置变更内容
   */
  private getConfigChanges(
    oldConfig: CodeWhispererStreamingConfig,
    newConfig: CodeWhispererStreamingConfig
  ): Record<string, any> {
    const changes: Record<string, any> = {};
    
    if (oldConfig.implementation !== newConfig.implementation) {
      changes.implementation = {
        from: oldConfig.implementation,
        to: newConfig.implementation,
      };
    }
    
    // 检查realtimeOptions的变更
    const realtimeChanges: Record<string, any> = {};
    for (const key in oldConfig.realtimeOptions) {
      const oldValue = (oldConfig.realtimeOptions as any)[key];
      const newValue = (newConfig.realtimeOptions as any)[key];
      if (oldValue !== newValue) {
        realtimeChanges[key] = { from: oldValue, to: newValue };
      }
    }
    if (Object.keys(realtimeChanges).length > 0) {
      changes.realtimeOptions = realtimeChanges;
    }
    
    return changes;
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 重置为默认配置
   */
  resetToDefault(): void {
    this.config = { ...defaultStreamingConfig };
    this.saveConfig();
    this.notifyListeners(this.config);
    logger.info('CodeWhisperer流式配置已重置为默认配置');
  }

  /**
   * 验证配置
   */
  validateConfig(config: CodeWhispererStreamingConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // 验证implementation
    if (!['buffered', 'realtime'].includes(config.implementation)) {
      errors.push('implementation必须是buffered或realtime');
    }
    
    // 验证realtimeOptions
    if (config.realtimeOptions.maxConcurrentStreams < 1) {
      errors.push('maxConcurrentStreams必须大于0');
    }
    
    if (config.realtimeOptions.binaryFrameSize < 1024) {
      errors.push('binaryFrameSize必须至少为1024字节');
    }
    
    if (!['immediate', 'buffered'].includes(config.realtimeOptions.toolCallStrategy)) {
      errors.push('toolCallStrategy必须是immediate或buffered');
    }
    
    // 验证performanceMetrics
    if (config.performanceMetrics.metricsIntervalMs < 100) {
      errors.push('metricsIntervalMs必须至少为100ms');
    }
    
    // 验证fallback
    if (config.fallback.maxFailuresBeforeFallback < 1) {
      errors.push('maxFailuresBeforeFallback必须大于0');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
