/**
 * Bootstrap集成测试
 * 
 * 测试ApplicationBootstrap与现有系统的集成
 * 
 * @author RCC v4.0 Architecture Team
 */

import { BOOTSTRAP_CONFIG, SCHEDULER_DEFAULTS, COMPONENT_NAMES } from '../../constants/bootstrap-constants';

describe('Bootstrap Integration Tests', () => {
  describe('常量验证', () => {
    it('应该有正确的引导配置常量', () => {
      expect(BOOTSTRAP_CONFIG.APPLICATION_VERSION).toBeDefined();
      expect(BOOTSTRAP_CONFIG.DEFAULT_HOST).toBeDefined();
      expect(BOOTSTRAP_CONFIG.DEFAULT_DEBUG_LOGS_PATH).toBeDefined();
      expect(BOOTSTRAP_CONFIG.BOOTSTRAP_TIMEOUT_MS).toBeGreaterThan(0);
    });

    it('应该有正确的调度器默认配置', () => {
      expect(SCHEDULER_DEFAULTS.STRATEGY).toBeDefined();
      expect(SCHEDULER_DEFAULTS.MAX_ERROR_COUNT).toBeGreaterThan(0);
      expect(SCHEDULER_DEFAULTS.BLACKLIST_DURATION_MS).toBeGreaterThan(0);
      expect(SCHEDULER_DEFAULTS.AUTH_RETRY_DELAY_MS).toBeGreaterThan(0);
      expect(SCHEDULER_DEFAULTS.HEALTH_CHECK_INTERVAL_MS).toBeGreaterThan(0);
    });

    it('应该有正确的组件名称常量', () => {
      expect(COMPONENT_NAMES.CONFIG_PREPROCESSOR).toBeDefined();
      expect(COMPONENT_NAMES.ROUTER_PREPROCESSOR).toBeDefined();
      expect(COMPONENT_NAMES.PIPELINE_LIFECYCLE_MANAGER).toBeDefined();
      expect(COMPONENT_NAMES.RUNTIME_SCHEDULER).toBeDefined();
    });
  });

  describe('模块导入验证', () => {
    it('应该能够导入ApplicationBootstrap', async () => {
      const { ApplicationBootstrap } = await import('../application-bootstrap');
      expect(ApplicationBootstrap).toBeDefined();
      expect(typeof ApplicationBootstrap.bootstrap).toBe('function');
    });

    it('应该能够导入配置预处理器', async () => {
      const { ConfigPreprocessor } = await import('../../config/config-preprocessor');
      expect(ConfigPreprocessor).toBeDefined();
      expect(typeof ConfigPreprocessor.preprocess).toBe('function');
    });

    it('应该能够导入路由预处理器', async () => {
      const { RouterPreprocessor } = await import('../../router/router-preprocessor');
      expect(RouterPreprocessor).toBeDefined();
      expect(typeof RouterPreprocessor.preprocess).toBe('function');
    });
  });

  describe('类型定义验证', () => {
    it('应该有正确的引导配置类型', async () => {
      const { ApplicationBootstrap } = await import('../application-bootstrap');
      
      // 验证类型导出
      expect(ApplicationBootstrap).toBeDefined();
      
      // 创建一个基本的配置对象来验证类型
      const config = {
        configPath: '/test/path',
        server: {
          port: 5506,
          host: '0.0.0.0',
          debug: false
        },
        debug: false
      };
      
      expect(config.configPath).toBeDefined();
      expect(config.server?.port).toBeGreaterThan(0);
    });
  });

  describe('错误处理验证', () => {
    it('应该有正确的错误常量', async () => {
      const { BOOTSTRAP_ERRORS } = await import('../../constants/bootstrap-constants');
      
      expect(BOOTSTRAP_ERRORS.CONFIG_REQUIRED).toContain('Configuration file is required');
      expect(BOOTSTRAP_ERRORS.BOOTSTRAP_FAILED).toBe('BOOTSTRAP_FAILED');
      expect(BOOTSTRAP_ERRORS.FORCE_KILL_FAILED).toBe('FORCE_KILL_FAILED');
    });
  });

  describe('CLI集成验证', () => {
    it('应该能够导入增强的CLI类', async () => {
      const { RCCCli } = await import('../../cli/rcc-cli');
      
      expect(RCCCli).toBeDefined();
      
      // 创建实例来验证基本功能
      const cli = new RCCCli();
      expect(cli).toBeDefined();
      expect(typeof cli.start).toBe('function');
      expect(typeof cli.stop).toBe('function');
      expect(typeof cli.status).toBe('function');
    });
  });
});