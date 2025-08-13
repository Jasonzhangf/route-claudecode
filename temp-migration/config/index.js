"use strict";
/**
 * Configuration Management System
 * Zero-hardcoding configuration management with explicit error handling
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
exports.default = exports.testingConfig = exports.productionConfig = exports.developmentConfig = exports.setGlobalConfigurationManager = exports.getGlobalConfigurationManager = exports.createConfigurationManager = exports.ZeroHardcodingConfigurationManager = exports.ExternalConfigurationLoader = exports.ConfigValidator = void 0;
// Export all configuration types and interfaces
__exportStar(require("../src/config/types.js"), exports);
__exportStar(require("../src/config/errors.js"), exports);
// Export configuration management classes
var validator_js_1 = require("../src/config/validator.js");
Object.defineProperty(exports, "ConfigValidator", { enumerable: true, get: function () { return validator_js_1.ConfigValidator; } });
var loader_js_1 = require("../src/config/loader.js");
Object.defineProperty(exports, "ExternalConfigurationLoader", { enumerable: true, get: function () { return loader_js_1.ExternalConfigurationLoader; } });
var manager_js_1 = require("../src/config/manager.js");
Object.defineProperty(exports, "ZeroHardcodingConfigurationManager", { enumerable: true, get: function () { return manager_js_1.ZeroHardcodingConfigurationManager; } });
Object.defineProperty(exports, "createConfigurationManager", { enumerable: true, get: function () { return manager_js_1.createConfigurationManager; } });
Object.defineProperty(exports, "getGlobalConfigurationManager", { enumerable: true, get: function () { return manager_js_1.getGlobalConfigurationManager; } });
Object.defineProperty(exports, "setGlobalConfigurationManager", { enumerable: true, get: function () { return manager_js_1.setGlobalConfigurationManager; } });
// Export environment-specific configurations
var index_js_1 = require("./development/index.js");
Object.defineProperty(exports, "developmentConfig", { enumerable: true, get: function () { return index_js_1.developmentConfig; } });
var index_js_2 = require("./production/index.js");
Object.defineProperty(exports, "productionConfig", { enumerable: true, get: function () { return index_js_2.productionConfig; } });
var index_js_3 = require("./testing/index.js");
Object.defineProperty(exports, "testingConfig", { enumerable: true, get: function () { return index_js_3.testingConfig; } });
// Re-export the main configuration manager as default
var manager_js_2 = require("../src/config/manager.js");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return manager_js_2.ZeroHardcodingConfigurationManager; } });
//# sourceMappingURL=index.js.map