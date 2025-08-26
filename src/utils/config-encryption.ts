/**
 * Configuration Encryption Utility
 *
 * 安全的配置文件加密和解密工具
 * 符合RCC v4.0安全要求
 *
 * @author Jason Zhang
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { JQJsonHandler } from './jq-json-handler';

/**
 * 加密配置接口
 */
export interface EncryptionConfig {
  algorithm: string;
  keyDerivation: {
    algorithm: string;
    iterations: number;
    saltLength: number;
    keyLength: number;
  };
  encryptedFields: string[];
}

/**
 * 加密结果接口
 */
export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  authTag: string;
}

/**
 * 配置加密管理器
 */
export class ConfigEncryptionManager {
  private readonly config: EncryptionConfig;
  private masterKey: Buffer | null = null;

  constructor(config: EncryptionConfig) {
    this.config = config;
  }

  /**
   * 初始化主密钥
   */
  async initializeMasterKey(masterKeySource?: string): Promise<void> {
    const masterKeyString = masterKeySource || process.env.RCC_MASTER_KEY || this.generateMasterKey();

    if (!masterKeyString) {
      throw new Error('Master key not provided. Set RCC_MASTER_KEY environment variable.');
    }

    // 验证主密钥格式
    if (masterKeyString.length < 32) {
      throw new Error('Master key must be at least 32 characters long');
    }

    this.masterKey = Buffer.from(masterKeyString, 'utf8');
    console.log('🔐 配置加密管理器已初始化');
  }

  /**
   * 生成新的主密钥
   */
  private generateMasterKey(): string {
    const key = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ 生成了新的主密钥，请保存到环境变量RCC_MASTER_KEY中:');
    console.warn(`export RCC_MASTER_KEY="${key}"`);
    return key;
  }

  /**
   * 派生加密密钥
   */
  private deriveKey(salt: Buffer): Buffer {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    return crypto.pbkdf2Sync(
      this.masterKey,
      salt,
      this.config.keyDerivation.iterations,
      this.config.keyDerivation.keyLength,
      'sha256'
    );
  }

