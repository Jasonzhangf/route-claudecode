/**
 * CLI Config Manager - 处理配置文件加载和验证
 */

import * as fs from 'fs';
import * as path from 'path';
import { getServerPort, getServerHost } from './constants';

export interface CLIConfig {
  configVersion?: string;
  version?: string;
  server?: {
    port?: number;
    host?: string;
  };
  standardProviders?: Record<string, any>;
  serverCompatibilityProviders?: Record<string, any>;
}

export interface ConfigLoadResult {
  config: CLIConfig;
  configPath: string;
  source: 'specified' | 'auto-detected';
}

export interface ConfigSearchLocation {
  path: string;
  desc: string;
}

export class CLIConfigManager {
  private static readonly DEFAULT_CONFIG_LOCATIONS: ConfigSearchLocation[] = [
    { path: './config.json', desc: 'project root config' },
    { path: './config/config.json', desc: 'project config directory' },
    { path: path.join(process.env.HOME!, '.route-claudecode/config.json'), desc: 'user global config' },
    { path: path.join(process.env.HOME!, '.route-claudecode/config/config.json'), desc: 'user config directory' },
  ];

  /**
   * 加载配置文件
   * @param specifiedPath 指定的配置文件路径（可选）
   * @returns 配置加载结果
   */
  static async loadConfig(specifiedPath?: string): Promise<ConfigLoadResult> {
    let configPath = specifiedPath;
    let source: 'specified' | 'auto-detected' = 'specified';

    // 如果没有指定配置文件，查找默认配置
    if (!configPath) {
      console.log('🔍 No config file specified, searching for default config.json...');
      source = 'auto-detected';

      console.log('📂 Searching in order:');
      for (const { path: configFile, desc } of this.DEFAULT_CONFIG_LOCATIONS) {
        const exists = fs.existsSync(configFile);
        console.log(`   ${exists ? '✅' : '❌'} ${configFile} (${desc})`);
        if (exists && !configPath) {
          configPath = configFile;
        }
      }

      if (configPath) {
        console.log(`\n📄 Found and using: ${configPath}`);
      }
    } else {
      console.log(`📄 Using specified config: ${configPath}`);
    }

    if (!configPath) {
      throw new Error('CONFIG_NOT_FOUND');
    }

    if (!fs.existsSync(configPath)) {
      throw new Error(`CONFIG_FILE_NOT_EXISTS: ${configPath}`);
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`\n✅ Successfully loaded config: ${configPath}`);

      // 验证和显示配置详情
      this.displayConfigSummary(config);

      return {
        config,
        configPath,
        source,
      };
    } catch (error) {
      throw new Error(`CONFIG_PARSE_ERROR: ${(error as Error).message}`);
    }
  }

  /**
   * 显示配置摘要信息
   */
  private static displayConfigSummary(config: CLIConfig): void {
    const standardProviders = config.standardProviders || {};
    const serverCompatibilityProviders = config.serverCompatibilityProviders || {};
    const allProviders = { ...standardProviders, ...serverCompatibilityProviders };
    const providerCount = Object.keys(allProviders).length;

    console.log(`📊 Configuration Summary:`);
    console.log(`   🔧 Providers: ${providerCount}`);
    console.log(
      `   🌐 Server: ${getServerHost(config.server?.host)}:${getServerPort(config.server?.port) || 'auto-detect'}`
    );
    console.log(`   📋 Version: ${config.configVersion || config.version || 'unknown'}`);

    if (providerCount > 0) {
      console.log(`   🚀 Available Providers:`);
      for (const [key, provider] of Object.entries(allProviders)) {
        const p = provider as any;
        const providerType = standardProviders[key] ? 'standard' : 'server-compatibility';
        console.log(
          `      - ${p.name || key} (${p.protocol || 'unknown'}) [${providerType}] - Priority: ${p.priority || 'N/A'}`
        );
      }
    } else {
      console.warn(`   ⚠️  No providers configured!`);
    }
  }

  /**
   * 获取所有Provider
   */
  static getAllProviders(config: CLIConfig): Record<string, any> {
    const standardProviders = config.standardProviders || {};
    const serverCompatibilityProviders = config.serverCompatibilityProviders || {};
    return { ...standardProviders, ...serverCompatibilityProviders };
  }

  /**
   * 解析服务器端口和主机
   */
  static resolveServerSettings(
    config: CLIConfig,
    cliPort?: string,
    cliHost?: string
  ): {
    port: number;
    host: string;
    portSource: string;
  } {
    const parsedCliPort = cliPort ? parseInt(cliPort) : null;
    const configPort = config.server?.port;
    const port = getServerPort(parsedCliPort || configPort);

    const configHost = config.server?.host;
    const host = getServerHost(cliHost || configHost);

    let portSource = 'default';
    if (parsedCliPort) {
      portSource = 'command line';
    } else if (configPort) {
      portSource = 'config file';
    }

    return { port, host, portSource };
  }

  /**
   * 显示配置错误信息和帮助
   */
  static displayConfigHelp(): void {
    console.error('\n❌ No configuration file found!');
    console.error('');
    console.error('🛠️  Quick Setup Options:');
    console.error('');
    console.error('1️⃣  Create a config file automatically:');
    console.error('   node create-config.js');
    console.error('');
    console.error('2️⃣  Use existing config file:');
    console.error('   rcc4 start --config /path/to/your/config.json --port 5506');
    console.error('');
    console.error('3️⃣  Expected default locations (in priority order):');
    this.DEFAULT_CONFIG_LOCATIONS.forEach((location, index) => {
      const priority =
        index === 0
          ? '(highest priority)'
          : index === this.DEFAULT_CONFIG_LOCATIONS.length - 1
            ? '(lowest priority)'
            : '';
      console.error(`   ${location.path.padEnd(45)} ${priority}`);
    });
    console.error('');
    console.error('📋 Example config.json structure:');
    console.error('   {');
    console.error('     "server": { "port": 5506, "host": "localhost" },');
    console.error('     "standardProviders": {');
    console.error('       "lmstudio": {');
    console.error('         "protocol": "openai",');
    console.error('         "connection": { "endpoint": "http://localhost:1234/v1/chat/completions" }');
    console.error('       }');
    console.error('     }');
    console.error('   }');
    console.error('');
    console.error('💡 For detailed setup: https://github.com/your-repo/rcc-v4-docs');
  }
}
