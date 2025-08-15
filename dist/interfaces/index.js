"use strict";
/**
 * RCC v4.0 核心接口定义 - 主导出文件
 *
 * 定义整个系统的标准接口，确保模块间的严格契约
 * 避免名称冲突，只导出最核心的接口
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolBuilder = exports.MessageBuilder = exports.StandardResponseBuilder = exports.StandardRequestBuilder = void 0;
var request_1 = require("./standard/request");
Object.defineProperty(exports, "StandardRequestBuilder", { enumerable: true, get: function () { return request_1.StandardRequestBuilder; } });
var response_1 = require("./standard/response");
Object.defineProperty(exports, "StandardResponseBuilder", { enumerable: true, get: function () { return response_1.StandardResponseBuilder; } });
var message_1 = require("./standard/message");
Object.defineProperty(exports, "MessageBuilder", { enumerable: true, get: function () { return message_1.MessageBuilder; } });
var tool_1 = require("./standard/tool");
Object.defineProperty(exports, "ToolBuilder", { enumerable: true, get: function () { return tool_1.ToolBuilder; } });
//# sourceMappingURL=index.js.map