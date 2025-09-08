/**
 * RCC v4.0 统一启动服务
 * 
 * 协调所有核心模块的初始化、配置和启动流程
 * 实现完整的模块初始化链：配置模块 → 路由模块 → 流水线模块 → 自检模块 → 调度模块
 * 
 * @author Claude Code Router v4.0
 */

import * as path from 'path';
import * as fs from 'fs';
import { ConfigPreprocessor, ConfigPreprocessResult } from '../../config/src/config-preprocessor';
import { RouterPreprocessor, RouterPreprocessResult } from '../../router/src/router-preprocessor';
import { PipelineAssembler } from '../../pipeline/src/pipeline-assembler';
import { PipelineAssemblyResult } from '../../pipeline/src/assembly-types';
import { SelfCheckService } from '../../self-check/self-check.service';
import { PipelineManager } from '../../pipeline/src/pipeline-manager';
import { EnhancedErrorHandler } from '../../error-handler/src/enhanced-error-handler';
import { HTTPServer } from '../../server/src/http-server';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { RCCError, RCCErrorCode } from '../../types/src/index';
import { GlobalDebugIntegration, ModuleDebugIntegration } from '../../logging/src/debug-integration';
import { PipelineAssemblyReporter } from './pipeline-assembly-reporter';

/**
 * 启动配置
 */
export interface StartupConfig {
  configPath?: string;
  port?: number; // undefined表示未显式指定，应使用配置文件中的端口
  host?: string;
  debug?: boolean;
  enableHealthCheck?: boolean;
}

/**
 * 启动结果
 */
export interface StartupResult {
  success: boolean;
  server?: HTTPServer;
  pipelineManager?: PipelineManager;
  config?: ConfigPreprocessResult;
  router?: RouterPreprocessResult;
  pipelines?: PipelineAssemblyResult;
  errors?: string[];
  warnings?: string[];
}

/**
 * RCC v4.0 统一启动服务
 */
export class StartupService {
  private configPreprocessor: ConfigPreprocessor;
  private routerPreprocessor: RouterPreprocessor;
  private pipelineAssembler: PipelineAssembler;
  private pipelineManager: PipelineManager;
  private selfCheckService: SelfCheckService;
  private errorHandler: EnhancedErrorHandler;
  private isInitialized: boolean = false;
  private startTime: number = 0;
  private currentConfigResult: ConfigPreprocessResult | null = null;
  
  // Debug系统组件
  private globalDebugIntegration: GlobalDebugIntegration;
  private serverDebugIntegration: ModuleDebugIntegration | null = null;
  private pipelineAssemblyReporter: PipelineAssemblyReporter;

  constructor() {
    this.configPreprocessor = new ConfigPreprocessor();
    this.routerPreprocessor = new RouterPreprocessor();
    this.pipelineAssembler = new PipelineAssembler();
    this.pipelineManager = new PipelineManager();
    this.selfCheckService = new SelfCheckService();
    this.errorHandler = new EnhancedErrorHandler();
    
    // 初始化全局Debug集成
    this.globalDebugIntegration = GlobalDebugIntegration.getInstance();
    
    // 初始化流水线组装报告器
    this.pipelineAssemblyReporter = new PipelineAssemblyReporter({
      outputDirectory: './debug-logs/pipeline-assembly',
      enableConsoleOutput: true,
      enableFileOutput: true,
      enableDetailedLogging: true,
      enableSelfInspection: true,
      consoleOutputFormat: 'detailed',
      reportRetentionCount: 10,
      maxReportFileSize: 50 * 1024 * 1024
    });
  }