  /**
   * 加密敏感数据
   */
  encrypt(plaintext: string): EncryptedData {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    // 生成随机盐和IV
    const salt = crypto.randomBytes(this.config.keyDerivation.saltLength);
    const iv = crypto.randomBytes(12); // GCM推荐12字节IV

    // 派生加密密钥
    const key = this.deriveKey(salt);

    // 创建加密器
    const cipher = crypto.createCipheriv(this.config.algorithm, key, iv) as crypto.CipherGCM;

    // 加密数据
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    return {
      data: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * 解密敏感数据
   */
  decrypt(encryptedData: EncryptedData): string {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    try {
      // 解析加密数据
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');

      // 派生解密密钥
      const key = this.deriveKey(salt);

      // 创建解密器
      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      // 解密数据
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`解密失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 判断字段是否需要加密
   */
  private shouldEncryptField(fieldPath: string): boolean {
    return this.config.encryptedFields.some(pattern => {
      // 支持简单的通配符匹配
      const regex = new RegExp(pattern.replace('*', '.*'), 'i');
      return regex.test(fieldPath);
    });
  }

  /**
   * 递归加密配置对象中的敏感字段
   */
  encryptConfigObject(obj: any, prefix: string = ''): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.shouldEncryptField(prefix) ? this.encrypt(obj) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => this.encryptConfigObject(item, `${prefix}[${index}]`));
    }

    if (typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        result[key] = this.encryptConfigObject(value, fieldPath);
      }
      return result;
    }

    return obj;
  }

  /**
   * 递归解密配置对象中的加密字段
   */
  decryptConfigObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // 检查是否为加密数据对象
    if (typeof obj === 'object' && obj.data && obj.iv && obj.salt && obj.authTag) {
      try {
        return this.decrypt(obj as EncryptedData);
      } catch (error) {
        console.warn('⚠️ 解密配置字段失败:', error instanceof Error ? error.message : 'Unknown error');
        return '[DECRYPTION_FAILED]';
      }
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.decryptConfigObject(item));
    }

    if (typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.decryptConfigObject(value);
      }
      return result;
    }

    return obj;
  }

  /**
   * 安全地保存加密配置文件
   */
  async saveEncryptedConfig(configPath: string, config: any): Promise<void> {
    // 加密敏感字段
    const encryptedConfig = this.encryptConfigObject(config);

    // 添加加密元数据
    const configWithMetadata = {
      ...encryptedConfig,
      _encryption: {
        version: '4.0.0',
        algorithm: this.config.algorithm,
        encrypted: true,
        timestamp: new Date().toISOString(),
      },
    };

    // 确保目录存在
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 安全地写入文件
    const tempPath = `${configPath}.tmp`;
    fs.writeFileSync(tempPath, JQJsonHandler.stringifyJson(configWithMetadata, true), {
      mode: 0o600, // 只有所有者可读写
    });

    // 原子性地替换文件
    fs.renameSync(tempPath, configPath);

    console.log(`🔒 加密配置已保存到: ${configPath}`);
  }

  /**
   * 安全地加载加密配置文件
   */
  async loadEncryptedConfig(configPath: string): Promise<any> {
    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }

    // 检查文件权限
    const stats = fs.statSync(configPath);
    if ((stats.mode & 0o077) !== 0) {
      console.warn(`⚠️ 配置文件权限过于宽松: ${configPath}`);
    }

    // 读取配置文件
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    // 检查是否为加密配置
    if (!config._encryption || !config._encryption.encrypted) {
      console.log('📄 加载未加密配置文件');
      return config;
    }

    // 解密配置
    console.log('🔓 解密配置文件...');
    const decryptedConfig = this.decryptConfigObject(config);

    // 移除加密元数据
    delete decryptedConfig._encryption;

    return decryptedConfig;
  }

  /**
   * 验证配置完整性
   */
  validateConfigIntegrity(config: any): boolean {
    try {
      // 基本结构验证
      if (!config || typeof config !== 'object') {
        return false;
      }

      // 检查是否有解密失败的字段
      const configString = JQJsonHandler.stringifyJson(config);
      if (configString.includes('[DECRYPTION_FAILED]')) {
        console.error('❌ 配置包含解密失败的字段');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ 配置验证失败:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * 清理内存中的敏感数据
   */
  cleanup(): void {
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }
    console.log('🧹 配置加密管理器已清理');
  }
}

/**
 * 配置工厂类
 */
export class SecureConfigManager {
  private encryptionManager: ConfigEncryptionManager;

  constructor() {
    const encryptionConfig: EncryptionConfig = {
      algorithm: 'aes-256-gcm',
      keyDerivation: {
        algorithm: 'pbkdf2',
        iterations: 100000,
        saltLength: 32,
        keyLength: 32,
      },
      encryptedFields: [
        'apiKey',
        'secret',
        'token',
        'password',
        'privateKey',
        'connection.apiKey',
        'providers.*.connection.apiKey',
        '*.apiKey',
      ],
    };

    this.encryptionManager = new ConfigEncryptionManager(encryptionConfig);
  }

  /**
   * 初始化安全配置管理器
   */
  async initialize(): Promise<void> {
    await this.encryptionManager.initializeMasterKey();
  }

  /**
   * 加载安全配置
   */
  async loadSecureConfig(configPath: string): Promise<any> {
    return await this.encryptionManager.loadEncryptedConfig(configPath);
  }

  /**
   * 保存安全配置
   */
  async saveSecureConfig(configPath: string, config: any): Promise<void> {
    await this.encryptionManager.saveEncryptedConfig(configPath, config);
  }

  /**
   * 验证配置
   */
  validateConfig(config: any): boolean {
    return this.encryptionManager.validateConfigIntegrity(config);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.encryptionManager.cleanup();
  }
}
