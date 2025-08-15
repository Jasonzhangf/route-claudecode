"use strict";
/**
 * RCC v4.0 核心类型定义
 *
 * 统一的类型系统，确保整个项目的类型一致性
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RCCError = void 0;
// 错误类型
class RCCError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.name = 'RCCError';
        this.code = code;
        this.details = details;
    }
}
exports.RCCError = RCCError;
//# sourceMappingURL=index.js.map