# CLI扩展模块 (CLI Extensions Module)

## 模块概述

CLI扩展模块是RCC v4.0系统的命令行接口功能扩展集合，提供额外的CLI命令和功能，增强系统的可管理性和用户体验。

## 模块职责

1. **Provider管理**: 提供AI Provider的自动更新和管理功能
2. **模型发现**: 自动发现和管理可用的AI模型
3. **Token限制测试**: 测试和验证模型的Token限制
4. **黑名单管理**: 管理模型黑名单和限制访问
5. **长上下文模型管理**: 自动识别和管理长上下文模型
6. **性能基准测试**: 提供性能基准测试功能
7. **配置导出**: 导出环境变量和配置信息

## 模块结构

```
cli-extensions/
├── README.md                          # 本模块设计文档
├── index.ts                           # 模块入口和导出
├── extension-manager.ts               # 扩展管理器
├── provider-updater/                  # Provider更新器
│   ├── provider-updater.ts            # Provider更新器主类
│   ├── provider-discovery.ts           # Provider发现器
│   ├── provider-validator.ts           # Provider验证器
│   ├── provider-installer.ts           # Provider安装器
│   └── provider-uninstaller.ts        # Provider卸载器
├── model-discovery/                   # 模型发现器
│   ├── model-discovery.ts              # 模型发现器主类
│   ├── model-scanner.ts                # 模型扫描器
│   ├── model-validator.ts              # 模型验证器
│   ├── model-cache.ts                  # 模型缓存
│   └── model-registry.ts              # 模型注册表
├── token-limiter/                     # Token限制器
│   ├── token-limiter.ts                # Token限制器主类
│   ├── token-tester.ts                # Token测试器
│   ├── token-analyzer.ts               # Token分析器
│   ├── token-cache.ts                  # Token缓存
│   └── token-reporter.ts              # Token报告器
├── blacklist-manager/                 # 黑名单管理器
│   ├── blacklist-manager.ts            # 黑名单管理器主类
│   ├── blacklist-loader.ts             # 黑名单加载器
│   ├── blacklist-saver.ts              # 黑名单保存器
│   ├── blacklist-validator.ts           # 黑名单验证器
│   └── blacklist-cache.ts              # 黑名单缓存
├── long-context-manager/              # 长上下文管理器
│   ├── long-context-manager.ts         # 长上下文管理器主类
│   ├── context-detector.ts             # 上下文检测器
│   ├── context-analyzer.ts             # 上下文分析器
│   ├── context-cache.ts                # 上下文缓存
│   └── context-reporter.ts             # 上下文报告器
├── benchmark/                        # 基准测试器
│   ├── benchmark-runner.ts             # 基准测试运行器
│   ├── benchmark-analyzer.ts           # 基准测试分析器
│   ├── benchmark-reporter.ts            # 基准测试报告器
│   ├── benchmark-cache.ts              # 基准测试缓存
│   └── benchmark-config.ts             # 基准测试配置
├── config-exporter/                   # 配置导出器
│   ├── config-exporter.ts              # 配置导出器主类
│   ├── env-exporter.ts                 # 环境变量导出器
│   ├── config-formatter.ts             # 配置格式化器
│   ├── config-validator.ts              # 配置验证器
│   └── config-cache.ts                # 配置缓存
├── types/                             # 扩展类型定义
│   ├── provider-types.ts               # Provider类型定义
│   ├── model-types.ts                  # 模型类型定义
│   ├── token-types.ts                  # Token类型定义
│   ├── blacklist-types.ts              # 黑名单类型定义
│   ├── context-types.ts                # 上下文类型定义
│   ├── benchmark-types.ts              # 基准测试类型定义
│   └── config-types.ts                 # 配置类型定义
└── utils/                             # 工具函数
    ├── http-client.ts                  # HTTP客户端
    ├── file-utils.ts                   # 文件工具
    ├── validation-utils.ts             # 验证工具
    ├── cache-utils.ts                  # 缓存工具
    └── reporting-utils.ts              # 报告工具
```

## 核心组件

### 扩展管理器 (ExtensionManager)
负责CLI扩展的整体协调和管理，是模块的主入口点。

### Provider更新器 (ProviderUpdater)
提供AI Provider的自动更新和管理功能。

### 模型发现器 (ModelDiscovery)
自动发现和管理可用的AI模型。

### Token限制器 (TokenLimiter)
测试和验证模型的Token限制。

### 黑名单管理器 (BlacklistManager)
管理模型黑名单和限制访问。

### 长上下文管理器 (LongContextManager)
自动识别和管理长上下文模型。

### 基准测试器 (Benchmark)
提供性能基准测试功能。

### 配置导出器 (ConfigExporter)
导出环境变量和配置信息。

## Provider更新器

### Provider更新器
```typescript
// provider-updater.ts
import { EventEmitter } from 'events';
import { ProviderDiscovery } from './provider-discovery';
import { ProviderInstaller } from './provider-installer';
import { ProviderValidator } from './provider-validator';

export interface ProviderUpdateOptions {
  autoInstall?: boolean;
  validateAfterUpdate?: boolean;
  backupExisting?: boolean;
  updateInterval?: number;
  forceUpdate?: boolean;
}

export interface ProviderUpdateResult {
  provider: string;
  version: string;
  updated: boolean;
  installed: boolean;
  validated: boolean;
  backupCreated: boolean;
  error?: string;
}

export class ProviderUpdater extends EventEmitter {
  private discovery: ProviderDiscovery;
  private installer: ProviderInstaller;
  private validator: ProviderValidator;
  private updateInterval?: NodeJS.Timeout;
  private autoInstall: boolean = true;
  private validateAfterUpdate: boolean = true;
  private backupExisting: boolean = true;
  
  constructor(options?: ProviderUpdateOptions) {
    super();
    
    this.discovery = new ProviderDiscovery();
    this.installer = new ProviderInstaller();
    this.validator = new ProviderValidator();
    
    if (options) {
      this.autoInstall = options.autoInstall ?? true;
      this.validateAfterUpdate = options.validateAfterUpdate ?? true;
      this.backupExisting = options.backupExisting ?? true;
      
      if (options.updateInterval) {
        this.startAutoUpdates(options.updateInterval);
      }
    }
  }
  
  /**
   * 更新所有Provider
   */
  async updateAllProviders(options?: ProviderUpdateOptions): Promise<ProviderUpdateResult[]> {
    const results: ProviderUpdateResult[] = [];
    
    try {
      console.log('🔄 Updating all providers...');
      
      // 发现可用的Provider
      const availableProviders = await this.discovery.discoverAvailableProviders();
      
      // 更新每个Provider
      for (const provider of availableProviders) {
        try {
          const result = await this.updateProvider(provider, options);
          results.push(result);
          
          // 发出更新事件
          this.emit('providerUpdated', result);
        } catch (error) {
          const errorResult: ProviderUpdateResult = {
            provider: provider.name,
            version: 'unknown',
            updated: false,
            installed: false,
            validated: false,
            backupCreated: false,
            error: error.message
          };
          
          results.push(errorResult);
          this.emit('providerUpdateFailed', errorResult);
        }
      }
      
      console.log(`✅ Updated ${results.length} providers`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Failed to update providers:', error.message);
      throw error;
    }
  }
  
  /**
   * 更新单个Provider
   */
  async updateProvider(provider: ProviderInfo, options?: ProviderUpdateOptions): Promise<ProviderUpdateResult> {
    const opts = { ...this.getDefaultOptions(), ...options };
    
    console.log(`🔄 Updating provider: ${provider.name} (${provider.version})`);
    
    try {
      // 检查是否有更新
      const hasUpdate = await this.discovery.checkForUpdates(provider);
      
      if (!hasUpdate && !opts.forceUpdate) {
        console.log(`✅ Provider ${provider.name} is already up to date`);
        
        return {
          provider: provider.name,
          version: provider.version,
          updated: false,
          installed: false,
          validated: false,
          backupCreated: false
        };
      }
      
      // 创建备份
      let backupCreated = false;
      if (opts.backupExisting) {
        await this.createBackup(provider);
        backupCreated = true;
        console.log(`💾 Backup created for ${provider.name}`);
      }
      
      // 下载并安装更新
      let installed = false;
      if (opts.autoInstall) {
        await this.installer.installProvider(provider);
        installed = true;
        console.log(`✅ Provider ${provider.name} installed successfully`);
      }
      
      // 验证更新
      let validated = false;
      if (opts.validateAfterUpdate) {
        const isValid = await this.validator.validateProvider(provider);
        validated = isValid;
        
        if (isValid) {
          console.log(`✅ Provider ${provider.name} validated successfully`);
        } else {
          console.warn(`⚠️ Provider ${provider.name} validation failed`);
        }
      }
      
      const result: ProviderUpdateResult = {
        provider: provider.name,
        version: provider.latestVersion || provider.version,
        updated: true,
        installed,
        validated,
        backupCreated,
        error: validated ? undefined : 'Validation failed'
      };
      
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to update provider ${provider.name}:`, error.message);
      
      throw error;
    }
  }
  
  /**
   * 手动安装Provider
   */
  async installProvider(provider: ProviderInfo, options?: { force?: boolean }): Promise<void> {
    try {
      console.log(`📥 Installing provider: ${provider.name}`);
      
      // 验证Provider信息
      const isValid = await this.validator.validateProvider(provider);
      if (!isValid && !options?.force) {
        throw new Error(`Invalid provider: ${provider.name}`);
      }
      
      // 检查是否已安装
      const isInstalled = await this.installer.isProviderInstalled(provider);
      if (isInstalled && !options?.force) {
        console.log(`✅ Provider ${provider.name} is already installed`);
        return;
      }
      
      // 安装Provider
      await this.installer.installProvider(provider);
      console.log(`✅ Provider ${provider.name} installed successfully`);
      
      // 验证安装
      const installationValid = await this.validator.validateInstallation(provider);
      if (!installationValid) {
        throw new Error(`Installation validation failed for ${provider.name}`);
      }
      
      console.log(`✅ Installation verified for ${provider.name}`);
      
    } catch (error) {
      console.error(`❌ Failed to install provider ${provider.name}:`, error.message);
      throw error;
    }
  }
  
  /**
   * 卸载Provider
   */
  async uninstallProvider(providerName: string): Promise<void> {
    try {
      console.log(`🗑️ Uninstalling provider: ${providerName}`);
      
      // 检查是否存在
      const providerExists = await this.installer.isProviderInstalled({ name: providerName } as ProviderInfo);
      if (!providerExists) {
        console.log(`⚠️ Provider ${providerName} is not installed`);
        return;
      }
      
      // 卸载Provider
      await this.installer.uninstallProvider(providerName);
      console.log(`✅ Provider ${providerName} uninstalled successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to uninstall provider ${providerName}:`, error.message);
      throw error;
    }
  }
  
  /**
   * 创建备份
   */
  private async createBackup(provider: ProviderInfo): Promise<void> {
    try {
      const backupPath = await this.installer.createBackup(provider);
      console.log(`💾 Provider backup created: ${backupPath}`);
    } catch (error) {
      console.warn(`⚠️ Failed to create backup for ${provider.name}:`, error.message);
    }
  }
  
  /**
   * 获取默认选项
   */
  private getDefaultOptions(): ProviderUpdateOptions {
    return {
      autoInstall: this.autoInstall,
      validateAfterUpdate: this.validateAfterUpdate,
      backupExisting: this.backupExisting
    };
  }
  
  /**
   * 启动自动更新
   */
  startAutoUpdates(intervalMs: number): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateAllProviders();
      } catch (error) {
        console.error('❌ Auto-update failed:', error.message);
      }
    }, intervalMs);
    
    console.log(`⏰ Auto-updates scheduled every ${intervalMs}ms`);
  }
  
  /**
   * 停止自动更新
   */
  stopAutoUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
      console.log('🛑 Auto-updates stopped');
    }
  }
  
  /**
   * 获取更新状态
   */
  getUpdateStatus(): ProviderUpdateStatus {
    return {
      autoUpdatesEnabled: !!this.updateInterval,
      lastUpdate: new Date(),
      providersToUpdate: 0,
      failedUpdates: 0,
      successfulUpdates: 0
    };
  }
}
```

### Provider发现器
```typescript
// provider-discovery.ts
export interface ProviderInfo {
  name: string;
  version: string;
  description: string;
  homepage: string;
  repository: string;
  registry: string;
  latestVersion?: string;
  downloadUrl?: string;
  checksum?: string;
  dependencies?: Record<string, string>;
  keywords?: string[];
  author?: string;
  license?: string;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  config?: ProviderConfig;
  models?: ProviderModel[];
}

