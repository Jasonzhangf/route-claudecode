#!/usr/bin/env node

/**
 * ModelScope和ShuaiHong Provider v3.0集成测试
 * 验证配置合规性和功能正确性
 * @author Jason Zhang
 * @version v3.0-integration-test
 */

import fs from 'fs';
import path from 'path';

const testResults = {
  modelscope: { passed: 0, failed: 0, tests: [] },
  shuaihong: { passed: 0, failed: 0, tests: [] }
};

console.log('🧪 ModelScope和ShuaiHong Provider v3.0集成测试');
console.log('=' * 60);

/**
 * 测试辅助函数
 */
function runTest(provider, testName, testFunction) {
  try {
    const result = testFunction();
    if (result === true || result?.success === true) {
      testResults[provider].passed++;
      testResults[provider].tests.push({ name: testName, status: '✅ PASS', details: result?.details || 'Test passed' });
      console.log(`✅ ${provider.toUpperCase()}: ${testName} - PASS`);
    } else {
      testResults[provider].failed++;
      testResults[provider].tests.push({ name: testName, status: '❌ FAIL', details: result?.details || 'Test failed' });
      console.log(`❌ ${provider.toUpperCase()}: ${testName} - FAIL: ${result?.details || 'Unknown failure'}`);
    }
  } catch (error) {
    testResults[provider].failed++;
    testResults[provider].tests.push({ name: testName, status: '❌ ERROR', details: error.message });
    console.log(`❌ ${provider.toUpperCase()}: ${testName} - ERROR: ${error.message}`);
  }
}

/**
 * 1. 测试ModelScope配置
 */
console.log('\n📋 1. ModelScope v3.0配置合规性测试');
console.log('-'.repeat(40));

const modelScopeConfigPath = '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-openai-modelscope-v3-5507.json';
let modelScopeConfig;

runTest('modelscope', '配置文件存在性', () => {
  return fs.existsSync(modelScopeConfigPath);
});

runTest('modelscope', '配置文件加载', () => {
  modelScopeConfig = JSON.parse(fs.readFileSync(modelScopeConfigPath, 'utf8'));
  return { success: true, details: `Config loaded: ${modelScopeConfig.name}` };
});

runTest('modelscope', 'v3.0版本验证', () => {
  return modelScopeConfig?.version === '3.0.0' && modelScopeConfig?.server?.architecture === 'v3.0';
});

runTest('modelscope', '六层架构配置', () => {
  const layers = modelScopeConfig?.layers;
  const requiredLayers = ['client', 'router', 'postProcessor', 'transformer', 'providerProtocol', 'preprocessor', 'server'];
  const hasAllLayers = requiredLayers.every(layer => layers?.[layer]?.enabled === true);
  return { success: hasAllLayers, details: `Layers enabled: ${Object.keys(layers || {})}` };
});

runTest('modelscope', '零硬编码合规性', () => {
  const governance = modelScopeConfig?.governance;
  return governance?.complianceRules?.includes('zero-hardcoding') && governance?.complianceRules?.includes('zero-fallback');
});

runTest('modelscope', 'Preprocessing-Only修改', () => {
  const governance = modelScopeConfig?.governance;
  return governance?.complianceRules?.includes('preprocessing-only-modifications');
});

runTest('modelscope', 'ModelScope特定配置', () => {
  const provider = modelScopeConfig?.providers?.['modelscope-openai-v3'];
  return provider?.preprocessing?.preprocessorClass === 'ModelScopePreprocessor' &&
         provider?.preprocessing?.compatibility?.glmFormat === true &&
         provider?.preprocessing?.regionSpecific?.chinaApiOptimizations === true;
});

runTest('modelscope', 'Patch系统配置', () => {
  const provider = modelScopeConfig?.providers?.['modelscope-openai-v3'];
  const patches = provider?.patchSystem?.patches;
  return patches?.includes('ModelScopeFinishReasonPatch') && patches?.includes('GLMToolCallTextFixPatch');
});

/**
 * 2. 测试ShuaiHong配置
 */
console.log('\n📋 2. ShuaiHong v3.0配置合规性测试');
console.log('-'.repeat(40));

const shuaiHongConfigPath = '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-openai-shuaihong-v3-5508.json';
let shuaiHongConfig;

runTest('shuaihong', '配置文件存在性', () => {
  return fs.existsSync(shuaiHongConfigPath);
});

runTest('shuaihong', '配置文件加载', () => {
  shuaiHongConfig = JSON.parse(fs.readFileSync(shuaiHongConfigPath, 'utf8'));
  return { success: true, details: `Config loaded: ${shuaiHongConfig.name}` };
});

runTest('shuaihong', 'v3.0版本验证', () => {
  return shuaiHongConfig?.version === '3.0.0' && shuaiHongConfig?.server?.architecture === 'v3.0';
});

runTest('shuaihong', '六层架构配置', () => {
  const layers = shuaiHongConfig?.layers;
  const requiredLayers = ['client', 'router', 'postProcessor', 'transformer', 'providerProtocol', 'preprocessor', 'server'];
  const hasAllLayers = requiredLayers.every(layer => layers?.[layer]?.enabled === true);
  return { success: hasAllLayers, details: `Layers enabled: ${Object.keys(layers || {})}` };
});

