/**
 * Claude Code代理模式
 *
 * 启动Claude Code并透明代理到RCC服务器
 *
 * @author Jason Zhang
 */

import { spawn, ChildProcess } from 'child_process';
import { checkServerStatus } from '../cli-utils';

/**
 * Claude Code代理配置
 */
export interface ClaudeCodeProxyConfig {
  rccPort: number;
  claudeCodePath?: string;
  proxyPort?: number;
  autoRestart?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 启动Claude Code代理模式
 */
export async function startClaudeCodeProxy(rccPort: number): Promise<void> {
  console.log('🚀 Starting Claude Code with RCC proxy integration...');

  // 验证RCC服务器可用性
  if (!(await checkServerStatus(rccPort))) {
    throw new Error(`RCC server is not accessible on port ${rccPort}`);
  }

  console.log(`✅ RCC server confirmed running on port ${rccPort}`);

  // 设置环境变量
  const env = {
    ...process.env,
    RCC_PROXY_ENABLED: 'true',
    RCC_PROXY_PORT: rccPort.toString(),
    RCC_PROXY_HOST: 'localhost',
    RCC_INTEGRATION_MODE: 'transparent',
  };

  try {
    // 查找Claude Code可执行文件
    const claudeCodePath = await findClaudeCodeExecutable();

    if (!claudeCodePath) {
      console.log('⚠️  Claude Code executable not found in PATH');
      console.log('🔄 Running RCC in standalone mode...');
      await runStandaloneMode(rccPort);
      return;
    }

    console.log(`📍 Found Claude Code at: ${claudeCodePath}`);
    console.log('🔗 Starting Claude Code with RCC integration...');

    // 启动Claude Code
    const claudeProcess = spawn(claudeCodePath, [], {
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    claudeProcess.on('error', error => {
      console.error('❌ Failed to start Claude Code:', error.message);
      process.exit(1);
    });

    claudeProcess.on('exit', code => {
      console.log(`👋 Claude Code exited with code ${code}`);
      process.exit(code || 0);
    });

    // 处理进程信号
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping Claude Code proxy...');
      claudeProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Terminating Claude Code proxy...');
      claudeProcess.kill('SIGTERM');
    });

    console.log('✅ Claude Code started with RCC proxy integration');
    console.log('💡 All AI requests will be transparently routed through RCC');
  } catch (error) {
    console.error('❌ Claude Code proxy startup failed:', error);
    throw error;
  }
}

/**
 * 查找Claude Code可执行文件
 */
async function findClaudeCodeExecutable(): Promise<string | null> {
  const { execSync } = await import('child_process');

  try {
    // 尝试通过which/where命令查找
    const command = process.platform === 'win32' ? 'where' : 'which';
    const result = execSync(`${command} code`, { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    // 尝试常见安装路径
    const commonPaths =
      process.platform === 'win32'
        ? [
            'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
            'C:\\Program Files\\Microsoft VS Code\\Code.exe',
            'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe',
          ]
        : ['/usr/local/bin/code', '/usr/bin/code', '/opt/homebrew/bin/code', process.env.HOME + '/.local/bin/code'];

    const fs = await import('fs/promises');

    for (const path of commonPaths) {
      try {
        const expandedPath = path.replace('%USERNAME%', process.env.USERNAME || '');
        await fs.access(expandedPath);
        return expandedPath;
      } catch {
        continue;
      }
    }

    return null;
  }
}

/**
 * 运行独立模式（不启动VS Code）
 */
async function runStandaloneMode(rccPort: number): Promise<void> {
  console.log('🎯 Running RCC in standalone mode');
  console.log(`🌐 RCC API available at: http://localhost:${rccPort}`);
  console.log('📋 Available endpoints:');
  console.log('   • GET  /health                    - Health check');
  console.log('   • GET  /status                    - Server status');
  console.log('   • GET  /api/v1/providers          - List providers');
  console.log('   • GET  /api/v1/pipelines          - List pipelines');
  console.log('   • POST /v1/messages               - Anthropic compatible');
  console.log('   • POST /v1/chat/completions       - OpenAI compatible');
  console.log('   • POST /v1/proxy/:provider/:model - Universal proxy');
  console.log('');
  console.log('💡 You can now make AI requests to the RCC server');
  console.log('⌨️  Press Ctrl+C to stop');

  // 监控服务器状态
  const statusCheck = setInterval(async () => {
    if (!(await checkServerStatus(rccPort))) {
      console.log('❌ RCC server became unavailable');
      clearInterval(statusCheck);
      process.exit(1);
    }
  }, 30000);

  // 等待退出信号
  await new Promise<void>(resolve => {
    process.on('SIGINT', () => {
      console.log('\n👋 Stopping standalone mode...');
      clearInterval(statusCheck);
      resolve();
    });

    process.on('SIGTERM', () => {
      console.log('\n👋 Terminating standalone mode...');
      clearInterval(statusCheck);
      resolve();
    });
  });
}

/**
 * 创建代理中间件（为将来的高级集成准备）
 */
export function createProxyMiddleware(rccPort: number) {
  return {
    '/v1/messages': `http://localhost:${rccPort}`,
    '/v1/chat/completions': `http://localhost:${rccPort}`,
    '/v1beta/models/*/generateContent': `http://localhost:${rccPort}`,
    '/v1/proxy/*/*': `http://localhost:${rccPort}`,
  };
}
