/**
 * CLI Utils - 通用工具函数和常量
 */

export class CLIUtils {
  /**
   * 设置全局错误处理
   */
  static setupGlobalErrorHandlers(): void {
    // 未捕获异常处理
    process.on('uncaughtException', error => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    // 未处理的Promise拒绝
    process.on('unhandledRejection', reason => {
      console.error('❌ Unhandled Rejection:', reason);
      process.exit(1);
    });
  }

  /**
   * 生成唯一的请求ID
   */
  static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 格式化时间戳
   */
  static formatTimestamp(timestamp?: Date): string {
    return (timestamp || new Date()).toISOString();
  }

  /**
   * 安全的JSON解析
   */
  static safeJsonParse(jsonString: string): any | null {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('❌ JSON parse error:', (error as Error).message);
      return null;
    }
  }

  /**
   * 检查端口是否有效
   */
  static isValidPort(port: string | number): boolean {
    const portNum = typeof port === 'string' ? parseInt(port) : port;
    return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
  }

  /**
   * 格式化字节大小
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 显示启动横幅
   */
  static displayBanner(): void {
    console.log('');
    console.log('🚀 Route Claude Code v4.0');
    console.log('   高性能多AI提供商路由系统');
    console.log('');
  }

  /**
   * 显示调试信息
   */
  static displayDebugInfo(data: any, label?: string): void {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${label || 'Debug'}:`, JSON.stringify(data, null, 2));
    }
  }

  /**
   * 睡眠/延迟函数
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重试执行函数
   */
  static async retry<T>(fn: () => Promise<T>, maxRetries: number = 3, delay: number = 1000): Promise<T> {
    let lastError: Error;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (i === maxRetries) {
          throw lastError;
        }

        console.log(`⚠️  Attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
        delay *= 2; // 指数退避
      }
    }

    throw lastError!;
  }

  /**
   * 验证环境变量
   */
  static validateEnvironment(): boolean {
    const required = ['NODE_ENV'];
    const missing = required.filter(env => !process.env[env]);

    if (missing.length > 0) {
      console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * 清理进程退出
   */
  static cleanExit(code: number = 0, message?: string): void {
    if (message) {
      console.log(message);
    }

    process.exit(code);
  }

  /**
   * 获取系统信息
   */
  static getSystemInfo(): any {
    const os = require('os');

    return {
      platform: os.platform(),
      arch: os.arch(),
      node: process.version,
      memory: {
        total: this.formatBytes(os.totalmem()),
        free: this.formatBytes(os.freemem()),
      },
      cpu: os.cpus().length,
    };
  }

  /**
   * 检查依赖是否可用
   */
  static async checkDependencies(): Promise<boolean> {
    const dependencies = ['node', 'npm'];

    for (const dep of dependencies) {
      try {
        const { spawn } = require('child_process');
        await new Promise((resolve, reject) => {
          const proc = spawn(dep, ['--version'], { stdio: 'ignore' });
          proc.on('close', (code: number) => {
            code === 0 ? resolve(true) : reject(new Error(`${dep} not found`));
          });
          proc.on('error', reject);
        });
      } catch (error) {
        console.error(`❌ Missing dependency: ${dep}`);
        return false;
      }
    }

    return true;
  }
}
