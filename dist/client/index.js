"use strict";
/**
 * 客户端模块入口文件
 *
 * 提供完整的客户端功能，包括CLI、会话管理、HTTP处理和代理功能
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientModuleAdapter = exports.CLIError = exports.HttpError = exports.SessionError = exports.ClientModule = exports.CLIENT_MODULE_VERSION = void 0;
exports.createClientModule = createClientModule;
exports.createClient = createClient;
// 模块版本信息
exports.CLIENT_MODULE_VERSION = '4.0.0-alpha.2';
// 导入核心类
const session_1 = require("./session");
Object.defineProperty(exports, "SessionError", { enumerable: true, get: function () { return session_1.SessionError; } });
const http_1 = require("./http");
Object.defineProperty(exports, "HttpError", { enumerable: true, get: function () { return http_1.HttpError; } });
const client_manager_1 = require("./client-manager");
const error_handler_1 = require("../interfaces/client/error-handler");
const jq_json_handler_1 = require("../utils/jq-json-handler");
/**
 * 客户端模块主类
 */
class ClientModule {
    constructor(config, errorHandler) {
        this.config = config;
        this.errorHandler = errorHandler;
        this.version = exports.CLIENT_MODULE_VERSION;
        this.initialized = false;
        // ModuleInterface implementation properties
        this.moduleId = 'client-module';
        this.moduleName = 'Client Module';
        this.moduleConnections = new Map();
        this.moduleMessageListeners = new Set();
        // 初始化组件
        this.sessionManager = new session_1.SessionManager(this.errorHandler);
        this.httpClient = new http_1.HttpClient(this.sessionManager, this.errorHandler);
        this.proxy = new client_manager_1.ClientProxy();
        this.envExporter = new client_manager_1.EnvironmentExporter();
        // 初始化ModuleInterface属性
        this.moduleStatus = {
            id: this.moduleId,
            name: this.moduleName,
            type: base_module_1.ModuleType.CLIENT,
            status: 'stopped',
            health: 'healthy'
        };
        this.moduleMetrics = {
            requestsProcessed: 0,
            averageProcessingTime: 0,
            errorRate: 0,
            memoryUsage: 0,
            cpuUsage: 0
        };
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
            console.log(`🔌 Proxy started: ${jq_json_handler_1.JQJsonHandler.stringifyJson(data.config)}`);
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
            // 清理ModuleInterface资源
            this.moduleConnections.clear();
            this.moduleMessageListeners.clear();
            this.initialized = false;
            this.moduleStatus.status = 'stopped';
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
    // ===== ModuleInterface Implementation =====
    getId() { return this.moduleId; }
    getName() { return this.moduleName; }
    getType() { return base_module_1.ModuleType.CLIENT; }
    getVersion() { return this.version; }
    getStatus() { return { ...this.moduleStatus }; }
    getMetrics() { return { ...this.moduleMetrics }; }
    async configure(config) {
        this.config = { ...this.config, ...config };
        this.moduleStatus.status = 'idle';
    }
    async start() {
        await this.initialize();
        this.moduleStatus.status = 'running';
    }
    async stop() {
        await this.cleanup();
        this.moduleStatus.status = 'stopped';
    }
    async process(input) {
        this.moduleMetrics.requestsProcessed++;
        this.moduleStatus.lastActivity = new Date();
        return input;
    }
    async reset() {
        this.moduleMetrics = {
            requestsProcessed: 0, averageProcessingTime: 0, errorRate: 0, memoryUsage: 0, cpuUsage: 0
        };
    }
    async healthCheck() {
        return { healthy: this.initialized, details: { status: this.moduleStatus } };
    }
    addConnection(module) { this.moduleConnections.set(module.getId(), module); }
    removeConnection(moduleId) { this.moduleConnections.delete(moduleId); }
    getConnection(moduleId) { return this.moduleConnections.get(moduleId); }
    getConnections() { return Array.from(this.moduleConnections.values()); }
    async sendToModule(targetModuleId, message, type) { return message; }
    async broadcastToModules(message, type) { }
    onModuleMessage(listener) {
        this.moduleMessageListeners.add(listener);
    }
    on(event, listener) { }
    removeAllListeners() { this.moduleMessageListeners.clear(); }
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
// ModuleInterface实现相关导入
const base_module_1 = require("../interfaces/module/base-module");
exports.clientModuleAdapter = new base_module_1.SimpleModuleAdapter('client-module', 'Client Module', base_module_1.ModuleType.CLIENT, exports.CLIENT_MODULE_VERSION);
//# sourceMappingURL=index.js.map