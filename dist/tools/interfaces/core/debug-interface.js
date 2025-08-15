"use strict";
/**
 * Debug系统接口定义
 *
 * 定义Debug系统的标准接口，包括调试记录、回放系统、性能分析等功能
 * 严格遵循模块边界，不依赖其他模块的具体实现
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordType = exports.DebugLevel = void 0;
/**
 * Debug级别枚举
 */
var DebugLevel;
(function (DebugLevel) {
    DebugLevel["TRACE"] = "trace";
    DebugLevel["DEBUG"] = "debug";
    DebugLevel["INFO"] = "info";
    DebugLevel["WARN"] = "warn";
    DebugLevel["ERROR"] = "error";
})(DebugLevel || (exports.DebugLevel = DebugLevel = {}));
/**
 * 记录类型枚举
 */
var RecordType;
(function (RecordType) {
    RecordType["REQUEST"] = "request";
    RecordType["RESPONSE"] = "response";
    RecordType["PIPELINE"] = "pipeline";
    RecordType["ERROR"] = "error";
    RecordType["PERFORMANCE"] = "performance";
    RecordType["SYSTEM"] = "system";
})(RecordType || (exports.RecordType = RecordType = {}));
