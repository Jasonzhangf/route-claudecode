#!/usr/bin/env node

/**
 * RCC v4.0 CLI入口点
 * 
 * 支持双模式运行：
 * - Server模式: rcc4 start (独立服务器)
 * - Client模式: rcc4 code (透明代理)
 * 
 * @author Jason Zhang
 */

import { program } from 'commander';
import { VERSION } from './index';

async function main(): Promise<void> {
  program
    .name('rcc4')
    .description('Route Claude Code v4.0 - 高性能多AI提供商路由系统')
    .version(VERSION);

  // start命令 - 启动服务器模式
  program
    .command('start')
    .description('启动RCC服务器 (阻塞式运行)')
    .option('-p, --port <port>', '服务器端口', '3456')
    .option('-h, --host <host>', '服务器主机', 'localhost')
    .option('-c, --config <path>', '配置文件路径')
    .option('-d, --debug', '启用调试模式')
    .action(async (options) => {
      console.log('🚀 Starting RCC v4.0 Server...');
      console.log('Options:', options);
      // TODO: 实现服务器启动逻辑
      process.exit(0);
    });

  // code命令 - 启动客户端模式
  program
    .command('code')
    .description('启动Claude Code并透明代理到RCC')
    .option('-p, --port <port>', 'RCC服务器端口', '3456')
    .option('--auto-start', '自动启动服务器如果未运行')
    .action(async (options) => {
      console.log('🔗 Starting Claude Code with RCC proxy...');
      console.log('Options:', options);
      // TODO: 实现客户端代理逻辑
      process.exit(0);
    });

  // status命令 - 查看状态
  program
    .command('status')
    .description('查看RCC服务器状态')
    .option('-p, --port <port>', '服务器端口', '3456')
    .action(async (options) => {
      console.log('📊 Checking RCC v4.0 Status...');
      console.log('Options:', options);
      // TODO: 实现状态检查逻辑
      process.exit(0);
    });

  // stop命令 - 停止服务器
  program
    .command('stop')
    .description('停止RCC服务器')
    .option('-p, --port <port>', '服务器端口', '3456')
    .action(async (options) => {
      console.log('🛑 Stopping RCC v4.0 Server...');
      console.log('Options:', options);
      // TODO: 实现停止服务器逻辑
      process.exit(0);
    });

  // config命令 - 配置管理
  program
    .command('config')
    .description('配置管理命令')
    .option('--list', '列出所有配置')
    .option('--validate', '验证配置文件')
    .option('--reset', '重置为默认配置')
    .action(async (options) => {
      console.log('⚙️  Managing RCC v4.0 Configuration...');
      console.log('Options:', options);
      // TODO: 实现配置管理逻辑
      process.exit(0);
    });

  // 解析命令行参数
  await program.parseAsync(process.argv);
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n👋 RCC v4.0 shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 RCC v4.0 received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// 运行主程序
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ CLI Error:', error);
    process.exit(1);
  });
}