runTest('shuaihong', '零硬编码合规性', () => {
  const governance = shuaiHongConfig?.governance;
  return governance?.complianceRules?.includes('zero-hardcoding') && governance?.complianceRules?.includes('zero-fallback');
});

runTest('shuaihong', 'Preprocessing-Only修改', () => {
  const governance = shuaiHongConfig?.governance;
  return governance?.complianceRules?.includes('preprocessing-only-modifications');
});

runTest('shuaihong', 'ShuaiHong特定配置', () => {
  const provider = shuaiHongConfig?.providers?.['shuaihong-openai-v3'];
  return provider?.preprocessing?.preprocessorClass === 'OpenAICompatiblePreprocessor' &&
         provider?.endpoint === 'https://ai.shuaihong.fun/v1/chat/completions' &&
         provider?.capabilities?.multimodal === true;
});

runTest('shuaihong', 'Patch系统配置', () => {
  const provider = shuaiHongConfig?.providers?.['shuaihong-openai-v3'];
  const patches = provider?.patchSystem?.patches;
  return patches?.includes('OpenAIToolFormatFixPatch') && patches?.includes('AnthropicToolCallTextFixPatch');
});

runTest('shuaihong', '多模型支持配置', () => {
  const provider = shuaiHongConfig?.providers?.['shuaihong-openai-v3'];
  const models = provider?.models;
  return models?.includes('claude-4-sonnet') && models?.includes('gemini-2.5-pro') && models?.includes('DeepSeek-V3');
});

/**
 * 3. 配置对比测试
 */
console.log('\n📋 3. 配置架构一致性测试');
console.log('-'.repeat(40));

runTest('modelscope', '配置架构一致性', () => {
  const msLayers = Object.keys(modelScopeConfig?.layers || {});
  const shLayers = Object.keys(shuaiHongConfig?.layers || {});
  const consistent = msLayers.length === shLayers.length && msLayers.every(layer => shLayers.includes(layer));
  return { success: consistent, details: `MS layers: ${msLayers.length}, SH layers: ${shLayers.length}` };
});

runTest('shuaihong', 'Debug配置一致性', () => {
  const msDebug = modelScopeConfig?.debug;
  const shDebug = shuaiHongConfig?.debug;
  return msDebug?.ioRecording?.enabled === shDebug?.ioRecording?.enabled &&
         msDebug?.performanceMetrics?.enabled === shDebug?.performanceMetrics?.enabled;
});

/**
 * 4. 总结测试结果
 */
console.log('\n📊 测试结果总结');
console.log('='.repeat(60));

console.log(`\n🔬 ModelScope v3.0测试结果:`);
console.log(`   ✅ 通过: ${testResults.modelscope.passed}`);
console.log(`   ❌ 失败: ${testResults.modelscope.failed}`);
console.log(`   📊 通过率: ${(testResults.modelscope.passed / (testResults.modelscope.passed + testResults.modelscope.failed) * 100).toFixed(1)}%`);

console.log(`\n🔬 ShuaiHong v3.0测试结果:`);
console.log(`   ✅ 通过: ${testResults.shuaihong.passed}`);
console.log(`   ❌ 失败: ${testResults.shuaihong.failed}`);
console.log(`   📊 通过率: ${(testResults.shuaihong.passed / (testResults.shuaihong.passed + testResults.shuaihong.failed) * 100).toFixed(1)}%`);

const totalPassed = testResults.modelscope.passed + testResults.shuaihong.passed;
const totalFailed = testResults.modelscope.failed + testResults.shuaihong.failed;
const overallPassRate = (totalPassed / (totalPassed + totalFailed) * 100).toFixed(1);

console.log(`\n🎯 总体测试结果:`);
console.log(`   ✅ 总通过: ${totalPassed}`);
console.log(`   ❌ 总失败: ${totalFailed}`);
console.log(`   📊 总通过率: ${overallPassRate}%`);

if (overallPassRate >= 95) {
  console.log('\n🎉 集成测试通过！两个provider的v3.0配置完全符合架构规范。');
} else if (overallPassRate >= 80) {
  console.log('\n⚠️ 集成测试基本通过，但存在一些需要优化的地方。');
} else {
  console.log('\n❌ 集成测试失败，需要修复配置问题后重新测试。');
}

// 保存测试结果到文件
const reportPath = `test-output-modelscope-shuaihong-integration-${Date.now()}.json`;
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  testType: 'provider-integration-v3.0',
  providers: ['modelscope', 'shuaihong'],
  results: testResults,
  summary: {
    totalTests: totalPassed + totalFailed,
    totalPassed,
    totalFailed,
    overallPassRate: parseFloat(overallPassRate)
  }
}, null, 2));

console.log(`\n📄 详细测试报告已保存: ${reportPath}`);

process.exit(totalFailed === 0 ? 0 : 1);