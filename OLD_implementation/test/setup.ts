/**
 * Test setup file
 * Global test configuration and utilities
 */

import { jest } from '@jest/globals';

// 设置测试环境变量
process.env.RCC_PORT = '9999'; // 测试端口
process.env.NODE_ENV = 'test';

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn()
};