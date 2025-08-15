"use strict";
/**
 * 服务器模块接口定义
 *
 * 定义HTTP服务器和Pipeline服务器的标准接口
 * 严格遵循模块边界，通过接口与其他模块通信
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPMethod = void 0;
/**
 * HTTP方法枚举
 */
var HTTPMethod;
(function (HTTPMethod) {
    HTTPMethod["GET"] = "GET";
    HTTPMethod["POST"] = "POST";
    HTTPMethod["PUT"] = "PUT";
    HTTPMethod["DELETE"] = "DELETE";
    HTTPMethod["PATCH"] = "PATCH";
    HTTPMethod["OPTIONS"] = "OPTIONS";
    HTTPMethod["HEAD"] = "HEAD";
})(HTTPMethod || (exports.HTTPMethod = HTTPMethod = {}));
