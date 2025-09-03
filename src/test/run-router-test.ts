/**
 * 路由器测试执行器
 * 简单的测试执行脚本
 */

import { PipelineTableLoader } from '../router/pipeline-table-loader';
import { PipelineRouter } from '../router/pipeline-router';
import * as path from 'path';
import * as fs from 'fs';

// 确保输出目录存在
const outputDir = './test-output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 检查可用的流水线表
const availableTables = PipelineTableLoader.listAvailablePipelineTables();
const targetConfig = 'qwen-iflow-mixed-v4-5511';

if (!availableTables.includes(targetConfig)) {
  const status = {
    status: 'pending',
    reason: '流水线表未生成',
    availableTables: availableTables,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'router-test-status.json'),
    JSON.stringify(status, null, 2)
  );
  
  // 退出程序
  process.exit(0);
}

// 加载路由表
const routingTable = PipelineTableLoader.loadPipelineTable(targetConfig);

// 创建路由器实例
const router = new PipelineRouter(routingTable);

// 定义测试输入
const testInputs = [
  'default',
  'coding',
  'reasoning',
  'longContext'
];

// 执行测试并收集结果
const results: any[] = [];

for (const input of testInputs) {
  const decision = router.route(input);
  results.push({
    inputModel: input,
    virtualModel: decision.virtualModel,
    availablePipelines: decision.availablePipelines.length,
    reasoning: decision.reasoning
  });
}

// 生成报告
const report = {
  timestamp: new Date().toISOString(),
  config: targetConfig,
  testResults: results
};

// 保存报告
fs.writeFileSync(
  path.join(outputDir, 'router-test-results.json'),
  JSON.stringify(report, null, 2)
);

// 生成摘要
let summary = `路由器测试结果摘要\n`;
summary += `==================\n`;
summary += `测试时间: ${report.timestamp}\n`;
summary += `配置文件: ${report.config}\n\n`;

summary += `测试结果:\n`;
summary += `---------\n`;
for (const result of report.testResults) {
  summary += `${result.inputModel} → ${result.virtualModel} (${result.availablePipelines} 个流水线)\n`;
  summary += `  理由: ${result.reasoning}\n\n`;
}

fs.writeFileSync(
  path.join(outputDir, 'router-test-summary.txt'),
  summary
);