export class ProviderDiscovery {
  private registries: string[] = [
    'https://registry.npmjs.org',
    'https://registry.yarnpkg.com',
    'https://r.cnpmjs.org'
  ];
  
  private cache: Map<string, ProviderInfo> = new Map();
  private cacheTimeout: number = 3600000; // 1小时
  
  /**
   * 发现可用的Provider
   */
  async discoverAvailableProviders(): Promise<ProviderInfo[]> {
    try {
      console.log('🔍 Discovering available providers...');
      
      const providers: ProviderInfo[] = [];
      
      // 从注册表获取Provider列表
      const registryProviders = await this.discoverFromRegistries();
      providers.push(...registryProviders);
      
      // 从本地配置获取Provider列表
      const localProviders = await this.discoverFromLocalConfig();
      providers.push(...localProviders);
      
      // 从文件系统获取Provider列表
      const fsProviders = await this.discoverFromFileSystem();
      providers.push(...fsProviders);
      
      // 去重和验证
      const uniqueProviders = this.dedupeProviders(providers);
      const validProviders = await this.validateProviders(uniqueProviders);
      
      console.log(`✅ Discovered ${validProviders.length} valid providers`);
      
      return validProviders;
      
    } catch (error) {
      console.error('❌ Failed to discover providers:', error.message);
      return [];
    }
  }
  
  /**
   * 从注册表发现Provider
   */
  private async discoverFromRegistries(): Promise<ProviderInfo[]> {
    const providers: ProviderInfo[] = [];
    
    for (const registry of this.registries) {
      try {
        const registryProviders = await this.fetchProvidersFromRegistry(registry);
        providers.push(...registryProviders);
      } catch (error) {
        console.warn(`⚠️ Failed to fetch providers from ${registry}:`, error.message);
      }
    }
    
    return providers;
  }
  
  /**
   * 从注册表获取Provider
   */
  private async fetchProvidersFromRegistry(registry: string): Promise<ProviderInfo[]> {
    try {
      // 搜索关键词为 "rcc-provider" 或 "rcc-ai-provider" 的包
      const response = await fetch(`${registry}/-/v1/search?text=rcc-provider&size=100`);
      const data = await response.json();
      
      const providers: ProviderInfo[] = [];
      
      for (const pkg of data.objects) {
        try {
          const provider = await this.fetchProviderDetails(registry, pkg.package.name);
          if (provider) {
            providers.push(provider);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch details for ${pkg.package.name}:`, error.message);
        }
      }
      
      return providers;
      
    } catch (error) {
      console.warn(`⚠️ Failed to search registry ${registry}:`, error.message);
      return [];
    }
  }
  
  /**
   * 获取Provider详细信息
   */
  private async fetchProviderDetails(registry: string, packageName: string): Promise<ProviderInfo | null> {
    // 检查缓存
    const cacheKey = `${registry}:${packageName}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.lastChecked || 0) < this.cacheTimeout) {
      return cached;
    }
    
    try {
      const response = await fetch(`${registry}/${packageName}`);
      const data = await response.json();
      
      const latestVersion = data['dist-tags']?.latest;
      const latestManifest = data.versions?.[latestVersion];
      
      if (!latestManifest) {
        return null;
      }
      
      const provider: ProviderInfo = {
        name: data.name,
        version: latestVersion,
        description: data.description,
        homepage: data.homepage,
        repository: data.repository?.url,
        registry: registry,
        latestVersion: latestVersion,
        downloadUrl: latestManifest.dist?.tarball,
        checksum: latestManifest.dist?.shasum,
        dependencies: latestManifest.dependencies,
        keywords: data.keywords,
        author: data.author?.name,
        license: data.license,
        engines: latestManifest.engines,
        scripts: latestManifest.scripts,
        lastChecked: Date.now()
      };
      
      // 缓存结果
      this.cache.set(cacheKey, provider);
      
      return provider;
      
    } catch (error) {
      console.warn(`⚠️ Failed to fetch provider details for ${packageName}:`, error.message);
      return null;
    }
  }
  
  /**
   * 从本地配置发现Provider
   */
  private async discoverFromLocalConfig(): Promise<ProviderInfo[]> {
    try {
      // 读取本地配置文件
      const configPath = path.join(os.homedir(), '.route-claudecode', 'providers.json');
      if (fs.existsSync(configPath)) {
        const configFile = await fs.promises.readFile(configPath, 'utf-8');
        const config = JSON.parse(configFile);
        
        if (config.providers && Array.isArray(config.providers)) {
          return config.providers.map((p: any) => ({
            name: p.name,
            version: p.version || 'unknown',
            description: p.description || '',
            homepage: p.homepage || '',
            repository: p.repository || '',
            registry: 'local',
            config: p
          }));
        }
      }
      
      return [];
      
    } catch (error) {
      console.warn('⚠️ Failed to read local provider config:', error.message);
      return [];
    }
  }
  
  /**
   * 从文件系统发现Provider
   */
  private async discoverFromFileSystem(): Promise<ProviderInfo[]> {
    try {
      const providers: ProviderInfo[] = [];
      
      // 搜索常见的Provider安装路径
      const searchPaths = [
        path.join(os.homedir(), '.route-claudecode', 'providers'),
        path.join(process.cwd(), 'providers'),
        path.join(process.cwd(), 'node_modules')
      ];
      
      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          const fsProviders = await this.scanFileSystemForProviders(searchPath);
          providers.push(...fsProviders);
        }
      }
      
      return providers;
      
    } catch (error) {
      console.warn('⚠️ Failed to discover providers from filesystem:', error.message);
      return [];
    }
  }
  
