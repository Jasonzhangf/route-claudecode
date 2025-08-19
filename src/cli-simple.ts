#!/usr/bin/env node

/**
 * RCC v4.0 简化CLI - 模块化重构版本
 */

import { CLICommands } from './cli-commands';
import { CLIUtils } from './cli-utils';

/**
 * 主函数 - CLI应用入口点
 */
async function main(): Promise<void> {
  // 设置全局错误处理
  CLIUtils.setupGlobalErrorHandlers();

  // 显示启动横幅
  CLIUtils.displayBanner();

  // 设置CLI程序和命令
  const program = CLICommands.setupProgram();

  // 解析命令行参数
  await program.parseAsync(process.argv);
}

// 运行主程序
if (require.main === module) {
  main().catch(error => {
    console.error('❌ CLI Error:', error);
    CLIUtils.cleanExit(1);
  });
}

export { main };