  /**
   * 执行完整的RCC v4.0启动流程
   * 
   * 启动顺序：
   * 1. 配置模块初始化 - 加载和预处理配置
   * 2. 路由模块初始化 - 生成路由表和流水线配置
   * 3. 流水线模块初始化 - 组装流水线
   * 4. 自检模块初始化 - 验证配置和连接
   * 5. 调度模块初始化 - 启动流水线管理
   * 6. HTTP服务器启动 - 开始接收请求
   * 
   * @param config 启动配置
   * @returns Promise<StartupResult> 启动结果
   */
  async start(config: StartupConfig): Promise<StartupResult> {
    this.startTime = Date.now();
    const result: StartupResult = {
      success: false,
      errors: [],
      warnings: []
    };

    try {
      secureLogger.info('🚀 Starting RCC v4.0 unified startup process...', {
        configPath: config.configPath,
        port: config.port,
        host: config.host,
        debug: config.debug
      });

      // 1. 配置模块初始化 - 加载和预处理配置
      const configResult = await this.initializeConfigModule(config);
      if (!configResult.success) {
        result.errors!.push(configResult.error?.message || 'Config initialization failed');
        return result;
      }
      this.currentConfigResult = configResult; // 存储配置结果供后续使用
      result.config = configResult;
      secureLogger.info('✅ Config module initialized successfully');

      // 1.5. Debug系统初始化 - 现在可以获取正确的端口号了
      const serverPort = config.port || configResult.routingTable?.server?.port || 5506;
      await this.initializeDebugSystemWithPort(serverPort, config);
      secureLogger.info('✅ Debug system initialized successfully');

      // 2. 路由模块初始化 - 生成路由表和流水线配置
      const routerResult = await this.initializeRouterModule(configResult);
      if (!routerResult.success) {
        result.errors!.push(...routerResult.errors || []);
        return result;
      }
      result.router = routerResult;
      secureLogger.info('✅ Router module initialized successfully');

      // 3. 流水线模块初始化 - 组装流水线
      const pipelineResult = await this.initializePipelineModule(routerResult);
      if (!pipelineResult.success) {
        result.errors!.push(...pipelineResult.errors || []);
        return result;
      }
      result.pipelines = pipelineResult;
      secureLogger.info('✅ Pipeline module initialized successfully');

      // 4. 自检模块初始化 - 验证配置和连接
      await this.initializeSelfCheckModule(pipelineResult);
      secureLogger.info('✅ Self-check module initialized successfully');

      // 5. 调度模块初始化 - 启动流水线管理
      await this.initializeSchedulerModule(pipelineResult);
      secureLogger.info('✅ Scheduler module initialized successfully');

      // 6. HTTP服务器启动 - 开始接收请求
      const server = await this.startHttpServer(config, pipelineResult);
      result.server = server;
      secureLogger.info('✅ HTTP server started successfully');

      // Debug系统已在配置初始化后正确设置，无需额外配置

      // 设置模块间的连接和依赖关系
      await this.setupModuleConnections();

      // ✅ 验证HTTP服务器流水线设置
      await this.validateServerPipelineSetup(result.server!, pipelineResult);

      result.success = true;
      const totalTime = Date.now() - this.startTime;
      secureLogger.info('🎉 RCC v4.0 startup completed successfully!', {
        totalTimeMs: totalTime,
        totalPipelines: pipelineResult.allPipelines.length,
        activePipelines: pipelineResult.allPipelines.filter(p => p.assemblyStatus === 'assembled').length
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during startup';
      result.errors!.push(errorMessage);
      secureLogger.error('❌ RCC v4.0 startup failed', { error: errorMessage });
      
      // 尝试进行清理
      await this.cleanupOnError();
      
      return result;
    }
  }

  /**
   * 停止所有服务
   */
  async stop(): Promise<void> {
    secureLogger.info('🛑 Stopping RCC v4.0 services...');

    try {
      // 停止HTTP服务器
      // 注意：这里需要获取当前运行的服务器实例
      // 在实际实现中，应该有一个全局的服务器实例管理器

      // 停止调度模块
      await this.pipelineManager.destroy();
      secureLogger.info('✅ Pipeline manager stopped');

      // 停止自检模块
      await this.selfCheckService.stop();
      secureLogger.info('✅ Self-check service stopped');

      // 清理流水线组装器
      await this.pipelineAssembler.destroy();
      secureLogger.info('✅ Pipeline assembler destroyed');

      // 清理Debug系统
      try {
        await this.globalDebugIntegration.endGlobalSession();
        secureLogger.info('✅ Global debug session ended');
      } catch (error) {
        secureLogger.warn('⚠️ Failed to end global debug session', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }

      secureLogger.info('🛑 All RCC v4.0 services stopped successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during shutdown';
      secureLogger.error('❌ Error during shutdown', { error: errorMessage });
      throw error;
    }
  }

  /**
   * 1. 初始化配置模块
   */
  private async initializeConfigModule(config: StartupConfig): Promise<ConfigPreprocessResult> {
    try {
      const configPath = config.configPath || this.getDefaultConfigPath();
      
      if (!fs.existsSync(configPath)) {
        throw new RCCError(
          `Configuration file not found: ${configPath}`,
          RCCErrorCode.CONFIG_MISSING,
          'startup'
        );
      }

      secureLogger.info('🔧 Initializing config module...', { configPath });
      
      const configResult = await ConfigPreprocessor.preprocess(configPath);
      
      if (!configResult.success) {
        throw new RCCError(
          `Config preprocessing failed: ${configResult.error?.message || 'Unknown error'}`,
          RCCErrorCode.CONFIG_PARSE_ERROR,
          'startup',
          { details: configResult.error }
        );
      }

      return configResult;
    } catch (error) {
      if (error instanceof RCCError) {
        throw error;
      }
      throw new RCCError(
        `Failed to initialize config module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.CONFIG_PARSE_ERROR,
        'startup'
      );
    }
  }

  /**
   * 2. 初始化路由模块
   */
  private async initializeRouterModule(configResult: ConfigPreprocessResult): Promise<RouterPreprocessResult> {
    try {
      secureLogger.info('🔧 Initializing router module...');
      
      if (!configResult.routingTable) {
        throw new RCCError(
          'Routing table is missing from config preprocessing result',
          RCCErrorCode.ROUTER_CONFIG_ERROR,
          'startup'
        );
      }

      const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable);
      
      if (!routerResult.success) {
        throw new RCCError(
          `Router preprocessing failed: ${routerResult.errors.join(', ')}`,
          RCCErrorCode.ROUTER_CONFIG_ERROR,
          'startup',
          { details: routerResult.errors }
        );
      }

      return routerResult;
    } catch (error) {
      if (error instanceof RCCError) {
        throw error;
      }
      throw new RCCError(
        `Failed to initialize router module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.ROUTER_CONFIG_ERROR,
        'startup'
      );
    }
  }

  /**
   * 🆕 生成流水线组装报告
   */
  private async generatePipelineAssemblyReport(
    config: StartupConfig, 
    routerResult: RouterPreprocessResult, 
    pipelineResult: PipelineAssemblyResult
  ): Promise<void> {
    try {
      const configPath = config.configPath || this.getDefaultConfigPath();
      const serverPort = this.getConfigFileServerInfo()?.port;
      
      secureLogger.info('📊 Generating pipeline assembly report...', {
        configPath,
        serverPort,
        pipelineCount: pipelineResult.allPipelines.length
      });
      
      // 生成完整报告
      const report = await this.pipelineAssemblyReporter.generateReport(
        routerResult,
        pipelineResult,
        configPath,
        serverPort
      );
      
      // 生成控制台输出
      const consoleOutput = this.pipelineAssemblyReporter.generateConsoleOutput(report);
      console.log(consoleOutput);
      
      // 保存报告到文件
      const reportFilePath = await this.pipelineAssemblyReporter.saveReportToFile(report);
      secureLogger.info('✅ Pipeline assembly report saved', { reportFilePath });
      
      // 验证报告完整性
      const isValid = this.pipelineAssemblyReporter.validateReport(report);
      if (!isValid) {
        secureLogger.warn('⚠️ Pipeline assembly report validation failed', {
          reportId: report.sessionInfo.reportId
        });
      }
      
      // 记录自检结果摘要
      const selfInspection = report.selfInspection;
      secureLogger.info('🔍 Self inspection results', {
        status: selfInspection.status,
        overallScore: selfInspection.overallScore,
        criticalIssues: selfInspection.criticalIssues.length,
        recommendations: selfInspection.recommendations.slice(0, 3)
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      secureLogger.error('❌ Failed to generate pipeline assembly report', {
        error: errorMessage
      });
      // 不抛出错误，避免影响启动流程
    }
  }

  /**
   * 3. 初始化流水线模块
   */
  private async initializePipelineModule(routerResult: RouterPreprocessResult): Promise<PipelineAssemblyResult> {
    try {
      secureLogger.info('🔧 Initializing pipeline module...');
      
      if (!routerResult.pipelineConfigs || routerResult.pipelineConfigs.length === 0) {
        throw new RCCError(
          'No pipeline configurations found in router result',
          RCCErrorCode.PIPELINE_ASSEMBLY_FAILED,
          'startup'
        );
      }

      const pipelineResult = await this.pipelineAssembler.assemble(routerResult.pipelineConfigs);
      
      if (!pipelineResult.success) {
        throw new RCCError(
          `Pipeline assembly failed: ${pipelineResult.errors.join(', ')}`,
          RCCErrorCode.PIPELINE_ASSEMBLY_FAILED,
          'startup',
          { details: pipelineResult.errors }
        );
      }

      // 🆕 生成流水线组装报告 - 使用存储的配置信息
      const startupConfig = {
        configPath: this.currentConfigResult?.metadata?.configPath,
        port: this.getConfigFileServerInfo()?.port,
        host: this.getConfigFileServerInfo()?.host,
        debug: this.getConfigFileServerInfo()?.debug
      };
      await this.generatePipelineAssemblyReport(startupConfig, routerResult, pipelineResult);

      return pipelineResult;
    } catch (error) {
      if (error instanceof RCCError) {
        throw error;
      }
      throw new RCCError(
        `Failed to initialize pipeline module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.PIPELINE_ASSEMBLY_FAILED,
        'startup'
      );
    }
  }

  /**
   * 4. 初始化自检模块
   */
  private async initializeSelfCheckModule(pipelineResult: PipelineAssemblyResult): Promise<void> {
    try {
      secureLogger.info('🔧 Initializing self-check module...');
      
      // 配置自检服务
      await this.selfCheckService.configure({
        enableApiKeyValidation: true,
        enableTokenRefresh: true,
        enablePipelineHealthCheck: true,
        autoDestroyInvalidPipelines: true
      });

      // 设置流水线管理器引用
      this.selfCheckService.setPipelineManager(this.pipelineManager);
      
      // 设置错误处理器引用
      this.selfCheckService.setErrorHandler(this.errorHandler);
      
      // 启动自检服务
      await this.selfCheckService.start();
      
      secureLogger.info('✅ Self-check module configured and started');
    } catch (error) {
      throw new RCCError(
        `Failed to initialize self-check module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.MODULE_INIT_FAILED,
        'startup'
      );
    }
  }

  /**
   * 5. 初始化调度模块
   */
  private async initializeSchedulerModule(pipelineResult: PipelineAssemblyResult): Promise<void> {
    try {
      secureLogger.info('🔧 Initializing scheduler module...');
      
      // 将组装好的流水线添加到管理器
      for (const pipeline of pipelineResult.allPipelines) {
        if (pipeline.assemblyStatus === 'assembled') {
          this.pipelineManager.addPipeline(pipeline);
        }
      }
      
      // 获取服务器端口并设置到PipelineManager
      const serverPort = this.getConfigFileServerInfo()?.port || 5506;
      console.log(`🔧 [STARTUP] 设置PipelineManager端口: ${serverPort}`);
      
      // 🔧 设置Debug系统端口
      this.pipelineManager.setDebugPort(serverPort);

      // 设置错误处理器引用（用于鉴权维护流程协调）
      this.pipelineManager.setErrorHandler(this.errorHandler);
      
      // 设置自检服务引用（用于健康检查协调）
      if (this.selfCheckService) {
        this.pipelineManager.on('maintenance-auto-recovery', (data) => {
          secureLogger.info('Pipeline maintenance auto-recovery event received', data);
        });
      }

      secureLogger.info('✅ Scheduler module configured with pipelines', {
        totalPipelines: pipelineResult.allPipelines.length,
        activePipelines: pipelineResult.allPipelines.filter(p => p.assemblyStatus === 'assembled').length
      });
    } catch (error) {
      throw new RCCError(
        `Failed to initialize scheduler module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.MODULE_INIT_FAILED,
        'startup'
      );
    }
  }

  /**
   * 6. 启动HTTP服务器
   */
  private async startHttpServer(config: StartupConfig, pipelineResult: PipelineAssemblyResult): Promise<HTTPServer> {
    try {
      secureLogger.info('🔧 Starting HTTP server...');
      
      // 端口优先级：CLI显式端口 > 配置文件端口 > 默认值5506
      const configFileServer = this.getConfigFileServerInfo();
      const serverConfig = {
        port: config.port || configFileServer?.port || 5506,
        host: configFileServer?.host || config.host || '0.0.0.0',
        debug: configFileServer?.debug !== undefined ? configFileServer.debug : (config.debug || false)
      };

      // 创建HTTP服务器实例
      const httpServer = new HTTPServer(serverConfig, config.configPath);
      
      // ✅ 设置流水线数据到HTTP服务器 - 使用真实的流水线执行逻辑
      const assembledPipelines = pipelineResult.allPipelines.filter(p => p.assemblyStatus === 'assembled');
      const httpPipelines = assembledPipelines.map(p => ({
        id: p.pipelineId,
        provider: p.provider,
        model: p.model,
        layers: p.modules,
        execute: p.modules?.length ? this.createPipelineExecutor(p) : undefined
      }));
      httpServer.setPipelines(httpPipelines, true);
      
      secureLogger.info('🔧 Configured HTTP server with pipelines', {
        totalPipelines: pipelineResult.allPipelines.length,
        assembledPipelines: assembledPipelines.length,
        pipelineIds: assembledPipelines.map(p => p.pipelineId)
      });
      
      // 启动服务器
      await httpServer.start();
      
      secureLogger.info('✅ HTTP server started', {
        port: serverConfig.port,
        host: serverConfig.host
      });

      return httpServer;
    } catch (error) {
      throw new RCCError(
        `Failed to start HTTP server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.SERVER_START_FAILED,
        'startup'
      );
    }
  }

  /**
   * 1.5. Debug系统初始化 - 使用正确的端口号
   */
  private async initializeDebugSystemWithPort(serverPort: number, config: StartupConfig): Promise<void> {
    try {
      secureLogger.info('🔧 Initializing debug system with port...', { port: serverPort });
      
      // 注册核心模块的Debug集成
      const coreModules = [
        { id: 'config-preprocessor', name: 'Config Preprocessor', captureLevel: 'basic' as const },
        { id: 'router-preprocessor', name: 'Router Preprocessor', captureLevel: 'basic' as const },
        { id: 'pipeline-assembler', name: 'Pipeline Assembler', captureLevel: 'full' as const },
        { id: 'pipeline-manager', name: 'Pipeline Manager', captureLevel: 'full' as const },
        { id: 'error-handler', name: 'Error Handler', captureLevel: 'basic' as const }
      ];
      
      for (const module of coreModules) {
        this.globalDebugIntegration.registerModule({
          moduleId: module.id,
          moduleName: module.name,
          enabled: config.debug || false,
          captureLevel: module.captureLevel,
          serverPort: serverPort
        });
      }
      
      // 初始化所有Debug模块
      await this.globalDebugIntegration.initializeAll();
      
      secureLogger.info('✅ Debug system configured with correct port', {
        serverPort: serverPort,
        debugEnabled: config.debug || false,
        registeredCoreModules: coreModules.length
      });
      
    } catch (error) {
      throw new RCCError(
        `Failed to initialize debug system with port: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.MODULE_INIT_FAILED,
        'startup'
      );
    }
  }

  /**
   * 创建流水线执行器 - 真实的流水线处理逻辑
   */
  private createPipelineExecutor(pipeline: any) {
    return async (input: any) => {
      const requestId = input.requestId || `req_${Date.now()}`;
      const startTime = Date.now();
      
      console.log(`🚀 [${requestId}] 开始执行真实流水线: ${pipeline.pipelineId}`);
      console.log(`📋 [${requestId}] 流水线信息:`, {
        pipelineId: pipeline.pipelineId,
        provider: pipeline.provider,
        model: pipeline.model,
        layerCount: pipeline.modules?.length || 0,
        layerTypes: pipeline.modules?.map((m: any) => m?.type).filter(Boolean) || []
      });
      
      try {
        // 使用流水线管理器执行流水线
        const result = await this.pipelineManager.executePipeline(pipeline.pipelineId, input);
        const processingTime = Date.now() - startTime;
        
        console.log(`✅ [${requestId}] 流水线执行成功! 耗时: ${processingTime}ms`);
        console.log(`📤 [${requestId}] 流水线结果:`, {
          statusCode: result.statusCode || 200,
          hasResponse: !!result.responseBody,
          provider: pipeline.provider,
          model: pipeline.model
        });
        
        return {
          statusCode: result.statusCode || 200,
          contentType: result.contentType || 'application/json',
          responseBody: result.responseBody || result,
          processingTime
        };
      } catch (error) {
        const processingTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
        
        console.error(`❌ [${requestId}] 流水线执行失败! 耗时: ${processingTime}ms`);
        console.error(`💥 [${requestId}] 错误详情:`, {
          error: errorMessage,
          pipelineId: pipeline.pipelineId,
          provider: pipeline.provider,
          model: pipeline.model
        });
        
        // 返回错误响应
        throw {
          statusCode: 500,
          contentType: 'application/json',
          responseBody: {
            error: {
              message: errorMessage,
              type: 'pipeline_execution_error',
              code: 'PIPELINE_FAILED'
            }
          },
          processingTime
        };
      }
    };
  }

  /**
   * 设置模块间的连接和依赖关系
   */
  private async setupModuleConnections(): Promise<void> {
    try {
      secureLogger.info('🔧 Setting up module connections...');
      
      // 错误处理器与自检服务连接（添加空值检查）
      if (this.errorHandler && typeof this.errorHandler.setSelfCheckService === 'function') {
        this.errorHandler.setSelfCheckService(this.selfCheckService);
        secureLogger.debug('✅ Error handler <-> Self-check service connection established');
      } else {
        secureLogger.warn('⚠️ Error handler is null or missing setSelfCheckService method');
      }
      
      if (this.errorHandler && typeof this.errorHandler.setPipelineManager === 'function') {
        this.errorHandler.setPipelineManager(this.pipelineManager);
        secureLogger.debug('✅ Error handler <-> Pipeline manager connection established');
      } else {
        secureLogger.warn('⚠️ Error handler is null or missing setPipelineManager method');
      }
      
      // 错误处理器与流水线管理器连接
      // (已在initializeSchedulerModule中设置)
      
      // 自检服务与错误处理器连接
      // (已在initializeSelfCheckModule中设置)
      
      secureLogger.info('✅ Module connections setup completed');
    } catch (error) {
      secureLogger.warn('⚠️ Failed to setup some module connections', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 验证HTTP服务器流水线设置
   */
  private async validateServerPipelineSetup(httpServer: HTTPServer, pipelineResult: PipelineAssemblyResult): Promise<void> {
    try {
      secureLogger.info('🔍 Validating HTTP server pipeline setup...');
      
      const serverStatus = httpServer.getStatus();
      const assembledCount = pipelineResult.allPipelines.filter(p => p.assemblyStatus === 'assembled').length;
      
      if (serverStatus.activePipelines === 0) {
        throw new RCCError(
          'HTTP server has no active pipelines after setup',
          RCCErrorCode.PIPELINE_MODULE_MISSING,
          'startup',
          { 
            details: {
              activePipelines: serverStatus.activePipelines,
              assembledPipelines: assembledCount,
              totalPipelines: pipelineResult.allPipelines.length
            }
          }
        );
      }
      
      if (serverStatus.activePipelines !== assembledCount) {
        secureLogger.warn('Mismatch between server active pipelines and assembled pipelines', {
          serverActivePipelines: serverStatus.activePipelines,
          assembledPipelines: assembledCount
        });
      }
      
      secureLogger.info('✅ HTTP server pipeline setup validated', {
        activePipelines: serverStatus.activePipelines,
        assembledPipelines: assembledCount
      });
      
    } catch (error) {
      if (error instanceof RCCError) {
        throw error;
      }
      throw new RCCError(
        `Failed to validate HTTP server pipeline setup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.MODULE_INIT_FAILED,
        'startup'
      );
    }
  }

  /**
   * 错误时的清理工作
   */
  private async cleanupOnError(): Promise<void> {
    try {
      secureLogger.info('🧹 Cleaning up on error...');
      
      // 停止可能已启动的服务
      await this.selfCheckService.stop().catch(() => {});
      await this.pipelineManager.destroy().catch(() => {});
      await this.pipelineAssembler.destroy().catch(() => {});
      
      secureLogger.info('✅ Cleanup completed');
    } catch (cleanupError) {
      secureLogger.warn('⚠️ Error during cleanup', {
        error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
      });
    }
  }

  /**
   * 获取默认配置文件路径
   */
  private getDefaultConfigPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(homeDir, '.route-claudecode', 'config.json');
  }

  /**
   * 获取配置文件中的服务器信息
   */
  private getConfigFileServerInfo(): { port?: number; host?: string; debug?: boolean } | null {
    // 从存储的配置结果中获取服务器配置
    if (this.currentConfigResult && this.currentConfigResult.routingTable && this.currentConfigResult.routingTable.server) {
      return this.currentConfigResult.routingTable.server;
    }
    return null;
  }

  /**
   * 7. 初始化Debug系统 - 从配置中读取正确的端口信息
   */
  private async initializeDebugSystem(config: StartupConfig, server: HTTPServer): Promise<void> {
    try {
      secureLogger.info('🔧 Initializing debug system...');
      
      // 从当前配置结果中获取端口号（配置处理后的实际端口）
      const configPort = this.getConfigFileServerInfo()?.port;
      
      // 端口优先级：CLI显式端口 > 配置文件端口 > HTTP服务器实际端口
      const actualPort = config.port || configPort || (server as any).config?.port || 5506;
      
      secureLogger.info('📋 Debug system port configuration:', {
        cliPort: config.port,
        configFilePort: configPort,
        serverPort: (server as any).config?.port,
        finalPort: actualPort
      });

      // 注册并初始化服务器模块的Debug集成
      this.serverDebugIntegration = this.globalDebugIntegration.registerModule({
        moduleId: 'server',
        moduleName: 'HTTPServer',
        enabled: true,
        captureLevel: 'full',
        serverPort: actualPort
      });

      // 初始化所有Debug集成
      await this.globalDebugIntegration.initializeAll();

      // 开始全局Debug会话
      const sessionId = this.globalDebugIntegration.startGlobalSession(`rcc4-startup-${Date.now()}`);
      
      secureLogger.info('✅ Debug system initialized', {
        port: actualPort,
        sessionId: sessionId,
        registeredModules: ['server'] // 可以扩展注册更多模块
      });

    } catch (error) {
      secureLogger.warn('⚠️ Failed to initialize debug system, but startup will continue', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// 导出单例实例
export const startupService = new StartupService();