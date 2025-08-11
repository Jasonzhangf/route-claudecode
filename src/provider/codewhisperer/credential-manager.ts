/**
 * CodeWhisperer 多源凭据管理器
 * 基于 AIClient-2-API 的灵活凭据加载策略
 * 项目所有者: Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promises as fsPromises } from 'fs';
import { 
  TokenData, 
  CredentialConfig, 
  CredentialSource, 
  KIRO_AUTH_TOKEN_FILE,
  DEFAULT_CREDENTIAL_CONFIG 
} from './enhanced-auth-config';

export class CredentialManager {
  private config: CredentialConfig;
  private logger?: any;

  constructor(config: CredentialConfig = {}, logger?: any) {
    this.config = { ...DEFAULT_CREDENTIAL_CONFIG, ...config };
    this.logger = logger;
  }

  /**
   * 按优先级加载凭据
   */
  async loadCredentials(): Promise<TokenData | null> {
    const mergedCredentials: Partial<TokenData> = {};
    
    for (const source of this.config.priorityOrder || []) {
      try {
        const credentials = await this.loadFromSource(source);
        if (credentials) {
          Object.assign(mergedCredentials, credentials);
          this.log('info', `Successfully loaded credentials from ${source}`);
        }
      } catch (error) {
        this.log('warn', `Failed to load credentials from ${source}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }

    // 验证必需字段
    if (!mergedCredentials.accessToken && !mergedCredentials.refreshToken) {
      this.log('error', 'No valid credentials found from any source');
      return null;
    }

    return mergedCredentials as TokenData;
  }

  /**
   * 从指定源加载凭据
   */
  private async loadFromSource(source: CredentialSource): Promise<TokenData | null> {
    switch (source) {
      case CredentialSource.BASE64:
        return this.loadFromBase64();
      
      case CredentialSource.FILE_PATH:
        return this.loadFromFilePath();
      
      case CredentialSource.DIRECTORY_SCAN:
        return this.loadFromDirectoryScan();
      
      case CredentialSource.ENVIRONMENT:
        return this.loadFromEnvironment();
      
      case CredentialSource.DEFAULT_PATH:
        return this.loadFromDefaultPath();
      
      default:
        return null;
    }
  }

  /**
   * 从 Base64 编码字符串加载凭据
   */
  private loadFromBase64(): TokenData | null {
    if (!this.config.base64Creds) {
      return null;
    }

    try {
      const decodedCreds = Buffer.from(this.config.base64Creds, 'base64').toString('utf8');
      const parsedCreds = JSON.parse(decodedCreds);
      this.log('debug', 'Successfully decoded Base64 credentials');
      return parsedCreds;
    } catch (error) {
      this.log('error', `Failed to parse Base64 credentials: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 从指定文件路径加载凭据
   */
  private async loadFromFilePath(): Promise<TokenData | null> {
    if (!this.config.credsFilePath) {
      return null;
    }

    return this.loadCredentialsFromFile(this.config.credsFilePath);
  }

  /**
   * 从目录扫描加载凭据
   */
  private async loadFromDirectoryScan(): Promise<TokenData | null> {
    const dirPath = this.config.credsDirPath || path.join(os.homedir(), '.aws', 'sso', 'cache');
    
    if (!fs.existsSync(dirPath)) {
      this.log('debug', `Credentials directory not found: ${dirPath}`);
      return null;
    }

    try {
      const files = await fsPromises.readdir(dirPath);
      const mergedCredentials: Partial<TokenData> = {};
      
      for (const file of files) {
        if (file.endsWith('.json') && file !== KIRO_AUTH_TOKEN_FILE) {
          const filePath = path.join(dirPath, file);
          const credentials = await this.loadCredentialsFromFile(filePath);
          if (credentials) {
            Object.assign(mergedCredentials, credentials);
            this.log('debug', `Loaded credentials from ${file}`);
          }
        }
      }

      return Object.keys(mergedCredentials).length > 0 ? mergedCredentials as TokenData : null;
    } catch (error) {
      this.log('warn', `Could not scan credentials directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 从环境变量加载凭据
   */
  private loadFromEnvironment(): TokenData | null {
    const prefix = this.config.envPrefix || 'KIRO_';
    
    const envCredentials: Partial<TokenData> = {};
    
    const envMappings = {
      [`${prefix}ACCESS_TOKEN`]: 'accessToken',
      [`${prefix}REFRESH_TOKEN`]: 'refreshToken',
      [`${prefix}CLIENT_ID`]: 'clientId',
      [`${prefix}CLIENT_SECRET`]: 'clientSecret',
      [`${prefix}EXPIRES_AT`]: 'expiresAt',
      [`${prefix}PROFILE_ARN`]: 'profileArn',
      [`${prefix}REGION`]: 'region',
      [`${prefix}AUTH_METHOD`]: 'authMethod'
    };

    for (const [envKey, credKey] of Object.entries(envMappings)) {
      const envValue = process.env[envKey];
      if (envValue) {
        (envCredentials as any)[credKey] = envValue;
      }
    }

    if (Object.keys(envCredentials).length === 0) {
      return null;
    }

    this.log('debug', `Loaded ${Object.keys(envCredentials).length} credentials from environment variables`);
    return envCredentials as TokenData;
  }

  /**
   * 从默认路径加载凭据
   */
  private async loadFromDefaultPath(): Promise<TokenData | null> {
    const defaultPath = path.join(os.homedir(), '.aws', 'sso', 'cache', KIRO_AUTH_TOKEN_FILE);
    return this.loadCredentialsFromFile(defaultPath);
  }

  /**
   * 从文件加载凭据的通用方法
   */
  private async loadCredentialsFromFile(filePath: string): Promise<TokenData | null> {
    try {
      if (!fs.existsSync(filePath)) {
        this.log('debug', `Credential file not found: ${filePath}`);
        return null;
      }

      const fileContent = await fsPromises.readFile(filePath, 'utf8');
      const credentials = JSON.parse(fileContent);
      
      return credentials;
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        this.log('debug', `Credential file not found: ${filePath}`);
      } else if (error instanceof SyntaxError) {
        this.log('warn', `Failed to parse JSON from ${filePath}: ${error.message}`);
      } else {
        this.log('warn', `Failed to read credential file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    }
  }

  /**
   * 保存凭据到文件
   */
  async saveCredentialsToFile(filePath: string, newData: Partial<TokenData>): Promise<void> {
    try {
      let existingData: any = {};
      
      // 尝试读取现有数据
      try {
        if (fs.existsSync(filePath)) {
          const fileContent = await fsPromises.readFile(filePath, 'utf8');
          existingData = JSON.parse(fileContent);
        }
      } catch (readError) {
        this.log('debug', `Could not read existing file ${filePath}, creating new one`);
      }

      // 合并数据
      const mergedData = { ...existingData, ...newData };
      
      // 确保目录存在
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      
      // 保存文件
      await fsPromises.writeFile(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
      
      this.log('info', `Updated credential file: ${filePath}`);
    } catch (error) {
      this.log('error', `Failed to save credentials to file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 日志输出方法
   */
  private log(level: string, message: string): void {
    if (this.logger) {
      this.logger[level]?.(message);
    } else {
      console.log(`[CredentialManager] ${level.toUpperCase()}: ${message}`);
    }
  }
}