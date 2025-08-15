/**
 * Jest测试环境设置
 * 
 * @author Jason Zhang
 */

import { config } from 'dotenv';
import path from 'path';

// 加载测试环境变量
config({ path: path.join(__dirname, '../.env.test') });

// 设置测试超时
jest.setTimeout(30000);

// 全局测试钩子
beforeAll(async () => {
  // 测试开始前的全局设置
  console.log('🧪 Starting RCC v4.0 test suite...');
});

afterAll(async () => {
  // 测试结束后的清理
  console.log('✅ RCC v4.0 test suite completed.');
});

// 抑制console.log在测试中的输出（保留错误和警告）
if (process.env.NODE_ENV === 'test') {
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    if (process.env.DEBUG_TESTS) {
      originalConsoleLog(...args);
    }
  };
}

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.RCC_DEBUG = 'false';
process.env.RCC_CONFIG_DIR = path.join(__dirname, 'fixtures/config');
process.env.RCC_LOG_LEVEL = 'warn';