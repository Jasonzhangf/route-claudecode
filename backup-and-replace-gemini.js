#!/usr/bin/env node

/**
 * 备份原Gemini client并替换为最小化版本
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 备份和替换Gemini客户端');

const originalPath = 'src/providers/gemini/client.ts';
const minimalPath = 'src/providers/gemini/client-minimal.ts';
const backupPath = `src/providers/gemini/client.ts.backup-${Date.now()}`;

try {
  // 检查文件是否存在
  if (!fs.existsSync(originalPath)) {
    console.log('❌ 原文件不存在:', originalPath);
    process.exit(1);
  }
  
  if (!fs.existsSync(minimalPath)) {
    console.log('❌ 最小化版本不存在:', minimalPath);
    process.exit(1);
  }
  
  // 创建备份
  console.log('📦 创建备份:', backupPath);
  fs.copyFileSync(originalPath, backupPath);
  
  // 替换文件
  console.log('🔄 替换为最小化版本');
  fs.copyFileSync(minimalPath, originalPath);
  
  console.log('✅ 替换完成！');
  console.log('📄 备份文件:', backupPath);
  console.log('🧪 现在可以测试基本功能');
  
} catch (error) {
  console.log('❌ 替换失败:', error.message);
  process.exit(1);
}