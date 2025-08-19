"use strict";
/**
 * Debug系统模块入口文件
 *
 * @author Jason Zhang
 * @author RCC v4.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PIPELINE_DEBUG_CONFIG = exports.PipelineDebugSystemFactory = exports.RequestTestSystem = exports.PipelineDebugSystem = exports.DebugManagerImpl = exports.DEBUG_MODULE_VERSION = void 0;
// 模块版本信息
exports.DEBUG_MODULE_VERSION = '4.0.0-alpha.2';
// 原有Debug系统
var debug_manager_1 = require("./debug-manager");
Object.defineProperty(exports, "DebugManagerImpl", { enumerable: true, get: function () { return debug_manager_1.DebugManagerImpl; } });
// 新增: Pipeline调试系统
var pipeline_debug_system_1 = require("./pipeline-debug-system");
Object.defineProperty(exports, "PipelineDebugSystem", { enumerable: true, get: function () { return pipeline_debug_system_1.PipelineDebugSystem; } });
var request_test_system_1 = require("./request-test-system");
Object.defineProperty(exports, "RequestTestSystem", { enumerable: true, get: function () { return request_test_system_1.RequestTestSystem; } });
/**
 * Pipeline调试系统工厂
 *
 * 简化Pipeline调试系统的创建和配置
 */
class PipelineDebugSystemFactory {
    /**
     * 创建完整的Pipeline调试系统
     */
    static createDebugSystem(pipelineManager, pipelineRouter, loadBalancer) {
        const pipelineDebug = new PipelineDebugSystem(pipelineManager);
        const requestTest = new RequestTestSystem(pipelineManager, pipelineRouter, loadBalancer);
        return {
            pipelineDebug,
            requestTest
        };
    }
    /**
     * 创建基础Pipeline调试系统
     */
    static createPipelineDebugSystem(pipelineManager) {
        return new PipelineDebugSystem(pipelineManager);
    }
    /**
     * 创建请求测试系统
     */
    static createRequestTestSystem(pipelineManager, pipelineRouter, loadBalancer) {
        return new RequestTestSystem(pipelineManager, pipelineRouter, loadBalancer);
    }
}
exports.PipelineDebugSystemFactory = PipelineDebugSystemFactory;
/**
 * 默认Pipeline调试配置
 */
exports.DEFAULT_PIPELINE_DEBUG_CONFIG = {
    enableInitializationCheck: true,
    enableRequestTesting: true,
    enableLayerDiagnostics: true,
    logLevel: 'info'
};
//# sourceMappingURL=index.js.map