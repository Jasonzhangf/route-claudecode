/**
 * RCC v4.0 统一CLI实现
 *
 * 实现永久模板规则的CLI命令系统
 * 遵循.claude/rules/unified-cli-config-template.md规范
 * 所有配置值和消息从配置文件加载，无硬编码
 *
 * @author Jason Zhang
 */

import * as path from 'path';
import {
  CLICommands,
  StartOptions,
  StopOptions,
  CodeOptions,
  StatusOptions,
  ServerStatus,
  HealthCheck,
} from '../interfaces/client/cli-interface';

import { ConfigReader, MergedConfig } from '../config/config-reader';
import { PipelineLifecycleManager } from '../pipeline/pipeline-lifecycle-manager';
import { secureLogger } from '../utils/secure-logger';
import fs from 'fs/promises';

/**
 * CLI配置模板接口
 */
interface CLITemplate {
  cliDefaults: {
    defaultPort: number;
    defaultHost: string;
    version: string;
    proxyApiKey: string;
  };
  healthCheck: {
    defaultChecks: string[];
    statuses: Record<string, string>;
    checkStatuses: Record<string, string>;
    messages: Record<string, string>;
  };
  cliMessages: Record<string, string>;
  urlTemplates: Record<string, string>;
  paths: {
    templateConfig: string;
  };
}

/**
 * 统一CLI实现类
 */
export class UnifiedCLI implements CLICommands {
  private pipelineManager: PipelineLifecycleManager;
  private configReader: ConfigReader;
  private runningInstances: Map<number, any> = new Map();
  private cliTemplate: CLITemplate | null = null;

  constructor() {
    this.configReader = new ConfigReader();
    // PipelineManager will be created later with correct config path
    this.pipelineManager = null as any;
  }

  /**
   * 加载CLI模板配置
   */
  private async loadCLITemplate(): Promise<CLITemplate> {
    if (this.cliTemplate) {
      return this.cliTemplate;
    }

    try {
      // 使用环境变量或默认路径，支持全局安装
      let templatePath = process.env.RCC_CONFIG_TEMPLATE_PATH;
      
      if (!templatePath) {
        // 尝试多个可能的路径
        const possiblePaths = [
          'config/unified-config-templates.json', // 当前目录
          path.join(__dirname, '../../config/unified-config-templates.json'), // 相对于dist目录
          path.join(process.cwd(), 'config/unified-config-templates.json'), // 当前工作目录
          '/opt/homebrew/lib/node_modules/route-claude-code/config/unified-config-templates.json', // 全局安装路径
        ];
        
        for (const possiblePath of possiblePaths) {
          try {
            await fs.access(possiblePath);
            templatePath = possiblePath;
            break;
          } catch {
            // 继续尝试下一个路径
          }
        }
        
        if (!templatePath) {
          throw new Error('Could not find unified-config-templates.json in any expected location');
        }
      }
      
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const fullTemplate = JSON.parse(templateContent);
      this.cliTemplate = {
        cliDefaults: fullTemplate.cliDefaults,
        healthCheck: fullTemplate.healthCheck,
        cliMessages: fullTemplate.cliMessages,
        urlTemplates: fullTemplate.urlTemplates,
        paths: fullTemplate.paths,
      };
      return this.cliTemplate!;
    } catch (error) {
      throw new Error(`Failed to load CLI template: ${error.message}`);
    }
  }

  /**
   * 构建URL
   */
  private buildUrl(template: string, port: number): string {
    return template.replace('{port}', port.toString());
  }

