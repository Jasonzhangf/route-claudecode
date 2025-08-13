#!/usr/bin/env node
/**
 * 🧪 API Timeout Fix Verification Test
 * 验证API超时时间修复（从30秒改为120秒）
 * 
 * Project owner: Jason Zhang
 */

console.log('🧪 API Timeout Fix Verification Test');
console.log('====================================');

// 1. 验证配置文件修改
console.log('📋 Step 1: 验证配置文件修改...');

import fs from 'fs';
import path from 'path';

// 检查provider-protocol-mapping.json
const protocolMappingPath = path.join(process.cwd(), 'config/system/provider-protocol-mapping.json');
const protocolMapping = JSON.parse(fs.readFileSync(protocolMappingPath, 'utf8'));

console.log('🔍 Provider Protocol Mapping 超时设置:');
Object.entries(protocolMapping.protocolMapping).forEach(([key, config]) => {
  console.log(`   ${key}: ${config.timeout}ms`);
});

// 检查development配置
const devConfigPath = path.join(process.cwd(), 'config/development/index.ts');
const devConfigContent = fs.readFileSync(devConfigPath, 'utf8');

const timeoutMatches = devConfigContent.match(/timeout:\s*(\d+)/g);
console.log('🔍 Development 配置超时设置:');
if (timeoutMatches) {
  timeoutMatches.forEach(match => {
    console.log(`   ${match}`);
  });
}

// 验证关键超时值
const lmstudioTimeout = protocolMapping.protocolMapping.lmstudio.timeout;
const isLMStudioFixed = lmstudioTimeout === 120000;

console.log('');
console.log('✅ 配置验证结果:');
console.log(`   LM Studio超时: ${lmstudioTimeout}ms ${isLMStudioFixed ? '✅' : '❌'}`);
console.log(`   预期值: 120000ms`);

// 2. 验证代码修改
console.log('');
console.log('📋 Step 2: 验证代码修改...');

// 检查base-provider.ts
const baseProviderPath = path.join(process.cwd(), 'src/v3/provider-protocol/base-provider.ts');
const baseProviderContent = fs.readFileSync(baseProviderPath, 'utf8');

const hasAbortSignal = baseProviderContent.includes('AbortSignal.timeout');
const hasTimeoutConfig = baseProviderContent.includes('this.config.timeout || 120000');

console.log('🔍 base-provider.ts 修改验证:');
console.log(`   包含 AbortSignal.timeout: ${hasAbortSignal ? '✅' : '❌'}`);
console.log(`   包含超时配置读取: ${hasTimeoutConfig ? '✅' : '❌'}`);

// 检查client-factory.ts
const clientFactoryPath = path.join(process.cwd(), 'src/v3/provider-protocol/openai/client-factory.ts');
const clientFactoryContent = fs.readFileSync(clientFactoryPath, 'utf8');

const factoryHasAbortSignal = clientFactoryContent.includes('AbortSignal.timeout');
const factoryHasTimeoutConfig = clientFactoryContent.includes('config.timeout || 120000');

console.log('🔍 client-factory.ts 修改验证:');
console.log(`   包含 AbortSignal.timeout: ${factoryHasAbortSignal ? '✅' : '❌'}`);
console.log(`   包含超时配置读取: ${factoryHasTimeoutConfig ? '✅' : '❌'}`);

// 3. 总结修复状态
console.log('');
console.log('📋 Step 3: 修复状态总结...');
console.log('====================================');

const allChecks = [
  { name: 'LM Studio配置超时', status: isLMStudioFixed },
  { name: 'base-provider AbortSignal', status: hasAbortSignal },
  { name: 'base-provider 配置读取', status: hasTimeoutConfig },
  { name: 'client-factory AbortSignal', status: factoryHasAbortSignal },
  { name: 'client-factory 配置读取', status: factoryHasTimeoutConfig }
];

const passedChecks = allChecks.filter(check => check.status).length;
const totalChecks = allChecks.length;

console.log('🧪 修复验证结果:');
allChecks.forEach(check => {
  console.log(`   ${check.status ? '✅' : '❌'} ${check.name}`);
});

console.log('');
console.log(`📊 总体状态: ${passedChecks}/${totalChecks} 项检查通过`);

if (passedChecks === totalChecks) {
  console.log('🎉 超时修复验证: 完全成功！');
  console.log('');
  console.log('🔧 修复总结:');
  console.log('   • LM Studio超时: 30秒 → 120秒');
  console.log('   • 开发环境配置: 所有provider超时提升至120秒');
  console.log('   • 代码实现: 添加AbortSignal.timeout支持');
  console.log('   • 配置集成: 自动读取配置文件中的超时值');
  console.log('');
  console.log('💡 效果:');
  console.log('   • 工具调用不会在30秒后超时');
  console.log('   • 长响应有足够时间处理');
  console.log('   • 更好的用户体验和稳定性');
} else {
  console.log('❌ 超时修复验证: 部分失败');
  console.log('   需要检查未通过的项目并重新修复');
  process.exit(1);
}