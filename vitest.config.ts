import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 解决worker环境限制问题
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    // 提供Node.js环境API
    environment: 'node',
    // 全局变量配置
    globals: true,
    // 超时配置
    testTimeout: 30000,
    hookTimeout: 30000,
    // 允许process API
    env: {
      NODE_ENV: 'test'
    },
    // 设置工作目录
    root: process.cwd(),
    // 模拟文件系统API
    setupFiles: ['./test/setup.ts']
  }
});