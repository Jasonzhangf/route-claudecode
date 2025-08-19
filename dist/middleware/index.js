"use strict";
/**
 * 中间件模块入口文件
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
exports.MIDDLEWARE_MODULE_VERSION = void 0;
__exportStar(require("./middleware-factory"), exports);
__exportStar(require("./auth"), exports);
__exportStar(require("./cors"), exports);
__exportStar(require("./logger"), exports);
__exportStar(require("./error-handler"), exports);
__exportStar(require("./rate-limiter"), exports);
__exportStar(require("./validation"), exports);
// 其他中间件文件不存在，注释掉
// export * from './security-middleware';
// export * from './compression-middleware';
// export * from './cache-middleware';
// export * from './request-parser-middleware';
// export * from './response-formatter-middleware';
// export * from './monitoring-middleware';
// export * from './tracing-middleware';
// 模块版本信息
exports.MIDDLEWARE_MODULE_VERSION = '4.0.0-alpha.2';
//# sourceMappingURL=index.js.map