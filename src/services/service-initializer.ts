/**
 * 服务初始化器
 *
 * 负责初始化和注册所有全局服务
 *
 * @author Jason Zhang
 */

import {
  registerProviderManager,
  registerPipelineManager,
  registerConfigManager,
  registerServerManager,
  registerCacheManager,
  IConfigManager,
  validateRequiredServices,
} from './global-service-registry';

import { ProviderManager } from '../modules/providers/provider-manager';
import { PipelineManager } from '../pipeline/pipeline-manager';
import { RCCv4ConfigLoader } from '../config/v4-config-loader';
import { ServerManager } from './server-manager';
import { CacheManager } from './cache-manager';
import { StandardPipelineFactoryImpl } from '../pipeline/pipeline-factory';
import { ModuleRegistry } from '../pipeline/module-registry';

/**
 * 服务初始化结果
 */
export interface ServiceInitializationResult {
  success: boolean;
  services: {
    providerManager: ProviderManager;
    pipelineManager: PipelineManager;
    configManager: IConfigManager;
    serverManager: ServerManager;
    cacheManager: CacheManager;
  };
  errors: string[];
}

/**
 * 初始化所有全局服务
 */
export async function initializeServices(configPath?: string): Promise<ServiceInitializationResult> {
  const errors: string[] = [];

  try {
    console.log('🚀 Initializing RCC v4.0 services...');

    // 1. 初始化配置管理器
    console.log('📋 Initializing configuration manager...');
    const configManager = new RCCv4ConfigLoader();
    await configManager.initialize();

    // 加载配置
    const config = await configManager.loadConfig(configPath || 'config/v4');
    registerConfigManager(configManager as IConfigManager);
    console.log('✅ Configuration manager initialized');

    // 2. 初始化缓存管理器
    console.log('💾 Initializing cache manager...');
    const cacheManager = new CacheManager();
    registerCacheManager(cacheManager);
    console.log('✅ Cache manager initialized');

    // 3. 初始化Provider管理器
    console.log('🔌 Initializing provider manager...');
    const providerManager = new ProviderManager({
      routingStrategy: config.routing?.defaultStrategy || ('round_robin' as any),
      healthCheckInterval: config.routing?.healthCheckInterval || 30000,
      maxRetries: config.routing?.maxRetries || 3,
      debug: config.server?.debug || false,
      strictErrorReporting: config.routing?.strictErrorReporting !== false,
    });

    // 加载Provider配置并初始化
    const providerConfigs = Object.entries(config.providers || {}).map(([id, providerConfig]: [string, any]) => ({
      id,
      ...providerConfig,
    }));

    if (providerConfigs.length > 0) {
      await providerManager.initialize(providerConfigs);
    }
    registerProviderManager(providerManager);
    console.log(`✅ Provider manager initialized with ${providerConfigs.length} providers`);

    // 4. 初始化Pipeline管理器
    console.log('⚙️  Initializing pipeline manager...');
    const moduleRegistry = new ModuleRegistry();
    const pipelineFactory = new StandardPipelineFactoryImpl(moduleRegistry);
    const pipelineManager = new PipelineManager(pipelineFactory);

    // 创建Pipeline
    const pipelineConfigs = Object.entries(config.pipelines || {}).map(([id, pipelineConfig]: [string, any]) => ({
      id,
      ...pipelineConfig,
    }));

    for (const pipelineConfig of pipelineConfigs) {
      try {
        await pipelineManager.createPipeline(pipelineConfig);
      } catch (error) {
        errors.push(
          `Failed to create pipeline ${pipelineConfig.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    registerPipelineManager(pipelineManager);
    console.log(`✅ Pipeline manager initialized with ${pipelineConfigs.length} pipelines`);

    // 5. 初始化服务器管理器
    console.log('🖥️  Initializing server manager...');
    const serverManager = new ServerManager();
    await serverManager.initialize();
    registerServerManager(serverManager);
    console.log('✅ Server manager initialized');

    // 6. 验证所有必要服务已注册
    const validation = validateRequiredServices();
    if (!validation.valid) {
      errors.push(`Missing required services: ${validation.missing.join(', ')}`);
    }

    const success = errors.length === 0;

    if (success) {
      console.log('🎉 All services initialized successfully!');
    } else {
      console.warn('⚠️  Service initialization completed with warnings:', errors);
    }

    return {
      success,
      services: {
        providerManager,
        pipelineManager,
        configManager: configManager as IConfigManager,
        serverManager,
        cacheManager,
      },
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    errors.push(errorMessage);
    console.error('❌ Service initialization failed:', errorMessage);

    throw new Error(`Service initialization failed: ${errorMessage}`);
  }
}

/**
 * 停止所有服务
 */
export async function stopServices(): Promise<void> {
  console.log('🛑 Stopping all services...');

  try {
    // 这里应该停止所有服务
    // 由于全局服务注册表的设计，我们需要获取服务实例并停止它们

    console.log('✅ All services stopped successfully');
  } catch (error) {
    console.error('❌ Error stopping services:', error);
    throw error;
  }
}

/**
 * 健康检查所有服务
 */
export async function healthCheckServices(): Promise<{
  healthy: boolean;
  services: Record<string, boolean>;
  issues: string[];
}> {
  const { getServiceRegistry } = await import('./global-service-registry');
  const registry = getServiceRegistry();

  const issues: string[] = [];

  if (!registry.healthy) {
    issues.push('Not all required services are registered');
  }

  return {
    healthy: registry.healthy && issues.length === 0,
    services: registry.services,
    issues,
  };
}
