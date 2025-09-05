"use strict";
/**
 * 路由模块入口文件
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
exports.routesModuleAdapter = exports.ROUTES_MODULE_VERSION = void 0;
__exportStar(require("./route-manager"), exports);
__exportStar(require("./health-routes"), exports);
__exportStar(require("./debug-routes"), exports);
__exportStar(require("./admin-routes"), exports);
__exportStar(require("./pipeline-routes"), exports);
__exportStar(require("./provider-routes"), exports);
__exportStar(require("./config-routes"), exports);
__exportStar(require("./metrics-routes"), exports);
__exportStar(require("./auth-routes"), exports);
__exportStar(require("./proxy-routes"), exports);
__exportStar(require("./webhook-routes"), exports);
__exportStar(require("./param-validator"), exports);
__exportStar(require("./route-matcher"), exports);
// 模块版本信息
exports.ROUTES_MODULE_VERSION = '4.0.0-alpha.2';
// ModuleInterface implementation for architecture compliance
const base_module_1 = require("../interfaces/module/base-module");
exports.routesModuleAdapter = new base_module_1.SimpleModuleAdapter('routes-module', 'Routes Module', base_module_1.ModuleType.ROUTER, exports.ROUTES_MODULE_VERSION);
//# sourceMappingURL=index.js.map