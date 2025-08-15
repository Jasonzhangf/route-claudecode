/**
 * RCC v4.0 基础功能测试
 * 
 * 验证项目初始化和基础配置
 * 
 * @author Jason Zhang
 */

import { RouteClaudeCode, VERSION } from '../../src';

describe('RCC v4.0 Basic Functionality', () => {
  describe('Version and Build Info', () => {
    it('should have correct version', () => {
      expect(VERSION).toBe('4.0.0-alpha.1');
    });

    it('should create singleton instance', () => {
      const instance1 = RouteClaudeCode.getInstance();
      const instance2 = RouteClaudeCode.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1.getVersion()).toBe('4.0.0-alpha.1');
    });

    it('should have build date', () => {
      const instance = RouteClaudeCode.getInstance();
      const buildDate = instance.getBuildDate();
      
      expect(buildDate).toBeDefined();
      expect(new Date(buildDate)).toBeInstanceOf(Date);
    });
  });
  
  describe('Module Exports', () => {
    it('should export all core modules', () => {
      // 验证所有模块都可以导入
      expect(() => {
        require('../../src/types');
        require('../../src/client');
        require('../../src/router');
        require('../../src/pipeline');
        require('../../src/debug');
        require('../../src/utils');
      }).not.toThrow();
    });
  });
});