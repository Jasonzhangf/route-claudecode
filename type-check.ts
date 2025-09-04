/**
 * TypeScript编译测试文件 - 验证主要类型是否正确
 */

// 测试主要类型导入
import { ApplicationBootstrap, BootstrapConfig, ApplicationRuntime } from './src/bootstrap/application-bootstrap';
import { UnifiedInitializer, InitializationResult } from './src/pipeline/unified-initializer';
import { RuntimeScheduler } from './src/pipeline/runtime-scheduler';
import { LoadBalanceStrategy } from './src/interfaces/scheduler/dynamic-scheduler';
import { ConfigPreprocessor, ConfigPreprocessResult } from './src/config/config-preprocessor';
import { RouterPreprocessor, RouterPreprocessResult, PipelineConfig } from './src/router/router-preprocessor';
import { PipelineManager } from './src/pipeline/pipeline-manager';

// 类型测试 - 这些不会被执行，只是用于编译时类型检查
export function testTypes(): void {
  // 测试 BootstrapConfig 类型
  const bootstrapConfig: BootstrapConfig = {
    configPath: './config.json',
    server: {
      port: 5506,
      host: '0.0.0.0',
      debug: false
    },
    debug: true
  };

  // 测试 LoadBalanceStrategy 枚举
  const strategy: LoadBalanceStrategy = LoadBalanceStrategy.ROUND_ROBIN;

  // 测试异步方法类型
  async function testBootstrap() {
    const result = await ApplicationBootstrap.bootstrap(bootstrapConfig);
    console.log('Bootstrap result:', result.success);
  }

  // 测试 RuntimeScheduler 配置
  const schedulerConfig = {
    strategy: LoadBalanceStrategy.ROUND_ROBIN,
    maxErrorCount: 3,
    blacklistDuration: 60000
  };

  const scheduler = new RuntimeScheduler(schedulerConfig);

  console.log('Type check completed successfully');
}

export default testTypes;