"use strict";
/**
 * RCC v4.0 核心类型定义
 *
 * 统一的类型系统，确保整个项目的类型一致性
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
exports.TYPES_MODULE_VERSION = void 0;
// 模块版本信息
exports.TYPES_MODULE_VERSION = '4.0.0-alpha.2';
// 错误类型 - 从专用模块导入
__exportStar(require("./error"), exports);
//# sourceMappingURL=index.js.map