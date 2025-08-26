/**
 * Qwen OAuth2认证管理器
 * 处理多认证文件的创建、管理和轮询
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { secureLogger } from '../../utils/secure-logger';
import { JQJsonHandler } from '../../utils/jq-json-handler';
import { API_DEFAULTS } from '../../constants/api-defaults';
import { QWEN_AUTH_ERRORS } from '../../constants/error-messages';

export interface QwenAuthConfig {
  access_token: string;
  refresh_token: string;
  resource_url?: string;
  expires_at: number;
  created_at: string;
  account_index: number;
}

export class QwenAuthManager {
  private authDir: string;

  constructor() {
    this.authDir = path.join(os.homedir(), '.route-claudecode', 'auth');
  }

  /**
   * 启动OAuth2认证流程
   */
  async authenticate(index: number, options: { autoOpen?: boolean } = { autoOpen: true }): Promise<void> {
    console.log(`🔐 启动Qwen OAuth2认证 (账户 ${index})...`);

    try {
      // 确保认证目录存在
      await fs.mkdir(this.authDir, { recursive: true });

      // 动态导入qwen-code的OAuth2实现
      const { QwenOAuth2Client, generatePKCEPair, qwenOAuth2Events, QwenOAuth2Event } = 
        await this.loadQwenOAuth2();

      const client = new QwenOAuth2Client({ proxy: null });
      const { code_verifier, code_challenge } = generatePKCEPair();

      // 设置事件监听
      this.setupEventListeners(qwenOAuth2Events, QwenOAuth2Event);

      // 发起设备授权
      const deviceAuth = await client.requestDeviceAuthorization({
        scope: 'openid profile email model.completion',
        code_challenge,
        code_challenge_method: 'S256'
      });

      console.log('\n🌐 请访问以下链接进行授权:');
      console.log(`   ${deviceAuth.verification_uri_complete}`);
      console.log(`📱 用户代码: ${deviceAuth.user_code}`);
      console.log(`⏰ 过期时间: ${deviceAuth.expires_in}秒`);

      // 🚀 自动打开浏览器认证
      if (options.autoOpen !== false) {
        await this.attemptBrowserOpen(deviceAuth.verification_uri_complete);
      }

      // 轮询获取token
      const tokenData = await this.pollForToken(client, deviceAuth.device_code, code_verifier);

      // 保存认证文件
      await this.saveAuthFile(index, tokenData);

      console.log(`✅ Qwen认证完成！认证文件已保存: qwen-auth-${index}.json`);
      console.log(`💡 配置示例: "api_key": "qwen-auth-${index}"`);

    } catch (error) {
      console.error(`❌ Qwen认证失败:`, error.message);
      throw error;
    }
  }

  /**
   * 内置的简化OAuth2实现
   */
  private async loadQwenOAuth2(): Promise<any> {
    // 使用内置的简化OAuth2实现
    return {
      QwenOAuth2Client: this.createInlineOAuth2Client(),
      generatePKCEPair: this.generatePKCEPair.bind(this),
      qwenOAuth2Events: this.createEventEmitter(),
      QwenOAuth2Event: {
        AuthProgress: 'auth_progress',
        TokenReceived: 'token_received',
        AuthError: 'auth_error'
      }
    };
  }

  /**
   * 生成PKCE密钥对
   */
  private generatePKCEPair(): { code_verifier: string; code_challenge: string } {
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    return { code_verifier: codeVerifier, code_challenge: codeChallenge };
  }

  /**
   * 创建事件发射器
   */
  private createEventEmitter(): any {
    const { EventEmitter } = require('events');
    return new EventEmitter();
  }

  /**
   * 创建内联OAuth2客户端类
   */
  private createInlineOAuth2Client(): any {
    const self = this;
    
    return class QwenOAuth2Client {
      private options: any;

      constructor(options: any = {}) {
        this.options = {
          clientId: API_DEFAULTS.QWEN_OAUTH.CLIENT_ID,
          tokenUrl: API_DEFAULTS.QWEN_OAUTH.TOKEN_URL,
          deviceAuthUrl: API_DEFAULTS.QWEN_OAUTH.DEVICE_AUTH_URL,
          userAgent: API_DEFAULTS.QWEN_OAUTH.USER_AGENT,
          timeout: 30000,
          ...options
        };
      }

      async requestDeviceAuthorization(params: any): Promise<any> {
        console.log('🔄 正在请求设备授权...');
        
        const crypto = require('crypto');
        const requestParams = new URLSearchParams({
          client_id: this.options.clientId,
          scope: params.scope || API_DEFAULTS.QWEN_OAUTH.DEFAULT_SCOPE,
          code_challenge: params.code_challenge,
          code_challenge_method: params.code_challenge_method || API_DEFAULTS.QWEN_OAUTH.DEFAULT_CODE_CHALLENGE_METHOD
        });

        const response = await fetch(this.options.deviceAuthUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'x-request-id': crypto.randomUUID(),
            'User-Agent': this.options.userAgent
          },
          body: requestParams.toString()
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`设备授权请求失败: ${response.status} - ${errorText}`);
        }

        const authData = JQJsonHandler.parseJsonString(await response.text());
        console.log(`✅ 设备授权获取成功: ${authData.user_code}`);

        return {
          device_code: authData.device_code,
          user_code: authData.user_code,
          verification_uri: authData.verification_uri || API_DEFAULTS.QWEN_OAUTH.VERIFICATION_URI,
          verification_uri_complete: authData.verification_uri_complete,
          expires_in: authData.expires_in || API_DEFAULTS.QWEN_OAUTH.DEFAULT_EXPIRES_IN,
          interval: authData.interval || (API_DEFAULTS.QWEN_OAUTH.DEFAULT_INTERVAL / 1000)
        };
      }

      async pollDeviceToken(params: any): Promise<any> {
        const requestParams = new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: this.options.clientId,
          device_code: params.device_code,
          code_verifier: params.code_verifier
        });

        const response = await fetch(this.options.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: requestParams.toString()
        });

        const responseText = await response.text();
        
        if (!response.ok) {
          let errorData: any;
          
          if (responseText.trim()) {
            errorData = JQJsonHandler.parseJsonString(responseText);
          } else {
            throw new Error(`Token轮询失败: ${response.status}`);
          }

          const errorCode = errorData.error;

          if (errorCode === 'authorization_pending') {
            return { status: 'pending' };
          } else if (errorCode === 'slow_down') {
            return { status: 'pending', slowDown: true };
          } else if (errorCode === 'expired_token') {
            throw new Error('设备授权已过期，请重新开始认证流程');
          } else if (errorCode === 'access_denied') {
            throw new Error('用户拒绝了授权请求');
          } else {
            throw new Error(`OAuth2错误: ${errorCode} - ${errorData.error_description || errorCode}`);
          }
        }

        const tokenData = JQJsonHandler.parseJsonString(responseText);

        if (!tokenData.access_token) {
          throw new Error('无效的token响应: 缺少access_token');
        }

        console.log('✅ 访问令牌获取成功');

        return {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type || 'Bearer',
          expires_in: tokenData.expires_in || 3600,
          scope: tokenData.scope,
          resource_url: tokenData.resource_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        };
      }
    };
  }

  /**
   * 设置OAuth2事件监听
   */
  private setupEventListeners(qwenOAuth2Events: any, QwenOAuth2Event: any): void {
    qwenOAuth2Events.on(QwenOAuth2Event.AuthProgress, (status: string, message: string) => {
      const statusEmojis = {
        'polling': '🔄',
        'success': '✅',
        'error': '❌',
        'timeout': '⏰',
        'rate_limit': '🚫'
      };
      
      console.log(`${statusEmojis[status] || '📝'} [${status.toUpperCase()}] ${message}`);
    });
  }

  /**
   * 轮询获取token
   */
  private async pollForToken(client: any, deviceCode: string, codeVerifier: string): Promise<any> {
    console.log('\n🔄 开始token轮询...');
    
    let pollInterval: number = API_DEFAULTS.QWEN_OAUTH.POLL_INTERVAL_MIN; // 2秒间隔
    const maxAttempts = API_DEFAULTS.QWEN_OAUTH.MAX_POLL_ATTEMPTS; // 5分钟最大等待时间

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const tokenResponse = await client.pollDeviceToken({
          device_code: deviceCode,
          code_verifier: codeVerifier
        });

        // 检查是否成功获取token
        if (tokenResponse.access_token) {
          return {
            access_token: tokenResponse.access_token,
            refresh_token: tokenResponse.refresh_token,
            resource_url: tokenResponse.resource_url,
            expires_in: tokenResponse.expires_in
          };
        }

        // 处理pending状态
        if (tokenResponse.status === 'pending') {
          if (tokenResponse.slowDown) {
            pollInterval = Math.min(pollInterval * 1.5, API_DEFAULTS.QWEN_OAUTH.POLL_INTERVAL_MAX);
            console.log(`📢 服务器要求降低轮询频率，调整间隔为 ${pollInterval}ms`);
          }
          
          process.stdout.write('.');
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }

      } catch (error) {
        if (error.message.includes('authorization_pending')) {
          process.stdout.write('.');
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        if (error.message.includes('429')) {
          pollInterval = Math.min(pollInterval * 2, API_DEFAULTS.QWEN_OAUTH.POLL_INTERVAL_MAX);
          console.log(`🚫 遇到频率限制，增加间隔到 ${pollInterval}ms`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        throw error;
      }
    }

    throw new Error('认证超时，请重新尝试');
  }

  /**
   * 保存认证文件
   */
  private async saveAuthFile(index: number, tokenData: any): Promise<void> {
    const authFile = path.join(this.authDir, `qwen-auth-${index}.json`);
    
    const authConfig: QwenAuthConfig = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      resource_url: tokenData.resource_url,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      created_at: new Date().toISOString(),
      account_index: index
    };

    await fs.writeFile(authFile, JQJsonHandler.stringifyJson(authConfig, false));
    
    secureLogger.info('Qwen认证文件已保存', {
      authFile,
      accountIndex: index,
      hasResourceUrl: !!authConfig.resource_url
    });
  }

  /**
   * 列出现有认证文件
   */
  async listAuthFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.authDir);
      const qwenFiles = files.filter(f => f.startsWith('qwen-auth-') && f.endsWith('.json'));

      if (qwenFiles.length === 0) {
        console.log('📝 没有找到Qwen认证文件');
        console.log('💡 使用 "rcc4 auth qwen <序号>" 创建新的认证文件 (序号可以是任意数字)');
        return;
      }

      // 按序号排序
      const sortedFiles = qwenFiles.sort((a, b) => {
        const indexA = parseInt(a.match(/qwen-auth-(\d+)\.json/)?.[1] || '0');
        const indexB = parseInt(b.match(/qwen-auth-(\d+)\.json/)?.[1] || '0');
        return indexA - indexB;
      });

      console.log('📋 现有Qwen认证文件:');
      console.log('━'.repeat(50));

      const availableIndexes: string[] = [];

      for (const file of sortedFiles) {
        const match = file.match(/qwen-auth-(\d+)\.json/);
        if (match) {
          const index = match[1];
          availableIndexes.push(index);
          const filePath = path.join(this.authDir, file);
          
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const auth: QwenAuthConfig = JQJsonHandler.parseJsonString(content);
            const isExpired = Date.now() > auth.expires_at;
            const status = isExpired ? '❌ 已过期' : '✅ 有效';
            
            console.log(`📁 qwen-auth-${index}.json ${status}`);
            console.log(`   创建时间: ${auth.created_at}`);
            console.log(`   过期时间: ${new Date(auth.expires_at).toISOString()}`);
            if (auth.resource_url) {
              console.log(`   端点: ${auth.resource_url}`);
            }
            
            if (isExpired) {
              console.log(`   💡 刷新命令: rcc4 auth qwen ${index} --refresh`);
            }
            
          } catch (error) {
            console.log(`📁 qwen-auth-${index}.json ❌ 解析失败`);
          }
        }
      }

      console.log('━'.repeat(50));
      console.log('💡 配置示例:');
      console.log(`   "api_key": [${availableIndexes.map(i => `"qwen-auth-${i}"`).join(', ')}]`);
      console.log('💡 管理命令:');
      console.log(`   刷新token: rcc4 auth qwen <序号> --refresh`);
      console.log(`   删除文件: rcc4 auth qwen <序号> --remove`);

    } catch (error) {
      console.log('📝 认证目录不存在，使用 "rcc4 auth qwen <序号>" 创建认证文件');
    }
  }

  /**
   * 删除认证文件
   */
  async removeAuthFile(index: number): Promise<void> {
    const authFile = path.join(this.authDir, `qwen-auth-${index}.json`);
    
    try {
      await fs.unlink(authFile);
      console.log(`✅ 已删除认证文件: qwen-auth-${index}.json`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`❌ 认证文件不存在: qwen-auth-${index}.json`);
      } else {
        console.error(`❌ 删除认证文件失败:`, error.message);
      }
    }
  }

  /**
   * 获取现有认证文件的序号列表
   */
  async getAvailableAuthIndexes(): Promise<number[]> {
    try {
      const files = await fs.readdir(this.authDir);
      const qwenFiles = files.filter(f => f.startsWith('qwen-auth-') && f.endsWith('.json'));
      
      const indexes: number[] = [];
      for (const file of qwenFiles) {
        const match = file.match(/qwen-auth-(\d+)\.json/);
        if (match) {
          indexes.push(parseInt(match[1]));
        }
      }
      
      return indexes.sort((a, b) => a - b);
    } catch (error) {
      return [];
    }
  }

  /**
   * 获取下一个可用的序号
   */
  async getNextAvailableIndex(): Promise<number> {
    const existingIndexes = await this.getAvailableAuthIndexes();
    
    if (existingIndexes.length === 0) {
      return 1; // 如果没有文件，建议从1开始
    }
    
    // 找到最大序号并+1
    return Math.max(...existingIndexes) + 1;
  }

  /**
   * 验证序号是否已存在
   */
  async validateAuthIndex(index: number): Promise<{ exists: boolean; isValid?: boolean; isExpired?: boolean }> {
    try {
      const authFile = path.join(this.authDir, `qwen-auth-${index}.json`);
      const content = await fs.readFile(authFile, 'utf-8');
      const auth: QwenAuthConfig = JQJsonHandler.parseJsonString(content);
      const isExpired = Date.now() > auth.expires_at;
      
      return {
        exists: true,
        isValid: true,
        isExpired
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * 尝试自动打开浏览器进行OAuth2认证
   */
  private async attemptBrowserOpen(url: string): Promise<void> {
    try {
      secureLogger.info('尝试自动打开浏览器', { url: this.sanitizeUrl(url) });
      
      // 动态导入open模块
      const { default: open } = await import('open');
      
      // 尝试打开浏览器
      const childProcess = await open(url, { 
        wait: false,  // 不等待浏览器关闭
        newInstance: false  // 使用现有浏览器实例
      });
      
      // 添加错误处理
      if (childProcess) {
        childProcess.on('error', (error) => {
          secureLogger.warn('浏览器进程启动失败', { 
            error: error.message,
            fallback: '请手动访问链接'
          });
        });
      }
      
      secureLogger.info('浏览器已自动打开OAuth2授权页面');
      console.log('🌐 浏览器已自动打开授权页面');
      console.log('📋 如果浏览器未打开，请手动访问上述链接完成授权');
      
    } catch (error) {
      secureLogger.warn('自动打开浏览器失败，回退到手动模式', {
        error: error.message,
        platform: process.platform,
        hasDisplay: !!process.env.DISPLAY
      });
      
      console.log('⚠️  无法自动打开浏览器，请手动访问上述链接完成授权');
      console.log('💡 可能原因: 运行在无图形界面环境或缺少浏览器');
    }
  }

  /**
   * 清理URL用于日志记录（移除敏感参数）
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // 保留主要信息，隐藏用户代码
      return `${urlObj.origin}${urlObj.pathname}?user_code=***&client=${urlObj.searchParams.get('client')}`;
    } catch (error) {
      return 'OAuth2授权URL';
    }
  }

  /**
   * 刷新认证token
   */
  async refreshAuthFile(index: number): Promise<void> {
    const authFile = path.join(this.authDir, `qwen-auth-${index}.json`);
    
    try {
      const content = await fs.readFile(authFile, 'utf-8');
      const auth: QwenAuthConfig = JQJsonHandler.parseJsonString(content);

      console.log(`🔄 刷新认证文件: qwen-auth-${index}.json`);

      // 使用refresh_token获取新的access_token
      const response = await fetch(API_DEFAULTS.QWEN_OAUTH.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: auth.refresh_token,
          client_id: API_DEFAULTS.QWEN_OAUTH.CLIENT_ID
        })
      });

      if (!response.ok) {
        throw new Error(`Token刷新失败: ${response.status} ${response.statusText}`);
      }

      const tokenData = JQJsonHandler.parseJsonString(await response.text());
      
      // 更新认证文件
      auth.access_token = tokenData.access_token;
      auth.refresh_token = tokenData.refresh_token || auth.refresh_token;
      auth.resource_url = tokenData.resource_url || auth.resource_url;
      auth.expires_at = Date.now() + (tokenData.expires_in * 1000);

      await fs.writeFile(authFile, JQJsonHandler.stringifyJson(auth, false));
      
      console.log(`✅ 认证文件刷新成功: qwen-auth-${index}.json`);

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`❌ 认证文件不存在: qwen-auth-${index}.json`);
      } else {
        console.error(`❌ 刷新认证文件失败:`, error.message);
      }
    }
  }
}