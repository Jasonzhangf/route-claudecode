/**
 * CLI工具函数
 *
 * 提供CLI命令需要的核心功能实现
 *
 * @author Jason Zhang
 */

import { getServerHost, getServerPort } from '../constants';
import { CLI_DEFAULTS } from '../constants/cli-defaults';

/**
 * 服务器状态检查结果
 */
export interface ServerStatus {
  running: boolean;
  host: string;
  port: number;
  version?: string;
  uptime?: number;
  pipelines?: number;
  providers?: number;
  lastCheck: string;
}

/**
 * 详细服务器状态
 */
export interface DetailedServerStatus extends ServerStatus {
  health: {
    overall: 'healthy' | 'unhealthy' | 'degraded';
    issues: string[];
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    averageResponseTime: number;
  };
  services: {
    pipelineManager: boolean;
    providerManager: boolean;
    configManager: boolean;
  };
}

/**
 * 检查服务器是否运行
 */
export async function checkServerStatus(port: number = getServerPort()): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`http://${getServerHost()}:${port}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * 获取服务器详细状态
 */
export async function getServerDetailedStatus(
  host: string = getServerHost(),
  port: number = getServerPort()
): Promise<DetailedServerStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`http://${host}:${port}/status`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();

    return {
      running: true,
      host,
      port,
      version: data.version,
      uptime: data.uptime,
      pipelines: data.activePipelines,
      providers: data.activeProviders,
      lastCheck: new Date().toISOString(),
      health: {
        overall: data.health?.overall || 'unknown',
        issues: data.health?.issues || [],
      },
      performance: {
        memoryUsage: data.performance?.memoryUsage || 0,
        cpuUsage: data.performance?.cpuUsage || 0,
        averageResponseTime: data.performance?.averageResponseTime || 0,
      },
      services: {
        pipelineManager: data.services?.pipelineManager || false,
        providerManager: data.services?.providerManager || false,
        configManager: data.services?.configManager || false,
      },
    };
  } catch (error) {
    return {
      running: false,
      host,
      port,
      lastCheck: new Date().toISOString(),
      health: {
        overall: 'unhealthy',
        issues: [`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      },
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        averageResponseTime: 0,
      },
      services: {
        pipelineManager: false,
        providerManager: false,
        configManager: false,
      },
    };
  }
}

/**
 * 优雅停止服务器
 */
export async function gracefulStopServer(
  host: string = getServerHost(),
  port: number = getServerPort(),
  timeout: number = CLI_DEFAULTS.TIMEOUT
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout + 5000);

    const response = await fetch(`http://${host}:${port}/api/admin/shutdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-key-123', // 临时管理员密钥
      },
      body: JSON.stringify({ graceful: true, timeout }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Shutdown request failed with status ${response.status}`);
    }

    // 等待服务器停止
    for (let i = 0; i < timeout / 1000; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!(await checkServerStatus(port))) {
        return { success: true };
      }
    }

    return { success: false, error: 'Server did not stop within timeout' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 强制停止服务器
 */
export async function forceStopServer(
  host: string = getServerHost(),
  port: number = getServerPort()
): Promise<{ success: boolean; error?: string }> {
  try {
    // 尝试发送强制停止信号
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`http://${host}:${port}/api/admin/shutdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-key-123',
      },
      body: JSON.stringify({ graceful: false, force: true }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 即使请求失败也继续，因为可能是服务器已经停止

    // 等待确认服务器停止
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!(await checkServerStatus(port))) {
        return { success: true };
      }
    }

    // 如果仍然运行，尝试使用操作系统级别的停止方法
    return { success: false, error: 'Server is still running after force stop attempt' };
  } catch (error) {
    // 对于强制停止，连接错误可能意味着成功
    if (!(await checkServerStatus(port))) {
      return { success: true };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 显示服务器状态
 */
export function displayServerStatus(status: DetailedServerStatus, detailed: boolean = false): void {
  console.log('\n📊 RCC v4.0 Server Status:');
  console.log('═══════════════════════════════════════');

  // 基本状态
  const statusIcon = status.running ? '🟢' : '🔴';
  const statusText = status.running ? 'RUNNING' : 'STOPPED';
  console.log(`${statusIcon} Status: ${statusText}`);

  if (status.running) {
    console.log(`🌐 Address: ${status.host}:${status.port}`);
    if (status.version) console.log(`📦 Version: ${status.version}`);
    if (status.uptime) {
      const uptimeHours = Math.floor(status.uptime / 3600);
      const uptimeMinutes = Math.floor((status.uptime % 3600) / 60);
      console.log(`⏱️  Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
    }

    // 服务统计
    console.log('\n📈 Service Statistics:');
    console.log(`├─ Active Pipelines: ${status.pipelines || 0}`);
    console.log(`├─ Active Providers: ${status.providers || 0}`);
    console.log(`└─ Health: ${getHealthIcon(status.health.overall)} ${status.health.overall.toUpperCase()}`);

    if (status.health.issues.length > 0) {
      console.log('\n⚠️  Health Issues:');
      status.health.issues.forEach(issue => console.log(`   • ${issue}`));
    }

    if (detailed) {
      // 详细信息
      console.log('\n🔧 Services:');
      console.log(`├─ Pipeline Manager: ${status.services.pipelineManager ? '✅' : '❌'}`);
      console.log(`├─ Provider Manager: ${status.services.providerManager ? '✅' : '❌'}`);
      console.log(`└─ Config Manager: ${status.services.configManager ? '✅' : '❌'}`);

      console.log('\n🎯 Performance:');
      console.log(`├─ Memory Usage: ${(status.performance.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
      console.log(`├─ CPU Usage: ${status.performance.cpuUsage.toFixed(1)}%`);
      console.log(`└─ Avg Response Time: ${status.performance.averageResponseTime.toFixed(1)}ms`);
    }
  }

  console.log(`\n🕒 Last Check: ${new Date(status.lastCheck).toLocaleString()}`);
  console.log('═══════════════════════════════════════\n');
}

/**
 * 获取健康状态图标
 */
function getHealthIcon(health: string): string {
  switch (health) {
    case 'healthy':
      return '🟢';
    case 'degraded':
      return '🟡';
    case 'unhealthy':
      return '🔴';
    default:
      return '❓';
  }
}

/**
 * 格式化字节数
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
