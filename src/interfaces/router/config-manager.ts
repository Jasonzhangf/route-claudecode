/**
 * 配置管理器接口定义
 *
 * 定义配置系统的标准接口
 *
 * @author Jason Zhang
 */

// 内嵌必要的配置类型定义
export interface RCCConfig {
  version: string;
  debug?: DebugConfig;
  server?: ServerConfig;
  providers?: ProviderConfig[];
  routing?: RoutingConfig;
  pipeline?: PipelineConfig;
}

export interface DebugConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  saveRequests: boolean;
  captureLevel: 'basic' | 'full';
}

export interface ServerConfig {
  port: number;
  host: string;
  cors?: {
    enabled: boolean;
    origins: string[];
  };
}

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: 'openai' | 'anthropic' | 'gemini';
  baseUrl: string;
  apiKey: string;
  models: ModelConfig[];
  healthCheck?: HealthCheckConfig;
  rateLimit?: RateLimitConfig;
}

export interface ModelConfig {
  id: string;
  name: string;
  maxTokens: number;
  supportsFunctions: boolean;
  supportsStreaming: boolean;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  endpoint: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface RoutingConfig {
  strategy: 'weighted' | 'round-robin' | 'least-connections';
  categories: Record<string, CategoryConfig>;
}

export interface CategoryConfig {
  rules: RoutingRule[];
}

export interface RoutingRule {
  provider: string;
  model: string;
  weight: number;
}

export interface PipelineConfig {
  modules: Record<string, ModuleConfig>;
}

export interface ModuleConfig {
  enabled: boolean;
  [key: string]: any;
}

/**
 * 配置管理器接口
 */
export interface ConfigManager {
  /**
   * 加载Provider配置
   */
  loadProviderConfig(): Promise<ProviderConfig[]>;

  /**
   * 加载路由配置
   */
  loadRoutingConfig(): Promise<RoutingConfig>;

  /**
   * 加载完整配置
   */
  loadConfig(): Promise<RCCConfig>;

  /**
   * 生成路由表
   */
  generateRoutingTable(): Promise<GeneratedRoutingTable>;

  /**
   * 监听配置变化
   */
  watchConfigChanges(callback: ConfigChangeCallback): void;

  /**
   * 验证配置
   */
  validateConfig(config: RCCConfig): Promise<ConfigValidationResult>;

  /**
   * 保存配置
   */
  saveConfig(config: RCCConfig): Promise<void>;

  /**
   * 重置为默认配置
   */
  resetToDefault(): Promise<void>;
}

/**
 * 生成的路由表
 */
export interface GeneratedRoutingTable {
  timestamp: number;
  version: string;
  routes: Array<{
    category: string;
    pipelines: Array<{
      id: string;
      provider: string;
      model: string;
      weight: number;
      isActive: boolean;
      priority?: number;
    }>;
  }>;
  metadata: {
    totalProviders: number;
    totalModels: number;
    generatedAt: Date;
    configHash: string;
  };
}

/**
 * 配置变化回调
 */
export type ConfigChangeCallback = (change: ConfigChange) => void;

/**
 * 配置变化事件
 */
export interface ConfigChange {
  type: 'provider' | 'routing' | 'server' | 'debug';
  action: 'added' | 'updated' | 'removed';
  path: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

/**
 * 配置验证错误
 */
export interface ConfigValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

/**
 * 配置验证警告
 */
export interface ConfigValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

/**
 * 配置加载器接口
 */
export interface ConfigLoader {
  /**
   * 从文件加载配置
   */
  loadFromFile(filePath: string): Promise<any>;

  /**
   * 从环境变量加载配置
   */
  loadFromEnv(): Promise<Partial<RCCConfig>>;

  /**
   * 合并配置
   */
  mergeConfigs(configs: Partial<RCCConfig>[]): RCCConfig;

  /**
   * 解析配置模板
   */
  parseTemplate(template: string, variables: Record<string, string>): string;
}

/**
 * 配置监听器接口
 */
export interface ConfigWatcher {
  /**
   * 开始监听配置文件变化
   */
  startWatching(paths: string[], callback: ConfigChangeCallback): void;

  /**
   * 停止监听
   */
  stopWatching(): void;

  /**
   * 检查文件是否被监听
   */
  isWatching(path: string): boolean;
}

/**
 * 配置缓存接口
 */
export interface ConfigCache {
  /**
   * 获取缓存的配置
   */
  get<T>(key: string): T | null;

  /**
   * 设置配置缓存
   */
  set<T>(key: string, value: T, ttl?: number): void;

  /**
   * 清除缓存
   */
  clear(key?: string): void;

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean;
}