  /**
   * 扫描文件系统中的Provider
   */
  private async scanFileSystemForProviders(searchPath: string): Promise<ProviderInfo[]> {
    const providers: ProviderInfo[] = [];
    
    try {
      const entries = await fs.promises.readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const packageJsonPath = path.join(searchPath, entry.name, 'package.json');
          
          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageJson = await fs.promises.readFile(packageJsonPath, 'utf-8');
              const manifest = JSON.parse(packageJson);
              
              // 检查是否是RCC Provider
              if (manifest.keywords && manifest.keywords.includes('rcc-provider')) {
                const provider: ProviderInfo = {
                  name: manifest.name,
                  version: manifest.version,
                  description: manifest.description,
                  homepage: manifest.homepage,
                  repository: manifest.repository?.url,
                  registry: 'filesystem',
                  lastChecked: Date.now()
                };
                
                providers.push(provider);
              }
            } catch (error) {
              console.warn(`⚠️ Failed to read package.json for ${entry.name}:`, error.message);
            }
          }
        }
      }
      
      return providers;
      
    } catch (error) {
      console.warn(`⚠️ Failed to scan filesystem path ${searchPath}:`, error.message);
      return [];
    }
  }
  
  /**
   * 去重Provider
   */
  private dedupeProviders(providers: ProviderInfo[]): ProviderInfo[] {
    const seen = new Set<string>();
    const uniqueProviders: ProviderInfo[] = [];
    
    for (const provider of providers) {
      if (!seen.has(provider.name)) {
        seen.add(provider.name);
        uniqueProviders.push(provider);
      }
    }
    
    return uniqueProviders;
  }
  
  /**
   * 验证Provider
   */
  private async validateProviders(providers: ProviderInfo[]): Promise<ProviderInfo[]> {
    const validProviders: ProviderInfo[] = [];
    
    for (const provider of providers) {
      try {
        const isValid = await this.validateProvider(provider);
        if (isValid) {
          validProviders.push(provider);
        }
      } catch (error) {
        console.warn(`⚠️ Provider ${provider.name} validation failed:`, error.message);
      }
    }
    
    return validProviders;
  }
  
  /**
   * 验证单个Provider
   */
  private async validateProvider(provider: ProviderInfo): Promise<boolean> {
    // 检查必需字段
    if (!provider.name || !provider.version) {
      return false;
    }
    
    // 检查是否包含rcc-provider关键词
    if (provider.keywords && !provider.keywords.includes('rcc-provider')) {
      return false;
    }
    
    // 检查版本格式
    if (!semver.valid(provider.version)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 检查更新
   */
  async checkForUpdates(provider: ProviderInfo): Promise<boolean> {
    try {
      if (provider.registry && provider.registry !== 'local' && provider.registry !== 'filesystem') {
        const latestProvider = await this.fetchProviderDetails(provider.registry, provider.name);
        if (latestProvider && latestProvider.latestVersion) {
          return semver.gt(latestProvider.latestVersion, provider.version);
        }
      }
      
      return false;
      
    } catch (error) {
      console.warn(`⚠️ Failed to check updates for ${provider.name}:`, error.message);
      return false;
    }
  }
  
  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Provider discovery cache cleared');
  }
}
```

## 模型发现器

### 模型发现器
```typescript
// model-discovery.ts
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  pricing: ModelPricing;
  availability: ModelAvailability;
  metadata: Record<string, any>;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctions: boolean;
  supportsVision: boolean;
  supportsEmbeddings: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsFiles: boolean;
  supportsTools: boolean;
}

export interface ModelLimits {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  tokensPerDay: number;
}

export interface ModelPricing {
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  cacheHitCostPerMillionTokens?: number;
  trainingCostPerMillionTokens?: number;
}

export interface ModelAvailability {
  regions: string[];
  status: 'available' | 'limited' | 'unavailable' | 'deprecated';
  deprecationDate?: string;
  maintenanceWindows?: MaintenanceWindow[];
}

export class ModelDiscovery {
  private modelCache: Map<string, ModelInfo> = new Map();
  private discoverySources: DiscoverySource[] = [];
  private cacheTimeout: number = 3600000; // 1小时
  
  constructor() {
    this.initializeDiscoverySources();
  }
  
  /**
   * 初始化发现源
   */
  private initializeDiscoverySources(): void {
    this.discoverySources = [
      {
        name: 'official-providers',
        type: 'api',
        url: 'https://api.route-claudecode.com/v1/models',
        enabled: true
      },
      {
        name: 'community-registry',
        type: 'api',
        url: 'https://registry.route-claudecode.com/models',
        enabled: true
      },
      {
        name: 'local-config',
        type: 'file',
        path: path.join(os.homedir(), '.route-claudecode', 'models.json'),
        enabled: true
      },
      {
        name: 'builtin-models',
        type: 'builtin',
        enabled: true
      }
    ];
  }
  
  /**
   * 发现所有模型
   */
  async discoverAllModels(): Promise<ModelInfo[]> {
    try {
      console.log('🔍 Discovering all available models...');
      
      const allModels: ModelInfo[] = [];
      
      // 从所有启用的源获取模型
      for (const source of this.discoverySources.filter(s => s.enabled)) {
        try {
          const models = await this.discoverFromSource(source);
          allModels.push(...models);
        } catch (error) {
          console.warn(`⚠️ Failed to discover models from ${source.name}:`, error.message);
        }
      }
      
      // 去重和排序
      const uniqueModels = this.dedupeModels(allModels);
      const sortedModels = this.sortModels(uniqueModels);
      
      console.log(`✅ Discovered ${sortedModels.length} unique models`);
      
      return sortedModels;
      
    } catch (error) {
      console.error('❌ Failed to discover models:', error.message);
      return [];
    }
  }
  
  /**
   * 从源发现模型
   */
  private async discoverFromSource(source: DiscoverySource): Promise<ModelInfo[]> {
    switch (source.type) {
      case 'api':
        return await this.discoverFromAPI(source);
      case 'file':
        return await this.discoverFromFile(source);
      case 'builtin':
        return await this.discoverBuiltInModels();
      default:
        throw new Error(`Unsupported discovery source type: ${source.type}`);
    }
  }
  
  /**
   * 从API发现模型
   */
  private async discoverFromAPI(source: DiscoverySource): Promise<ModelInfo[]> {
    try {
      console.log(`📡 Fetching models from ${source.name}...`);
      
      const response = await fetch(source.url!, {
        headers: {
          'User-Agent': 'RCC-Model-Discovery/1.0',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const models = Array.isArray(data) ? data : data.models || [];
      
      console.log(`✅ Fetched ${models.length} models from ${source.name}`);
      
      return models.map((model: any) => this.normalizeModelInfo(model, source.name));
      
    } catch (error) {
      console.warn(`⚠️ Failed to fetch models from ${source.name}:`, error.message);
      return [];
    }
  }
  
  /**
   * 从文件发现模型
   */
  private async discoverFromFile(source: DiscoverySource): Promise<ModelInfo[]> {
    try {
      if (!fs.existsSync(source.path!)) {
        return [];
      }
      
      console.log(`📁 Reading models from ${source.path}...`);
      
      const fileContent = await fs.promises.readFile(source.path!, 'utf-8');
      const data = JSON.parse(fileContent);
      const models = Array.isArray(data) ? data : data.models || [];
      
      console.log(`✅ Read ${models.length} models from ${source.path}`);
      
      return models.map((model: any) => this.normalizeModelInfo(model, source.name));
      
    } catch (error) {
      console.warn(`⚠️ Failed to read models from ${source.path}:`, error.message);
      return [];
    }
  }
  
  /**
   * 发现内置模型
   */
  private async discoverBuiltInModels(): Promise<ModelInfo[]> {
    const builtinModels: ModelInfo[] = [
      // OpenAI模型
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        description: 'OpenAI\'s most capable model, optimized for complex tasks',
        capabilities: {
          maxTokens: 128000,
          supportsStreaming: true,
          supportsFunctions: true,
          supportsVision: true,
          supportsEmbeddings: true,
          supportsAudio: false,
          supportsVideo: false,
          supportsFiles: true,
          supportsTools: true
        },
        limits: {
          maxInputTokens: 128000,
          maxOutputTokens: 16384,
          maxTotalTokens: 128000,
          requestsPerMinute: 10000,
          tokensPerMinute: 150000,
          tokensPerDay: 10000000
        },
        pricing: {
          inputCostPerMillionTokens: 30.00,
          outputCostPerMillionTokens: 60.00
        },
        availability: {
          regions: ['global'],
          status: 'available'
        },
        metadata: {
          family: 'gpt-4',
          releaseDate: '2023-03-14',
          architecture: 'transformer',
          trainingDataCutoff: '2023-04'
        }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        description: 'Fast, inexpensive model for simple tasks',
        capabilities: {
          maxTokens: 16385,
          supportsStreaming: true,
          supportsFunctions: true,
          supportsVision: false,
          supportsEmbeddings: true,
          supportsAudio: false,
          supportsVideo: false,
          supportsFiles: true,
          supportsTools: true
        },
        limits: {
          maxInputTokens: 16385,
          maxOutputTokens: 4096,
          maxTotalTokens: 16385,
          requestsPerMinute: 3500,
          tokensPerMinute: 90000,
          tokensPerDay: 10000000
        },
        pricing: {
          inputCostPerMillionTokens: 0.50,
          outputCostPerMillionTokens: 1.50
        },
        availability: {
          regions: ['global'],
          status: 'available'
        },
        metadata: {
          family: 'gpt-3.5',
          releaseDate: '2023-01-10',
          architecture: 'transformer',
          trainingDataCutoff: '2021-09'
        }
      },
      // Anthropic模型
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        description: 'Most intelligent model, with strong agentic and reasoning capabilities',
        capabilities: {
          maxTokens: 200000,
          supportsStreaming: true,
          supportsFunctions: true,
          supportsVision: true,
          supportsEmbeddings: false,
          supportsAudio: false,
          supportsVideo: false,
          supportsFiles: true,
          supportsTools: true
        },
        limits: {
          maxInputTokens: 200000,
          maxOutputTokens: 8192,
          maxTotalTokens: 200000,
          requestsPerMinute: 1000,
          tokensPerMinute: 80000,
          tokensPerDay: 5000000
        },
        pricing: {
          inputCostPerMillionTokens: 3.00,
          outputCostPerMillionTokens: 15.00
        },
        availability: {
          regions: ['aws-us-east-1', 'aws-eu-central-1', 'aws-apac-1'],
          status: 'available'
        },
        metadata: {
          family: 'claude-3.5',
          releaseDate: '2024-10-22',
          architecture: 'transformer',
          trainingDataCutoff: '2024-04'
        }
      },
      // Google模型
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        description: 'Multimodal model with breakthrough long context understanding',
        capabilities: {
          maxTokens: 1048576,
          supportsStreaming: true,
          supportsFunctions: true,
          supportsVision: true,
          supportsEmbeddings: true,
          supportsAudio: true,
          supportsVideo: true,
          supportsFiles: true,
          supportsTools: true
        },
        limits: {
          maxInputTokens: 1048576,
          maxOutputTokens: 8192,
          maxTotalTokens: 1048576,
          requestsPerMinute: 2,
          tokensPerMinute: 32000,
          tokensPerDay: 50000
        },
        pricing: {
          inputCostPerMillionTokens: 7.00,
          outputCostPerMillionTokens: 21.00
        },
        availability: {
          regions: ['us-central1', 'asia-east1', 'europe-west4'],
          status: 'available'
        },
        metadata: {
          family: 'gemini-1.5',
          releaseDate: '2024-02-15',
          architecture: 'transformer',
          trainingDataCutoff: '2024-03'
        }
      }
    ];
    
    console.log(`📦 Loaded ${builtinModels.length} built-in models`);
    
    return builtinModels;
  }
  