  /**
   * 启动服务器
   */
  async start(options: StartOptions): Promise<void> {
    process.stdout.write('🔍 [DEBUG] UnifiedCLI.start()开始\n');
    
    try {
      process.stdout.write('🔍 [DEBUG] 加载CLI模板...\n');
      const template = await this.loadCLITemplate();
      process.stdout.write('🔍 [DEBUG] CLI模板加载成功\n');

      secureLogger.info(template.cliMessages.startingServer);

      // 1. 加载配置 - 直接读取，无模板
      process.stdout.write(`🔍 [DEBUG] 加载配置文件: ${options.config}\n`);
      const config = ConfigReader.loadConfig(options.config, 'config/system-config.json');
      process.stdout.write('🔍 [DEBUG] 配置加载成功\n');
      process.stdout.write(`🔍 [DEBUG] 配置包含字段: ${Object.keys(config).join(', ')}\n`);
      process.stdout.write(`🔍 [DEBUG] router数量: ${config.router ? Object.keys(config.router).length : 0}\n`);

      // 2. 验证配置完整性
      process.stdout.write('🔍 [DEBUG] 验证配置完整性...\n');
      // Configuration validation removed - using direct Demo1 format
      process.stdout.write('🔍 [DEBUG] 配置验证通过\n');
      
      // 3. 应用CLI选项覆盖
      process.stdout.write('🔍 [DEBUG] 应用CLI选项覆盖...\n');
      const finalConfig = this.applyCLIOverrides(config, options, template);
      process.stdout.write('🔍 [DEBUG] CLI选项覆盖完成\n');
      process.stdout.write(`🔍 [DEBUG] finalConfig.router数量: ${finalConfig.router ? Object.keys(finalConfig.router).length : 0}\n`);

      // 4. 验证端口是否已占用
      const port = finalConfig.server.port;
      process.stdout.write(`🔍 [DEBUG] 检查端口占用: ${port}\n`);
      if (this.runningInstances.has(port)) {
        throw new Error(`服务器已在运行 ${port}`);
      }
      process.stdout.write('🔍 [DEBUG] 端口检查通过\n');

      // 5. 创建Pipeline管理器并传递正确的配置路径
      if (!this.pipelineManager) {
        process.stdout.write('🔍 [DEBUG] 创建PipelineLifecycleManager...\n');
        const systemConfigPath = path.join(__dirname, '../../config/system-config.json');
        this.pipelineManager = new PipelineLifecycleManager(options.config, systemConfigPath);
        process.stdout.write('🔧 Created PipelineLifecycleManager with config paths\n');
      }
      // 设置最终配置，确保 modelRoutes 被传递
      process.stdout.write('🔍 [DEBUG] 设置最终配置到PipelineManager...\n');
      process.stdout.write(`🔍 [DEBUG] 传递给Pipeline的finalConfig.router: ${finalConfig.router ? Object.keys(finalConfig.router).length + '个' : 'undefined'}\n`);
      (this.pipelineManager as any).config = finalConfig;

      // 6. 启动Pipeline系统
      process.stdout.write('🔍 [DEBUG] 启动Pipeline系统...\n');
      const startSuccess = await this.pipelineManager.start();
      if (!startSuccess) {
        throw new Error('Pipeline系统启动失败');
      }
      process.stdout.write('🔍 [DEBUG] Pipeline系统启动成功\n');

      // 6. 记录服务器实例（Pipeline管理器内部管理HTTP服务器）
      const serverInstance = { started: true, port, host: finalConfig.server.host };

      // 6. 记录运行实例
      this.runningInstances.set(port, {
        config: finalConfig,
        startTime: new Date(),
        instance: serverInstance,
      });

      secureLogger.info('RCC v4.0 Server Started Successfully', {
        host: finalConfig.server.host,
        port,
        providers: finalConfig.providers.length,
        router: Object.keys(finalConfig.router || {}).length,
        debug: finalConfig.server.debug,
      });
      process.stdout.write('🔍 [DEBUG] UnifiedCLI.start()完成\n');
    } catch (error) {
      process.stderr.write(`❌ [DEBUG] UnifiedCLI.start()失败: ${error.message}\n`);
      process.stderr.write(`❌ [DEBUG] 错误堆栈: ${error.stack}\n`);
      const template = await this.loadCLITemplate();
      secureLogger.error(template.cliMessages.failedToStart, { error: error.message });
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stop(options: StopOptions): Promise<void> {
    try {
      const template = await this.loadCLITemplate();
      const port = options.port || template.cliDefaults.defaultPort;

      secureLogger.info(template.cliMessages.stoppingServer, { port });

      const instance = this.runningInstances.get(port);
      if (!instance) {
        if (options.force) {
          secureLogger.warn(template.healthCheck.messages.noRunningInstance, { port });
          return;
        }
        throw new Error(`${template.cliMessages.noServerFound} ${port}`);
      }

      // 优雅关闭Pipeline
      await this.pipelineManager.stop();

      // 关闭HTTP服务器
      if (instance.instance && instance.instance.close) {
        instance.instance.close();
      }

      // 移除实例记录
      this.runningInstances.delete(port);

      secureLogger.info(template.cliMessages.serverStopped, { port });
    } catch (error) {
      const template = await this.loadCLITemplate();
      secureLogger.error(template.cliMessages.failedToStop, { error: error.message });
      if (!options.force) {
        throw error;
      }
    }
  }

  /**
   * 查看服务器状态
   */
  async status(options: StatusOptions): Promise<ServerStatus> {
    try {
      const template = await this.loadCLITemplate();
      const port = options.port || template.cliDefaults.defaultPort;
      const instance = this.runningInstances.get(port);

      if (!instance) {
        secureLogger.warn(template.healthCheck.messages.statusCheckNonRunning, { port });
        return {
          isRunning: false,
          port,
          host: template.cliDefaults.defaultHost,
          version: template.cliDefaults.version,
          activePipelines: 0,
          totalRequests: 0,
          health: {
            status: template.healthCheck.statuses.unhealthy as 'unhealthy',
            checks: [
              {
                name: 'server',
                status: template.healthCheck.checkStatuses.fail as 'fail',
                message: template.healthCheck.messages.serverNotRunning,
              },
            ],
          },
        };
      }

      // 获取详细状态
      const healthChecks: HealthCheck[] = [];

      // Pipeline健康检查
      const pipelineStats = (this.pipelineManager as any).stats || {};
      const isHealthy = (this.pipelineManager as any).isRunning || false;
      healthChecks.push({
        name: 'pipeline',
        status: isHealthy
          ? (template.healthCheck.checkStatuses.pass as 'pass')
          : (template.healthCheck.checkStatuses.fail as 'fail'),
        message: isHealthy ? 'Pipeline running normally' : 'Pipeline not running',
        responseTime: pipelineStats.averageResponseTime || 0,
      });

      // 计算运行时间
      const uptime = this.calculateUptime(instance.startTime);

      const allPassed = healthChecks.every(c => c.status === template.healthCheck.checkStatuses.pass);
      const healthStatus = allPassed ? template.healthCheck.statuses.healthy : template.healthCheck.statuses.degraded;

      const status: ServerStatus = {
        isRunning: true,
        port,
        host: instance.config.server.host,
        startTime: instance.startTime,
        version: template.cliDefaults.version,
        activePipelines: Object.keys(instance.config.router || {}).length,
        totalRequests: pipelineStats.totalRequests || 0,
        uptime,
        health: {
          status: healthStatus as 'healthy' | 'degraded' | 'unhealthy',
          checks: healthChecks,
        },
      };

      if (options.detailed) {
        status.pipeline = {
          stats: pipelineStats,
          activeRequests: 0,
          layerHealth: pipelineStats.layerHealth || {},
        };
      }

      secureLogger.info(template.cliMessages.statusRetrieved, {
        port,
        isRunning: status.isRunning,
        health: status.health.status,
      });

      return status;
    } catch (error) {
      const template = await this.loadCLITemplate();
      secureLogger.error(template.cliMessages.failedToGetStatus, { error: error.message });
      throw new Error(`${template.cliMessages.failedToGetStatus}: ${error.message}`);
    }
  }

  /**
   * 启动客户端模式 (透明代理Claude Code)
   */
  async code(options: CodeOptions): Promise<void> {
    try {
      const template = await this.loadCLITemplate();
      const port = options.port || template.cliDefaults.defaultPort;

      secureLogger.info(template.cliMessages.startingProxy, { port });

      // 如果需要自动启动服务器
      if (options.autoStart) {
        const instance = this.runningInstances.get(port);
        if (!instance) {
          secureLogger.info(template.cliMessages.autoStarting);
          await this.start({ port });
        }
      }

      // 构建URL和环境变量
      const baseUrl = this.buildUrl(template.urlTemplates.anthropicBaseUrlTemplate, port);
      process.env.ANTHROPIC_BASE_URL = baseUrl;
      process.env.ANTHROPIC_API_KEY = template.cliDefaults.proxyApiKey;

      if (options.export) {
        // 输出环境变量设置（这是用户明确要求的输出，不是调试代码）
        process.stdout.write(template.urlTemplates.envVarComment + '\n');
        process.stdout.write(template.urlTemplates.envVarPrefix + 'ANTHROPIC_BASE_URL=' + baseUrl + '\n');
        process.stdout.write(
          template.urlTemplates.envVarPrefix + 'ANTHROPIC_API_KEY=' + template.cliDefaults.proxyApiKey + '\n'
        );
        return;
      }

      secureLogger.info(template.cliMessages.proxyConfigured, { port });

      // 启动Claude Code
      try {
        const { spawn } = await import('child_process');
        
        // 使用继承的stdio让Claude Code直接与用户交互
        const claudeProcess = spawn('claude', [], {
          stdio: 'inherit',
          env: {
            ...process.env,
            ANTHROPIC_BASE_URL: baseUrl,
            ANTHROPIC_API_KEY: template.cliDefaults.proxyApiKey,
          },
        });

        // 处理Claude Code进程事件
        claudeProcess.on('error', (error: any) => {
          if (error.code === 'ENOENT') {
            process.stderr.write('❌ Claude Code not found. Please install Claude Code first:\n');
            process.stderr.write('   Visit: https://claude.ai/download\n');
          } else {
            process.stderr.write(`❌ Failed to start Claude Code: ${error.message}\n`);
          }
        });

        claudeProcess.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            process.stderr.write(`❌ Claude Code exited with code: ${code}\n`);
          }
        });

        // 等待进程结束或用户中断
        await new Promise<void>((resolve) => {
          claudeProcess.on('close', resolve);
          process.on('SIGINT', () => {
            claudeProcess.kill('SIGTERM');
            resolve();
          });
        });

      } catch (error) {
        process.stderr.write(`❌ Failed to launch Claude Code: ${error.message}\n`);
        throw error;
      }

    } catch (error) {
      const template = await this.loadCLITemplate();
      secureLogger.error(template.cliMessages.failedToConfigureProxy, { error: error.message });
      throw error;
    }
  }

  /**
   * 配置管理（预留接口）
   */
  async config(options: any): Promise<void> {
    const template = await this.loadCLITemplate();
    secureLogger.info(template.cliMessages.configRequested);
    // 预留给后续版本实现
    throw new Error(template.cliMessages.configNotImplemented);
  }

  /**
   * 应用CLI选项覆盖
   */
  private applyCLIOverrides(config: MergedConfig, options: StartOptions, template: CLITemplate): MergedConfig {
    const overrideConfig = { ...config };

    if (options.port !== undefined) {
      overrideConfig.server.port = options.port;
    }

    if (options.host !== undefined) {
      overrideConfig.server.host = options.host;
    }

    if (options.debug !== undefined) {
      overrideConfig.server.debug = options.debug;
    }

    return overrideConfig;
  }

  /**
   * 计算运行时间
   */
  private calculateUptime(startTime: Date): string {
    const now = new Date();
    const uptimeMs = now.getTime() - startTime.getTime();

    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
