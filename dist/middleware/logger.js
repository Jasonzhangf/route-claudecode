"use strict";
/**
 * 日志中间件
 *
 * 记录HTTP请求和响应信息
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
exports.logger = logger;
// import { IMiddlewareFunction } from '../interfaces/core/middleware-interface';
const jq_json_handler_1 = require("../utils/jq-json-handler");
/**
 * 日志级别
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * 创建日志中间件
 */
function logger(options = {}) {
    const { level = LogLevel.INFO, format = 'simple', includeHeaders = false, includeBody = false, excludePaths = ['/health', '/status'], } = options;
    return (req, res, next) => {
        // 检查是否应该排除此路径
        if (excludePaths.some(path => req.url.startsWith(path))) {
            return next();
        }
        const startTime = Date.now();
        // 保存原始next函数，以便在响应时记录
        const originalNext = next;
        const enhancedNext = (error) => {
            if (error) {
                logError(req, error, startTime);
            }
            else {
                logRequest(req, res, startTime);
            }
            originalNext(error);
        };
        enhancedNext();
    };
    function logRequest(req, res, startTime) {
        if (level < LogLevel.INFO)
            return;
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode || 200;
        switch (format) {
            case 'simple':
                console.log(`${req.method} ${req.url} ${statusCode} ${duration}ms`);
                break;
            case 'detailed':
                console.log(`[${new Date().toISOString()}] ${req.id} ${req.method} ${req.url} ${statusCode} ${duration}ms`);
                if (includeHeaders) {
                    console.log(`  Headers: ${jq_json_handler_1.JQJsonHandler.stringifyJson(req.headers)}`);
                }
                if (includeBody && req.body) {
                    console.log(`  Body: ${jq_json_handler_1.JQJsonHandler.stringifyJson(req.body)}`);
                }
                break;
            case 'json':
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    requestId: req.id,
                    method: req.method,
                    url: req.url,
                    statusCode,
                    duration,
                    userAgent: req.headers['user-agent'],
                    ...(includeHeaders && { headers: req.headers }),
                    ...(includeBody && req.body && { body: req.body }),
                };
                console.log(jq_json_handler_1.JQJsonHandler.stringifyJson(logEntry, true));
                break;
        }
    }
    function logError(req, error, startTime) {
        if (level < LogLevel.ERROR)
            return;
        const duration = Date.now() - startTime;
        switch (format) {
            case 'simple':
                console.error(`ERROR ${req.method} ${req.url} ${duration}ms - ${error.message}`);
                break;
            case 'detailed':
            case 'json':
                const errorEntry = {
                    timestamp: new Date().toISOString(),
                    level: 'ERROR',
                    requestId: req.id,
                    method: req.method,
                    url: req.url,
                    duration,
                    error: {
                        message: error.message,
                        stack: error.stack,
                    },
                };
                console.error(jq_json_handler_1.JQJsonHandler.stringifyJson(errorEntry));
                break;
        }
    }
}
//# sourceMappingURL=logger.js.map