  /**
   * 标准化模型信息
   */
  private normalizeModelInfo(rawModel: any, source: string): ModelInfo {
    return {
      id: rawModel.id || rawModel.name,
      name: rawModel.name || rawModel.id,
      provider: rawModel.provider || 'unknown',
      description: rawModel.description || '',
      capabilities: {
        maxTokens: rawModel.capabilities?.maxTokens || rawModel.maxTokens || 4096,
        supportsStreaming: rawModel.capabilities?.supportsStreaming ?? false,
        supportsFunctions: rawModel.capabilities?.supportsFunctions ?? false,
        supportsVision: rawModel.capabilities?.supportsVision ?? false,
        supportsEmbeddings: rawModel.capabilities?.supportsEmbeddings ?? false,
        supportsAudio: rawModel.capabilities?.supportsAudio ?? false,
        supportsVideo: rawModel.capabilities?.supportsVideo ?? false,
        supportsFiles: rawModel.capabilities?.supportsFiles ?? false,
        supportsTools: rawModel.capabilities?.supportsTools ?? false
      },
      limits: {
        maxInputTokens: rawModel.limits?.maxInputTokens || rawModel.maxTokens || 4096,
        maxOutputTokens: rawModel.limits?.maxOutputTokens || 4096,
        maxTotalTokens: rawModel.limits?.maxTotalTokens || rawModel.maxTokens || 4096,
        requestsPerMinute: rawModel.limits?.requestsPerMinute || 60,
        tokensPerMinute: rawModel.limits?.tokensPerMinute || 60000,
        tokensPerDay: rawModel.limits?.tokensPerDay || 1000000
      },
      pricing: {
        inputCostPerMillionTokens: rawModel.pricing?.inputCostPerMillionTokens || 0,
        outputCostPerMillionTokens: rawModel.pricing?.outputCostPerMillionTokens || 0,
        cacheHitCostPerMillionTokens: rawModel.pricing?.cacheHitCostPerMillionTokens,
        trainingCostPerMillionTokens: rawModel.pricing?.trainingCostPerMillionTokens
      },
      availability: {
        regions: rawModel.availability?.regions || ['global'],
        status: rawModel.availability?.status || 'available',
        deprecationDate: rawModel.availability?.deprecationDate,
        maintenanceWindows: rawModel.availability?.maintenanceWindows
      },
      metadata: {
        ...rawModel.metadata,
        source,
        discoveredAt: new Date().toISOString()
      }
    };
  }
  
