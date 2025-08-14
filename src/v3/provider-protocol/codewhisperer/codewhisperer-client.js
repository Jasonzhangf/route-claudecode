/**
 * CodeWhisperer Client - V3.0 Six-Layer Architecture
 * 直接与AWS CodeWhisperer API通信，基于demo3的KiroApiService实现
 * 支持多账号管理、工具调用、流式响应和回放系统集成
 * 
 * Project owner: Jason Zhang
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

const KIRO_CONSTANTS = {
    REFRESH_URL: 'https://prod.{{region}}.auth.desktop.kiro.dev/refreshToken',
    REFRESH_IDC_URL: 'https://oidc.{{region}}.amazonaws.com/token',
    BASE_URL: 'https://codewhisperer.{{region}}.amazonaws.com/generateAssistantResponse',
    AMAZON_Q_URL: 'https://codewhisperer.{{region}}.amazonaws.com/SendMessageStreaming',
    DEFAULT_MODEL_NAME: 'kiro-claude-sonnet-4-20250514',
    AXIOS_TIMEOUT: 120000, // 2分钟超时
    USER_AGENT: 'KiroIDE',
    CONTENT_TYPE_JSON: 'application/json',
    ACCEPT_JSON: 'application/json',
    AUTH_METHOD_SOCIAL: 'social',
    CHAT_TRIGGER_TYPE_MANUAL: 'MANUAL',
    ORIGIN_AI_EDITOR: 'AI_EDITOR',
};

const KIRO_AUTH_TOKEN_FILE = "kiro-auth-token.json";

export class CodewhispererClient {
    constructor(config, id) {
        this.id = id;
        this.config = config;
        this.isInitialized = false;
        this.timeout = config.timeout || 120000;
        this.retryDelays = config.retryDelays || [1000, 2000, 4000];
        this.replayIntegration = true;

        // 认证配置
        this.credPath = config.authentication?.credPath || path.join(os.homedir(), ".aws", "sso", "cache");
        this.credsBase64 = config.authentication?.credsBase64;
        this.credsFilePath = config.authentication?.credsFilePath;
        
        // Base64凭证解码
        if (this.credsBase64) {
            try {
                const decodedCreds = Buffer.from(this.credsBase64, 'base64').toString('utf8');
                const parsedCreds = JSON.parse(decodedCreds);
                this.base64Creds = parsedCreds;
                console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Successfully decoded Base64 credentials`);
            } catch (error) {
                console.error(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Failed to parse Base64 credentials: ${error.message}`);
            }
        }

        this.axiosInstance = null;
        
        console.log(`[V3:${process.env.RCC_PORT}] Initialized CodeWhisperer client: ${this.id}`, {
            endpoint: config.endpoint || 'https://codewhisperer.us-east-1.amazonaws.com',
            timeout: this.timeout,
            retryDelays: this.retryDelays,
            replayIntegration: this.replayIntegration
        });
    }

    /**
     * 初始化客户端
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Initializing...`);
        
        await this.initializeAuth();
        
        this.axiosInstance = axios.create({
            timeout: this.timeout,
            headers: {
                'Content-Type': KIRO_CONSTANTS.CONTENT_TYPE_JSON,
                'Accept': KIRO_CONSTANTS.ACCEPT_JSON,
            }
        });
        
        this.isInitialized = true;
        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Initialization completed`);
    }

    /**
     * 获取MAC地址SHA256哈希
     */
    async getMacAddressSha256() {
        const networkInterfaces = os.networkInterfaces();
        let macAddress = '';

        for (const interfaceName in networkInterfaces) {
            const networkInterface = networkInterfaces[interfaceName];
            for (const iface of networkInterface) {
                if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    macAddress = iface.mac;
                    break;
                }
            }
            if (macAddress) break;
        }

        if (!macAddress) {
            console.warn(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] 无法获取MAC地址，使用默认值`);
            macAddress = '00:00:00:00:00:00';
        }

        const sha256Hash = crypto.createHash('sha256').update(macAddress).digest('hex');
        return sha256Hash;
    }

    /**
     * 初始化认证
     */
    async initializeAuth(forceRefresh = false) {
        if (this.accessToken && !forceRefresh) {
            console.debug(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Access token already available`);
            return;
        }

        const loadCredentialsFromFile = async (filePath) => {
            try {
                const fileContent = await fs.readFile(filePath, 'utf8');
                return JSON.parse(fileContent);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Failed to read credential file ${filePath}: ${error.message}`);
                }
                return null;
            }
        };

        const saveCredentialsToFile = async (filePath, newData) => {
            try {
                let existingData = {};
                try {
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    existingData = JSON.parse(fileContent);
                } catch (readError) {
                    // 文件不存在或读取失败，继续使用空对象
                }
                const mergedData = { ...existingData, ...newData };
                await fs.writeFile(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
                console.info(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Updated token file: ${filePath}`);
            } catch (error) {
                console.error(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Failed to write token to file ${filePath}: ${error.message}`);
            }
        };

        try {
            let mergedCredentials = {};

            // 优先级1: Base64凭证
            if (this.base64Creds) {
                Object.assign(mergedCredentials, this.base64Creds);
                console.info(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Loaded credentials from Base64`);
                this.base64Creds = null;
            }

            // 优先级2: 指定文件路径
            const credPath = this.credsFilePath || path.join(this.credPath, KIRO_AUTH_TOKEN_FILE);
            if (credPath) {
                const credentialsFromFile = await loadCredentialsFromFile(credPath);
                if (credentialsFromFile) {
                    Object.assign(mergedCredentials, credentialsFromFile);
                    console.info(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Loaded credentials from ${credPath}`);
                }
            }

            // 优先级3: 目录扫描
            try {
                const files = await fs.readdir(this.credPath);
                for (const file of files) {
                    if (file.endsWith('.json') && file !== KIRO_AUTH_TOKEN_FILE) {
                        const filePath = path.join(this.credPath, file);
                        const credentials = await loadCredentialsFromFile(filePath);
                        if (credentials) {
                            Object.assign(mergedCredentials, credentials);
                            console.debug(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Loaded credentials from ${file}`);
                        }
                    }
                }
            } catch (error) {
                console.warn(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Could not read credential directory: ${error.message}`);
            }

            // 应用凭证
            this.accessToken = this.accessToken || mergedCredentials.accessToken;
            this.refreshToken = this.refreshToken || mergedCredentials.refreshToken;
            this.clientId = this.clientId || mergedCredentials.clientId;
            this.clientSecret = this.clientSecret || mergedCredentials.clientSecret;
            this.authMethod = this.authMethod || mergedCredentials.authMethod;
            this.expiresAt = this.expiresAt || mergedCredentials.expiresAt;
            this.profileArn = this.profileArn || mergedCredentials.profileArn;
            this.region = this.region || mergedCredentials.region;

            // 设置默认区域
            if (!this.region) {
                console.warn(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Region not found, using default us-east-1`);
                this.region = 'us-east-1';
            }

            // 设置URL
            this.refreshUrl = KIRO_CONSTANTS.REFRESH_URL.replace("{{region}}", this.region);
            this.refreshIDCUrl = KIRO_CONSTANTS.REFRESH_IDC_URL.replace("{{region}}", this.region);
            this.baseUrl = KIRO_CONSTANTS.BASE_URL.replace("{{region}}", this.region);
            this.amazonQUrl = KIRO_CONSTANTS.AMAZON_Q_URL.replace("{{region}}", this.region);

        } catch (error) {
            console.warn(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Auth initialization error: ${error.message}`);
        }

        // 刷新token
        if (forceRefresh || (!this.accessToken && this.refreshToken)) {
            if (!this.refreshToken) {
                throw new Error('No refresh token available to refresh access token.');
            }

            try {
                const requestBody = {
                    refreshToken: this.refreshToken,
                };

                let refreshUrl = this.refreshUrl;
                if (this.authMethod !== KIRO_CONSTANTS.AUTH_METHOD_SOCIAL) {
                    refreshUrl = this.refreshIDCUrl;
                    requestBody.clientId = this.clientId;
                    requestBody.clientSecret = this.clientSecret;
                    requestBody.grantType = 'refresh_token';
                }

                const response = await this.axiosInstance.post(refreshUrl, requestBody);

                if (response.data && response.data.accessToken) {
                    this.accessToken = response.data.accessToken;
                    this.refreshToken = response.data.refreshToken;
                    this.profileArn = response.data.profileArn;
                    const expiresIn = response.data.expiresIn;
                    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
                    this.expiresAt = expiresAt;

                    console.info(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Access token refreshed successfully`);

                    // 更新token文件
                    const tokenFilePath = path.join(this.credPath, KIRO_AUTH_TOKEN_FILE);
                    const updatedTokenData = {
                        accessToken: this.accessToken,
                        refreshToken: this.refreshToken,
                        expiresAt: expiresAt,
                    };
                    if (this.profileArn) {
                        updatedTokenData.profileArn = this.profileArn;
                    }
                    await saveCredentialsToFile(tokenFilePath, updatedTokenData);
                } else {
                    throw new Error('Invalid refresh response: Missing accessToken');
                }
            } catch (error) {
                console.error(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Token refresh failed: ${error.message}`);
                throw new Error(`Token refresh failed: ${error.message}`);
            }
        }

        if (!this.accessToken) {
            throw new Error('No access token available after initialization and refresh attempts.');
        }
    }

    /**
     * 健康检查
     */
    async healthCheck() {
        const startTime = Date.now();
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // 简单的认证检查
            if (!this.accessToken) {
                return {
                    healthy: false,
                    error: 'No access token available',
                    responseTime: Date.now() - startTime
                };
            }

            return {
                healthy: true,
                responseTime: Date.now() - startTime,
                region: this.region,
                authenticated: !!this.accessToken
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                responseTime: Date.now() - startTime
            };
        }
    }

    /**
     * 发送请求到CodeWhisperer API
     */
    async sendRequest(request, context = {}) {
        const startTime = Date.now();
        const { requestId } = context;

        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Sending request ${requestId}`);

        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // 确定使用哪个URL (amazonq模型使用amazonQUrl)
            const model = request.conversationState?.currentMessage?.userInputMessage?.modelId || 'default';
            const requestUrl = model.startsWith('amazonq') ? this.amazonQUrl : this.baseUrl;

            const headers = {
                'Authorization': `Bearer ${this.accessToken}`,
                'amz-sdk-invocation-id': `${uuidv4()}`,
            };

            // 添加profileArn（如果是social认证）
            if (this.authMethod === KIRO_CONSTANTS.AUTH_METHOD_SOCIAL && this.profileArn) {
                request.profileArn = this.profileArn;
            }

            // 详细记录请求信息用于调试
            console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] DEBUG REQUEST DETAILS:`);
            console.log(`  - URL: ${requestUrl}`);
            console.log(`  - Headers:`, JSON.stringify(headers, null, 2));
            console.log(`  - Request Body:`, JSON.stringify(request, null, 2));
            console.log(`  - Auth Method: ${this.authMethod}`);
            console.log(`  - Profile ARN: ${this.profileArn}`);
            console.log(`  - Region: ${this.region}`);

            const response = await this.axiosInstance.post(requestUrl, request, { headers });

            // 回放系统集成
            if (this.replayIntegration && context.replayCapture) {
                context.replayCapture.provider = {
                    request: request,
                    response: response.data,
                    metadata: {
                        clientId: this.id,
                        url: requestUrl,
                        duration: Date.now() - startTime
                    }
                };
            }

            console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Request ${requestId} completed in ${Date.now() - startTime}ms`);
            return response.data;

        } catch (error) {
            // 详细记录错误信息用于调试
            console.error(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] DEBUG ERROR DETAILS:`);
            console.error(`  - Status: ${error.response?.status}`);
            console.error(`  - Status Text: ${error.response?.statusText}`);
            console.error(`  - Response Headers:`, error.response?.headers);
            console.error(`  - Response Data:`, error.response?.data);
            console.error(`  - Request URL: ${error.config?.url}`);
            console.error(`  - Request Method: ${error.config?.method}`);
            console.error(`  - Request Headers:`, error.config?.headers);
            
            // 处理403错误 - 尝试刷新token
            if (error.response?.status === 403) {
                console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Received 403, attempting token refresh for ${requestId}`);
                try {
                    await this.initializeAuth(true);
                    return this.sendRequest(request, context); // 重试一次
                } catch (refreshError) {
                    console.error(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Token refresh failed: ${refreshError.message}`);
                    throw refreshError;
                }
            }

            console.error(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Request ${requestId} failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * 发送流式请求
     * 注意：CodeWhisperer实际上不支持真正的流式，这里返回普通响应
     */
    async *sendStreamRequest(request, context = {}) {
        const { requestId } = context;
        
        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Sending stream request ${requestId}`);

        try {
            // CodeWhisperer不支持真正的流式，所以我们发送普通请求然后模拟流式返回
            const response = await this.sendRequest(request, context);
            
            // 直接yield响应，让transformer层处理流式格式转换
            yield response;

        } catch (error) {
            console.error(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:${this.id}] Stream request ${requestId} failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * 获取支持的模型列表
     */
    getSupportedModels() {
        return [
            'claude-sonnet-4-20250514',
            'claude-3-7-sonnet-20250219', 
            'amazonq-claude-sonnet-4-20250514',
            'amazonq-claude-3-7-sonnet-20250219'
        ];
    }

    /**
     * 获取客户端配置
     */
    getConfig() {
        return {
            id: this.id,
            endpoint: this.baseUrl,
            timeout: this.timeout,
            retryDelays: this.retryDelays,
            region: this.region,
            authenticated: !!this.accessToken
        };
    }

    /**
     * 获取Provider信息
     */
    get provider() {
        return 'codewhisperer';
    }

    /**
     * 获取端点信息
     */
    get endpoint() {
        return this.baseUrl;
    }
}