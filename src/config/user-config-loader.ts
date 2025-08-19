/**
 * 用户配置加载器
 * 从~/.route-claudecode/config/v4/目录加载配置文件
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface UserConfigPaths {
  configDir: string;
  providersDir: string;
  routingDir: string;
  securityDir: string;
}

export class UserConfigLoader {
  private readonly userConfigDir: string;

  constructor() {
    this.userConfigDir = join(homedir(), '.route-claudecode', 'config', 'v4');
  }

  /**
   * 获取用户配置目录路径
   */
  getConfigPaths(): UserConfigPaths {
    return {
      configDir: this.userConfigDir,
      providersDir: join(this.userConfigDir, 'providers'),
      routingDir: join(this.userConfigDir, 'routing'),
      securityDir: join(this.userConfigDir, 'security'),
    };
  }

  /**
   * 加载混合多Provider配置
   */
  loadHybridConfig(): any {
    const configPath = join(this.userConfigDir, 'hybrid-multi-provider-v3-5509.json');
    return this.loadJsonConfig(configPath);
  }

  /**
   * 加载Provider配置
   */
  loadProviderConfig(providerId: string): any {
    const configPath = join(this.userConfigDir, 'providers', `${providerId}.json5`);
    return this.loadJsonConfig(configPath);
  }

  /**
   * 加载LM Studio配置
   */
  loadLMStudioConfig(protocol: 'openai' | 'anthropic' = 'openai'): any {
    const configPath = join(this.userConfigDir, 'providers', `lmstudio-${protocol}.json5`);
    return this.loadJsonConfig(configPath);
  }

  /**
   * 加载测试端点配置
   */
  loadTestEndpointConfig(provider: string): any {
    const configPath = join(this.userConfigDir, `test-${provider}-endpoint.js`);
    if (!existsSync(configPath)) {
      throw new Error(`Test endpoint config not found: ${configPath}`);
    }

    // 对于JavaScript文件，我们需要动态require
    // 但出于安全考虑，这里只返回路径
    return { configPath };
  }

  /**
   * 检查配置文件是否存在
   */
  hasConfig(configName: string): boolean {
    const configPath = join(this.userConfigDir, configName);
    return existsSync(configPath);
  }

  /**
   * 列出可用的Provider配置
   */
  listProviderConfigs(): string[] {
    const providersDir = join(this.userConfigDir, 'providers');
    if (!existsSync(providersDir)) {
      return [];
    }

    try {
      const fs = require('fs');
      return fs
        .readdirSync(providersDir)
        .filter((file: string) => file.endsWith('.json5') || file.endsWith('.json'))
        .map((file: string) => file.replace(/\.(json5?|js)$/, ''));
    } catch (error) {
      console.warn('Failed to list provider configs:', error);
      return [];
    }
  }

  /**
   * 加载JSON配置文件
   */
  private loadJsonConfig(configPath: string): any {
    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    try {
      const content = readFileSync(configPath, 'utf8');

      // 处理JSON5格式（移除注释）
      if (configPath.endsWith('.json5')) {
        const json5 = require('json5');
        return json5.parse(content);
      } else {
        return JSON.parse(content);
      }
    } catch (error) {
      throw new Error(`Failed to parse configuration file ${configPath}: ${error.message}`);
    }
  }

  /**
   * 获取配置文件的完整路径
   */
  getConfigPath(configName: string): string {
    return join(this.userConfigDir, configName);
  }

  /**
   * 验证用户配置目录结构
   */
  validateConfigStructure(): { valid: boolean; missingDirs: string[] } {
    const requiredDirs = [
      this.userConfigDir,
      join(this.userConfigDir, 'providers'),
      join(this.userConfigDir, 'routing'),
      join(this.userConfigDir, 'security'),
    ];

    const missingDirs = requiredDirs.filter(dir => !existsSync(dir));

    return {
      valid: missingDirs.length === 0,
      missingDirs,
    };
  }

  /**
   * 创建用户配置目录结构
   */
  createConfigStructure(): void {
    const dirs = [
      this.userConfigDir,
      join(this.userConfigDir, 'providers'),
      join(this.userConfigDir, 'routing'),
      join(this.userConfigDir, 'security'),
    ];

    const fs = require('fs');
    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 获取当前测试命令和配置
   */
  getTestCommands(): { [key: string]: string } {
    return {
      // v3 全局命令
      rcc3: 'rcc3',

      // v4 本地命令
      rcc4: './dist/cli.js',

      // 测试脚本
      'test-hybrid': 'node test-hybrid-config.js',
      'validate-hybrid': 'node validate-hybrid-fallback-config.js',

      // 构建命令
      build: 'npm run build',
      test: 'npm test',
      lint: 'npm run lint',
    };
  }
}

// 导出单例实例
export const userConfigLoader = new UserConfigLoader();
export default UserConfigLoader;