  /**
   * 去重模型
   */
  private dedupeModels(models: ModelInfo[]): ModelInfo[] {
    const seen = new Map<string, ModelInfo>();
    
    for (const model of models) {
      const key = `${model.provider}:${model.id}`;
      
      if (!seen.has(key) || this.isBetterModel(seen.get(key)!, model)) {
        seen.set(key, model);
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * 判断是否是更好的模型
   */
  private isBetterModel(existing: ModelInfo, candidate: ModelInfo): boolean {
    // 优先选择来自官方源的模型
    const officialSources = ['official-providers', 'builtin'];
    const existingIsOfficial = officialSources.includes(existing.metadata?.source || '');
    const candidateIsOfficial = officialSources.includes(candidate.metadata?.source || '');
    
    if (candidateIsOfficial && !existingIsOfficial) {
      return true;
    }
    
    if (!candidateIsOfficial && existingIsOfficial) {
      return false;
    }
    
    // 比较版本（如果有的话）
    if (existing.metadata?.version && candidate.metadata?.version) {
      return semver.gt(candidate.metadata.version, existing.metadata.version);
    }
    
    // 默认情况下，保留第一个遇到的
    return false;
  }
  
  /**
   * 排序模型
   */
  private sortModels(models: ModelInfo[]): ModelInfo[] {
    return models.sort((a, b) => {
      // 首先按提供商排序
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      
      // 然后按模型名称排序
      return a.name.localeCompare(b.name);
    });
  }
  
  /**
   * 发现特定提供商的模型
   */
  async discoverModelsByProvider(provider: string): Promise<ModelInfo[]> {
    try {
      console.log(`🔍 Discovering models for provider: ${provider}`);
      
      const allModels = await this.discoverAllModels();
      const providerModels = allModels.filter(model => model.provider === provider);
      
      console.log(`✅ Found ${providerModels.length} models for provider ${provider}`);
      
      return providerModels;
      
    } catch (error) {
      console.error(`❌ Failed to discover models for provider ${provider}:`, error.message);
      return [];
    }
  }
  
  /**
   * 获取模型信息
   */
  getModel(id: string): ModelInfo | undefined {
    return this.modelCache.get(id);
  }
  
  /**
   * 缓存模型信息
   */
  cacheModel(model: ModelInfo): void {
    this.modelCache.set(model.id, {
      ...model,
      cachedAt: Date.now()
    });
  }
  
  /**
   * 清理缓存
   */
  clearCache(): void {
    this.modelCache.clear();
    console.log('🧹 Model discovery cache cleared');
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats(): CacheStats {
    return {
      cachedModels: this.modelCache.size,
      cacheHits: 0, // 需要实现缓存命中统计
      cacheMisses: 0, // 需要实现缓存未命中统计
      lastCacheClear: new Date() // 需要记录上次清理时间
    };
  }
}
```

## Token限制器

### Token限制测试器
```typescript
// token-limiter.ts
export interface TokenTestConfig {
  model: string;
  provider: string;
  testCases: TokenTestCase[];
  maxRetries: number;
  timeout: number;
  concurrency: number;
  validateResults: boolean;
}

export interface TokenTestCase {
  name: string;
  description: string;
  inputTokens: number;
  outputTokens?: number;
  expectedBehavior: 'success' | 'failure' | 'partial';
  inputContent?: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export interface TokenTestResult {
  testCase: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens?: number;
  actualInputTokens?: number;
  actualOutputTokens?: number;
  success: boolean;
  errorMessage?: string;
  duration: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface TokenLimitReport {
  model: string;
  provider: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  testedAt: Date;
  testResults: TokenTestResult[];
  recommendations: string[];
  confidence: number; // 0-1
}

export class TokenLimiter {
  private testResults: Map<string, TokenTestResult[]> = new Map();
  private providers: Map<string, ProviderClient> = new Map();
  
  /**
   * 运行Token限制测试
   */
  async runTokenLimitTests(config: TokenTestConfig): Promise<TokenLimitReport> {
    try {
      console.log(`🧪 Running token limit tests for ${config.model} (${config.provider})...`);
      
      // 验证配置
      this.validateTestConfig(config);
      
      // 获取Provider客户端
      const providerClient = await this.getProviderClient(config.provider);
      
      // 并发运行测试
      const results = await this.runConcurrentTests(providerClient, config);
      
      // 分析结果
      const report = this.analyzeTestResults(config, results);
      
      // 缓存结果
      this.cacheTestResults(config.model, results);
      
      console.log(`✅ Token limit tests completed for ${config.model}`);
      
      return report;
      
    } catch (error) {
      console.error(`❌ Token limit tests failed for ${config.model}:`, error.message);
      throw error;
    }
  }
  
  /**
   * 验证测试配置
   */
  private validateTestConfig(config: TokenTestConfig): void {
    if (!config.model) {
      throw new Error('Model is required');
    }
    
    if (!config.provider) {
      throw new Error('Provider is required');
    }
    
    if (!config.testCases || config.testCases.length === 0) {
      throw new Error('Test cases are required');
    }
    
    if (config.maxRetries < 0) {
      throw new Error('Max retries must be non-negative');
    }
    
    if (config.timeout <= 0) {
      throw new Error('Timeout must be positive');
    }
    
    if (config.concurrency <= 0) {
      throw new Error('Concurrency must be positive');
    }
  }
  
  /**
   * 获取Provider客户端
   */
  private async getProviderClient(provider: string): Promise<ProviderClient> {
    if (this.providers.has(provider)) {
      return this.providers.get(provider)!;
    }
    
    // 这里应该创建一个新的Provider客户端
    // 实际实现应该从Provider管理器获取或创建客户端
    const providerClient = await this.createProviderClient(provider);
    this.providers.set(provider, providerClient);
    
    return providerClient;
  }
  
  /**
   * 创建Provider客户端
   */
  private async createProviderClient(provider: string): Promise<ProviderClient> {
    // 这是一个占位实现，实际应该使用Provider管理器
    console.log(`🔧 Creating client for provider: ${provider}`);
    
    return {
      name: provider,
      sendMessage: async (request: any) => {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 根据输入内容生成适当长度的输出
        const inputLength = request.messages?.reduce((len: number, msg: any) => 
          len + (typeof msg.content === 'string' ? msg.content.length : 0), 0) || 0;
        
        return {
          id: `msg_${Date.now()}`,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a simulated response with appropriate length based on input.'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: Math.ceil(inputLength / 4), // 估算token数
            completion_tokens: Math.ceil((inputLength / 4) * 0.5), // 输出通常是输入的一半
            total_tokens: Math.ceil(inputLength / 4) * 1.5
          }
        };
      },
      getModels: async () => {
        return [{
          id: 'test-model',
          name: 'Test Model',
          maxTokens: 4096,
          supportsFunctions: true,
          supportsStreaming: true
        }];
      }
    };
  }
  
  /**
   * 并发运行测试
   */
  private async runConcurrentTests(providerClient: ProviderClient, config: TokenTestConfig): Promise<TokenTestResult[]> {
    const results: TokenTestResult[] = [];
    
    // 创建测试批次
    const batches = this.createTestBatches(config.testCases, config.concurrency);
    
    console.log(`🔄 Running ${config.testCases.length} tests in ${batches.length} batches...`);
    
    // 按批次运行测试
    for (let i = 0; i < batches.length; i++) {
      console.log(`📦 Running batch ${i + 1}/${batches.length}...`);
      
      const batchResults = await Promise.all(
        batches[i].map(testCase => this.runSingleTest(providerClient, config, testCase))
      );
      
      results.push(...batchResults);
      
      // 批次间短暂休息
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }
  
  /**
   * 创建测试批次
   */
  private createTestBatches(testCases: TokenTestCase[], batchSize: number): TokenTestCase[][] {
    const batches: TokenTestCase[][] = [];
    
    for (let i = 0; i < testCases.length; i += batchSize) {
      batches.push(testCases.slice(i, i + batchSize));
    }
    
    return batches;
  }
  
  /**
   * 运行单个测试
   */
  private async runSingleTest(providerClient: ProviderClient, config: TokenTestConfig, testCase: TokenTestCase): Promise<TokenTestResult> {
    const startTime = Date.now();
    let retries = 0;
    
    while (retries <= config.maxRetries) {
      try {
        const request = this.createTestRequest(config, testCase);
        
        // 设置超时
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Test timeout')), config.timeout);
        });
        
        // 执行测试
        const responsePromise = providerClient.sendMessage(request);
        const response = await Promise.race([responsePromise, timeoutPromise]);
        
        const duration = Date.now() - startTime;
        const actualInputTokens = response.usage?.prompt_tokens || 0;
        const actualOutputTokens = response.usage?.completion_tokens || 0;
        
        const result: TokenTestResult = {
          testCase: testCase.name,
          model: config.model,
          provider: config.provider,
          inputTokens: testCase.inputTokens,
          outputTokens: testCase.outputTokens,
          actualInputTokens,
          actualOutputTokens,
          success: true,
          duration,
          timestamp: new Date(),
          metadata: {
            inputContentPreview: testCase.inputContent?.substring(0, 100) + '...',
            systemPromptPreview: testCase.systemPrompt?.substring(0, 100) + '...'
          }
        };
        
        return result;
        
      } catch (error) {
        retries++;
        
        if (retries > config.maxRetries) {
          const duration = Date.now() - startTime;
          
          const result: TokenTestResult = {
            testCase: testCase.name,
            model: config.model,
            provider: config.provider,
            inputTokens: testCase.inputTokens,
            outputTokens: testCase.outputTokens,
            success: false,
            errorMessage: error.message,
            duration,
            timestamp: new Date(),
            metadata: {
              retries,
              lastError: error.message
            }
          };
          
          return result;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }
    
    throw new Error('Unexpected error in test execution');
  }
  
  /**
   * 创建测试请求
   */
  private createTestRequest(config: TokenTestConfig, testCase: TokenTestCase): any {
    const messages: any[] = [];
    
    // 添加系统提示（如果有的话）
    if (testCase.systemPrompt) {
      messages.push({
        role: 'system',
        content: testCase.systemPrompt
      });
    }
    
    // 生成适当的输入内容
    const inputContent = testCase.inputContent || this.generateInputContent(testCase.inputTokens);
    
    messages.push({
      role: 'user',
      content: inputContent
    });
    
    return {
      model: config.model,
      messages,
      temperature: testCase.temperature,
      top_p: testCase.topP,
      frequency_penalty: testCase.frequencyPenalty,
      presence_penalty: testCase.presencePenalty,
      stop: testCase.stopSequences,
      max_tokens: testCase.outputTokens
    };
  }
  
  /**
   * 生成输入内容
   */
  private generateInputContent(tokenCount: number): string {
    // 假设每个token大约是4个字符
    const charCount = tokenCount * 4;
    
    // 生成重复的内容直到达到目标字符数
    const baseText = 'This is a test input for token limit testing. ';
    const repeatCount = Math.ceil(charCount / baseText.length);
    
    return baseText.repeat(repeatCount).substring(0, charCount);
  }
  
  /**
   * 分析测试结果
   */
  private analyzeTestResults(config: TokenTestConfig, results: TokenTestResult[]): TokenLimitReport {
    console.log(`📊 Analyzing ${results.length} test results...`);
    
    // 计算成功和失败的测试
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    console.log(`✅ Successful tests: ${successfulTests.length}`);
    console.log(`❌ Failed tests: ${failedTests.length}`);
    
    // 分析Token限制
    const maxInputTokens = this.determineMaxInputTokens(successfulTests);
    const maxOutputTokens = this.determineMaxOutputTokens(successfulTests);
    const maxTotalTokens = this.determineMaxTotalTokens(successfulTests);
    
    // 生成建议
    const recommendations = this.generateRecommendations(config, results);
    
    // 计算置信度
    const confidence = this.calculateConfidence(results);
    
    const report: TokenLimitReport = {
      model: config.model,
      provider: config.provider,
      maxInputTokens,
      maxOutputTokens,
      maxTotalTokens,
      testedAt: new Date(),
      testResults: results,
      recommendations,
      confidence
    };
    
    return report;
  }
  
  /**
   * 确定最大输入Tokens
   */
  private determineMaxInputTokens(results: TokenTestResult[]): number {
    if (results.length === 0) {
      return 4096; // 默认值
    }
    
    // 找到成功的测试中的最大输入Tokens
    const successfulInputs = results
      .filter(r => r.success && r.actualInputTokens)
      .map(r => r.actualInputTokens!);
    
    if (successfulInputs.length === 0) {
      return 4096; // 默认值
    }
    
    // 返回最大值
    return Math.max(...successfulInputs);
  }
  
  /**
   * 确定最大输出Tokens
   */
  private determineMaxOutputTokens(results: TokenTestResult[]): number {
    if (results.length === 0) {
      return 4096; // 默认值
    }
    
    // 找到成功的测试中的最大输出Tokens
    const successfulOutputs = results
      .filter(r => r.success && r.actualOutputTokens)
      .map(r => r.actualOutputTokens!);
    
    if (successfulOutputs.length === 0) {
      return 4096; // 默认值
    }
    
    // 返回最大值
    return Math.max(...successfulOutputs);
  }
  
  /**
   * 确定最大总Tokens
   */
  private determineMaxTotalTokens(results: TokenTestResult[]): number {
    if (results.length === 0) {
      return 8192; // 默认值
    }
    
    // 计算成功的测试中的总Tokens
    const totalTokens = results
      .filter(r => r.success && r.actualInputTokens && r.actualOutputTokens)
      .map(r => (r.actualInputTokens! + r.actualOutputTokens!));
    
    if (totalTokens.length === 0) {
      return 8192; // 默认值
    }
    
    // 返回最大值
    return Math.max(...totalTokens);
  }
  
  /**
   * 生成建议
   */
  private generateRecommendations(config: TokenTestConfig, results: TokenTestResult[]): string[] {
    const recommendations: string[] = [];
    
    // 检查是否有失败的测试
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length > 0) {
      recommendations.push(
        `Found ${failedTests.length} failing tests. Consider adjusting token limits or investigating errors.`
      );
    }
    
    // 检查是否有超过4096的测试
    const largeTests = results.filter(r => r.inputTokens > 4096 || (r.outputTokens || 0) > 4096);
    if (largeTests.length > 0) {
      recommendations.push(
        'Some tests exceed 4096 tokens. Consider using models optimized for long contexts.'
      );
    }
    
    // 检查性能
    const slowTests = results.filter(r => r.success && r.duration > 5000); // 5秒以上
    if (slowTests.length > 0) {
      recommendations.push(
        `${slowTests.length} tests took longer than 5 seconds. Consider optimizing prompts or using faster models.`
      );
    }
    
    return recommendations;
  }
  
  /**
   * 计算置信度
   */
  private calculateConfidence(results: TokenTestResult[]): number {
    if (results.length === 0) {
      return 0;
    }
    
    const successRate = results.filter(r => r.success).length / results.length;
    const consistencyRate = this.calculateConsistency(results);
    
    // 综合置信度 = 成功率 * 一致性
    return successRate * consistencyRate;
  }
  
  /**
   * 计算一致性
   */
  private calculateConsistency(results: TokenTestResult[]): number {
    if (results.length < 2) {
      return 1; // 如果只有一个结果，认为是完全一致的
    }
    
    // 计算结果的时间方差
    const times = results.map(r => r.duration);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    
    // 如果标准差很大，说明不一致
    const consistency = 1 / (1 + stdDev / 1000); // 归一化到0-1范围
    
    return Math.max(0, Math.min(1, consistency));
  }
  
  /**
   * 缓存测试结果
   */
  private cacheTestResults(model: string, results: TokenTestResult[]): void {
    this.testResults.set(model, results);
    
    // 设置缓存清理
    setTimeout(() => {
      this.testResults.delete(model);
    }, 24 * 60 * 60 * 1000); // 24小时后清理
  }
  
  /**
   * 获取缓存的测试结果
   */
  getCachedResults(model: string): TokenTestResult[] | undefined {
    return this.testResults.get(model);
  }
  
  /**
   * 清理缓存
   */
  clearCache(): void {
    this.testResults.clear();
    console.log('🧹 Token limiter cache cleared');
  }
  
  /**
   * 生成测试报告
   */
  async generateTestReport(model: string, provider: string): Promise<string> {
    const results = this.testResults.get(`${provider}:${model}`) || 
                   this.testResults.get(model) ||
                   [];
    
    if (results.length === 0) {
      return 'No test results found for this model.';
    }
    
    const report: string[] = [];
    report.push(`# Token Limit Test Report for ${model} (${provider})`);
    report.push(`Generated at: ${new Date().toISOString()}`);
    report.push('');
    
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    report.push(`## Test Summary`);
    report.push(`Total Tests: ${results.length}`);
    report.push(`Successful: ${successfulTests.length}`);
    report.push(`Failed: ${failedTests.length}`);
    report.push(`Success Rate: ${(successfulTests.length / results.length * 100).toFixed(2)}%`);
    report.push('');
    
    report.push(`## Performance Metrics`);
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    report.push(`Average Duration: ${avgDuration.toFixed(2)}ms`);
    
    if (successfulTests.length > 0) {
      const avgInputTokens = successfulTests.reduce((sum, r) => sum + (r.actualInputTokens || 0), 0) / successfulTests.length;
      const avgOutputTokens = successfulTests.reduce((sum, r) => sum + (r.actualOutputTokens || 0), 0) / successfulTests.length;
      report.push(`Average Input Tokens: ${avgInputTokens.toFixed(2)}`);
      report.push(`Average Output Tokens: ${avgOutputTokens.toFixed(2)}`);
    }
    report.push('');
    
    if (failedTests.length > 0) {
      report.push(`## Failed Tests`);
      failedTests.forEach((result, index) => {
        report.push(`${index + 1}. ${result.testCase}: ${result.errorMessage}`);
      });
      report.push('');
    }
    
    return report.join('\n');
  }
}

// Provider客户端接口
interface ProviderClient {
  name: string;
  sendMessage(request: any): Promise<any>;
  getModels(): Promise<any[]>;
}
```

## 黑名单管理器

### 黑名单管理器
```typescript
// blacklist-manager.ts
export interface BlacklistEntry {
  id: string;
  type: 'model' | 'provider' | 'user' | 'ip';
  value: string;
  reason: string;
  createdAt: Date;
  expiresAt?: Date;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface BlacklistConfig {
  enabled: boolean;
  defaultExpireDays: number;
  notifyOnBlock: boolean;
  logBlocks: boolean;
  whitelist?: string[];
}

export class BlacklistManager {
  private blacklist: Map<string, BlacklistEntry> = new Map();
  private config: BlacklistConfig;
  private storage: BlacklistStorage;
  private notificationService: NotificationService;
  
  constructor(config: BlacklistConfig, storage: BlacklistStorage, notificationService: NotificationService) {
    this.config = config;
    this.storage = storage;
    this.notificationService = notificationService;
    
    // 加载现有黑名单
    this.loadBlacklist();
  }
  
  /**
   * 加载黑名单
   */
  private async loadBlacklist(): Promise<void> {
    try {
      const entries = await this.storage.loadBlacklist();
      entries.forEach(entry => {
        this.blacklist.set(this.generateEntryKey(entry), entry);
      });
      
      console.log(`✅ Loaded ${entries.length} blacklist entries`);
    } catch (error) {
      console.error('❌ Failed to load blacklist:', error.message);
    }
  }
  
  /**
   * 添加黑名单条目
   */
  async addToBlacklist(entry: Omit<BlacklistEntry, 'id' | 'createdAt' | 'createdBy'>, createdBy: string): Promise<void> {
    if (!this.config.enabled) {
      console.warn('⚠️ Blacklist is disabled');
      return;
    }
    
    const fullEntry: BlacklistEntry = {
      id: this.generateId(),
      type: entry.type,
      value: entry.value,
      reason: entry.reason,
      createdAt: new Date(),
      expiresAt: entry.expiresAt,
      createdBy
    };
    
    // 检查是否应该阻止添加
    if (!this.shouldAddToBlacklist(fullEntry)) {
      console.log(`ℹ️ Skipping blacklist entry for ${entry.type}:${entry.value} (whitelisted)`);
      return;
    }
    
    // 添加到内存映射
    this.blacklist.set(this.generateEntryKey(fullEntry), fullEntry);
    
    // 保存到持久化存储
    await this.storage.saveBlacklistEntry(fullEntry);
    
    console.log(`✅ Added ${entry.type}:${entry.value} to blacklist`);
    
    // 发送通知
    if (this.config.notifyOnBlock) {
      await this.notificationService.sendBlacklistNotification(fullEntry);
    }
  }
  
  /**
   * 从黑名单移除
   */
  async removeFromBlacklist(type: string, value: string): Promise<void> {
    const key = `${type}:${value}`;
    const entry = this.blacklist.get(key);
    
    if (entry) {
      this.blacklist.delete(key);
      await this.storage.removeBlacklistEntry(type, value);
      console.log(`✅ Removed ${type}:${value} from blacklist`);
    }
  }
  
  /**
   * 检查是否在黑名单中
   */
  isBlacklisted(type: string, value: string): boolean {
    const key = `${type}:${value}`;
    const entry = this.blacklist.get(key);
    
    // 检查是否过期
    if (entry && entry.expiresAt && entry.expiresAt < new Date()) {
      this.removeFromBlacklist(type, value).catch(console.error);
      return false;
    }
    
    return !!entry;
  }
  
  /**
   * 获取黑名单条目
   */
  getBlacklistEntry(type: string, value: string): BlacklistEntry | undefined {
    const key = `${type}:${value}`;
    const entry = this.blacklist.get(key);
    
    // 检查是否过期
    if (entry && entry.expiresAt && entry.expiresAt < new Date()) {
      this.removeFromBlacklist(type, value).catch(console.error);
      return undefined;
    }
    
    return entry;
  }
  
  /**
   * 获取所有黑名单条目
   */
  getAllBlacklisted(): BlacklistEntry[] {
    const now = new Date();
    const entries: BlacklistEntry[] = [];
    
    for (const [key, entry] of this.blacklist.entries()) {
      // 过滤过期条目
      if (!entry.expiresAt || entry.expiresAt > now) {
        entries.push(entry);
      }
    }
    
    return entries;
  }
  
  /**
   * 获取特定类型的黑名单
   */
  getBlacklistedByType(type: string): BlacklistEntry[] {
    return this.getAllBlacklisted().filter(entry => entry.type === type);
  }
  
  /**
   * 检查是否应该添加到黑名单
   */
  private shouldAddToBlacklist(entry: BlacklistEntry): boolean {
    // 检查白名单
    if (this.config.whitelist?.includes(entry.value)) {
      return false;
    }
    
    // 检查过期时间
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 生成条目键
   */
  private generateEntryKey(entry: BlacklistEntry): string {
    return `${entry.type}:${entry.value}`;
  }
  
  /**
   * 生成ID
   */
  private generateId(): string {
    return `bl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 清理过期条目
   */
  async cleanupExpiredEntries(): Promise<void> {
    const now = new Date();
    let removedCount = 0;
    
    for (const [key, entry] of this.blacklist.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.blacklist.delete(key);
        await this.storage.removeBlacklistEntry(entry.type, entry.value);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} expired blacklist entries`);
    }
  }
  
  /**
   * 刷新黑名单
   */
  async refreshBlacklist(): Promise<void> {
    this.blacklist.clear();
    await this.loadBlacklist();
    console.log('🔄 Blacklist refreshed');
  }
  
  /**
   * 导出黑名单
   */
  async exportBlacklist(format: 'json' | 'csv' = 'json'): Promise<string> {
    const entries = this.getAllBlacklisted();
    
    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    } else {
      const csvRows = [
        ['Type', 'Value', 'Reason', 'Created At', 'Expires At', 'Created By']
      ];
      
      entries.forEach(entry => {
        csvRows.push([
          entry.type,
          entry.value,
          entry.reason,
          entry.createdAt.toISOString(),
          entry.expiresAt?.toISOString() || '',
          entry.createdBy
        ]);
      });
      
      return csvRows.map(row => row.join(',')).join('\n');
    }
  }
  
  /**
   * 导入黑名单
   */
  async importBlacklist(data: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    let entries: BlacklistEntry[];
    
    if (format === 'json') {
      entries = JSON.parse(data);
    } else {
      const rows = data.split('\n').map(row => row.split(','));
      const headers = rows[0];
      entries = rows.slice(1).map(row => {
        const entry: any = {};
        headers.forEach((header, index) => {
          entry[header.toLowerCase().replace(' ', '_')] = row[index];
        });
        return entry;
      });
    }
    
    for (const entry of entries) {
      await this.addToBlacklist(entry, 'import');
    }
    
    console.log(`✅ Imported ${entries.length} blacklist entries`);
  }
}

// 黑名单存储接口
interface BlacklistStorage {
  loadBlacklist(): Promise<BlacklistEntry[]>;
  saveBlacklistEntry(entry: BlacklistEntry): Promise<void>;
  removeBlacklistEntry(type: string, value: string): Promise<void>;
  clearBlacklist(): Promise<void>;
}

// 通知服务接口
interface NotificationService {
  sendBlacklistNotification(entry: BlacklistEntry): Promise<void>;
  sendBlockNotification(entry: BlacklistEntry): Promise<void>;
  sendExpirationNotification(entry: BlacklistEntry): Promise<void>;
}
```

## 长上下文管理器

### 长上下文管理器
```typescript
// long-context-manager.ts
export interface LongContextModel {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  recommendedMaxTokens: number;
  costFactor: number; // 相对于基础模型的成本系数
  performanceImpact: number; // 对性能的影响程度（0-1）
  supportedFeatures: string[];
  availability: {
    regions: string[];
    status: 'available' | 'limited' | 'unavailable';
  };
  benchmarks?: ModelBenchmark[];
}

export interface ModelBenchmark {
  testType: 'context-length' | 'performance' | 'quality';
  inputTokens: number;
  outputTokens: number;
  processingTime: number; // 毫秒
  memoryUsage: number; // MB
  cost?: number; // 美元
  accuracy?: number; // 0-1
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ContextAnalysisResult {
  model: string;
  provider: string;
  requiredTokens: number;
  recommendedModel?: LongContextModel;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  costEstimate?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
}

export class LongContextManager {
  private longContextModels: Map<string, LongContextModel> = new Map();
  private modelCache: Map<string, LongContextModel[]> = new Map();
  private costCalculator: CostCalculator;
  private performanceBenchmarker: PerformanceBenchmarker;
  
  constructor(costCalculator: CostCalculator, performanceBenchmarker: PerformanceBenchmarker) {
    this.costCalculator = costCalculator;
    this.performanceBenchmarker = performanceBenchmarker;
    
    // 初始化长上下文模型列表
    this.initializeLongContextModels();
  }
  
  /**
   * 初始化长上下文模型列表
   */
  private initializeLongContextModels(): void {
    const models: LongContextModel[] = [
      // OpenAI
      {
        id: 'gpt-4-1106-preview',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        maxTokens: 128000,
        recommendedMaxTokens: 100000,
        costFactor: 2.0,
        performanceImpact: 0.3,
        supportedFeatures: ['streaming', 'functions', 'vision'],
        availability: {
          regions: ['global'],
          status: 'available'
        }
      },
      {
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo Preview',
        provider: 'openai',
        maxTokens: 128000,
        recommendedMaxTokens: 100000,
        costFactor: 2.0,
        performanceImpact: 0.3,
        supportedFeatures: ['streaming', 'functions', 'vision'],
        availability: {
          regions: ['global'],
          status: 'available'
        }
      },
      // Anthropic
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        maxTokens: 200000,
        recommendedMaxTokens: 150000,
        costFactor: 15.0,
        performanceImpact: 0.5,
        supportedFeatures: ['streaming', 'tools', 'vision'],
        availability: {
          regions: ['aws-us-east-1', 'aws-eu-central-1', 'aws-apac-1'],
          status: 'available'
        }
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        maxTokens: 200000,
        recommendedMaxTokens: 150000,
        costFactor: 3.0,
        performanceImpact: 0.2,
        supportedFeatures: ['streaming', 'tools', 'vision'],
        availability: {
          regions: ['aws-us-east-1', 'aws-eu-central-1', 'aws-apac-1'],
          status: 'available'
        }
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        maxTokens: 200000,
        recommendedMaxTokens: 150000,
        costFactor: 0.25,
        performanceImpact: 0.1,
        supportedFeatures: ['streaming', 'tools'],
        availability: {
          regions: ['aws-us-east-1', 'aws-eu-central-1', 'aws-apac-1'],
          status: 'available'
        }
      },
      // Google
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        maxTokens: 1048576,
        recommendedMaxTokens: 1000000,
        costFactor: 7.0,
        performanceImpact: 0.4,
        supportedFeatures: ['streaming', 'tools', 'vision', 'audio', 'video'],
        availability: {
          regions: ['us-central1', 'asia-east1', 'europe-west4'],
          status: 'available'
        }
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'google',
        maxTokens: 1048576,
        recommendedMaxTokens: 1000000,
        costFactor: 0.5,
        performanceImpact: 0.1,
        supportedFeatures: ['streaming', 'tools', 'vision', 'audio', 'video'],
        availability: {
          regions: ['us-central1', 'asia-east1', 'europe-west4'],
          status: 'available'
        }
      },
      // Claude 3.5 Sonnet (最新)
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        maxTokens: 200000,
        recommendedMaxTokens: 150000,
        costFactor: 3.0,
        performanceImpact: 0.25,
        supportedFeatures: ['streaming', 'tools', 'vision'],
        availability: {
          regions: ['aws-us-east-1', 'aws-eu-central-1', 'aws-apac-1'],
          status: 'available'
        }
      }
    ];
    
    // 添加到映射中
    models.forEach(model => {
      this.longContextModels.set(model.id, model);
    });
    
    console.log(`✅ Initialized ${models.length} long context models`);
  }
  
  /**
   * 分析上下文需求
   */
  async analyzeContextRequirements(content: string, options?: {
    provider?: string;
    features?: string[];
    maxCost?: number;
    maxLatency?: number;
  }): Promise<ContextAnalysisResult> {
    try {
      console.log('🔍 Analyzing context requirements...');
      
      // 计算所需的token数
      const requiredTokens = this.estimateTokens(content);
      
      console.log(`📝 Estimated ${requiredTokens} tokens required`);
      
      // 查找合适的模型
      const suitableModels = this.findSuitableModels(requiredTokens, options);
      
      // 选择推荐模型
      const recommendedModel = this.selectRecommendedModel(suitableModels, options);
      
      // 评估风险等级
      const riskLevel = this.assessRiskLevel(requiredTokens, recommendedModel);
      
      // 生成建议
      const recommendations = this.generateRecommendations(requiredTokens, recommendedModel, riskLevel);
      
      // 计算成本估算
      const costEstimate = recommendedModel ? 
        this.costCalculator.estimateCost(recommendedModel, requiredTokens) : undefined;
      
      const result: ContextAnalysisResult = {
        model: recommendedModel?.id || 'unknown',
        provider: recommendedModel?.provider || 'unknown',
        requiredTokens,
        recommendedModel,
        riskLevel,
        recommendations,
        costEstimate
      };
      
      console.log(`✅ Context analysis completed: ${riskLevel} risk, ${recommendedModel?.name || 'no model'} recommended`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Context analysis failed:', error.message);
      throw error;
    }
  }
  
  /**
   * 估算token数
   */
  private estimateTokens(content: string): number {
    // 这是一个简化的估算，实际应该使用更精确的方法
    // 如使用tiktoken或其他tokenizer
    const words = content.split(/\s+/).length;
    const chars = content.length;
    
    // 平均每个token大约是4个字符
    return Math.ceil(chars / 4);
  }
  
  /**
   * 查找合适的模型
   */
  private findSuitableModels(requiredTokens: number, options?: {
    provider?: string;
    features?: string[];
    maxCost?: number;
    maxLatency?: number;
  }): LongContextModel[] {
    let models = Array.from(this.longContextModels.values());
    
    // 按提供商过滤
    if (options?.provider) {
      models = models.filter(model => model.provider === options.provider);
    }
    
    // 按功能过滤
    if (options?.features && options.features.length > 0) {
      models = models.filter(model => 
        options.features!.every(feature => model.supportedFeatures.includes(feature))
      );
    }
    
    // 按token容量过滤
    models = models.filter(model => model.maxTokens >= requiredTokens);
    
    // 按最大成本过滤（如果指定了）
    if (options?.maxCost) {
      models = models.filter(model => 
        this.costCalculator.estimateCost(model, requiredTokens)?.totalCost! <= options.maxCost!
      );
    }
    
    return models;
  }
  
  /**
   * 选择推荐模型
   */
  private selectRecommendedModel(models: LongContextModel[], options?: {
    maxCost?: number;
    maxLatency?: number;
  }): LongContextModel | undefined {
    if (models.length === 0) {
      return undefined;
    }
    
    // 按优先级排序：
    // 1. 可用性
    // 2. 成本效益
    // 3. 性能影响
    // 4. 特性支持
    
    const sortedModels = [...models].sort((a, b) => {
      // 优先选择可用的模型
      if (a.availability.status !== b.availability.status) {
        const statusPriority: Record<string, number> = {
          'available': 3,
          'limited': 2,
          'unavailable': 1
        };
        return statusPriority[b.availability.status] - statusPriority[a.availability.status];
      }
      
      // 比较成本效益（单位token成本）
      const aCostPerToken = a.costFactor / a.maxTokens;
      const bCostPerToken = b.costFactor / b.maxTokens;
      if (aCostPerToken !== bCostPerToken) {
        return aCostPerToken - bCostPerToken;
      }
      
      // 比较性能影响
      if (a.performanceImpact !== b.performanceImpact) {
        return a.performanceImpact - b.performanceImpact;
      }
      
      // 比较最大token数
      return b.maxTokens - a.maxTokens;
    });
    
    return sortedModels[0];
  }
  
  /**
   * 评估风险等级
   */
  private assessRiskLevel(requiredTokens: number, model?: LongContextModel): 'low' | 'medium' | 'high' | 'critical' {
    if (!model) {
      return 'critical';
    }
    
    // 计算使用比例
    const usageRatio = requiredTokens / model.recommendedMaxTokens;
    
    if (usageRatio < 0.5) {
      return 'low';
    } else if (usageRatio < 0.8) {
      return 'medium';
    } else if (usageRatio < 0.95) {
      return 'high';
    } else {
      return 'critical';
    }
  }
  
  /**
   * 生成建议
   */
  private generateRecommendations(
    requiredTokens: number,
    model: LongContextModel | undefined,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const recommendations: string[] = [];
    
    if (!model) {
      recommendations.push('No suitable long context model found. Consider using a standard model or breaking down the context.');
      return recommendations;
    }
    
    // 根据风险等级提供不同建议
    switch (riskLevel) {
      case 'low':
        recommendations.push(`✅ Using ${model.name} (${model.provider}) - well within token limits.`);
        recommendations.push(`💡 Cost factor: ${model.costFactor}x (relative to base model)`);
        break;
      case 'medium':
        recommendations.push(`⚠️ Using ${model.name} (${model.provider}) - approaching token limits.`);
        recommendations.push(`💡 Consider optimizing context to reduce token usage.`);
        if (model.performanceImpact > 0.2) {
          recommendations.push(`🚨 High performance impact (${(model.performanceImpact * 100).toFixed(0)}%) expected.`);
        }
        break;
      case 'high':
        recommendations.push(`⚠️ Using ${model.name} (${model.provider}) - near token limits.`);
        recommendations.push(`🚨 High risk of hitting token limits. Consider reducing context or using a higher-capacity model.`);
        if (model.costFactor > 5) {
          recommendations.push(`💰 High cost factor (${model.costFactor}x) - consider cost implications.`);
        }
        break;
      case 'critical':
        recommendations.push(`🚨 Critical: Using ${model.name} (${model.provider}) - at or exceeding recommended token limits.`);
        recommendations.push(`🔥 Immediate attention required to prevent failures.`);
        break;
    }
    
    // 通用建议
    recommendations.push(`📊 Required tokens: ${requiredTokens}`);
    recommendations.push(`📏 Recommended max tokens: ${model.recommendedMaxTokens}`);
    recommendations.push(`📈 Max tokens: ${model.maxTokens}`);
    recommendations.push(`🌍 Available in ${model.availability.regions.length} regions`);
    
    return recommendations;
  }
  
  /**
   * 获取特定提供商的长上下文模型
   */
  getLongContextModelsByProvider(provider: string): LongContextModel[] {
    return Array.from(this.longContextModels.values())
      .filter(model => model.provider === provider);
  }
  
  /**
   * 获取所有长上下文模型
   */
  getAllLongContextModels(): LongContextModel[] {
    return Array.from(this.longContextModels.values());
  }
  
  /**
   * 获取适合的模型
   */
  getSuitableModels(tokenCount: number, filters?: {
    provider?: string;
    features?: string[];
  }): LongContextModel[] {
    return Array.from(this.longContextModels.values())
      .filter(model => {
        // Token容量检查
        if (model.maxTokens < tokenCount) {
          return false;
        }
        
        // 提供商过滤
        if (filters?.provider && model.provider !== filters.provider) {
          return false;
        }
        
        // 功能过滤
        if (filters?.features) {
          return filters.features.every(feature => model.supportedFeatures.includes(feature));
        }
        
        return true;
      })
      .sort((a, b) => {
        // 按最大token数排序
        return b.maxTokens - a.maxTokens;
      });
  }
  
  /**
   * 添加自定义长上下文模型
   */
  addCustomModel(model: LongContextModel): void {
    this.longContextModels.set(model.id, model);
    console.log(`✅ Added custom model: ${model.name}`);
  }
  
  /**
   * 移除自定义模型
   */
  removeCustomModel(modelId: string): void {
    const model = this.longContextModels.get(modelId);
    if (model) {
      this.longContextModels.delete(modelId);
      console.log(`✅ Removed custom model: ${model.name}`);
    }
  }
  
  /**
   * 刷新模型列表
   */
  async refreshModels(): Promise<void> {
    console.log('🔄 Refreshing long context models...');
    
    // 这里应该重新获取最新的模型信息
    // 实际实现应该调用API或读取配置文件
    
    console.log('✅ Long context models refreshed');
  }
  
  /**
   * 获取模型基准测试
   */
  async getModelBenchmarks(modelId: string): Promise<ModelBenchmark[]> {
    const model = this.longContextModels.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    // 如果已经有基准测试数据，返回缓存的数据
    if (model.benchmarks && model.benchmarks.length > 0) {
      return model.benchmarks;
    }
    
    // 否则运行基准测试
    const benchmarks = await this.performanceBenchmarker.runBenchmarks(model);
    
    // 更新模型的基准测试数据
    model.benchmarks = benchmarks;
    
    return benchmarks;
  }
  
  /**
   * 生成性能报告
   */
  async generatePerformanceReport(modelId: string): Promise<string> {
    const benchmarks = await this.getModelBenchmarks(modelId);
    
    if (benchmarks.length === 0) {
      return 'No benchmark data available for this model.';
    }
    
    const report: string[] = [];
    report.push(`# Performance Report for ${modelId}`);
    report.push(`Generated at: ${new Date().toISOString()}`);
    report.push('');
    
    // 按测试类型分组
    const groupedBenchmarks = new Map<string, ModelBenchmark[]>();
    benchmarks.forEach(benchmark => {
      const type = benchmark.testType;
      if (!groupedBenchmarks.has(type)) {
        groupedBenchmarks.set(type, []);
      }
      groupedBenchmarks.get(type)!.push(benchmark);
    });
    
    // 生成每种测试类型的报告
    groupedBenchmarks.forEach((benchmarks, type) => {
      report.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)} Tests`);
      report.push('| Input Tokens | Output Tokens | Time (ms) | Memory (MB) | Cost ($) | Accuracy |');
      report.push('|--------------|---------------|-----------|-------------|----------|----------|');
      
      benchmarks.forEach(benchmark => {
        report.push(`| ${benchmark.inputTokens} | ${benchmark.outputTokens} | ${benchmark.processingTime} | ${benchmark.memoryUsage} | ${benchmark.cost?.toFixed(2) || 'N/A'} | ${benchmark.accuracy?.toFixed(2) || 'N/A'} |`);
      });
      report.push('');
    });
    
    return report.join('\n');
  }
}

// 成本计算器接口
interface CostCalculator {
  estimateCost(model: LongContextModel, tokens: number): {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
}

// 性能基准测试器接口
interface PerformanceBenchmarker {
  runBenchmarks(model: LongContextModel): Promise<ModelBenchmark[]>;
}
```

## 接口定义

```typescript
interface CLIExtensionsModuleInterface {
  initialize(): Promise<void>;
  getProviderUpdater(): ProviderUpdater;
  getModelDiscoverer(): ModelDiscovery;
  getTokenLimiter(): TokenLimiter;
  getBlacklistManager(): BlacklistManager;
  getLongContextManager(): LongContextManager;
  updateAllProviders(options?: ProviderUpdateOptions): Promise<ProviderUpdateResult[]>;
  discoverAllModels(): Promise<ModelInfo[]>;
  runTokenLimitTests(config: TokenTestConfig): Promise<TokenLimitReport>;
  addToBlacklist(entry: Omit<BlacklistEntry, 'id' | 'createdAt' | 'createdBy'>, createdBy: string): Promise<void>;
  analyzeContextRequirements(content: string, options?: ContextAnalysisOptions): Promise<ContextAnalysisResult>;
}

interface ProviderUpdaterInterface {
  updateAllProviders(options?: ProviderUpdateOptions): Promise<ProviderUpdateResult[]>;
  updateProvider(provider: ProviderInfo, options?: ProviderUpdateOptions): Promise<ProviderUpdateResult>;
  installProvider(provider: ProviderInfo, options?: { force?: boolean }): Promise<void>;
  uninstallProvider(providerName: string): Promise<void>;
  getUpdateStatus(): ProviderUpdateStatus;
}

interface ModelDiscoveryInterface {
  discoverAllModels(): Promise<ModelInfo[]>;
  discoverModelsByProvider(provider: string): Promise<ModelInfo[]>;
  getModel(modelId: string): ModelInfo | undefined;
  cacheModel(model: ModelInfo): void;
  clearCache(): void;
  getCacheStats(): CacheStats;
}

interface TokenLimiterInterface {
  runTokenLimitTests(config: TokenTestConfig): Promise<TokenLimitReport>;
  getCachedResults(model: string): TokenTestResult[] | undefined;
  clearCache(): void;
  generateTestReport(model: string, provider: string): Promise<string>;
}

interface BlacklistManagerInterface {
  addToBlacklist(entry: Omit<BlacklistEntry, 'id' | 'createdAt' | 'createdBy'>, createdBy: string): Promise<void>;
  removeFromBlacklist(type: string, value: string): Promise<void>;
  isBlacklisted(type: string, value: string): boolean;
  getBlacklistEntry(type: string, value: string): BlacklistEntry | undefined;
  getAllBlacklisted(): BlacklistEntry[];
  getBlacklistedByType(type: string): BlacklistEntry[];
  cleanupExpiredEntries(): Promise<void>;
  refreshBlacklist(): Promise<void>;
  exportBlacklist(format: 'json' | 'csv'): Promise<string>;
  importBlacklist(data: string, format: 'json' | 'csv'): Promise<void>;
}

interface LongContextManagerInterface {
  analyzeContextRequirements(content: string, options?: ContextAnalysisOptions): Promise<ContextAnalysisResult>;
  getLongContextModelsByProvider(provider: string): LongContextModel[];
  getAllLongContextModels(): LongContextModel[];
  getSuitableModels(tokenCount: number, filters?: ModelFilters): LongContextModel[];
  addCustomModel(model: LongContextModel): void;
  removeCustomModel(modelId: string): void;
  refreshModels(): Promise<void>;
  getModelBenchmarks(modelId: string): Promise<ModelBenchmark[]>;
  generatePerformanceReport(modelId: string): Promise<string>;
}
```

## 依赖关系

- 依赖配置模块获取扩展配置
- 依赖Provider模块获取Provider客户端
- 依赖日志模块记录扩展活动
- 被CLI模块调用以提供扩展功能

## 设计原则

1. **模块化**: 每个扩展功能都是独立的模块
2. **可扩展性**: 支持自定义扩展和插件
3. **自动化**: 提供自动化的管理功能
4. **用户友好**: 提供清晰的CLI命令和反馈
5. **可靠性**: 完善的错误处理和恢复机制
6. **性能优化**: 优化扩展功能的性能
7. **安全性**: 安全的扩展管理和执行
8. **可配置性**: 支持灵活的配置选项
9. **可观测性**: 提供详细的日志和监控
10. **兼容性**: 兼容不同操作系统和环境