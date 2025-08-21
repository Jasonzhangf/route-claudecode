"use strict";
/**
 * 客户端模块入口文件
 *
 * 提供完整的客户端功能，包括CLI、会话管理、HTTP处理和代理功能
 *
 * @author Jason Zhang
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = exports.HttpError = exports.SessionError = exports.ClientModule = exports.CLIENT_MODULE_VERSION = void 0;
exports.createClientModule = createClientModule;
exports.createClient = createClient;
// 导出客户端功能
__exportStar(require("./session"), exports);
__exportStar(require("./http"), exports);
__exportStar(require("./client-manager"), exports);
// 模块版本信息
exports.CLIENT_MODULE_VERSION = '4.0.0-alpha.2';
// 导入核心类
const session_1 = require("./session");
Object.defineProperty(exports, "SessionError", { enumerable: true, get: function () { return session_1.SessionError; } });
const http_1 = require("./http");
Object.defineProperty(exports, "HttpError", { enumerable: true, get: function () { return http_1.HttpError; } });
const client_manager_1 = require("./client-manager");
const error_handler_1 = require("../interfaces/client/error-handler");
/**
 * 客户端模块主类
 */
class ClientModule {
    constructor(config, errorHandler) {
        this.config = config;
        this.errorHandler = errorHandler;
        this.version = exports.CLIENT_MODULE_VERSION;
        this.initialized = false;
        // 初始化组件
        this.sessionManager = new session_1.SessionManager(this.errorHandler);
        this.httpClient = new http_1.HttpClient(this.sessionManager, this.errorHandler);
        this.proxy = new client_manager_1.ClientProxy();
        this.envExporter = new client_manager_1.EnvironmentExporter();
    }
    /**
     * 初始化模块
     */
    async initialize() {
        if (this.initialized) {
            throw new Error('Client module is already initialized');
        }
        try {
            // 初始化子模块
            await this.initializeSubModules();
            this.initialized = true;
            console.log(`🚀 Client Module ${this.version} initialized successfully`);
        }
        catch (error) {
            this.errorHandler.handleError(error, {
                module: 'client',
                operation: 'initialize',
                timestamp: new Date(),
            });
            throw error;
        }
    }
    /**
     * 初始化子模块
     */
    async initializeSubModules() {
        // 设置事件监听
        this.sessionManager.on('session_created', sessionId => {
            console.log(`📱 Session created: ${sessionId}`);
        });
        this.httpClient.on('request', data => {
            if (this.config.enableDebug) {
                console.log(`🌐 HTTP Request: ${data.method} ${data.url} - ${data.success ? 'Success' : 'Failed'}`);
            }
        });
        this.proxy.on('started', data => {
            console.log(`🔌 Proxy started: ${JSON.stringify(data.config)}`);
        });
        this.proxy.on('error', error => {
            this.errorHandler.handleError(error, {
                module: 'proxy',
                operation: 'proxy_operation',
                timestamp: new Date(),
            });
        });
    }
    /**
     * 执行CLI命令
     */
    async executeCommand(command, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        // 构建命令行参数
        const argv = [process.argv[0], process.argv[1], command];
        // 添加选项
        for (const [key, value] of Object.entries(options)) {
            if (typeof value === 'boolean' && value) {
                argv.push(`--${key}`);
            }
            else if (value !== undefined && value !== null) {
                argv.push(`--${key}`, String(value));
            }
        }
        // CLI功能已迁移到主CLI模块，这里暂时简化实现
        console.log('CLI command execution:', argv);
    }
    /**
     * 创建新会话
     */
    createSession(config = {}) {
        if (!this.initialized) {
            throw new Error('Client module must be initialized before creating sessions');
        }
        const sessionConfig = {
            ...this.config.sessionConfig,
            ...config,
            serverHost: config.serverHost || this.config.serverHost,
            serverPort: config.serverPort || this.config.serverPort,
        };
        return this.sessionManager.createSession(sessionConfig);
    }
    /**
     * 获取HTTP客户端
     */
    getHttpClient() {
        if (!this.initialized) {
            throw new Error('Client module must be initialized before accessing HTTP client');
        }
        return this.httpClient;
    }
    /**
     * 获取代理实例
     */
    getProxy() {
        if (!this.initialized) {
            throw new Error('Client module must be initialized before accessing proxy');
        }
        return this.proxy;
    }
    /**
     * 获取会话管理器
     */
    getSessionManager() {
        if (!this.initialized) {
            throw new Error('Client module must be initialized before accessing session manager');
        }
        return this.sessionManager;
    }
    /**
     * 获取环境导出器
     */
    getEnvironmentExporter() {
        return this.envExporter;
    }
    /**
     * 获取模块统计信息
     */
    getStats() {
        if (!this.initialized) {
            throw new Error('Client module must be initialized before accessing stats');
        }
        return {
            sessions: this.sessionManager.getStats(),
            http: this.httpClient.getStats(),
            proxy: this.proxy.getProxyStatus(),
        };
    }
    /**
     * 清理模块资源
     */
    async cleanup() {
        if (!this.initialized)
            return;
        try {
            // 清理会话
            await this.sessionManager.cleanup();
            // 清理HTTP缓存
            await this.httpClient.clearCache();
            // 停止代理
            if (this.proxy.isConnected()) {
                await this.proxy.stop();
            }
            this.initialized = false;
            console.log('🧹 Client module cleaned up successfully');
        }
        catch (error) {
            this.errorHandler.handleError(error, {
                module: 'client',
                operation: 'cleanup',
                timestamp: new Date(),
            });
            throw error;
        }
    }
}
exports.ClientModule = ClientModule;
/**
 * 客户端工厂函数
 */
function createClientModule(config = {}, errorHandler) {
    return new ClientModule(config, errorHandler);
}
/**
 * 快速创建客户端实例的工厂函数
 */
async function createClient(config = {}) {
    // 创建默认错误处理器
    const defaultErrorHandler = {
        handleError: (error, context) => {
            console.error(`[${context?.module || 'unknown'}] ${error.message}`);
            if (context?.additionalData) {
                console.error('Context:', context.additionalData);
            }
        },
        formatError: error => error.message,
        logError: (error, context) => {
            console.error(`Error logged: ${error.message}`, context);
        },
        reportToUser: error => {
            console.error(`User Error: ${error.message}`);
        },
        createError: (message, code, details) => {
            return new error_handler_1.RCCError(message, code, details);
        },
    };
    const client = createClientModule(config, config.errorHandler || defaultErrorHandler);
    await client.initialize();
    return client;
}
// 导出CLI错误类
var error_1 = require("../types/error");
Object.defineProperty(exports, "CLIError", { enumerable: true, get: function () { return error_1.CLIError; } });
//# sourceMappingURL=index.js.map