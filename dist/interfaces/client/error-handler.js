"use strict";
/**
 * 错误处理接口定义
 *
 * 定义统一的错误处理接口，确保零静默失败
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RCCError = void 0;
/**
 * RCC错误基类
 */
class RCCError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'RCCError';
        this.code = code;
        this.details = details;
    }
}
exports.RCCError = RCCError;
//# sourceMappingURL=error-handler.js.map