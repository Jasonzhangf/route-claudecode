#!/usr/bin/env node

/**
 * LMStudio 验证系统启动脚本
 * 简化的入口点，用于快速启动完整的LMStudio验证流程
 * @author Jason Zhang
 * @version v3.0
 */

import { LMStudioMasterRunner } from './test/functional/test-lmstudio-master-runner.js';

console.log('🚀 启动 LMStudio 完整验证系统...');
console.log('=====================================\n');

const masterRunner = new LMStudioMasterRunner();

try {
  await masterRunner.runMasterValidation();
  
  console.log('\n🎉 LMStudio 验证系统执行完成!');
  console.log('请查看生成的报告了解详细结果。');
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ LMStudio 验证系统执行失败:', error.message);
  console.error('请检查错误日志获取更多信息。');
  
  process.exit(1);
}