"use strict";
/**
 * DEPRECATED: This router module has been replaced by src/modules/routing/
 *
 * ❌ DO NOT USE: This router module is deprecated
 * ✅ USE INSTEAD: src/modules/routing/core-router.ts - CoreRouter
 *
 * @deprecated Use CoreRouter from src/modules/routing/ instead
 * @see src/modules/routing/core-router.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTER_MODULE_VERSION = exports.CoreRouter = void 0;
// DEPRECATED: Use new routing module
// export * from './config';
// export * from './routing';
// export { FlowController } from './flow-control';
// export { LoadBalancer } from './load-balancing';
// Re-export the new CoreRouter for compatibility
var routing_1 = require("../modules/routing");
Object.defineProperty(exports, "CoreRouter", { enumerable: true, get: function () { return routing_1.CoreRouter; } });
// 模块版本信息
exports.ROUTER_MODULE_VERSION = '4.0.0-alpha.2';
//# sourceMappingURL=index.js.map