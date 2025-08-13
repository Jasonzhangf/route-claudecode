/**
 * Vitest Setup File
 * 解决测试环境中的API限制问题
 * Project owner: Jason Zhang
 */

import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// 全局配置fs模块
global.fs = fs;
global.readFileSync = fs.readFileSync;
global.writeFileSync = fs.writeFileSync;
global.existsSync = fs.existsSync;
global.statSync = fs.statSync;
global.readdirSync = fs.readdirSync;

// 模拟process.chdir为测试环境友好的版本
const originalChdir = process.chdir;
let currentDir = process.cwd();

process.chdir = vi.fn((dir: string) => {
  // 在测试环境中，我们模拟chdir行为但不实际改变目录
  if (process.env.NODE_ENV === 'test') {
    currentDir = path.resolve(dir);
    // 模拟目录变更
    return;
  }
  return originalChdir(dir);
});

// 提供模拟的cwd
const originalCwd = process.cwd;
process.cwd = vi.fn(() => {
  if (process.env.NODE_ENV === 'test') {
    return currentDir;
  }
  return originalCwd();
});

// 设置测试超时
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000
});

// 全局测试工具
global.testUtils = {
  resetDirectory: () => {
    currentDir = originalCwd();
  },
  setCurrentDirectory: (dir: string) => {
    currentDir = path.resolve(dir);
  }
};