"use strict";
/**
 * 流水线自检集成验证
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationWorks = void 0;
exports.verifyIntegration = verifyIntegration;
var self_check_service_1 = require("../self-check.service");
var pipeline_manager_1 = require("../../pipeline/src/pipeline-manager");
// 验证自检服务和流水线管理器能够正确集成
function verifyIntegration() {
    try {
        var selfCheckService = new self_check_service_1.SelfCheckService();
        var pipelineManager = new pipeline_manager_1.PipelineManager();
        // 设置集成
        selfCheckService.setPipelineManager(pipelineManager);
        // 验证基本功能
        var stats = pipelineManager.getStatistics();
        return true;
    }
    catch (_a) {
        return false;
    }
}
// 执行验证
var integrationWorks = verifyIntegration();
exports.integrationWorks = integrationWorks;
